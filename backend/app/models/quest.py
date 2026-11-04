from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class QuestType(str, Enum):
    STUDY = "study"
    EXERCISES = "exercises"
    PRACTICE = "practice"
    REVIEW = "review"
    PROJECT = "project"
    BOSS_FIGHT = "boss_fight"


class QuestDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    BOSS = "boss"


class QuestStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    boss_fight_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("boss_fights.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[QuestType] = mapped_column(SAEnum(QuestType), nullable=False, default=QuestType.STUDY)
    difficulty: Mapped[QuestDifficulty] = mapped_column(SAEnum(QuestDifficulty), nullable=False, default=QuestDifficulty.MEDIUM)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    boss_damage: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    status: Mapped[QuestStatus] = mapped_column(SAEnum(QuestStatus), nullable=False, default=QuestStatus.PENDING)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="quests")
    subject: Mapped[Optional["Subject"]] = relationship(back_populates="quests")
    boss_fight: Mapped[Optional["BossFight"]] = relationship(back_populates="quests")
    completions: Mapped[List["QuestCompletion"]] = relationship(back_populates="quest", cascade="all, delete-orphan")
    study_sessions: Mapped[List["StudySession"]] = relationship(back_populates="quest", cascade="all, delete-orphan")
