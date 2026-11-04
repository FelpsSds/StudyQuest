from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.boss_fight import BossFightCreate, BossFightRead
from app.core.boss_fights import award_boss_defeat
from app.core.security import get_current_user
from app.models.boss_fight import BossFight
from app.models.subject import Subject
from app.models.user import User

router = APIRouter(prefix="/boss-fights", tags=["boss-fights"])


def _get_owned_boss_fight(db: Session, fight_id: int, current_user: User) -> BossFight:
    fight = db.query(BossFight).filter(BossFight.id == fight_id).first()
    if not fight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Boss fight not found")
    if fight.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this boss fight")
    return fight


@router.get("/", response_model=list[BossFightRead])
def list_boss_fights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BossFight]:
    return db.query(BossFight).filter(BossFight.user_id == current_user.id).order_by(BossFight.id.asc()).all()


@router.get("/{boss_fight_id}", response_model=BossFightRead)
def get_boss_fight(
    boss_fight_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BossFight:
    return _get_owned_boss_fight(db, boss_fight_id, current_user)


@router.post("/", response_model=BossFightRead, status_code=status.HTTP_201_CREATED)
def create_boss_fight(
    payload: BossFightCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BossFight:
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    if subject.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this subject")

    boss_fight = BossFight(
        user_id=current_user.id,
        subject_id=payload.subject_id,
        title=payload.title,
        hp_max=payload.hp_max,
        hp_current=payload.hp_current,
        xp_reward=payload.xp_reward,
        status=payload.status,
    )
    db.add(boss_fight)
    db.commit()
    db.refresh(boss_fight)
    return boss_fight


@router.patch("/{boss_fight_id}/complete", response_model=BossFightRead)
def complete_boss_fight(
    boss_fight_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BossFight:
    boss_fight = _get_owned_boss_fight(db, boss_fight_id, current_user)
    if boss_fight.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Boss fight already completed")

    award_boss_defeat(db, boss_fight, current_user)
    db.commit()
    db.refresh(boss_fight)
    return boss_fight


@router.delete("/{boss_fight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_boss_fight(
    boss_fight_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    boss_fight = _get_owned_boss_fight(db, boss_fight_id, current_user)
    db.delete(boss_fight)
    db.commit()
