import uuid

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.shared.enums import UserRole, UserStatus


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    status: UserStatus
    role: UserRole
    created_at: AwareDatetime
