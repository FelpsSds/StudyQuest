def _create_user(client, email: str = "dashboard@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Dana", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "Matemática"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#22c55e",
            "icon": "📘",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_dashboard_returns_user_progress_summary(client):
    token = _create_user(client, email="dashboard1@example.com")
    subject = _create_subject(client, token, name="Física")

    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Revisar mecânica",
            "description": "Estudar cinemática",
            "type": "study",
            "difficulty": "medium",
            "xp_reward": 80,
            "estimated_minutes": 45,
            "status": "pending",
            "subject_id": subject["id"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert quest.status_code == 201

    complete = client.post(
        f"/api/v1/quests/{quest.json()['id']}/complete",
        json={"notes": "Concluído"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 200

    boss_fight = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "Boss de Física",
            "hp_max": 100,
            "hp_current": 100,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert boss_fight.status_code == 201

    session = client.post(
        "/api/v1/study-sessions/",
        json={
            "subject_id": subject["id"],
            "status": "in_progress",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session.status_code == 201

    response = client.get("/api/v1/users/dashboard", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["subjects"] == 1
    assert payload["stats"]["quests_total"] == 1
    assert payload["stats"]["quests_completed"] == 1
    assert payload["stats"]["boss_fights_active"] == 1
    assert payload["stats"]["study_sessions_total"] == 1
    assert payload["user"]["level"] >= 1
    assert payload["user"]["xp"] >= 80
