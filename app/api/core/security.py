"""密码哈希与 JWT 令牌。"""

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import jwt

from app.shared.config import get_settings

_ALGORITHM = "HS256"

DEFAULT_PASSWORD_SUFFIX = "000000"

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenError(Exception):
    """令牌缺失、过期、类型不符或内容非法。"""


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def default_password(username: str) -> str:
    return f"{username}{DEFAULT_PASSWORD_SUFFIX}"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = password_hash.split("$")
        if scheme != "scrypt":
            return False
        expected = _unb64(digest)
        actual = hashlib.scrypt(
            password.encode(),
            salt=_unb64(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except ValueError, TypeError:
        return False
    return hmac.compare_digest(actual, expected)


def create_token(subject: uuid.UUID, token_type: TokenType) -> tuple[str, int]:
    settings = get_settings().jwt
    now = datetime.now(UTC)
    if token_type is TokenType.ACCESS:
        expires_in = settings.access_token_minutes * 60
    else:
        expires_in = settings.refresh_token_days * 24 * 3600
    payload = {
        "sub": str(subject),
        "type": token_type.value,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)
    return token, expires_in


def decode_token(token: str, expected: TokenType) -> uuid.UUID:
    try:
        payload = jwt.decode(token, get_settings().jwt.secret_key, algorithms=[_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise TokenError from exc
    if payload.get("type") != expected.value:
        raise TokenError
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise TokenError from exc
