from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubjectBase(BaseModel):
    name: str = Field(max_length=120)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=32)
    icon: str | None = Field(default=None, max_length=64)
    professor: str | None = Field(default=None, max_length=120)
    semester: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be blank")
        return normalized


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(SubjectBase):
    pass


class SubjectRead(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
