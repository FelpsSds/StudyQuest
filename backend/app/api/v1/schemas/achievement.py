from pydantic import BaseModel, ConfigDict


class AchievementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    description: str
    icon: str | None = None
    criteria_type: str
    criteria_value: int
