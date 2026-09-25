from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.quest import QuestDifficulty, QuestStatus, QuestType


class QuestBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    type: QuestType = QuestType.STUDY
    difficulty: QuestDifficulty = QuestDifficulty.MEDIUM
    xp_reward: int = Field(default=0, ge=0)
    boss_damage: int = Field(default=10, ge=0)
    estimated_minutes: int = 30
    status: QuestStatus = QuestStatus.PENDING
    due_date: date | None = None
    subject_id: int | None = None
    boss_fight_id: int | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized


class QuestCreate(QuestBase):
    pass


class QuestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    type: QuestType | None = None
    difficulty: QuestDifficulty | None = None
    xp_reward: int | None = Field(default=None, ge=0)
    boss_damage: int | None = Field(default=None, ge=0)
    estimated_minutes: int | None = None
    status: QuestStatus | None = None
    due_date: date | None = None
    subject_id: int | None = None
    boss_fight_id: int | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized


class QuestRead(QuestBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int


class QuestCompleteRequest(BaseModel):
    notes: str | None = None
