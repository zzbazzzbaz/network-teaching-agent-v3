import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from urllib.parse import quote

from qcloud_cos import CosConfig, CosS3Client, CosServiceError

from app.shared.config import get_settings

_STREAM_CHUNK = 1 << 20

_settings = get_settings().cos

_client = CosS3Client(
    CosConfig(
        Region=_settings.region,
        SecretId=_settings.secret_id,
        SecretKey=_settings.secret_key,
        Scheme="https",
    )
)


@dataclass(frozen=True, slots=True)
class ObjectMeta:
    size: int
    content_type: str | None


def upload_url(key: str, headers: dict[str, str]) -> str:
    return _client.get_presigned_url(
        Bucket=_settings.bucket,
        Key=key,
        Method="PUT",
        Expired=_settings.upload_expires,
        Headers=headers,
    )


def download_url(key: str, filename: str, content_type: str, *, inline: bool) -> str:
    disposition = "inline" if inline else "attachment"
    return _client.get_presigned_url(
        Bucket=_settings.bucket,
        Key=key,
        Method="GET",
        Expired=_settings.download_expires,
        Params={
            "response-content-disposition": (
                f"{disposition}; filename*=UTF-8''{quote(filename, safe='')}"
            ),
            "response-content-type": content_type,
        },
    )


async def object_meta(key: str) -> ObjectMeta | None:
    def _head() -> ObjectMeta | None:
        try:
            response = _client.head_object(Bucket=_settings.bucket, Key=key)
        except CosServiceError as exc:
            if exc.get_status_code() == 404:
                return None
            raise
        return ObjectMeta(
            size=int(response["Content-Length"]),
            content_type=response.get("Content-Type"),
        )

    return await asyncio.to_thread(_head)


async def object_size(key: str) -> int | None:
    meta = await object_meta(key)
    return meta.size if meta is not None else None


async def iter_object(key: str) -> AsyncIterator[bytes]:
    try:
        response = await asyncio.to_thread(
            _client.get_object,
            Bucket=_settings.bucket,
            Key=key,
        )
    except CosServiceError as exc:
        if exc.get_status_code() == 404:
            raise FileNotFoundError(key) from exc
        raise

    body = response["Body"]
    try:
        while True:
            chunk = await asyncio.to_thread(body.read, _STREAM_CHUNK)
            if not chunk:
                break
            if isinstance(chunk, str):
                chunk = chunk.encode()
            yield chunk
    finally:
        raw = body.get_raw_stream()
        await asyncio.to_thread(raw.close)


async def delete_object(key: str) -> None:
    def _delete() -> None:
        try:
            _client.delete_object(Bucket=_settings.bucket, Key=key)
        except CosServiceError as exc:
            if exc.get_status_code() != 404:
                raise

    await asyncio.to_thread(_delete)


async def put_object(
    key: str,
    content: bytes,
    content_type: str,
    *,
    cache_control: str | None = None,
) -> None:
    def _put() -> None:
        kwargs: dict[str, str] = {"ContentType": content_type}
        if cache_control:
            kwargs["CacheControl"] = cache_control
        _client.put_object(
            Bucket=_settings.bucket,
            Key=key,
            Body=content,
            **kwargs,
        )

    await asyncio.to_thread(_put)
