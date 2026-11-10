import asyncio
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from qcloud_cos import CosConfig, CosS3Client, CosServiceError

READ_CHUNK = 1 << 20


@dataclass(frozen=True, slots=True)
class ObjectMeta:
    size: int
    content_type: str | None


def build_client(*, region: str, secret_id: str, secret_key: str) -> CosS3Client:
    return CosS3Client(
        CosConfig(
            Region=region,
            SecretId=secret_id,
            SecretKey=secret_key,
            Scheme="https",
        )
    )


def _is_not_found(exc: CosServiceError) -> bool:
    return exc.get_status_code() == 404


async def head_object(
    client: CosS3Client,
    bucket: str,
    key: str,
) -> ObjectMeta | None:
    def _head() -> ObjectMeta | None:
        try:
            response = client.head_object(Bucket=bucket, Key=key)
        except CosServiceError as exc:
            if _is_not_found(exc):
                return None
            raise
        return ObjectMeta(
            size=int(response["Content-Length"]),
            content_type=response.get("Content-Type"),
        )

    return await asyncio.to_thread(_head)


class COSReader:
    def __init__(self, body: Any) -> None:
        self._body = body

    async def read(self, n: int = -1) -> bytes:
        if n < 0:
            buffer = bytearray()
            while True:
                chunk = await self.read(READ_CHUNK)
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


@asynccontextmanager
async def open_object(
    client: CosS3Client,
    bucket: str,
    key: str,
) -> AsyncGenerator[COSReader]:
    try:
        response = await asyncio.to_thread(
            client.get_object,
            Bucket=bucket,
            Key=key,
        )
    except CosServiceError as exc:
        if _is_not_found(exc):
            raise FileNotFoundError(key) from exc
        raise
    body = response["Body"]
    try:
        yield COSReader(body)
    finally:
        raw = body.get_raw_stream()
        await asyncio.to_thread(raw.close)


async def iter_object(
    client: CosS3Client,
    bucket: str,
    key: str,
) -> AsyncIterator[bytes]:
    async with open_object(client, bucket, key) as reader:
        while True:
            chunk = await reader.read(READ_CHUNK)
            if not chunk:
                break
            yield chunk


async def delete_object(
    client: CosS3Client,
    bucket: str,
    key: str,
) -> None:
    def _delete() -> None:
        try:
            client.delete_object(Bucket=bucket, Key=key)
        except CosServiceError as exc:
            if not _is_not_found(exc):
                raise

    await asyncio.to_thread(_delete)
