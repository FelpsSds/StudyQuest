from pydantic import BaseModel, ConfigDict


class SubjectBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    professor: str | None = None
    semester: str | None = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(SubjectBase):
    pass


class SubjectRead(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
