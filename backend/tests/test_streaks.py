from datetime import date, timedelta

from app.core.streaks import calculate_streak


def test_calculate_streak_requires_activity_today_for_current_streak():
    today = date(2026, 9, 25)
    assert calculate_streak({today - timedelta(days=1)}, today) == (0, 1)


def test_calculate_streak_counts_consecutive_days_and_ignores_future_dates():
    today = date(2026, 9, 25)
    dates = {today - timedelta(days=2), today - timedelta(days=1), today, today + timedelta(days=1)}
    assert calculate_streak(dates, today) == (3, 3)


def _create_user(client, email: str = "streak@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Stella", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "Química"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#7c3aed",
            "icon": "🧪",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_streak_endpoint_returns_current_and_best_streak(client):
    token = _create_user(client, email="streak1@example.com")
    subject = _create_subject(client, token, name="Química")

    session = client.post(
        "/api/v1/study-sessions/",
        json={"subject_id": subject["id"], "status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session.status_code == 201

    response = client.get("/api/v1/users/streak", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_streak"] >= 1
    assert payload["best_streak"] >= 1
    assert payload["last_session_date"] is not None
