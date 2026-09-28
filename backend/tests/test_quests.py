def _create_user(client, email: str = "alice@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Alice", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_create_quest_for_current_user(client):
    token = _create_user(client)

    response = client.post(
        "/api/v1/quests/",
        json={
            "title": "Estudar FastAPI",
            "description": "Revisar rotas e dependências",
            "type": "study",
            "difficulty": "medium",
            "xp_reward": 50,
            "estimated_minutes": 40,
            "status": "pending",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Estudar FastAPI"
    assert data["user_id"] == 1
    assert data["status"] == "pending"


def test_list_quests_for_current_user(client):
    token = _create_user(client, email="bob@example.com")

    first = client.post(
        "/api/v1/quests/",
        json={"title": "Revisar SQLAlchemy", "type": "review", "difficulty": "easy", "xp_reward": 20},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 201

    response = client.get("/api/v1/quests/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert payload[0]["title"] == "Revisar SQLAlchemy"


def test_user_cannot_access_other_users_quests(client):
    token_a = _create_user(client, email="charlie@example.com")
    token_b = _create_user(client, email="daniel@example.com")

    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Resolver exercícios", "type": "exercises", "difficulty": "hard", "xp_reward": 80},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    quest_id = quest.json()["id"]

    response = client.get(f"/api/v1/quests/{quest_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert response.status_code == 403


def test_create_quest_rejects_blank_title(client):
    token = _create_user(client, email="blank-quest@example.com")

    response = client.post(
        "/api/v1/quests/",
        json={"title": "   ", "type": "study", "difficulty": "medium", "xp_reward": 30},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_quest_cannot_be_marked_completed_outside_completion_endpoint(client):
    token = _create_user(client, email="quest-status@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    quest = client.post("/api/v1/quests/", json={"title": "Estudar física"}, headers=headers)
    assert quest.status_code == 201

    create_completed = client.post(
        "/api/v1/quests/",
        json={"title": "Missão concluída", "status": "completed"},
        headers=headers,
    )
    update_completed = client.put(
        f"/api/v1/quests/{quest.json()['id']}",
        json={"status": "completed"},
        headers=headers,
    )

    assert create_completed.status_code == 422
    assert update_completed.status_code == 422


def test_quest_estimated_minutes_must_be_positive(client):
    token = _create_user(client, email="invalid-estimate@example.com")
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Estudar cálculo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert quest.status_code == 201

    invalid_create = client.post(
        "/api/v1/quests/",
        json={"title": "Estimativa inválida", "estimated_minutes": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    invalid_update = client.put(
        f"/api/v1/quests/{quest.json()['id']}",
        json={"estimated_minutes": -5},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert invalid_create.status_code == 422
    assert invalid_update.status_code == 422


def test_user_cannot_create_quest_for_other_users_subject(client):
    token_a = _create_user(client, email="subject-owner@example.com")
    token_b = _create_user(client, email="subject-guest@example.com")

    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Disciplina privada"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert subject.status_code == 201

    response = client.post(
        "/api/v1/quests/",
        json={"title": "Quest indevida", "subject_id": subject.json()["id"]},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 403


def test_user_cannot_update_quest_with_other_users_subject(client):
    token_a = _create_user(client, email="update-subject-owner@example.com")
    token_b = _create_user(client, email="update-subject-guest@example.com")

    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Outra disciplina privada"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Quest própria"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert subject.status_code == 201
    assert quest.status_code == 201

    response = client.put(
        f"/api/v1/quests/{quest.json()['id']}",
        json={"subject_id": subject.json()["id"]},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 403


def test_complete_quest_marks_status_and_prevents_duplicates(client):
    token = _create_user(client, email="erin@example.com")

    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Completar sprint", "type": "project", "difficulty": "boss", "xp_reward": 150},
        headers={"Authorization": f"Bearer {token}"},
    )
    quest_id = quest.json()["id"]

    complete_response = client.post(
        f"/api/v1/quests/{quest_id}/complete",
        json={"notes": "Sprint concluída"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "completed"
    assert complete_response.json()["completed_at"] is not None

    duplicate_response = client.post(
        f"/api/v1/quests/{quest_id}/complete",
        json={"notes": "Tentando duplicar"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert duplicate_response.status_code == 400


def test_quest_can_be_linked_to_owned_boss_fight(client):
    token = _create_user(client, email="quest-boss@example.com")
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Estruturas"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    boss = client.post(
        "/api/v1/boss-fights/",
        json={"subject_id": subject["id"], "title": "Boss de Estruturas"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.post(
        "/api/v1/quests/",
        json={"title": "Implementar árvore", "boss_fight_id": boss["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    assert response.json()["boss_fight_id"] == boss["id"]
    assert response.json()["subject_id"] == subject["id"]


def test_quest_cannot_link_to_other_users_boss_fight(client):
    owner_token = _create_user(client, email="quest-boss-owner@example.com")
    guest_token = _create_user(client, email="quest-boss-guest@example.com")
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Privada"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    boss = client.post(
        "/api/v1/boss-fights/",
        json={"subject_id": subject["id"], "title": "Boss privado"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    response = client.post(
        "/api/v1/quests/",
        json={"title": "Quest indevida", "boss_fight_id": boss["id"]},
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    assert response.status_code == 403


def test_completing_boss_quest_reduces_hp_and_defeats_boss(client):
    token = _create_user(client, email="boss-damage@example.com")
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Algoritmos"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    boss = client.post(
        "/api/v1/boss-fights/",
        json={"subject_id": subject["id"], "title": "Boss de Algoritmos", "hp_max": 25, "hp_current": 25, "xp_reward": 200},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Resolver recorrência", "boss_fight_id": boss["id"], "boss_damage": 15},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    first = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 200
    partial = client.get(f"/api/v1/boss-fights/{boss['id']}", headers={"Authorization": f"Bearer {token}"})
    assert partial.json()["hp_current"] == 10
    assert partial.json()["status"] == "active"

    second_quest = client.post(
        "/api/v1/quests/",
        json={"title": "Implementar solução", "boss_fight_id": boss["id"], "boss_damage": 15},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    second = client.post(
        f"/api/v1/quests/{second_quest['id']}/complete",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 200
    defeated = client.get(f"/api/v1/boss-fights/{boss['id']}", headers={"Authorization": f"Bearer {token}"})
    assert defeated.json()["hp_current"] == 0
    assert defeated.json()["status"] == "completed"
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["xp"] == 200
