from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.progression import level_for_xp
from app.models.boss_fight import BossFight
from app.models.user import User
from app.models.xp_transaction import XPTransaction


def award_boss_defeat(db: Session, boss_fight: BossFight, user: User) -> bool:
    """Complete a boss and award its XP once."""
    if boss_fight.status == "completed":
        return False

    boss_fight.status = "completed"
    boss_fight.hp_current = 0
    boss_fight.completed_at = datetime.now(timezone.utc)
    user.xp += boss_fight.xp_reward
    user.level = level_for_xp(user.xp)
    db.add(
        XPTransaction(
            user_id=user.id,
            amount=boss_fight.xp_reward,
            reason=f"Boss defeated: {boss_fight.title}",
            source_type="boss_fight",
            source_id=boss_fight.id,
        )
    )
    return True
