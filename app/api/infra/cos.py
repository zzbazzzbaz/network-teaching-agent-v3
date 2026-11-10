import asyncio
from collections.abc import AsyncIterator
from urllib.parse import quote

from app.shared import cos_client
from app.shared.config import get_settings
from app.shared.cos_client import ObjectMeta, build_client, head_object

_settings = get_settings().cos

_client = build_client(
    region=_settings.region,
    secret_id=_settings.secret_id,
    secret_key=_settings.secret_key,
)


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
    return await head_object(_client, _settings.bucket, key)


async def object_size(key: str) -> int | None:
    meta = await object_meta(key)
    return meta.size if meta is not None else None


async def iter_object(key: str) -> AsyncIterator[bytes]:
    async for chunk in cos_client.iter_object(_client, _settings.bucket, key):
        yield chunk


async def delete_object(key: str) -> None:
    await cos_client.delete_object(_client, _settings.bucket, key)


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
