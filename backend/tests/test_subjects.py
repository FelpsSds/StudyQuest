def _create_user(client, email: str = "alice@example.com", password: str = "StrongPass123!") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Alice", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_create_subject(client):
    token = _create_user(client)
    response = client.post(
        "/api/v1/subjects/",
        json={
            "name": "Estrutura de Dados",
            "description": "Disciplinas com listas e árvores",
            "color": "#7c3aed",
            "icon": "📚",
            "professor": "Prof. Silva",
            "semester": "3°",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Estrutura de Dados"
    assert data["user_id"] == 1


def test_list_subjects_for_current_user(client):
    token = _create_user(client, email="bob@example.com", password="StrongPass123!")
    first = client.post(
        "/api/v1/subjects/",
        json={"name": "Algoritmos", "description": "Análise de algoritmos"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 201

    response = client.get("/api/v1/subjects/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_user_cannot_access_other_users_subjects(client):
    token_a = _create_user(client, email="charlie@example.com", password="StrongPass123!")
    token_b = _create_user(client, email="daniel@example.com", password="StrongPass123!")

    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Banco de Dados", "description": "Modelagem"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    subject_id = subject.json()["id"]

    response = client.get(
        f"/api/v1/subjects/{subject_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 403
