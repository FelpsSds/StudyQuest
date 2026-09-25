def _create_user(client, email: str = "analytics@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Ana", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "Filosofia"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#10b981",
            "icon": "📖",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_analytics_returns_user_study_summary(client):
    token = _create_user(client, email="analytics1@example.com")
    subject = _create_subject(client, token, name="Filosofia")

    session = client.post(
        "/api/v1/study-sessions/",
        json={"subject_id": subject["id"], "status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    complete = client.patch(
        f"/api/v1/study-sessions/{session_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 200

    response = client.get("/api/v1/users/analytics", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["sessions_count"] >= 1
    assert payload["total_study_minutes"] >= 0
    assert payload["average_session_minutes"] >= 0
    assert payload["completed_sessions"] >= 1
