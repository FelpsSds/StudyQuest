from pydantic import BaseModel, Field, field_validator


class UserBase(BaseModel):
    name: str
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Invalid email format")
        return value.lower()


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    level: int = 1
    xp: int = 0

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be blank")
        return normalized
