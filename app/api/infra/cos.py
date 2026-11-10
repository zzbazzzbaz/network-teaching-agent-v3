"""腾讯云 COS 网关: 只负责签名与对象元数据操作, 不中转文件内容。"""

import asyncio
from urllib.parse import quote

from qcloud_cos import CosConfig, CosS3Client, CosServiceError

from app.shared.config import get_settings

_settings = get_settings().cos

_client = CosS3Client(
    CosConfig(
        Region=_settings.region,
        SecretId=_settings.secret_id,
        SecretKey=_settings.secret_key,
        Scheme="https",
    )
)


def upload_url(key: str, content_type: str) -> str:
    return _client.get_presigned_url(
        Bucket=_settings.bucket,
        Key=key,
        Method="PUT",
        Expired=_settings.upload_expires,
        Headers={"Content-Type": content_type},
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


async def object_size(key: str) -> int | None:
    def _head() -> int | None:
        try:
            response = _client.head_object(Bucket=_settings.bucket, Key=key)
        except CosServiceError as exc:
            if exc.get_status_code() == 404:
                return None
            raise
        return int(response["Content-Length"])

    return await asyncio.to_thread(_head)


async def delete_object(key: str) -> None:
    def _delete() -> None:
        try:
            _client.delete_object(Bucket=_settings.bucket, Key=key)
        except CosServiceError as exc:
            if exc.get_status_code() != 404:
                raise

    await asyncio.to_thread(_delete)


async def put_object(key: str, content: bytes, content_type: str) -> None:
    def _put() -> None:
        _client.put_object(
            Bucket=_settings.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    await asyncio.to_thread(_put)
