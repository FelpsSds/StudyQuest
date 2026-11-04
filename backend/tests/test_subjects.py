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


def test_create_subject_rejects_blank_name(client):
    token = _create_user(client, email="subject-blank@example.com", password="StrongPass123!")

    response = client.post(
        "/api/v1/subjects/",
        json={"name": "   ", "description": "Disciplina inválida"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_subject_text_fields_respect_database_lengths(client):
    token = _create_user(client, email="subject-lengths@example.com", password="StrongPass123!")
    headers = {"Authorization": f"Bearer {token}"}
    subject = client.post("/api/v1/subjects/", json={"name": "Química"}, headers=headers)
    assert subject.status_code == 201

    oversized_values = [
        {"name": "n" * 121},
        {"description": "d" * 501},
        {"color": "c" * 33},
        {"icon": "i" * 65},
        {"professor": "p" * 121},
        {"semester": "s" * 51},
    ]
    for oversized in oversized_values:
        create_response = client.post(
            "/api/v1/subjects/",
            json={"name": "Outra disciplina", **oversized},
            headers=headers,
        )
        update_response = client.put(
            f"/api/v1/subjects/{subject.json()['id']}",
            json={"name": "Química", **oversized},
            headers=headers,
        )

        assert create_response.status_code == 422
        assert update_response.status_code == 422


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


def test_update_subject_supports_partial_changes_and_field_clearing(client):
    token = _create_user(client, email="subject-update@example.com", password="StrongPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    subject = client.post(
        "/api/v1/subjects/",
        json={
            "name": "História",
            "description": "Turma A",
            "professor": "Prof. Souza",
        },
        headers=headers,
    )
    assert subject.status_code == 201
    subject_id = subject.json()["id"]

    response = client.put(
        f"/api/v1/subjects/{subject_id}",
        json={"description": None, "professor": None},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["description"] is None
    assert payload["professor"] is None


def test_update_subject_supports_all_profile_fields(client):
    token = _create_user(client, email="subject-full-update@example.com")
    headers = {"Authorization": "Bearer " + token}
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Literatura"},
        headers=headers,
    )
    assert subject.status_code == 201

    response = client.put(
        f"/api/v1/subjects/{subject.json()['id']}",
        json={
            "name": "Literatura Brasileira",
            "description": "Romantismo e Modernismo",
            "color": "#4050ab",
            "icon": "📚",
            "professor": "Prof. Ana",
            "semester": "2º semestre",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        **subject.json(),
        "name": "Literatura Brasileira",
        "description": "Romantismo e Modernismo",
        "color": "#4050ab",
        "icon": "📚",
        "professor": "Prof. Ana",
        "semester": "2º semestre",
    }


def test_user_cannot_update_another_users_subject(client):
    owner_token = _create_user(client, email="subject-update-owner@example.com")
    guest_token = _create_user(client, email="subject-update-guest@example.com")
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Privada"},
        headers={"Authorization": "Bearer " + owner_token},
    ).json()

    response = client.put(
        f"/api/v1/subjects/{subject['id']}",
        json={"name": "Alteração não autorizada"},
        headers={"Authorization": "Bearer " + guest_token},
    )

    assert response.status_code == 403


def test_update_subject_blank_optional_fields_are_normalized_to_none(client):
    token = _create_user(client, email="subject-blank-optionals@example.com", password="StrongPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Biologia", "description": "Turma B", "professor": "Prof. Lira"},
        headers=headers,
    )
    assert subject.status_code == 201
    subject_id = subject.json()["id"]

    response = client.put(
        f"/api/v1/subjects/{subject_id}",
        json={"description": "   ", "professor": "     "},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["description"] is None
    assert payload["professor"] is None
