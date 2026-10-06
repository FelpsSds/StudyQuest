from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.achievement import AchievementProgressRead, AchievementRead
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
        },
        {
            "code": "quest_streak_5",
            "title": "Ritmo constante",
            "description": "Complete 5 missões.",
            "icon": "⚔️",
            "criteria_type": "quests_completed",
            "criteria_value": 5,
        },
        {
            "code": "quest_master_10",
            "title": "Mestre das missões",
            "description": "Complete 10 missões.",
            "icon": "🌟",
            "criteria_type": "quests_completed",
            "criteria_value": 10,
        },
    ]

    for payload in defaults:
        existing = db.query(Achievement).filter(Achievement.code == payload["code"]).first()
        if not existing:
            db.add(Achievement(**payload))
    db.commit()


def _award_achievement_if_needed(db: Session, user: User) -> list[Achievement]:
    ensure_default_achievements(db)
    quest_count = db.query(QuestCompletion).filter(QuestCompletion.user_id == user.id).count()
    existing_ids = {
        item.achievement_id
        for item in db.query(UserAchievement).filter(UserAchievement.user_id == user.id).all()
    }
    unlocked = []
    for achievement in db.query(Achievement).order_by(Achievement.id.asc()).all():
        if achievement.id in existing_ids:
            continue
        if achievement.criteria_type == "quests_completed" and quest_count >= achievement.criteria_value:
            db.add(UserAchievement(user_id=user.id, achievement_id=achievement.id))
            unlocked.append(achievement)

    if unlocked:
        db.commit()

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


@router.get("/progress", response_model=list[AchievementProgressRead])
def list_achievement_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    quest_count = db.query(QuestCompletion).filter(QuestCompletion.user_id == current_user.id).count()
    unlocked_records = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    )
    unlocked_by_id = {record.achievement_id: record for record in unlocked_records}
    achievements = db.query(Achievement).order_by(Achievement.criteria_value.asc(), Achievement.id.asc()).all()
    progress = []

    for achievement in achievements:
        if achievement.criteria_type == "quests_completed":
            current = quest_count
        else:
            current = 0
        unlocked = unlocked_by_id.get(achievement.id)
        progress.append(
            {
                "id": achievement.id,
                "code": achievement.code,
                "title": achievement.title,
                "description": achievement.description,
                "icon": achievement.icon,
                "criteria_type": achievement.criteria_type,
                "criteria_value": achievement.criteria_value,
                "current_value": min(current, achievement.criteria_value),
                "unlocked": unlocked is not None,
                "unlocked_at": unlocked.unlocked_at if unlocked else None,
            }
        )

    return progress


def award_achievement_for_quest_completion(db: Session, user: User) -> list[Achievement]:
    return _award_achievement_if_needed(db, user)
