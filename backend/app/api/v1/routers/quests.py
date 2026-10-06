from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.quest import QuestCompleteRequest, QuestCreate, QuestRead, QuestUpdate
from app.api.v1.routers.achievements import award_achievement_for_quest_completion
from app.core.boss_fights import award_boss_defeat
from app.core.plan_generator import generate_plan_spec
from app.core.progression import level_for_xp
from app.core.security import get_current_user
from app.models.quest import Quest, QuestDifficulty, QuestStatus, QuestType
from app.models.quest_completion import QuestCompletion
from app.models.boss_fight import BossFight
from app.models.subject import Subject
from app.models.user import User
from app.models.xp_transaction import XPTransaction

router = APIRouter(prefix="/quests", tags=["quests"])


class StudyPlanTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    type: QuestType = QuestType.STUDY
    difficulty: QuestDifficulty = QuestDifficulty.MEDIUM
    xp_reward: int = Field(default=0, ge=0)
    estimated_minutes: int = Field(default=30, gt=0)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value


class StudyPlanGenerateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(default="", max_length=5000)
    preview_only: bool = False
    subject_id: int | None = None
    goal: str | None = Field(default=None, max_length=300)
    audience: str | None = Field(default=None, max_length=200)
    learning_style: str | None = Field(default="objetivo", max_length=50)
    provider_base_url: str | None = Field(default=None, max_length=500)
    provider_model: str | None = Field(default=None, max_length=200)
    learning_objectives: list[str] | None = None
    tasks: list[StudyPlanTaskRequest] | None = None


def _build_subject_name(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        return "Tema de estudo"
    return cleaned[:80]


def _get_subject_for_plan(
    db: Session,
    current_user: User,
    subject_id: int | None,
) -> Subject | None:
    if subject_id is not None:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        if subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this subject",
            )
        return subject
    return None


def _ensure_subject_for_plan(
    db: Session,
    current_user: User,
    title: str,
    subject_id: int | None,
) -> Subject:
    subject = _get_subject_for_plan(db, current_user, subject_id)
    if subject:
        return subject

    subject_name = _build_subject_name(title)
    existing = db.query(Subject).filter(Subject.user_id == current_user.id, Subject.name == subject_name).first()
    if existing:
        return existing

    subject = Subject(
        user_id=current_user.id,
        name=subject_name,
        description=f"Plano gerado automaticamente para: {subject_name}",
        color="#c7f36b",
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


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


@router.post("/generate-plan")
def generate_study_plan(
    payload: StudyPlanGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    title = payload.title.strip()
    content = (payload.content or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title cannot be blank")

    if not content:
        content = title

    goal = (payload.goal or "").strip()
    audience = (payload.audience or "").strip()
    learning_style = (payload.learning_style or "objetivo").strip() or "objetivo"
    provider_base_url = (payload.provider_base_url or "").strip() or None
    provider_model = (payload.provider_model or "").strip() or None

    if payload.tasks:
        plan_items = [
            {
                "title": task.title,
                "description": task.description or f"Plano revisado a partir de: {title}",
                "type": task.type.value if isinstance(task.type, QuestType) else str(task.type).lower(),
                "difficulty": task.difficulty.value if isinstance(task.difficulty, QuestDifficulty) else str(task.difficulty).lower(),
                "xp_reward": task.xp_reward,
                "estimated_minutes": task.estimated_minutes,
            }
            for task in payload.tasks
        ]
        if not plan_items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one task is required to generate a plan")
        learning_objectives = payload.learning_objectives or [
            goal or f"Dominar os tópicos principais de {title}",
            f"Revisar o conteúdo de {title} para {audience or 'o estudante'}.",
            f"Aplicar os conceitos de {title} em exercícios práticos.",
            f"Consolidar o tema de {title} com revisão e acompanhamento.",
        ]
    else:
        plan_spec = generate_plan_spec(
            title,
            content,
            goal=goal,
            audience=audience,
            learning_style=learning_style,
            base_url=provider_base_url,
            model=provider_model,
        )
        plan_items = plan_spec["tasks"]
        learning_objectives = plan_spec["learning_objectives"]

    if payload.preview_only:
        subject = _get_subject_for_plan(db, current_user, payload.subject_id)
        return {
            "subject": {
                "id": subject.id if subject else None,
                "name": subject.name if subject else _build_subject_name(title),
            },
            "tasks": [
                {
                    "title": item["title"],
                    "description": item.get("description"),
                    "type": item["type"].value if isinstance(item["type"], QuestType) else item["type"],
                    "difficulty": item["difficulty"].value if isinstance(item["difficulty"], QuestDifficulty) else item["difficulty"],
                    "xp_reward": item["xp_reward"],
                    "estimated_minutes": item["estimated_minutes"],
                }
                for item in plan_items
            ],
            "learning_objectives": learning_objectives,
            "generated_from": title,
        }

    subject = _ensure_subject_for_plan(db, current_user, title, payload.subject_id)
    created_quests: list[Quest] = []
    for item in plan_items:
        quest_type = item["type"] if not isinstance(item["type"], str) else QuestType(item["type"])
        quest_difficulty = item["difficulty"] if not isinstance(item["difficulty"], str) else QuestDifficulty(item["difficulty"])
        quest = Quest(
            user_id=current_user.id,
            subject_id=subject.id,
            title=item["title"],
            description=item.get("description") or f"Plano gerado a partir de: {title}",
            type=quest_type,
            difficulty=quest_difficulty,
            xp_reward=item["xp_reward"],
            boss_damage=10,
            estimated_minutes=item["estimated_minutes"],
            status=QuestStatus.PENDING,
        )
        db.add(quest)
        created_quests.append(quest)

    boss_fight = BossFight(
        user_id=current_user.id,
        subject_id=subject.id,
        title=f"Boss: {subject.name}",
        hp_max=120,
        hp_current=120,
        xp_reward=200,
        status="active",
    )
    db.add(boss_fight)
    db.flush()
    for quest in created_quests:
        quest.boss_fight_id = boss_fight.id

    db.commit()
    db.refresh(subject)
    quest_payload = []
    for quest in created_quests:
        db.refresh(quest)
        quest_payload.append(
            {
                "id": quest.id,
                "title": quest.title,
                "type": quest.type.value,
                "difficulty": quest.difficulty.value,
                "xp_reward": quest.xp_reward,
                "estimated_minutes": quest.estimated_minutes,
                "status": quest.status.value,
                "subject_id": quest.subject_id,
                "boss_fight_id": quest.boss_fight_id,
            }
        )

    db.refresh(boss_fight)
    return {
        "subject": {"id": subject.id, "name": subject.name, "user_id": subject.user_id},
        "quests": quest_payload,
        "boss_fight": {
            "id": boss_fight.id,
            "title": boss_fight.title,
            "subject_id": boss_fight.subject_id,
            "hp_max": boss_fight.hp_max,
            "hp_current": boss_fight.hp_current,
            "xp_reward": boss_fight.xp_reward,
            "status": boss_fight.status,
        },
        "learning_objectives": learning_objectives,
        "generated_from": title,
    }


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
        boss_fight = _validate_boss_link(db, payload.boss_fight_id, current_user, payload.subject_id or quest.subject_id)
        if payload.subject_id is None and quest.subject_id is None:
            quest.subject_id = boss_fight.subject_id
    elif payload.subject_id is not None and quest.boss_fight_id is not None and payload.subject_id != quest.subject_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest and boss fight must use the same subject")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or field in {"description", "due_date", "subject_id", "boss_fight_id"}:
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
    if quest.status == QuestStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived quest cannot be completed")

    existing = (
        db.query(QuestCompletion)
        .filter(QuestCompletion.user_id == current_user.id, QuestCompletion.quest_id == quest.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest already completed")

    quest.status = QuestStatus.COMPLETED
    quest.completed_at = datetime.now(timezone.utc)
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
