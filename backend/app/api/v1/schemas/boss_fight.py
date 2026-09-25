from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BossFightBase(BaseModel):
    subject_id: int
    title: str = Field(..., min_length=1, max_length=200)
    hp_max: int = Field(default=100, gt=0)
    hp_current: int = Field(default=100, ge=0)
    xp_reward: int = Field(default=200, ge=0)
    status: Literal["active", "completed"] = "active"

    @model_validator(mode="after")
    def validate_hit_points(self) -> "BossFightBase":
        if self.hp_current > self.hp_max:
            raise ValueError("hp_current cannot be greater than hp_max")
        if self.status == "completed" and self.hp_current != 0:
            raise ValueError("A completed boss fight must have zero HP")
        return self


class BossFightCreate(BossFightBase):
    pass


class BossFightRead(BossFightBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    completed_at: datetime | None = None
