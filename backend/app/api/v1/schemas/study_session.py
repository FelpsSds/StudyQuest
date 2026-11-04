from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StudySessionBase(BaseModel):
    subject_id: int | None = None
    quest_id: int | None = None
    duration_minutes: int | None = None
    status: str = "in_progress"


class StudySessionCreate(StudySessionBase):
    duration_minutes: int | None = Field(default=None, ge=15)
    status: Literal["in_progress"] = "in_progress"


class StudySessionRead(StudySessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    started_at: datetime
    ended_at: datetime | None = None
    duration_minutes: int | None = None
