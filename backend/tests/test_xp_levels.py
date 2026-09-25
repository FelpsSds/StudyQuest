def _create_user(client, email: str = "alice@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Alice", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_quest(client, token: str, title: str = "Estudar XP", xp_reward: int = 150):
    response = client.post(
        "/api/v1/quests/",
        json={
            "title": title,
            "type": "study",
            "difficulty": "medium",
            "xp_reward": xp_reward,
            "estimated_minutes": 30,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_complete_quest_awards_xp_and_updates_level(client):
    token = _create_user(client)
    quest = _create_quest(client, token, xp_reward=150)

    complete_response = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Concluído"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_response.status_code == 200

    me_response = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200

    data = me_response.json()
    assert data["xp"] == 150
    assert data["level"] == 2


def test_duplicate_quest_completion_does_not_double_xp(client):
    token = _create_user(client, email="bob@example.com")
    quest = _create_quest(client, token, xp_reward=120)

    first = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Primeira vez"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Segunda vez"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 400

    me_response = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["xp"] == 120


def test_progression_reports_xp_range_for_current_level(client):
    token = _create_user(client, email="progression@example.com")
    quest = _create_quest(client, token, xp_reward=150)

    response = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Progresso"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    dashboard = client.get("/api/v1/users/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert dashboard.status_code == 200
    progression = dashboard.json()["user"]
    assert progression["current_level_xp"] == 100
    assert progression["next_level_xp"] == 200
    assert progression["progress_percent"] == 50
