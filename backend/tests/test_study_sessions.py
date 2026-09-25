def _create_user(client, email: str = "studier@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Bruno", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "Literatura"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#f59e0b",
            "icon": "📚",
            "professor": "Prof. Lima",
            "semester": "2°",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_create_study_session_for_current_user(client):
    token = _create_user(client, email="session1@example.com")
    subject = _create_subject(client, token, name="Geografia")

    response = client.post(
        "/api/v1/study-sessions/",
        json={
            "subject_id": subject["id"],
            "status": "in_progress",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == 1
    assert data["subject_id"] == subject["id"]
    assert data["status"] == "in_progress"


def test_complete_study_session_sets_end_time(client):
    token = _create_user(client, email="session2@example.com")
    subject = _create_subject(client, token, name="Português")

    session = client.post(
        "/api/v1/study-sessions/",
        json={
            "subject_id": subject["id"],
            "status": "in_progress",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    session_id = session.json()["id"]

    response = client.patch(
        f"/api/v1/study-sessions/{session_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["ended_at"] is not None


def test_create_study_session_rejects_other_users_quest(client):
    token_a = _create_user(client, email="owner@example.com")
    token_b = _create_user(client, email="visiting@example.com")
    subject_a = _create_subject(client, token_a, name="História")
    subject_b = _create_subject(client, token_b, name="Filosofia")

    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Ler capítulo",
            "type": "study",
            "difficulty": "medium",
            "xp_reward": 50,
            "estimated_minutes": 30,
            "subject_id": subject_a["id"],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert quest.status_code == 201

    response = client.post(
        "/api/v1/study-sessions/",
        json={
            "subject_id": subject_b["id"],
            "quest_id": quest.json()["id"],
            "status": "in_progress",
        },
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 403
