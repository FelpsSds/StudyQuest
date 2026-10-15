const configuredBase = document.querySelector('meta[name="studyquest-api-base"]')?.content.trim();
export const API_BASE = import.meta.env.VITE_API_BASE || configuredBase || '/api/v1';

export function setAccessToken(token) {
  if (token) localStorage.setItem('studyquest_token', token);
  else localStorage.removeItem('studyquest_token');
}

export async function request(path, options = {}) {
  const token = localStorage.getItem('studyquest_token');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
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
      throw new Error('A API demorou mais de 30 segundos para responder. Tente novamente.');
    }
    throw new Error('Não foi possível acessar a API. Confira se o backend está ativo.');
  }

  const payload = response.status === 204 ? null : await response.json().catch((error) => {
    if (error?.name === 'AbortError') {
      window.clearTimeout(timeoutId);
      throw new Error('A API demorou mais de 30 segundos para responder. Tente novamente.');
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
    throw new Error(typeof detail === 'string' ? detail : 'Não foi possível concluir a solicitação.');
  }
  return payload;
}

export const jsonRequest = (method, value) => ({ method, body: JSON.stringify(value) });
