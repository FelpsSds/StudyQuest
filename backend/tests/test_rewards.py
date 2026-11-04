def _create_user(client, email: str = "rewards@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Rita", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "História"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#f59e0b",
            "icon": "📜",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_rewards_endpoint_returns_xp_history_and_balance(client):
    token = _create_user(client, email="rewards1@example.com")
    subject = _create_subject(client, token, name="História")

    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Estudar revolução",
            "description": "Revisar conteúdo do capítulo",
            "type": "study",
            "difficulty": "medium",
            "xp_reward": 120,
            "estimated_minutes": 50,
            "status": "pending",
            "subject_id": subject["id"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert quest.status_code == 201

    complete = client.post(
        f"/api/v1/quests/{quest.json()['id']}/complete",
        json={"notes": "Terminada"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 200

    response = client.get("/api/v1/users/rewards", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["xp_balance"] >= 120
    assert payload["xp_history"][0]["amount"] >= 120
    assert payload["xp_history"][0]["source_type"] == "quest"
