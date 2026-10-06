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


def test_generate_study_plan_creates_quests_and_boss(client):
    token = _create_user(client, email="plan-generator@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/quests/generate-plan",
        json={
            "title": "Álgebra linear",
            "content": "Matrizes, vetores, sistemas lineares, autovalores e determinantes.",
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["subject"]["name"] == "Álgebra linear"
    assert len(payload["quests"]) >= 3
    assert payload["boss_fight"]["title"].startswith("Boss: Álgebra linear")
    assert payload["boss_fight"]["subject_id"] == payload["subject"]["id"]


def test_generate_study_plan_preview_is_saved_only_after_review(client):
    token = _create_user(client, email="plan-preview@example.com")
    headers = {"Authorization": "Bearer " + token}
    preview = client.post(
        "/api/v1/quests/generate-plan",
        json={"title": "Geometria", "content": "Angulos, areas e poligonos.", "preview_only": True},
        headers=headers,
    )

    assert preview.status_code == 200
    preview_payload = preview.json()
    assert preview_payload["subject"]["id"] is None
    assert preview_payload["tasks"]
    assert client.get("/api/v1/quests/", headers=headers).json() == []
    assert client.get("/api/v1/subjects/", headers=headers).json() == []
    assert client.get("/api/v1/boss-fights/", headers=headers).json() == []

    saved = client.post(
        "/api/v1/quests/generate-plan",
        json={
            "title": "Geometria",
            "preview_only": False,
            "tasks": preview_payload["tasks"],
            "learning_objectives": preview_payload["learning_objectives"],
        },
        headers=headers,
    )

    assert saved.status_code == 200
    assert len(saved.json()["quests"]) == len(preview_payload["tasks"])
    assert len(client.get("/api/v1/quests/", headers=headers).json()) == len(preview_payload["tasks"])
    assert len(client.get("/api/v1/subjects/", headers=headers).json()) == 1
    assert len(client.get("/api/v1/boss-fights/", headers=headers).json()) == 1


def test_generate_study_plan_accepts_goal_and_audience(client):
    token = _create_user(client, email="plan-generator-ai@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/quests/generate-plan",
        json={
            "title": "Biologia celular",
            "content": "Membrana, mitose, respiração celular e síntese de proteínas.",
            "goal": "entender os mecanismos da célula",
            "audience": "alunos do ensino médio",
            "learning_style": "prática",
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["generated_from"] == "Biologia celular"
    assert any("célula" in objective.lower() or "alunos" in objective.lower() for objective in payload["learning_objectives"])
    assert len(payload["quests"]) >= 4


def test_generate_plan_spec_prefers_structured_ai_payload(monkeypatch):
    from app.core import plan_generator

    monkeypatch.setattr(plan_generator.settings, "openai_api_key", "fake-key")
    monkeypatch.setattr(
        plan_generator,
        "_call_openai_for_plan",
        lambda *args, **kwargs: {
            "learning_objectives": ["Aplicar o tema em exercícios práticos para alunos do ensino médio."],
            "tasks": [
                {
                    "title": "Revisar tópicos fundamentais",
                    "type": "review",
                    "difficulty": "easy",
                    "xp_reward": 30,
                    "estimated_minutes": 20,
                    "description": "Revisão guiada do conteúdo principal.",
                }
            ],
        },
    )

    payload = plan_generator.generate_plan_spec(
        "Física",
        "Força, energia e movimento.",
        goal="compreender conceitos básicos",
        audience="alunos do ensino médio",
        learning_style="prática",
    )

    assert payload["learning_objectives"][0].startswith("Aplicar")
    assert payload["tasks"][0]["type"] == "review"


def test_generate_study_plan_accepts_custom_reviewed_tasks(client):
    token = _create_user(client, email="plan-reviewed@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/quests/generate-plan",
        json={
            "title": "Química orgânica",
            "content": "Funções orgânicas, nomenclatura e reações.",
            "tasks": [
                {
                    "title": "Mapear grupos funcionais",
                    "type": "review",
                    "difficulty": "easy",
                    "xp_reward": 55,
                    "estimated_minutes": 25,
                    "description": "Listar os grupos com exemplos simples.",
                },
                {
                    "title": "Classificar reações",
                    "type": "exercises",
                    "difficulty": "medium",
                    "xp_reward": 80,
                    "estimated_minutes": 35,
                    "description": "Relacionar reagentes e produtos.",
                },
            ],
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert [quest["title"] for quest in payload["quests"]] == [
        "Mapear grupos funcionais",
        "Classificar reações",
    ]


def test_generate_plan_spec_supports_local_ollama_without_api_key(monkeypatch):
    import httpx
    from app.core import plan_generator

    class DummyResponse:

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"learning_objectives": ["Entender os conceitos do tema."], "tasks": [{"title": "Revisar mapa conceitual", "type": "review", "difficulty": "easy", "xp_reward": 45, "estimated_minutes": 20, "description": "Mapeie os pontos essenciais."}]}'
                        }
                    }
                ]
            }

    monkeypatch.setattr(plan_generator.settings, "openai_api_key", None)
    monkeypatch.setattr(plan_generator.settings, "ai_generation_enabled", True)
    monkeypatch.setattr(plan_generator.settings, "openai_base_url", "http://localhost:11434/v1")
    monkeypatch.setattr(plan_generator.settings, "openai_model", "llama3.1")
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: DummyResponse())

    payload = plan_generator.generate_plan_spec(
        "Física",
        "Força, energia e movimento.",
        goal="compreender fundamentos",
        audience="alunos do ensino médio",
        learning_style="prática",
    )

    assert payload["learning_objectives"][0].startswith("Entender")
    assert payload["tasks"][0]["title"] == "Revisar mapa conceitual"


def test_generate_plan_spec_accepts_provider_overrides(monkeypatch):
    import httpx
    from app.core import plan_generator

    seen = {}

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"learning_objectives": ["Aplicar conceitos em exercícios."], "tasks": [{"title": "Resolver exercícios práticos", "type": "exercises", "difficulty": "medium", "xp_reward": 60, "estimated_minutes": 25, "description": "Pratique com exemplos reais."}]}'
                        }
                    }
                ]
            }

    def fake_post(url, **kwargs):
        seen["url"] = url
        seen["model"] = kwargs["json"]["model"]
        return DummyResponse()

    monkeypatch.setattr(plan_generator.settings, "openai_api_key", None)
    monkeypatch.setattr(plan_generator.settings, "ai_generation_enabled", True)
    monkeypatch.setattr(httpx, "post", fake_post)

    payload = plan_generator.generate_plan_spec(
        "Matemática",
        "equações e funções.",
        goal="resolver problemas",
        audience="jovens estudantes",
        learning_style="objetivo",
        base_url="http://localhost:11434/v1",
        model="llama3.1-local",
    )

    assert seen["url"] == "http://localhost:11434/v1/chat/completions"
    assert seen["model"] == "llama3.1-local"
    assert payload["tasks"][0]["title"] == "Resolver exercícios práticos"


def test_generate_plan_spec_parses_markdown_wrapped_json(monkeypatch):
    import httpx
    from app.core import plan_generator

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": "```json\n{\"learning_objectives\": [\"Entender os conceitos básicos do tema.\"], \"tasks\": [{\"title\": \"Revisar mapa conceitual\", \"type\": \"review\", \"difficulty\": \"easy\", \"xp_reward\": 45, \"estimated_minutes\": 20, \"description\": \"Mapeie os pontos essenciais.\"}]}\n```"
                        }
                    }
                ]
            }

    monkeypatch.setattr(plan_generator.settings, "openai_api_key", "fake-key")
    monkeypatch.setattr(plan_generator.settings, "ai_generation_enabled", True)
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: DummyResponse())

    payload = plan_generator.generate_plan_spec(
        "História",
        "Revolução industrial e transformações sociais.",
        goal="entender causas e consequências",
        audience="estudantes do ensino médio",
        learning_style="objetivo",
    )

    assert payload["learning_objectives"][0].startswith("Entender")
    assert payload["tasks"][0]["title"] == "Revisar mapa conceitual"


def test_generate_plan_spec_falls_back_when_ai_tasks_are_invalid(monkeypatch):
    from app.core import plan_generator

    monkeypatch.setattr(
        plan_generator,
        "_call_openai_for_plan",
        lambda *args, **kwargs: {
            "learning_objectives": ["Entender o tema."],
            "tasks": [{"title": "Missão inválida", "type": "unknown"}],
        },
    )

    payload = plan_generator.generate_plan_spec("Geometria", "Ângulos e polígonos.")

    assert len(payload["tasks"]) == 4
    assert all(task["title"] for task in payload["tasks"])


def test_generate_plan_spec_does_not_send_openai_key_to_override(monkeypatch):
    import httpx
    from app.core import plan_generator

    seen = {}

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"learning_objectives": ["Entender o tema."], "tasks": [{"title": "Revisar o tema", "type": "review", "difficulty": "easy", "xp_reward": 20, "estimated_minutes": 15}]}'
                        }
                    }
                ]
            }

    def fake_post(url, **kwargs):
        seen.update(kwargs["headers"])
        return DummyResponse()

    monkeypatch.setattr(plan_generator.settings, "openai_api_key", "server-secret")
    monkeypatch.setattr(plan_generator.settings, "openai_base_url", "https://api.openai.com/v1")
    monkeypatch.setattr(plan_generator.settings, "ai_generation_enabled", True)
    monkeypatch.setattr(httpx, "post", fake_post)

    plan_generator.generate_plan_spec(
        "Geometria",
        "Ângulos e polígonos.",
        base_url="https://custom.example/v1",
    )

    assert "Authorization" not in seen


def test_update_quest_can_clear_optional_description_and_due_date(client):
    token = _create_user(client, email="clear-quest-fields@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Revisar álgebra",
            "description": "Resolver exercícios extras",
            "due_date": "2026-10-01",
        },
        headers=headers,
    )
    assert quest.status_code == 201

    response = client.put(
        f"/api/v1/quests/{quest.json()['id']}",
        json={"description": None, "due_date": None},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["description"] is None
    assert response.json()["due_date"] is None


def test_update_quest_can_clear_optional_subject_and_boss_links(client):
    token = _create_user(client, email="clear-quest-links@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Física", "description": "Disciplina de física"},
        headers=headers,
    )
    assert subject.status_code == 201

    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Estudar cinemática", "subject_id": subject.json()["id"]},
        headers=headers,
    )
    assert quest.status_code == 201
    quest_id = quest.json()["id"]

    response = client.put(
        f"/api/v1/quests/{quest_id}",
        json={"subject_id": None, "boss_fight_id": None},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["subject_id"] is None
    assert payload["boss_fight_id"] is None


def test_update_quest_blank_optional_fields_are_normalized_to_none(client):
    token = _create_user(client, email="quest-blank-optionals@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    quest = client.post(
        "/api/v1/quests/",
        json={
            "title": "Revisar zoologia",
            "description": "Capítulo 3",
            "due_date": "2026-11-01",
        },
        headers=headers,
    )
    assert quest.status_code == 201
    quest_id = quest.json()["id"]

    response = client.put(
        f"/api/v1/quests/{quest_id}",
        json={"description": "   ", "due_date": "   "},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["description"] is None
    assert payload["due_date"] is None


def test_complete_quest_rejects_notes_over_database_limit(client):
    token = _create_user(client, email="quest-long-notes@example.com")
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Resolver exercícios"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert quest.status_code == 201

    response = client.post(
        f"/api/v1/quests/{quest.json()['id']}/complete",
        json={"notes": "n" * 501},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


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


def test_archived_quest_cannot_be_completed_or_reward_xp(client):
    token = _create_user(client, email="archived-quest@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Missão arquivada", "xp_reward": 100},
        headers=headers,
    ).json()
    archive_response = client.put(
        f"/api/v1/quests/{quest['id']}",
        json={"status": "archived"},
        headers=headers,
    )
    assert archive_response.status_code == 200

    complete_response = client.post(
        f"/api/v1/quests/{quest['id']}/complete",
        json={},
        headers=headers,
    )
    user_response = client.get("/api/v1/users/me", headers=headers)

    assert complete_response.status_code == 400
    assert user_response.json()["xp"] == 0


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


def test_updating_quest_with_boss_fight_inherits_boss_subject(client):
    token = _create_user(client, email="update-quest-boss-subject@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    subject = client.post(
        "/api/v1/subjects/",
        json={"name": "Cálculo"},
        headers=headers,
    ).json()
    boss = client.post(
        "/api/v1/boss-fights/",
        json={"subject_id": subject["id"], "title": "Boss de Cálculo"},
        headers=headers,
    ).json()
    quest = client.post(
        "/api/v1/quests/",
        json={"title": "Resolver integrais"},
        headers=headers,
    ).json()

    response = client.put(
        f"/api/v1/quests/{quest['id']}",
        json={"boss_fight_id": boss["id"]},
        headers=headers,
    )

    assert response.status_code == 200
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
