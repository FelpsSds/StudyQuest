from pydantic import BaseModel, Field, field_validator


def _validate_password_length(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password cannot exceed 72 UTF-8 bytes")
    return value


class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_length(value)


class RegisterRequest(BaseModel):
    name: str = Field(max_length=120)
    email: str = Field(max_length=255)
    password: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be blank")
        return normalized

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_length(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: dict
    access_token: str
    token_type: str = "bearer"
