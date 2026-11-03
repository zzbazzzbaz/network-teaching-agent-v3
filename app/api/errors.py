"""对外错误响应的统一构造。"""

from fastapi import HTTPException, status


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="未认证或登录已过期",
        headers={"WWW-Authenticate": "Bearer"},
    )


def forbidden() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无访问权限")
