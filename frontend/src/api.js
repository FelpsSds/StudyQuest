const configuredBase = document.querySelector('meta[name="studyquest-api-base"]')?.content.trim();
export const API_BASE = import.meta.env.VITE_API_BASE || configuredBase || '/api/v1';

const validationFieldLabels = {
  audience: 'Público',
  boss_damage: 'Dano no Boss',
  boss_fight_id: 'Boss Fight',
  color: 'Cor',
  description: 'Descrição',
  difficulty: 'Dificuldade',
  duration_minutes: 'Duração',
  due_date: 'Prazo',
  email: 'E-mail',
  estimated_minutes: 'Minutos estimados',
  goal: 'Objetivo',
  hp_max: 'Pontos de vida',
  learning_style: 'Estilo de aprendizagem',
  name: 'Nome',
  password: 'Senha',
  provider_api_key: 'Chave do provedor',
  provider_base_url: 'Endpoint do provedor',
  provider_model: 'Modelo',
  status: 'Situação',
  subject_id: 'Disciplina',
  title: 'Título',
  type: 'Tipo',
  xp_reward: 'XP',
};

function formatValidationMessage(message = '') {
  let match = message.match(/^Input should be greater than or equal to (.+)$/);
  if (match) return `deve ser no mínimo ${match[1]}`;
  match = message.match(/^Input should be less than or equal to (.+)$/);
  if (match) return `deve ser no máximo ${match[1]}`;
  match = message.match(/^Input should be greater than (.+)$/);
  if (match) return `deve ser maior que ${match[1]}`;
  match = message.match(/^Input should be less than (.+)$/);
  if (match) return `deve ser menor que ${match[1]}`;
  match = message.match(/^String should have at least (\d+) characters?$/);
  if (match) return `deve ter pelo menos ${match[1]} caracteres`;
  match = message.match(/^String should have at most (\d+) characters?$/);
  if (match) return `deve ter no máximo ${match[1]} caracteres`;
  if (message === 'Field required') return 'é obrigatório';
  if (message === 'Value error, Invalid email format') return 'formato inválido';
  if (message === 'Value error, Color must use the #RRGGBB format') return 'deve usar o formato #RRGGBB';
  return message.replace(/^Value error, /, '');
}

export function setAccessToken(token) {
  if (token) localStorage.setItem('studyquest_token', token);
  else localStorage.removeItem('studyquest_token');
}

export async function request(path, options = {}, timeoutMs = 30_000) {
  const token = localStorage.getItem('studyquest_token');
  const controller = new AbortController();
  const timeoutSeconds = Math.ceil(timeoutMs / 1000);
  const timeoutMessage = `A API demorou mais de ${timeoutSeconds} segundos para responder. Tente novamente.`;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw new Error('Não foi possível acessar a API. Confira se o backend está ativo.');
  }

  const payload = response.status === 204 ? null : await response.json().catch((error) => {
    if (error?.name === 'AbortError') {
      window.clearTimeout(timeoutId);
      throw new Error(timeoutMessage);
    }
    return null;
  });
  window.clearTimeout(timeoutId);
  if (response.status === 401 && token) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('studyquest:session-expired'));
  }
  if (!response.ok) {
    const detail = payload?.detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.filter((part) => !['body', 'query', 'path', 'header'].includes(part)) : [];
        const fieldName = location.at(-1);
        const field = typeof fieldName === 'string' ? validationFieldLabels[fieldName] || fieldName : '';
        const message = formatValidationMessage(item.msg || 'Valor inválido');
        return field ? `${field}: ${message}` : message;
      }).filter(Boolean);
      if (messages.length) throw new Error(messages.join('; '));
    }
    throw new Error(typeof detail === 'string' ? detail : 'Não foi possível concluir a solicitação.');
  }
  return payload;
}

export const jsonRequest = (method, value) => ({ method, body: JSON.stringify(value) });
