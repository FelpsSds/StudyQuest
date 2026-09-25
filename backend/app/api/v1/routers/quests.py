from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.quest import QuestCompleteRequest, QuestCreate, QuestRead, QuestUpdate
from app.api.v1.routers.achievements import award_achievement_for_quest_completion
from app.core.boss_fights import award_boss_defeat
from app.core.progression import level_for_xp
from app.core.security import get_current_user
from app.models.quest import Quest, QuestStatus
from app.models.quest_completion import QuestCompletion
from app.models.boss_fight import BossFight
from app.models.subject import Subject
from app.models.user import User
from app.models.xp_transaction import XPTransaction

router = APIRouter(prefix="/quests", tags=["quests"])


def _validate_boss_link(
    db: Session,
    boss_fight_id: int,
    current_user: User,
    subject_id: int | None,
) -> BossFight:
    boss_fight = db.query(BossFight).filter(BossFight.id == boss_fight_id).first()
    if not boss_fight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Boss fight not found")
    if boss_fight.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this boss fight")
    if subject_id is not None and subject_id != boss_fight.subject_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest and boss fight must use the same subject")
    return boss_fight


@router.get("/", response_model=list[QuestRead])
def list_quests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Quest]:
    return db.query(Quest).filter(Quest.user_id == current_user.id).order_by(Quest.id.asc()).all()


@router.get("/{quest_id}", response_model=QuestRead)
def get_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Quest:
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    if quest.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this quest")
    return quest


@router.post("/", response_model=QuestRead, status_code=status.HTTP_201_CREATED)
def create_quest(
    payload: QuestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Quest:
    if payload.subject_id is not None:
        subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        if subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this subject",
            )

    subject_id = payload.subject_id
    if payload.boss_fight_id is not None:
        boss_fight = _validate_boss_link(db, payload.boss_fight_id, current_user, subject_id)
        subject_id = boss_fight.subject_id

    quest_data = payload.model_dump()
    quest_data["subject_id"] = subject_id
    quest = Quest(user_id=current_user.id, **quest_data)
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return quest


@router.put("/{quest_id}", response_model=QuestRead)
def update_quest(
    quest_id: int,
    payload: QuestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Quest:
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    if quest.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this quest")

    if payload.subject_id is not None:
        subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        if subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this subject",
            )

    if payload.boss_fight_id is not None:
        _validate_boss_link(db, payload.boss_fight_id, current_user, payload.subject_id or quest.subject_id)
    elif payload.subject_id is not None and quest.boss_fight_id is not None and payload.subject_id != quest.subject_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest and boss fight must use the same subject")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(quest, field, value)

    db.commit()
    db.refresh(quest)
    return quest


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    if quest.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this quest")

    db.delete(quest)
    db.commit()


@router.post("/{quest_id}/complete", response_model=QuestRead)
def complete_quest(
    quest_id: int,
    payload: QuestCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Quest:
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    if quest.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this quest")

    existing = (
        db.query(QuestCompletion)
        .filter(QuestCompletion.user_id == current_user.id, QuestCompletion.quest_id == quest.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest already completed")

    quest.status = QuestStatus.COMPLETED
    current_user.xp += quest.xp_reward
    current_user.level = level_for_xp(current_user.xp)

    if quest.boss_fight_id is not None:
        boss_fight = db.query(BossFight).filter(BossFight.id == quest.boss_fight_id).first()
        if boss_fight is not None and boss_fight.status == "active":
            boss_fight.hp_current = max(0, boss_fight.hp_current - quest.boss_damage)
            if boss_fight.hp_current == 0:
                award_boss_defeat(db, boss_fight, current_user)

    completion = QuestCompletion(
        user_id=current_user.id,
        quest_id=quest.id,
        xp_earned=quest.xp_reward,
        notes=payload.notes,
        status="completed",
    )
    db.add(completion)
    db.add(
        XPTransaction(
            user_id=current_user.id,
            amount=quest.xp_reward,
            reason=f"Quest completed: {quest.title}",
            source_type="quest",
            source_id=quest.id,
        )
    )
    award_achievement_for_quest_completion(db, current_user)
    db.commit()
    db.refresh(quest)
    db.refresh(current_user)
    return quest
