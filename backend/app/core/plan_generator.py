import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.models.quest import QuestDifficulty, QuestType

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "a", "as", "ao", "aos", "e", "de", "do", "dos", "da", "das", "para", "com", "sem",
    "por", "uma", "um", "mais", "menos", "sobre", "entre", "tambem", "também", "que",
    "qual", "como", "quando", "onde", "esse", "essa", "este", "esta", "nos", "nas",
    "se", "sua", "seu", "pela", "pelo", "na", "no", "tem", "alguns", "algumas", "ser",
    "sao", "são", "partir", "dentro", "fora", "apenas", "muito", "muita", "muitos",
    "muitas", "tudo", "todos", "todas",
}


def _extract_keywords(text: str, limit: int = 4) -> list[str]:
    normalized = re.sub(r"[^A-Za-zÀ-ÿ0-9\s]", " ", text.lower())
    words = [word.strip() for word in normalized.split() if word.strip()]
    unique: list[str] = []
    seen: set[str] = set()
    for word in words:
        if len(word) <= 3 or word in STOP_WORDS:
            continue
        if word not in seen:
            unique.append(word)
            seen.add(word)
        if len(unique) >= limit:
            break
    return unique or ["estudo", "prática", "revisão", "aplicação"]


def _normalize_style(style: str | None) -> str:
    value = (style or "objetivo").strip().lower()
    aliases = {
        "pratica": "prática",
        "praticas": "prática",
        "prático": "prática",
        "intensivo": "intensivo",
        "leve": "leve",
        "objetivo": "objetivo",
        "basico": "objetivo",
        "básico": "objetivo",
    }
    return aliases.get(value, "objetivo")


def build_learning_objectives(
    title: str,
    content: str = "",
    goal: str | None = None,
    audience: str | None = None,
    learning_style: str | None = None,
) -> list[str]:
    focus_keywords = _extract_keywords(f"{title} {content} {goal or ''}", limit=4)
    audience_label = (audience or "estudantes").strip() or "estudantes"
    goal_phrase = (goal or f"aprender os conceitos principais de {title}").strip() or f"aprender os conceitos principais de {title}"
    style = _normalize_style(learning_style)

    if style == "prática":
        return [
            f"Aplicar {focus_keywords[0]} em exercícios práticos para {audience_label}.",
            f"Entender melhor o objetivo de {title} ao conectar {goal_phrase.lower()} para {audience_label}.",
            f"Resolver desafios com foco em {focus_keywords[1] if len(focus_keywords) > 1 else focus_keywords[0]}.",
            f"Validar a compreensão do tema com revisão rápida e autocorreção.",
        ]

    if style == "intensivo":
        return [
            f"Dominar os fundamentos de {title} com revisão estruturada para {audience_label}.",
            f"Combinar teoria e prática para concluir {goal_phrase.lower()}.",
            f"Trabalhar a velocidade de resolução em {focus_keywords[2] if len(focus_keywords) > 2 else focus_keywords[0]}.",
            f"Consolidar o assunto em um desafio final com foco em desempenho.",
        ]

    return [
        f"Compreender os pilares de {title} para atingir o objetivo de {goal_phrase.lower()}.",
        f"Entender como {focus_keywords[0]} se conecta ao tema para {audience_label}.",
        f"Organizar as ideias principais de {title} em um resumo útil e objetivo.",
        f"Validar o progresso em {title} com uma revisão final e exercícios focados.",
    ]


def build_plan_tasks(
    title: str,
    content: str = "",
    goal: str | None = None,
    audience: str | None = None,
    learning_style: str | None = None,
) -> list[dict[str, Any]]:
    focus_keywords = _extract_keywords(f"{title} {content} {goal or ''}", limit=6)
    while len(focus_keywords) < 4:
        focus_keywords.append("estudo")

    style = _normalize_style(learning_style)
    if style == "prática":
        tasks = [
            {
                "title": f"Revisar os conceitos essenciais de {focus_keywords[0]}",
                "type": QuestType.REVIEW,
                "difficulty": QuestDifficulty.EASY,
                "xp_reward": 35,
                "estimated_minutes": 20,
                "description": f"Mapa rápido dos pontos centrais de {title} para {audience or 'estudantes'}.",
            },
            {
                "title": f"Resolver exercícios com foco em {focus_keywords[1]}",
                "type": QuestType.EXERCISES,
                "difficulty": QuestDifficulty.MEDIUM,
                "xp_reward": 55,
                "estimated_minutes": 30,
                "description": f"Aplicar os conceitos em exercícios guiados sobre {title}.",
            },
            {
                "title": f"Explicar em suas palavras o tema de {focus_keywords[2]}",
                "type": QuestType.PRACTICE,
                "difficulty": QuestDifficulty.EASY,
                "xp_reward": 45,
                "estimated_minutes": 25,
                "description": "Transformar o conteúdo em uma explicação clara e objetiva.",
            },
            {
                "title": f"Desafiar sua compreensão em {focus_keywords[3]}",
                "type": QuestType.PRACTICE,
                "difficulty": QuestDifficulty.HARD,
                "xp_reward": 75,
                "estimated_minutes": 40,
                "description": "Confrontar o conhecimento em uma situação mais complexa e verificar a retenção.",
            },
        ]
    elif style == "intensivo":
        tasks = [
            {
                "title": f"Mapear a base teórica de {focus_keywords[0]}",
                "type": QuestType.REVIEW,
                "difficulty": QuestDifficulty.MEDIUM,
                "xp_reward": 45,
                "estimated_minutes": 25,
                "description": "Organizar as bases do tema para acelerar a compreensão.",
            },
            {
                "title": f"Treinar resolução de problemas de {focus_keywords[1]}",
                "type": QuestType.EXERCISES,
                "difficulty": QuestDifficulty.HARD,
                "xp_reward": 70,
                "estimated_minutes": 35,
                "description": "Executar desafios em ritmo mais acelerado para reforçar a memória.",
            },
            {
                "title": f"Comparar soluções e erros em {focus_keywords[2]}",
                "type": QuestType.PRACTICE,
                "difficulty": QuestDifficulty.MEDIUM,
                "xp_reward": 60,
                "estimated_minutes": 30,
                "description": "Avaliar erros e melhorar a modelagem do raciocínio.",
            },
            {
                "title": f"Aplicar o tema em um desafio final de {focus_keywords[3]}",
                "type": QuestType.PROJECT,
                "difficulty": QuestDifficulty.HARD,
                "xp_reward": 90,
                "estimated_minutes": 50,
                "description": "Encerrar com um diagnóstico prático de domínio do assunto.",
            },
        ]
    else:
        tasks = [
            {
                "title": f"Revisar os fundamentos de {focus_keywords[0]}",
                "type": QuestType.REVIEW,
                "difficulty": QuestDifficulty.EASY,
                "xp_reward": 35,
                "estimated_minutes": 20,
                "description": f"Estabelecer uma visão clara dos conceitos centrais de {title}.",
            },
            {
                "title": f"Resolver exercícios sobre {focus_keywords[1]}",
                "type": QuestType.EXERCISES,
                "difficulty": QuestDifficulty.MEDIUM,
                "xp_reward": 55,
                "estimated_minutes": 30,
                "description": f"Fixar o conteúdo com exercícios simples e bem orientados sobre {title}.",
            },
            {
                "title": f"Resumir os pontos principais de {focus_keywords[2]}",
                "type": QuestType.PRACTICE,
                "difficulty": QuestDifficulty.EASY,
                "xp_reward": 45,
                "estimated_minutes": 25,
                "description": "Organizar um resumo visual dos assuntos mais importantes.",
            },
            {
                "title": f"Desafiar sua compreensão em {focus_keywords[3]}",
                "type": QuestType.PRACTICE,
                "difficulty": QuestDifficulty.HARD,
                "xp_reward": 75,
                "estimated_minutes": 40,
                "description": "Consolidar o conhecimento em uma aplicação mais aprofundada do tema.",
            },
        ]

    return tasks


def _normalize_plan_task(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError("Generated plan tasks must be objects")

    title = str(item.get("title") or "").strip()
    if not title or len(title) > 200:
        raise ValueError("Generated plan task title is invalid")

    xp_reward = int(item.get("xp_reward", 0) or 0)
    estimated_minutes = int(item.get("estimated_minutes", 20) or 20)
    if not 0 <= xp_reward <= 2_147_483_647 or not 0 < estimated_minutes <= 2_147_483_647:
        raise ValueError("Generated plan task values are invalid")

    return {
        "title": title,
        "type": QuestType(str(item.get("type", QuestType.STUDY.value)).lower()).value,
        "difficulty": QuestDifficulty(str(item.get("difficulty", QuestDifficulty.MEDIUM.value)).lower()).value,
        "xp_reward": xp_reward,
        "estimated_minutes": estimated_minutes,
        "description": str(item.get("description") or "").strip(),
    }


def _parse_json_response(raw_message: str) -> dict[str, Any] | None:
    candidate = raw_message.strip()
    if not candidate:
        return None

    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate, flags=re.IGNORECASE)
        candidate = re.sub(r"\s*```$", "", candidate)

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        compact = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
        if not compact:
            return None
        try:
            parsed = json.loads(compact.group(0))
        except json.JSONDecodeError:
            return None

    return parsed if isinstance(parsed, dict) else None


def _call_openai_for_plan(
    title: str,
    content: str,
    goal: str | None,
    audience: str | None,
    learning_style: str | None,
    base_url: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    if not settings.ai_generation_enabled:
        return {}

    effective_base_url = (base_url or settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
    effective_model = model or settings.openai_model or "gpt-4o-mini"
    is_local_provider = any(marker in effective_base_url.lower() for marker in ("localhost", "127.0.0.1", "ollama", "lmstudio"))
    if not settings.openai_api_key and not is_local_provider:
        return {}

    prompt = (
        "Você é um planejador pedagógico de estudo. "
        "Retorne apenas JSON válido com as chaves: learning_objectives e tasks. "
        "learning_objectives deve ser uma lista de 4 strings curtas. "
        "tasks deve ser uma lista de 4 objetos com campos: title, type, difficulty, xp_reward, estimated_minutes, description. "
        f"Tema: {title}. Conteúdo: {content}. Objetivo: {goal or 'nenhum objetivo específico'}. "
        f"Público: {audience or 'todos os estudantes'}. Estilo: {learning_style or 'objetivo'}. "
        "Tipos válidos: review, exercises, practice, project. Dificuldades válidas: easy, medium, hard."
    )

    endpoint = f"{effective_base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    configured_base_url = (settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
    if settings.openai_api_key and effective_base_url == configured_base_url:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    try:
        response = httpx.post(
            endpoint,
            headers=headers,
            json={
                "model": effective_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        message = data["choices"][0]["message"]["content"]
        parsed = _parse_json_response(message)
        if isinstance(parsed, dict):
            return parsed
        logger.warning("AI study plan response was not a JSON object; using the built-in plan")
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        logger.warning("AI study plan request failed; using the built-in plan", exc_info=True)
    return {}


def generate_plan_spec(
    title: str,
    content: str = "",
    goal: str | None = None,
    audience: str | None = None,
    learning_style: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    ai_payload = _call_openai_for_plan(title, content, goal, audience, learning_style, base_url=base_url, model=model)
    if ai_payload:
        learning_objectives = ai_payload.get("learning_objectives")
        if not isinstance(learning_objectives, list) or not all(
            isinstance(item, str) and item.strip() for item in learning_objectives
        ):
            learning_objectives = build_learning_objectives(title, content, goal, audience, learning_style)

        tasks = ai_payload.get("tasks")
        try:
            if not isinstance(tasks, list) or not tasks:
                raise ValueError("Generated plan tasks are missing")
            normalized_tasks = [_normalize_plan_task(task) for task in tasks]
        except (TypeError, ValueError, OverflowError):
            logger.warning("AI study plan tasks were invalid; using the built-in tasks")
            normalized_tasks = build_plan_tasks(title, content, goal, audience, learning_style)

        return {"learning_objectives": learning_objectives, "tasks": normalized_tasks}

    return {
        "learning_objectives": build_learning_objectives(title, content, goal, audience, learning_style),
        "tasks": build_plan_tasks(title, content, goal, audience, learning_style),
    }
