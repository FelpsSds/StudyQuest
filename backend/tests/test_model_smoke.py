from app.models import (
    Achievement,
    BossFight,
    Quest,
    QuestCompletion,
    StudySession,
    Subject,
    User,
    UserAchievement,
    XPTransaction,
)


def test_core_models_are_registered():
    assert User.__tablename__ == "users"
    assert Subject.__tablename__ == "subjects"
    assert Quest.__tablename__ == "quests"
    assert QuestCompletion.__tablename__ == "quest_completions"
    assert XPTransaction.__tablename__ == "xp_transactions"
    assert Achievement.__tablename__ == "achievements"
    assert UserAchievement.__tablename__ == "user_achievements"
    assert BossFight.__tablename__ == "boss_fights"
    assert StudySession.__tablename__ == "study_sessions"


def test_user_model_has_expected_columns():
    columns = {column.name for column in User.__table__.columns}
    assert {"id", "name", "email", "password_hash", "level", "xp"}.issubset(columns)


def test_quest_model_has_expected_columns():
    columns = {column.name for column in Quest.__table__.columns}
    assert {"title", "description", "type", "difficulty", "xp_reward", "estimated_minutes", "status"}.issubset(columns)


def test_unique_constraints_exist():
    constraints = [constraint.name for constraint in QuestCompletion.__table__.constraints]
    assert "uq_quest_completion_user_quest" in constraints

    user_achievement_constraints = [constraint.name for constraint in UserAchievement.__table__.constraints]
    assert "uq_user_achievement_user_achievement" in user_achievement_constraints
