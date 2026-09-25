const API_BASE = 'http://127.0.0.1:8000/api/v1';
const state = { token: localStorage.getItem('studyquest_token'), registerMode: false };

const authView = document.querySelector('#auth-view');
const appView = document.querySelector('#app-view');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const nameField = document.querySelector('#name-field');
const authTitle = document.querySelector('#auth-title');
const authSubmit = document.querySelector('#auth-submit');
const authToggle = document.querySelector('#auth-toggle');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || 'Não foi possível concluir a solicitação.');
  return payload;
}

function showAuthError(message = '') { authError.textContent = message; }
function setRegisterMode(enabled) {
  state.registerMode = enabled;
  nameField.classList.toggle('hidden', !enabled);
  document.querySelector('#name').required = enabled;
  authTitle.textContent = enabled ? 'Começar uma nova jornada' : 'Entrar na sua jornada';
  authSubmit.textContent = enabled ? 'Criar conta' : 'Entrar';
  authToggle.textContent = enabled ? 'Já tenho uma conta' : 'Ainda não tenho uma conta';
  showAuthError();
}

function saveSession(token) { state.token = token; localStorage.setItem('studyquest_token', token); }
function clearSession() { state.token = null; localStorage.removeItem('studyquest_token'); authView.classList.remove('hidden'); appView.classList.add('hidden'); }

async function authenticate(event) {
  event.preventDefault();
  showAuthError();
  const email = document.querySelector('#email').value;
  const password = document.querySelector('#password').value;
  const body = { email, password };
  if (state.registerMode) body.name = document.querySelector('#name').value;
  try {
    const payload = await request(state.registerMode ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(body) });
    saveSession(payload.access_token);
    await showDashboard();
  } catch (error) { showAuthError(error.message); }
}

function updateDashboard(payload) {
  const user = payload.user;
  const stats = payload.stats;
  document.querySelector('#user-greeting').textContent = `Olá, ${user.name}`;
  document.querySelector('#dashboard-title').textContent = `Olá, ${user.name.split(' ')[0]}. Vamos avançar?`;
  document.querySelector('#level-value').textContent = user.level;
  document.querySelector('#xp-value').textContent = `${user.xp} XP`;
  document.querySelector('#xp-progress').style.width = `${user.progress_percent}%`;
  document.querySelector('#xp-caption').textContent = `${user.next_level_xp - user.xp} XP para o próximo nível`;
  document.querySelector('#quests-completed').textContent = stats.quests_completed;
  document.querySelector('#quests-total').textContent = stats.quests_total;
  document.querySelector('#streak-value').innerHTML = `${user.streak_current} <small>dias</small>`;
  document.querySelector('#best-streak').textContent = user.streak_best;
}

async function loadQuests() {
  const list = document.querySelector('#quests-list');
  list.innerHTML = '<p class="empty-state">Carregando suas missões...</p>';
  try {
    const quests = await request('/quests/');
    if (!quests.length) { list.innerHTML = '<p class="empty-state">Nenhuma missão por aqui ainda. Crie sua primeira no backend.</p>'; return; }
    list.innerHTML = quests.map((quest) => `<article class="quest-item ${quest.status === 'completed' ? 'completed' : ''}"><div><h3 class="quest-title">${escapeHtml(quest.title)}</h3><span class="quest-meta">${quest.xp_reward} XP &middot; ${quest.estimated_minutes} min &middot; ${quest.difficulty}</span></div><button class="complete-button" data-quest-id="${quest.id}" ${quest.status === 'completed' ? 'disabled' : ''}>${quest.status === 'completed' ? 'Concluída' : 'Concluir'}</button></article>`).join('');
    list.querySelectorAll('[data-quest-id]').forEach((button) => button.addEventListener('click', () => completeQuest(button.dataset.questId)));
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadSubjects() {
  const select = document.querySelector('#quest-subject');
  try {
    const subjects = await request('/subjects/');
    select.innerHTML = '<option value="">Sem disciplina</option>';
    subjects.forEach((subject) => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = '<option value="">Não foi possível carregar</option>';
  }
}

async function createSubject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await request('/subjects/', {
      method: 'POST',
      body: JSON.stringify({
        name: document.querySelector('#subject-name').value,
        color: document.querySelector('#subject-color').value,
      }),
    });
    form.reset();
    document.querySelector('#subject-color').value = '#c7f36b';
    await loadSubjects();
  } catch (error) { window.alert(error.message); }
}

async function createQuest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const subjectId = document.querySelector('#quest-subject').value;
  try {
    await request('/quests/', {
      method: 'POST',
      body: JSON.stringify({
        title: document.querySelector('#quest-title').value,
        type: 'study',
        difficulty: 'medium',
        xp_reward: Number(document.querySelector('#quest-xp').value),
        estimated_minutes: Number(document.querySelector('#quest-minutes').value),
        status: 'pending',
        subject_id: subjectId ? Number(subjectId) : null,
      }),
    });
    form.reset();
    document.querySelector('#quest-xp').value = 40;
    document.querySelector('#quest-minutes').value = 30;
    await loadQuests();
  } catch (error) { window.alert(error.message); }
}

async function completeQuest(id) {
  try { await request(`/quests/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes: 'Concluída pelo painel' }) }); await showDashboard(); } catch (error) { window.alert(error.message); }
}

async function loadRewards() {
  try { const rewards = await request('/users/rewards'); const first = rewards.xp_history[0]; document.querySelector('#reward-summary').innerHTML = `<strong>${rewards.xp_balance} XP</strong><span>${first ? escapeHtml(first.reason) : 'Seu histórico aparece aqui.'}</span>`; } catch (error) { /* dashboard remains usable if rewards are unavailable */ }
}

async function showDashboard() {
  try {
    const dashboard = await request('/users/dashboard');
    updateDashboard(dashboard);
    const analytics = await request('/users/analytics');
    document.querySelector('#study-minutes').textContent = analytics.total_study_minutes;
    authView.classList.add('hidden'); appView.classList.remove('hidden');
    await Promise.all([loadQuests(), loadSubjects(), loadRewards()]);
  } catch (error) { clearSession(); showAuthError(error.message); }
}

function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
authForm.addEventListener('submit', authenticate);
authToggle.addEventListener('click', () => setRegisterMode(!state.registerMode));
document.querySelector('#logout-button').addEventListener('click', clearSession);
document.querySelector('#refresh-button').addEventListener('click', loadQuests);
document.querySelector('#subject-form').addEventListener('submit', createSubject);
document.querySelector('#quest-form').addEventListener('submit', createQuest);
if (state.token) showDashboard();
