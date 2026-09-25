from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.achievement import AchievementRead
from app.core.security import get_current_user
from app.models.achievement import Achievement
from app.models.quest import Quest
from app.models.quest_completion import QuestCompletion
from app.models.user import User
from app.models.user_achievement import UserAchievement

router = APIRouter(prefix="/achievements", tags=["achievements"])


def ensure_default_achievements(db: Session) -> None:
    defaults = [
        {
            "code": "first_quest",
            "title": "Primeira missão",
            "description": "Complete sua primeira missão.",
            "icon": "🏆",
            "criteria_type": "quests_completed",
            "criteria_value": 1,
        }
    ]

    for payload in defaults:
        existing = db.query(Achievement).filter(Achievement.code == payload["code"]).first()
        if not existing:
            db.add(Achievement(**payload))
    db.commit()


def _award_achievement_if_needed(db: Session, user: User) -> list[Achievement]:
    ensure_default_achievements(db)
    unlocked: list[Achievement] = []

    first_quest_achievement = (
        db.query(Achievement).filter(Achievement.code == "first_quest").first()
    )
    if first_quest_achievement:
        quest_count = (
            db.query(QuestCompletion)
            .filter(QuestCompletion.user_id == user.id)
            .count()
        )
        if quest_count >= 1:
            existing = (
                db.query(UserAchievement)
                .filter(UserAchievement.user_id == user.id, UserAchievement.achievement_id == first_quest_achievement.id)
                .first()
            )
            if not existing:
                db.add(
                    UserAchievement(
                        user_id=user.id,
                        achievement_id=first_quest_achievement.id,
                    )
                )
                db.commit()
                unlocked.append(first_quest_achievement)

    return unlocked


@router.get("/", response_model=list[AchievementRead])
def list_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Achievement]:
    ensure_default_achievements(db)
    return db.query(Achievement).order_by(Achievement.id.asc()).all()


@router.get("/me", response_model=list[AchievementRead])
def list_user_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Achievement]:
    ensure_default_achievements(db)
    unlocked_ids = [
        item.achievement_id
        for item in db.query(UserAchievement).filter(UserAchievement.user_id == current_user.id).all()
    ]
    if not unlocked_ids:
        return []
    return db.query(Achievement).filter(Achievement.id.in_(unlocked_ids)).order_by(Achievement.id.asc()).all()


def award_achievement_for_quest_completion(db: Session, user: User) -> list[Achievement]:
    return _award_achievement_if_needed(db, user)
