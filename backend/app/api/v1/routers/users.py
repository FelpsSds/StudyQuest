from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.user import UserRead
from app.core.progression import progress_for_xp
from app.core.security import get_current_user
from app.core.streaks import calculate_streak
from app.models.boss_fight import BossFight
from app.models.quest import Quest
from app.models.quest_completion import QuestCompletion
from app.models.study_session import StudySession
from app.models.subject import Subject
from app.models.user import User
from app.models.xp_transaction import XPTransaction

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return db.query(User).filter(User.id == current_user.id).first()


@router.get("/dashboard")
def read_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == current_user.id).first()
    if user is None:
        raise ValueError("User not found")

    progression = progress_for_xp(user.xp)

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "level": user.level,
            "xp": user.xp,
            "streak_current": user.streak_current,
            "streak_best": user.streak_best,
            **progression,
        },
        "stats": {
            "subjects": db.query(Subject).filter(Subject.user_id == user.id).count(),
            "quests_total": db.query(Quest).filter(Quest.user_id == user.id).count(),
            "quests_completed": db.query(QuestCompletion).filter(QuestCompletion.user_id == user.id).count(),
            "boss_fights_active": db.query(BossFight)
            .filter(BossFight.user_id == user.id, BossFight.status == "active")
            .count(),
            "study_sessions_total": db.query(StudySession).filter(StudySession.user_id == user.id).count(),
        },
    }


@router.get("/leaderboard")
def read_leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    users = db.query(User).order_by(User.xp.desc(), User.level.desc(), User.id.asc()).all()
    leaderboard = []
    for index, user in enumerate(users, start=1):
        leaderboard.append(
            {
                "rank": index,
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "level": user.level,
                "xp": user.xp,
                "score": user.xp,
            }
        )
    return leaderboard


@router.get("/streak")
def read_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == current_user.id).first()
    if user is None:
        raise ValueError("User not found")

    sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == user.id)
        .order_by(StudySession.started_at.asc())
        .all()
    )

    activity_dates = set()
    for session in sessions:
        started_at = session.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        activity_dates.add(started_at.astimezone(timezone.utc).date())

    today = datetime.now(timezone.utc).date()
    current_streak, best_streak = calculate_streak(activity_dates, today)
    last_session_date = max(activity_dates).isoformat() if activity_dates else None

    user.streak_current = current_streak
    user.streak_best = max(user.streak_best, best_streak)
    db.commit()
    db.refresh(user)

    return {
        "current_streak": user.streak_current,
        "best_streak": user.streak_best,
        "last_session_date": last_session_date,
    }


@router.get("/analytics")
def read_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    completed_sessions = [session for session in sessions if session.status == "completed"]

    total_study_minutes = sum(session.duration_minutes or 0 for session in completed_sessions)
    average_session_minutes = (
        total_study_minutes / len(completed_sessions) if completed_sessions else 0
    )
    quests_completed = db.query(QuestCompletion).filter(QuestCompletion.user_id == current_user.id).count()

    return {
        "sessions_count": len(sessions),
        "completed_sessions": len(completed_sessions),
        "total_study_minutes": total_study_minutes,
        "average_session_minutes": average_session_minutes,
        "quests_completed": quests_completed,
    }


@router.get("/rewards")
def read_rewards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == current_user.id).first()
    if user is None:
        raise ValueError("User not found")

    history = []
    for transaction in (
        db.query(XPTransaction)
        .filter(XPTransaction.user_id == user.id)
        .order_by(XPTransaction.created_at.desc())
        .all()
    ):
        history.append(
            {
                "id": transaction.id,
                "amount": transaction.amount,
                "reason": transaction.reason,
                "source_type": transaction.source_type,
                "source_id": transaction.source_id,
                "created_at": transaction.created_at.isoformat(),
            }
        )

    return {
        "xp_balance": user.xp,
        "xp_history": history,
    }
