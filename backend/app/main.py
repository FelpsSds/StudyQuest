from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routers.achievements import ensure_default_achievements, router as achievements_router
from app.api.v1.routers.auth import router as auth_router
from app.api.v1.routers.boss_fights import router as boss_fights_router
from app.api.v1.routers.health import router as health_router
from app.api.v1.routers.quests import router as quests_router
from app.api.v1.routers.study_sessions import router as study_sessions_router
from app.api.v1.routers.subjects import router as subjects_router
from app.api.v1.routers.users import router as users_router
from app.core.database import SessionLocal

app = FastAPI(
    title="StudyQuest API",
    version="0.1.0",
    description="Backend inicial do StudyQuest com estrutura para autenticação, missões e evolução do aluno.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(subjects_router, prefix="/api/v1")
app.include_router(quests_router, prefix="/api/v1")
app.include_router(achievements_router, prefix="/api/v1")
app.include_router(boss_fights_router, prefix="/api/v1")
app.include_router(study_sessions_router, prefix="/api/v1")


@app.on_event("startup")
def seed_default_data() -> None:
    db = SessionLocal()
    try:
        ensure_default_achievements(db)
    finally:
        db.close()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "StudyQuest backend online"}
