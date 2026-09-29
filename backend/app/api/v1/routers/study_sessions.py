from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.schemas.study_session import StudySessionCreate, StudySessionRead
from app.core.security import get_current_user
from app.models.quest import Quest
from app.models.study_session import StudySession
from app.models.subject import Subject
from app.models.user import User

router = APIRouter(prefix="/study-sessions", tags=["study-sessions"])


def _get_owned_study_session(db: Session, study_session_id: int, current_user: User) -> StudySession:
    session = db.query(StudySession).filter(StudySession.id == study_session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this study session")
    return session


@router.get("/", response_model=list[StudySessionRead])
def list_study_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudySession]:
    return db.query(StudySession).filter(StudySession.user_id == current_user.id).order_by(StudySession.id.asc()).all()


@router.get("/{study_session_id}", response_model=StudySessionRead)
def get_study_session(
    study_session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    return _get_owned_study_session(db, study_session_id, current_user)


@router.post("/", response_model=StudySessionRead, status_code=status.HTTP_201_CREATED)
def create_study_session(
    payload: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    session_subject_id = payload.subject_id
    if session_subject_id is not None:
        subject = db.query(Subject).filter(Subject.id == session_subject_id).first()
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        if subject.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this subject")

    if payload.quest_id is not None:
        quest = db.query(Quest).filter(Quest.id == payload.quest_id).first()
        if not quest:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
        if quest.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this quest")
        if session_subject_id is not None and quest.subject_id is not None and session_subject_id != quest.subject_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Study session and quest must use the same subject",
            )
        if session_subject_id is None:
            session_subject_id = quest.subject_id

    study_session = StudySession(
        user_id=current_user.id,
        subject_id=session_subject_id,
        quest_id=payload.quest_id,
        status=payload.status,
    )
    db.add(study_session)
    db.commit()
    db.refresh(study_session)
    return study_session


@router.patch("/{study_session_id}/complete", response_model=StudySessionRead)
def complete_study_session(
    study_session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    study_session = _get_owned_study_session(db, study_session_id, current_user)
    if study_session.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Study session already completed")

    ended_at = datetime.now(timezone.utc)
    study_session.ended_at = ended_at
    study_session.status = "completed"
    if study_session.started_at:
        started_at = study_session.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        else:
            started_at = started_at.astimezone(timezone.utc)

        delta = ended_at - started_at
        study_session.duration_minutes = max(0, int(delta.total_seconds() // 60))
    db.commit()
    db.refresh(study_session)
    return study_session
