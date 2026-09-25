from pydantic import BaseModel, ConfigDict, field_validator


class SubjectBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    professor: str | None = None
    semester: str | None = None

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
