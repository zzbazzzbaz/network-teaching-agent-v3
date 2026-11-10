import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from typing import IO, Any

from agentscope.app.rag.blob_store import AsyncReadable, BlobStoreBase
from qcloud_cos import CosConfig, CosS3Client, CosServiceError

from app.shared import storage_keys

_SCHEME = "cos://"
_PART_SIZE = 8 << 20
_READ_CHUNK = 1 << 20


def _parse_key(key: str) -> tuple[str, str]:
    parts = key.split("/")
    if len(parts) != 3 or parts[0] != "kb" or not parts[1] or not parts[2]:
        raise ValueError(f"Invalid knowledge blob key: {key!r}")
    storage_keys.knowledge_key(parts[1], parts[2])
    return parts[1], parts[2]


class _COSReader:
    def __init__(self, body: Any) -> None:
        self._body = body

    async def read(self, n: int = -1) -> bytes:
        if n < 0:
            buffer = bytearray()
            while True:
                chunk = await self.read(_READ_CHUNK)
                if not chunk:
                    break
                buffer.extend(chunk)
            return bytes(buffer)
        data = await asyncio.to_thread(self._body.read, n)
        if not data:
            return b""
        if isinstance(data, str):
            return data.encode()
        return data


class COSBlobStore(BlobStoreBase):
    def __init__(
        self,
        *,
        bucket: str,
        region: str,
        secret_id: str,
        secret_key: str,
    ) -> None:
        self._bucket = bucket
        self._client = CosS3Client(
            CosConfig(
                Region=region,
                SecretId=secret_id,
                SecretKey=secret_key,
                Scheme="https",
            )
        )

    def _cos_key(self, key: str) -> str:
        knowledge_base_id, document_id = _parse_key(key)
        return storage_keys.knowledge_key(knowledge_base_id, document_id)

    def _key_from_uri(self, uri: str) -> str:
        if not uri.startswith(_SCHEME):
            raise ValueError(f"Not a COS blob URI: {uri!r}")
        bucket, _, key = uri[len(_SCHEME) :].partition("/")
        if bucket != self._bucket:
            raise ValueError(f"Bucket {bucket!r} is not the configured bucket")
        prefix = f"{storage_keys.KNOWLEDGE_PREFIX}/"
        if not key.startswith(prefix):
            raise ValueError(f"COS blob URI is outside {prefix}: {uri!r}")
        return key

    def _write_sync(self, key: str, stream: IO[bytes]) -> None:
        upload_id: str | None = None
        try:
            created = self._client.create_multipart_upload(
                Bucket=self._bucket,
                Key=key,
            )
            upload_id = created["UploadId"]
            parts: list[dict[str, object]] = []
            number = 1
            while True:
                chunk = stream.read(_PART_SIZE)
                if not chunk:
                    break
                if isinstance(chunk, str):
                    chunk = chunk.encode()
                response = self._client.upload_part(
                    Bucket=self._bucket,
                    Key=key,
                    Body=chunk,
                    PartNumber=number,
                    UploadId=upload_id,
                )
                parts.append({"PartNumber": number, "ETag": response["ETag"]})
                number += 1
            if not parts:
                with suppress(Exception):
                    self._client.abort_multipart_upload(
                        Bucket=self._bucket,
                        Key=key,
                        UploadId=upload_id,
                    )
                upload_id = None
                self._client.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=b"",
                )
            else:
                self._client.complete_multipart_upload(
                    Bucket=self._bucket,
                    Key=key,
                    UploadId=upload_id,
                    MultipartUpload={"Part": parts},
                )
                upload_id = None
        finally:
            if upload_id is not None:
                with suppress(Exception):
                    self._client.abort_multipart_upload(
                        Bucket=self._bucket,
                        Key=key,
                        UploadId=upload_id,
                    )

    async def write_stream(self, key: str, stream: IO[bytes]) -> str:
        cos_key = self._cos_key(key)
        await asyncio.to_thread(self._write_sync, cos_key, stream)
        return f"{_SCHEME}{self._bucket}/{cos_key}"

    @asynccontextmanager
    async def open(self, uri: str) -> AsyncGenerator[AsyncReadable]:
        key = self._key_from_uri(uri)
        try:
            response = await asyncio.to_thread(
                self._client.get_object,
                Bucket=self._bucket,
                Key=key,
            )
        except CosServiceError as exc:
            if exc.get_status_code() == 404:
                raise FileNotFoundError(uri) from exc
            raise
        body = response["Body"]
        try:
            yield _COSReader(body)
        finally:
            raw = body.get_raw_stream()
            await asyncio.to_thread(raw.close)

    async def size(self, uri: str) -> int | None:
        key = self._key_from_uri(uri)

        def _head() -> int | None:
            try:
                response = self._client.head_object(
                    Bucket=self._bucket,
                    Key=key,
                )
            except CosServiceError as exc:
                if exc.get_status_code() == 404:
                    return None
                raise
            return int(response["Content-Length"])

        return await asyncio.to_thread(_head)

    async def delete(self, uri: str) -> None:
        key = self._key_from_uri(uri)

        def _delete() -> None:
            try:
                self._client.delete_object(
                    Bucket=self._bucket,
                    Key=key,
                )
            except CosServiceError as exc:
                if exc.get_status_code() != 404:
                    raise

        await asyncio.to_thread(_delete)

    async def exists(self, uri: str) -> bool:
        return await self.size(uri) is not None
