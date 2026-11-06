import json
from typing import Any

from fastapi import HTTPException, status


class RemoteServiceError(Exception):
    def __init__(self, status_code: int, detail: str = "") -> None:
        super().__init__(detail or f"remote service returned {status_code}")
        self.status_code = status_code
        self.detail = detail


class RemoteServiceUnavailableError(RemoteServiceError):
    def __init__(self, detail: str = "remote service unreachable") -> None:
        super().__init__(status_code=503, detail=detail)


def detail_from_payload(payload: Any) -> str:
    if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
        return payload["detail"]
    return ""


def detail_from_body(body: bytes) -> str:
    try:
        payload = json.loads(body)
    except ValueError:
        return ""
    return detail_from_payload(payload)


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="未认证或登录已过期",
        headers={"WWW-Authenticate": "Bearer"},
    )


def forbidden() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无访问权限")


def not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资源不存在")


def bad_request() -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请求无法完成")


def conflict() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="上一条消息仍在生成中",
    )


def service_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="对话服务暂不可用",
    )


def memory_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="记忆服务暂不可用",
    )
