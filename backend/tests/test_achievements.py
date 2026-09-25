def _create_user(client, email: str = "alice@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Alice", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_quest(client, token: str, title: str = "Estudar conquista", xp_reward: int = 100):
    response = client.post(
        "/api/v1/quests/",
        json={
            "title": title,
            "type": "study",
            "difficulty": "easy",
            "xp_reward": xp_reward,
            "estimated_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_user_can_list_achievements(client):
    token = _create_user(client, email="peter@example.com")

    response = client.get("/api/v1/achievements/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert any(item["code"] == "first_quest" for item in payload)


def test_first_quest_unlocks_first_quest_achievement(client):
    token = _create_user(client, email="maria@example.com")
    quest = _create_quest(client, token, title="Primeira missão")

    complete_response = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Primeira missão concluída"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_response.status_code == 200

    achievements_response = client.get("/api/v1/achievements/me", headers={"Authorization": f"Bearer {token}"})
    assert achievements_response.status_code == 200
    payload = achievements_response.json()
    assert any(item["code"] == "first_quest" for item in payload)


def test_achievement_cannot_be_unlocked_twice(client):
    token = _create_user(client, email="joao@example.com")
    quest = _create_quest(client, token, title="Segunda missão")

    first = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Concluído"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={"notes": "Tentativa duplicada"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 400

    achievements_response = client.get("/api/v1/achievements/me", headers={"Authorization": f"Bearer {token}"})
    assert achievements_response.status_code == 200
    payload = achievements_response.json()
    assert sum(1 for item in payload if item["code"] == "first_quest") == 1
