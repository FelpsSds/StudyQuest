const configuredBase = document.querySelector('meta[name="studyquest-api-base"]')?.content.trim();
export const API_BASE = import.meta.env.VITE_API_BASE || configuredBase || '/api/v1';

export function setAccessToken(token) {
  if (token) localStorage.setItem('studyquest_token', token);
  else localStorage.removeItem('studyquest_token');
}

export async function request(path, options = {}) {
  const token = localStorage.getItem('studyquest_token');
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Não foi possível acessar a API. Confira se o backend está ativo.');
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && token) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('studyquest:session-expired'));
  }
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Não foi possível concluir a solicitação.');
  }
  return payload;
}

export const jsonRequest = (method, value) => ({ method, body: JSON.stringify(value) });
