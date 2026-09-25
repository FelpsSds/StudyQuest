def _create_user(client, email: str, name: str = "User", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": password},
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
            "icon": "📚",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_leaderboard_returns_top_users_by_xp(client):
    alice_token = _create_user(client, email="alice.leader@example.com", name="Alice")
    bob_token = _create_user(client, email="bob.leader@example.com", name="Bob")

    subject = _create_subject(client, alice_token, name="Biologia")
    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Estudar célula",
            "description": "Revisar conceitos básicos",
            "type": "study",
            "difficulty": "hard",
            "xp_reward": 150,
            "estimated_minutes": 60,
            "status": "pending",
            "subject_id": subject["id"],
        },
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert quest.status_code == 201

    completion = client.post(
        f"/api/v1/quests/{quest.json()['id']}/complete",
        json={"notes": "Foi bem"},
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert completion.status_code == 200

    response = client.get("/api/v1/users/leaderboard", headers={"Authorization": f"Bearer {bob_token}"})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 2
    assert payload[0]["name"] == "Alice"
    assert payload[0]["xp"] >= payload[1]["xp"]
    assert "score" in payload[0]
