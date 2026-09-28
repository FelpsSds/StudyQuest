def _create_user(client, email: str = "alice@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Alice", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _create_subject(client, token: str, name: str = "Matemática"):
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": name,
            "description": "Disciplina de estudo",
            "color": "#7c3aed",
            "icon": "📘",
            "professor": "Prof. Silva",
            "semester": "1°",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_create_boss_fight_for_current_user(client):
    token = _create_user(client, email="boss1@example.com")
    subject = _create_subject(client, token, name="Física")

    response = client.post(
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

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Boss de Física"
    assert data["user_id"] == 1
    assert data["subject_id"] == subject["id"]


def test_list_boss_fights_for_current_user(client):
    token = _create_user(client, email="boss2@example.com")
    subject = _create_subject(client, token, name="Química")

    client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "Boss de Química",
            "hp_max": 80,
            "hp_current": 80,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get("/api/v1/boss-fights/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert payload[0]["title"] == "Boss de Química"


def test_user_cannot_access_other_users_boss_fights(client):
    token_a = _create_user(client, email="boss3@example.com")
    token_b = _create_user(client, email="boss4@example.com")
    subject_a = _create_subject(client, token_a, name="Biologia")

    fight = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject_a["id"],
            "title": "Boss de Biologia",
            "hp_max": 120,
            "hp_current": 120,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    fight_id = fight.json()["id"]

    response = client.get(f"/api/v1/boss-fights/{fight_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert response.status_code == 403


def test_complete_boss_fight_updates_status(client):
    token = _create_user(client, email="boss5@example.com")
    subject = _create_subject(client, token, name="História")

    fight = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "Boss de História",
            "hp_max": 50,
            "hp_current": 10,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    fight_id = fight.json()["id"]

    response = client.patch(
        f"/api/v1/boss-fights/{fight_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["xp"] == 200

    rewards = client.get("/api/v1/users/rewards", headers={"Authorization": f"Bearer {token}"})
    assert rewards.json()["xp_history"][0]["source_type"] == "boss_fight"


def test_boss_fight_rejects_invalid_hit_points(client):
    token = _create_user(client, email="boss6@example.com")
    subject = _create_subject(client, token, name="Programação")

    response = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "Boss inválido",
            "hp_max": 50,
            "hp_current": 60,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_create_boss_fight_rejects_completed_status(client):
    token = _create_user(client, email="boss-completed-create@example.com")
    subject = _create_subject(client, token, name="Geometria")

    response = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "Boss já derrotado",
            "hp_current": 0,
            "status": "completed",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_create_boss_fight_rejects_blank_title(client):
    token = _create_user(client, email="boss-blank@example.com")
    subject = _create_subject(client, token, name="Física")

    response = client.post(
        "/api/v1/boss-fights/",
        json={
            "subject_id": subject["id"],
            "title": "   ",
            "hp_max": 80,
            "hp_current": 80,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
