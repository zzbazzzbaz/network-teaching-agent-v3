from fastapi import HTTPException, status


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
