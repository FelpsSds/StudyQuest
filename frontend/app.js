const API_BASE = 'http://127.0.0.1:8000/api/v1';
const state = { token: localStorage.getItem('studyquest_token'), registerMode: false, generatedPlan: null };
const QUEST_FILTER_KEY = 'studyquest_quest_filter';
const QUEST_SORT_KEY = 'studyquest_quest_sort';
const SESSION_SUBJECT_KEY = 'studyquest_session_subject';
const SESSION_QUEST_KEY = 'studyquest_session_quest';
const SESSION_DURATION_KEY = 'studyquest_session_duration';
const PLAN_PROVIDER_KEY = 'studyquest_plan_provider';
const PLAN_PROVIDER_PRESETS = {
  openai: { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { base_url: 'http://localhost:11434/v1', model: 'llama3.1' },
  custom: { base_url: '', model: '' },
};

function getSavedQuestFilter() {
  return localStorage.getItem(QUEST_FILTER_KEY) || 'all';
}

function getSavedQuestSort() {
  return localStorage.getItem(QUEST_SORT_KEY) || 'priority';
}

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

  const hasBody = response.status !== 204 && response.headers.get('content-length') !== '0';
  const payload = hasBody ? await response.json().catch(() => ({})) : null;

  if (response.status === 401 && state.token) {
    clearSession();
    throw new Error('Sua sessão expirou. Faça login novamente.');
  }

  if (!response.ok) {
    throw new Error(payload?.detail || 'Não foi possível concluir a solicitação.');
  }

  return payload;
}

function showAuthError(message = '') { authError.textContent = message; }
function showAppView() {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
}
function showAuthView() {
  appView.classList.add('hidden');
  authView.classList.remove('hidden');
}
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
function resetAuthForm() {
  authForm.reset();
  if (document.querySelector('#name')) document.querySelector('#name').value = '';
  if (document.querySelector('#email')) document.querySelector('#email').value = '';
  if (document.querySelector('#password')) document.querySelector('#password').value = '';
}
function clearSession() {
  state.token = null;
  localStorage.removeItem('studyquest_token');
  resetAuthForm();
  showAuthView();
  showAuthError();
}

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
    resetAuthForm();
    await showDashboard();
  } catch (error) {
    showAuthError(error.message);
  }
}

function updateDashboard(payload) {
  const user = payload.user;
  const stats = payload.stats;
  const profileName = document.querySelector('#profile-name');
  const profileEmail = document.querySelector('#profile-email');
  const profileStatus = document.querySelector('#profile-status');

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

  if (profileName) profileName.textContent = user.name;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profileStatus) profileStatus.textContent = `${user.level}º nível • ${user.progress_percent}% até o próximo upgrade`;
}

async function loadQuests() {
  const list = document.querySelector('#quests-list');
  const filter = document.querySelector('#quest-filter');
  const sort = document.querySelector('#quest-sort');
  const activeFilter = filter ? (filter.value || getSavedQuestFilter()) : getSavedQuestFilter();
  const activeSort = sort ? (sort.value || getSavedQuestSort()) : getSavedQuestSort();

  if (filter) filter.value = activeFilter;
  if (sort) sort.value = activeSort;

  list.innerHTML = '<p class="empty-state">Carregando suas missões...</p>';
  try {
    const quests = await request('/quests/');
    let filteredQuests = quests;

    if (activeFilter === 'pending') {
      filteredQuests = quests.filter((quest) => quest.status !== 'completed');
    } else if (activeFilter === 'completed') {
      filteredQuests = quests.filter((quest) => quest.status === 'completed');
    } else if (activeFilter.startsWith('subject:')) {
      const subjectId = activeFilter.split(':')[1];
      filteredQuests = quests.filter((quest) => String(quest.subject_id ?? '') === String(subjectId));
    }

    filteredQuests = [...filteredQuests].sort((a, b) => {
      if (activeSort === 'xp') return (b.xp_reward ?? 0) - (a.xp_reward ?? 0);
      if (activeSort === 'minutes') return (a.estimated_minutes ?? 0) - (b.estimated_minutes ?? 0);
      if (activeSort === 'title') return String(a.title).localeCompare(String(b.title));
      if (a.status === b.status) return (b.xp_reward ?? 0) - (a.xp_reward ?? 0);
      return a.status === 'completed' ? 1 : -1;
    });

    if (!filteredQuests.length) {
      list.innerHTML = '<p class="empty-state">Nenhuma missão para este filtro no momento.</p>';
      return;
    }

    list.innerHTML = filteredQuests.map((quest) => `
      <article class="quest-item ${quest.status === 'completed' ? 'completed' : ''}">
        <div>
          <h3 class="quest-title">${escapeHtml(quest.title)}</h3>
          <span class="quest-meta">${quest.xp_reward} XP &middot; ${quest.estimated_minutes} min &middot; ${quest.difficulty}</span>
        </div>
        <div class="quest-actions">
          <button class="mini-edit" data-edit-quest-id="${quest.id}" type="button">Editar</button>
          <button class="complete-button" data-quest-id="${quest.id}" ${quest.status === 'completed' ? 'disabled' : ''}>${quest.status === 'completed' ? 'Concluída' : 'Concluir'}</button>
          <button class="delete-button" data-delete-quest-id="${quest.id}" type="button">Excluir</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-quest-id]').forEach((button) => button.addEventListener('click', () => completeQuest(button.dataset.questId)));
    list.querySelectorAll('[data-delete-quest-id]').forEach((button) =>
      button.addEventListener('click', () => deleteQuest(button.dataset.deleteQuestId))
    );
    list.querySelectorAll('[data-edit-quest-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const quest = filteredQuests.find((item) => item.id === Number(button.dataset.editQuestId));
        if (quest) updateQuest(quest.id, quest.title, quest.xp_reward, quest.estimated_minutes);
      });
    });
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadSubjects() {
  const select = document.querySelector('#quest-subject');
  const sessionSelect = document.querySelector('#session-subject');
  const bossSelect = document.querySelector('#boss-subject');
    const planSelect = document.querySelector('#plan-subject');
    const filterSelect = document.querySelector('#quest-filter');
    try {
      const subjects = await request('/subjects/');
      [select, sessionSelect, bossSelect, planSelect].forEach((element) => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        element.appendChild(option);
      });
    });

    const sessionSubject = document.querySelector('#session-subject');
    if (sessionSubject) {
      const saved = localStorage.getItem(SESSION_SUBJECT_KEY);
      if (saved && Array.from(sessionSubject.options).some((option) => option.value === saved)) {
        sessionSubject.value = saved;
      }
    }

    if (filterSelect) {
      const activeValue = getSavedQuestFilter();
      filterSelect.innerHTML = '<option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option>';
      subjects.forEach((subject) => {
        const option = document.createElement('option');
        option.value = `subject:${subject.id}`;
        option.textContent = subject.name;
        filterSelect.appendChild(option);
      });

      const nextValue = activeValue.startsWith('subject:') && subjects.some((subject) => `subject:${subject.id}` === activeValue)
        ? activeValue
        : ['all', 'pending', 'completed'].includes(activeValue)
          ? activeValue
          : 'all';
      filterSelect.value = nextValue;
      localStorage.setItem(QUEST_FILTER_KEY, nextValue);
    }
  } catch (error) {
    [select, sessionSelect, bossSelect].forEach((element) => {
      if (!element) return;
      element.innerHTML = '<option value="">Não foi possível carregar</option>';
    });
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option>';
    }
  }
}

function persistSessionPreferences() {
  const sessionSubject = document.querySelector('#session-subject');
  const sessionQuest = document.querySelector('#session-quest');
  const sessionDuration = document.querySelector('#session-duration');

  if (sessionSubject) {
    if (sessionSubject.value) localStorage.setItem(SESSION_SUBJECT_KEY, sessionSubject.value);
    else localStorage.removeItem(SESSION_SUBJECT_KEY);
  }

  if (sessionQuest) {
    if (sessionQuest.value) localStorage.setItem(SESSION_QUEST_KEY, sessionQuest.value);
    else localStorage.removeItem(SESSION_QUEST_KEY);
  }

  if (sessionDuration) {
    const duration = Number(sessionDuration.value || 30);
    if (Number.isFinite(duration) && duration > 0) {
      localStorage.setItem(SESSION_DURATION_KEY, String(duration));
    }
  }
}

function restoreSessionPreferences() {
  const sessionSubject = document.querySelector('#session-subject');
  const sessionQuest = document.querySelector('#session-quest');
  const sessionDuration = document.querySelector('#session-duration');

  if (sessionSubject) {
    const savedSubject = localStorage.getItem(SESSION_SUBJECT_KEY);
    if (savedSubject && Array.from(sessionSubject.options).some((option) => option.value === savedSubject)) {
      sessionSubject.value = savedSubject;
    }
  }

  if (sessionQuest) {
    const savedQuest = localStorage.getItem(SESSION_QUEST_KEY);
    if (savedQuest && Array.from(sessionQuest.options).some((option) => option.value === savedQuest)) {
      sessionQuest.value = savedQuest;
    }
  }

  if (sessionDuration) {
    const savedDuration = Number(localStorage.getItem(SESSION_DURATION_KEY) || 30);
    sessionDuration.value = Number.isFinite(savedDuration) && savedDuration > 0 ? String(savedDuration) : '30';
  }
}

async function loadSessionQuestOptions() {
  const select = document.querySelector('#session-quest');
  const subjectSelect = document.querySelector('#session-subject');
  if (!select) return;

  try {
    const quests = await request('/quests/');
    const activeSubject = subjectSelect ? subjectSelect.value : '';
    const filteredQuests = activeSubject
      ? quests.filter((quest) => String(quest.subject_id ?? '') === String(activeSubject))
      : quests;

    select.innerHTML = '<option value="">Sem missão</option>';
    filteredQuests.forEach((quest) => {
      const option = document.createElement('option');
      option.value = quest.id;
      option.textContent = `${quest.title} (${quest.xp_reward} XP)`;
      select.appendChild(option);
    });

    const savedQuest = localStorage.getItem(SESSION_QUEST_KEY);
    const matchesSavedQuest = Array.from(select.options).some((option) => option.value === savedQuest);
    if (matchesSavedQuest) {
      select.value = savedQuest;
    } else if (filteredQuests.length && activeSubject) {
      select.value = String(filteredQuests[0].id);
      localStorage.setItem(SESSION_QUEST_KEY, String(filteredQuests[0].id));
    } else {
      select.value = '';
      localStorage.removeItem(SESSION_QUEST_KEY);
    }

    restoreSessionPreferences();
  } catch (error) {
    select.innerHTML = '<option value="">Não foi possível carregar</option>';
  }
}

async function loadSubjectsList() {
  const list = document.querySelector('#subjects-list');
  try {
    const subjects = await request('/subjects/');
    if (!subjects.length) {
      list.innerHTML = '<p class="small-empty">Nenhuma disciplina cadastrada.</p>';
      return;
    }

    list.innerHTML = subjects.map((subject) => `
      <div class="subject-row" style="border-left: 4px solid ${subject.color || '#c7f36b'};">
        <span>${escapeHtml(subject.name)}</span>
        <div class="row-actions">
          <button class="mini-edit" data-edit-subject-id="${subject.id}" type="button">Editar</button>
          <button class="mini-delete" data-subject-id="${subject.id}" type="button">Excluir</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-subject-id]').forEach((button) => {
      button.addEventListener('click', () => deleteSubject(button.dataset.subjectId));
    });
    list.querySelectorAll('[data-edit-subject-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const subject = subjects.find((item) => item.id === Number(button.dataset.editSubjectId));
        if (subject) updateSubject(subject.id, subject.name);
      });
    });
  } catch (error) {
    list.innerHTML = '<p class="small-empty">Não foi possível carregar as disciplinas.</p>';
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
    await showDashboard();
  } catch (error) { window.alert(error.message); }
}

async function updateSubject(id, currentName) {
  const nextName = window.prompt('Editar disciplina:', currentName || '');
  if (nextName === null) return;

  const trimmedName = nextName.trim();
  if (!trimmedName) {
    window.alert('O nome da disciplina não pode ficar vazio.');
    return;
  }

  try {
    await request(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: trimmedName }),
    });
    await Promise.all([loadSubjects(), loadSubjectsList(), loadQuests(), loadSessionQuestOptions(), showDashboard()]);
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteSubject(id) {
  if (!window.confirm('Deseja excluir esta disciplina?')) return;

  try {
    await request(`/subjects/${id}`, { method: 'DELETE' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function updateQuest(id, currentTitle, currentXp, currentMinutes) {
  const nextTitle = window.prompt('Editar título da missão:', currentTitle || '');
  if (nextTitle === null) return;

  const title = nextTitle.trim();
  if (!title) {
    window.alert('O título da missão não pode ficar vazio.');
    return;
  }

  const nextXp = Number(window.prompt('Novo valor de XP:', String(currentXp ?? 0)));
  if (!Number.isFinite(nextXp) || nextXp < 0) {
    window.alert('Informe um valor de XP válido.');
    return;
  }

  const nextMinutes = Number(window.prompt('Novo tempo estimado em minutos:', String(currentMinutes ?? 30)));
  if (!Number.isFinite(nextMinutes) || nextMinutes <= 0) {
    window.alert('Informe uma duração válida em minutos.');
    return;
  }

  try {
    await request(`/quests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        xp_reward: nextXp,
        estimated_minutes: nextMinutes,
      }),
    });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
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
    await showDashboard();
  } catch (error) { window.alert(error.message); }
}

function renderPlanReview(response, saved = false) {
  const preview = document.querySelector('#plan-preview');
  if (!preview || !response) return;

  const tasks = Array.isArray(response.tasks) ? response.tasks : Array.isArray(response.quests) ? response.quests : [];
  const objectives = Array.isArray(response.learning_objectives) ? response.learning_objectives : [];
  state.generatedPlan = saved ? null : {
    title: response.generated_from || '',
    content: document.querySelector('#plan-content').value.trim(),
    goal: document.querySelector('#plan-goal').value.trim(),
    audience: document.querySelector('#plan-audience').value.trim(),
    learning_style: document.querySelector('#plan-style').value,
    subject_id: response.subject?.id ?? (document.querySelector('#plan-subject').value ? Number(document.querySelector('#plan-subject').value) : null),
    tasks,
    objectives,
  };

  preview.innerHTML = `
    <div class="plan-review-header">
      <strong>${escapeHtml(response.subject?.name || 'Plano gerado')}</strong>
      <small>${objectives.length ? objectives.map((item) => escapeHtml(item)).join(' • ') : 'Plano pronto para revisão.'}</small>
    </div>
    <div class="plan-review-list">
      ${tasks.map((task, index) => `
        <div class="plan-review-task">
          <label class="plan-review-field">Título
            <input data-plan-task-field="title" data-plan-task-index="${index}" value="${escapeAttribute(task.title || '')}" />
          </label>
          <div class="plan-review-row">
            <label class="plan-review-field">Tipo
              <select data-plan-task-field="type" data-plan-task-index="${index}">
                <option value="review" ${task.type === 'review' ? 'selected' : ''}>Revisão</option>
                <option value="exercises" ${task.type === 'exercises' ? 'selected' : ''}>Exercícios</option>
                <option value="practice" ${task.type === 'practice' ? 'selected' : ''}>Prática</option>
                <option value="project" ${task.type === 'project' ? 'selected' : ''}>Projeto</option>
              </select>
            </label>
            <label class="plan-review-field">Dificuldade
              <select data-plan-task-field="difficulty" data-plan-task-index="${index}">
                <option value="easy" ${task.difficulty === 'easy' ? 'selected' : ''}>Fácil</option>
                <option value="medium" ${task.difficulty === 'medium' ? 'selected' : ''}>Média</option>
                <option value="hard" ${task.difficulty === 'hard' ? 'selected' : ''}>Difícil</option>
              </select>
            </label>
          </div>
          <div class="plan-review-row">
            <label class="plan-review-field">XP
              <input type="number" min="0" data-plan-task-field="xp" data-plan-task-index="${index}" value="${Number(task.xp_reward ?? 0)}" />
            </label>
            <label class="plan-review-field">Minutos
              <input type="number" min="1" data-plan-task-field="minutes" data-plan-task-index="${index}" value="${Number(task.estimated_minutes ?? 30)}" />
            </label>
          </div>
          <label class="plan-review-field">Descrição
            <textarea data-plan-task-field="description" data-plan-task-index="${index}" rows="2">${escapeHtml(task.description || '')}</textarea>
          </label>
        </div>
      `).join('')}
    </div>
    ${saved
      ? '<p role="status">Plano salvo com sucesso.</p>'
      : '<button class="secondary-button review-submit" type="button">Salvar plano revisado</button>'}
  `;

  const saveButton = preview.querySelector('.review-submit');
  if (saveButton) {
    saveButton.addEventListener('click', saveReviewedPlan);
  }
}

async function saveReviewedPlan() {
  if (!state.generatedPlan) {
    window.alert('Primeiro gere um plano para revisá-lo.');
    return;
  }

  const preview = document.querySelector('#plan-preview');
  const rows = preview ? Array.from(preview.querySelectorAll('.plan-review-task')) : [];
  if (!rows.length) {
    window.alert('Não há tarefas para salvar no plano atual.');
    return;
  }
  if (rows.some((row) => !row.querySelector('[data-plan-task-field="title"]').value.trim())) {
    window.alert('Cada missão revisada precisa ter um título válido.');
    return;
  }

  const tasks = rows.map((row) => {
    const title = row.querySelector('[data-plan-task-field="title"]').value.trim();
    const description = row.querySelector('[data-plan-task-field="description"]').value.trim();
    const type = row.querySelector('[data-plan-task-field="type"]').value;
    const difficulty = row.querySelector('[data-plan-task-field="difficulty"]').value;
    const xp_reward = Number(row.querySelector('[data-plan-task-field="xp"]').value || 0);
    const estimated_minutes = Number(row.querySelector('[data-plan-task-field="minutes"]').value || 30);

    return {
      title,
      description: description || undefined,
      type,
      difficulty,
      xp_reward,
      estimated_minutes,
    };
  });

  const saveButton = preview.querySelector('.review-submit');
  if (saveButton) saveButton.disabled = true;
  try {
    const payload = {
      title: state.generatedPlan.title || document.querySelector('#plan-title').value.trim(),
      content: state.generatedPlan.content || document.querySelector('#plan-content').value.trim(),
      goal: state.generatedPlan.goal || document.querySelector('#plan-goal').value.trim(),
      audience: state.generatedPlan.audience || document.querySelector('#plan-audience').value.trim(),
      learning_style: state.generatedPlan.learning_style || document.querySelector('#plan-style').value,
      provider_base_url: document.querySelector('#plan-provider-base-url')?.value?.trim() || null,
      provider_model: document.querySelector('#plan-provider-model')?.value?.trim() || null,
      subject_id: state.generatedPlan.subject_id ?? (document.querySelector('#plan-subject').value ? Number(document.querySelector('#plan-subject').value) : null),
      learning_objectives: state.generatedPlan.objectives || [],
      tasks,
    };
    const response = await request('/quests/generate-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    renderPlanReview(response, true);
    document.querySelector('#plan-title').value = '';
    document.querySelector('#plan-content').value = '';
    document.querySelector('#plan-goal').value = '';
    document.querySelector('#plan-audience').value = '';
    document.querySelector('#plan-style').value = 'objetivo';
    await showDashboard();
  } catch (error) {
    if (saveButton) saveButton.disabled = false;
    window.alert(error.message);
  }
}

async function generateStudyPlan(event) {
  event.preventDefault();
  const title = document.querySelector('#plan-title').value.trim();
  const content = document.querySelector('#plan-content').value.trim();
  const goal = document.querySelector('#plan-goal').value.trim();
  const audience = document.querySelector('#plan-audience').value.trim();
  const style = document.querySelector('#plan-style').value;
  const providerBaseUrl = document.querySelector('#plan-provider-base-url').value.trim();
  const providerModel = document.querySelector('#plan-provider-model').value.trim();
  const subjectId = document.querySelector('#plan-subject').value;
  const preview = document.querySelector('#plan-preview');

  if (!title) {
    window.alert('Informe um tema para gerar o plano de estudo.');
    return;
  }

  preview.textContent = 'Gerando plano...';

  try {
    const response = await request('/quests/generate-plan', {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        preview_only: true,
        goal,
        audience,
        learning_style: style,
        provider_base_url: providerBaseUrl || null,
        provider_model: providerModel || null,
        subject_id: subjectId ? Number(subjectId) : null,
      }),
    });

    renderPlanReview(response);
    document.querySelector('#plan-title').value = '';
    document.querySelector('#plan-content').value = '';
    document.querySelector('#plan-goal').value = '';
    document.querySelector('#plan-audience').value = '';
    document.querySelector('#plan-style').value = 'objetivo';
    await showDashboard();
  } catch (error) {
    preview.textContent = error.message;
    window.alert(error.message);
  }
}

async function createStudySession(event) {
  event.preventDefault();
  const subjectId = document.querySelector('#session-subject').value;
  const questId = document.querySelector('#session-quest').value;
  const durationMinutes = Number(document.querySelector('#session-duration').value || 30);

  try {
    persistSessionPreferences();
    await request('/study-sessions/', {
      method: 'POST',
      body: JSON.stringify({
        subject_id: subjectId ? Number(subjectId) : null,
        quest_id: questId ? Number(questId) : null,
        duration_minutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30,
        status: 'in_progress',
      }),
    });
    document.querySelector('#session-form').reset();
    restoreSessionPreferences();
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function completeQuest(id) {
  try { await request(`/quests/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes: 'Concluída pelo painel' }) }); await showDashboard(); } catch (error) { window.alert(error.message); }
}

async function deleteQuest(id) {
  if (!window.confirm('Deseja excluir esta missão?')) return;

  try {
    await request(`/quests/${id}`, { method: 'DELETE' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadSessions() {
  const list = document.querySelector('#sessions-list');
  if (!list) return;

  try {
    const sessions = await request('/study-sessions/');
    if (!sessions.length) {
      list.innerHTML = '<p class="small-empty">Nenhuma sessão em andamento.</p>';
      return;
    }

    list.innerHTML = sessions.map((session) => `
      <div class="session-row">
        <div>
          <strong>${session.subject_id ? 'Disciplina vinculada' : 'Sessão livre'}</strong>
          <small>${session.status === 'completed' ? 'Concluída' : 'Em andamento'}${session.duration_minutes ? ` • ${session.duration_minutes} min` : ''}</small>
        </div>
        <div class="row-actions">
          <button class="mini-delete" data-delete-session-id="${session.id}" type="button">Excluir</button>
          <button class="mini-delete" data-session-id="${session.id}" type="button" ${session.status === 'completed' ? 'disabled' : ''}>${session.status === 'completed' ? 'Finalizada' : 'Finalizar'}</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-session-id]').forEach((button) => {
      button.addEventListener('click', () => completeStudySession(button.dataset.sessionId));
    });
    list.querySelectorAll('[data-delete-session-id]').forEach((button) => {
      button.addEventListener('click', () => deleteStudySession(button.dataset.deleteSessionId));
    });
  } catch (error) {
    list.innerHTML = '<p class="small-empty">Não foi possível carregar as sessões.</p>';
  }
}

async function deleteStudySession(id) {
  if (!window.confirm('Deseja excluir esta sessão de estudo?')) return;

  try {
    await request(`/study-sessions/${id}`, { method: 'DELETE' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function completeStudySession(id) {
  try {
    await request(`/study-sessions/${id}/complete`, { method: 'PATCH' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadBosses() {
  const list = document.querySelector('#bosses-list');
  if (!list) return;

  try {
    const bosses = await request('/boss-fights/');
    if (!bosses.length) {
      list.innerHTML = '<p class="small-empty">Nenhum boss fight registrado.</p>';
      return;
    }

    list.innerHTML = bosses.map((boss) => `
      <div class="session-row">
        <div>
          <strong>${escapeHtml(boss.title)}</strong>
          <small>${boss.hp_current}/${boss.hp_max} HP • ${boss.status === 'completed' ? 'Derrotado' : 'Ativo'} • ${boss.xp_reward ?? 0} XP</small>
        </div>
        <div class="row-actions">
          <button class="mini-delete" data-delete-boss-id="${boss.id}" type="button">Excluir</button>
          <button class="mini-delete" data-boss-id="${boss.id}" type="button" ${boss.status === 'completed' ? 'disabled' : ''}>${boss.status === 'completed' ? 'Vencido' : 'Derrotar'}</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-boss-id]').forEach((button) => {
      button.addEventListener('click', () => completeBossFight(button.dataset.bossId));
    });
    list.querySelectorAll('[data-delete-boss-id]').forEach((button) => {
      button.addEventListener('click', () => deleteBossFight(button.dataset.deleteBossId));
    });
  } catch (error) {
    list.innerHTML = '<p class="small-empty">Não foi possível carregar os bosses.</p>';
  }
}

async function deleteBossFight(id) {
  if (!window.confirm('Deseja excluir este Boss Fight?')) return;

  try {
    await request(`/boss-fights/${id}`, { method: 'DELETE' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function completeBossFight(id) {
  try {
    await request(`/boss-fights/${id}/complete`, { method: 'PATCH' });
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function createBossFight(event) {
  event.preventDefault();
  const subjectId = document.querySelector('#boss-subject').value;
  const title = document.querySelector('#boss-title').value.trim();
  const hp = Number(document.querySelector('#boss-hp').value);
  const xp = Number(document.querySelector('#boss-xp').value);

  if (!subjectId) {
    window.alert('Selecione uma disciplina antes de criar o Boss Fight.');
    return;
  }

  if (!title) {
    window.alert('Informe um título para o Boss Fight.');
    return;
  }

  try {
    await request('/boss-fights/', {
      method: 'POST',
      body: JSON.stringify({
        subject_id: Number(subjectId),
        title,
        hp_max: hp,
        hp_current: hp,
        xp_reward: xp,
        status: 'active',
      }),
    });
    document.querySelector('#boss-form').reset();
    document.querySelector('#boss-hp').value = 100;
    document.querySelector('#boss-xp').value = 200;
    await showDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadRewards() {
  const activityList = document.querySelector('#activity-list');
  try {
    const rewards = await request('/users/rewards');
    const history = Array.isArray(rewards?.xp_history) ? rewards.xp_history : [];
    const first = history[0];
    document.querySelector('#reward-summary').innerHTML = `<strong>${Number(rewards?.xp_balance ?? 0)} XP</strong><span>${first ? escapeHtml(first.reason) : 'Seu histórico aparece aqui.'}</span>`;

    if (activityList) {
      const recent = history.slice(0, 4);
      activityList.innerHTML = !recent.length
        ? '<p class="mini-empty">Seu histórico de XP ainda vai aparecer aqui.</p>'
        : recent.map((item) => `
            <div class="activity-row">
              <span class="activity-badge">+${Number(item.amount ?? 0)}</span>
              <div>
                <strong>${escapeHtml(item.reason || 'Recompensa')}</strong>
                <small>${new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small>
              </div>
            </div>
          `).join('');
    }
  } catch (error) {
    document.querySelector('#reward-summary').innerHTML = '<strong>0 XP</strong><span>Seu histórico aparece aqui.</span>';
    if (activityList) activityList.innerHTML = '<p class="mini-empty">Não foi possível carregar o histórico.</p>';
  }
}

async function loadInsights() {
  const list = document.querySelector('#insights-list');
  if (!list) return;

  try {
    const analytics = await request('/users/analytics');
    const minutes = Number(analytics?.total_study_minutes ?? 0);
    const average = Number(analytics?.average_session_minutes ?? 0);
    const completed = Number(analytics?.quests_completed ?? 0);

    list.innerHTML = `
      <div class="insight-row"><span>Tempo</span><strong>${minutes} min</strong></div>
      <div class="insight-row"><span>Média</span><strong>${average.toFixed(0)} min</strong></div>
      <div class="insight-row"><span>Missões</span><strong>${completed}</strong></div>
    `;
  } catch (error) {
    list.innerHTML = '<p class="mini-empty">Não foi possível carregar os insights.</p>';
  }
}

async function loadMomentum() {
  const summary = document.querySelector('#momentum-summary');
  if (!summary) return;

  try {
    const [dashboard, quests] = await Promise.all([
      request('/users/dashboard'),
      request('/quests/'),
    ]);
    const user = dashboard?.user;
    const pending = Array.isArray(quests)
      ? quests.filter((quest) => quest.status !== 'completed').sort((a, b) => (b.xp_reward ?? 0) - (a.xp_reward ?? 0))
      : [];
    const progress = Math.max(0, Math.min(100, Number(user?.progress_percent ?? 0)));
    const nextQuest = pending[0];

    summary.innerHTML = `
      <div class="momentum-meter"><span style="width: ${progress}%"></span></div>
      <div class="momentum-head"><strong>${progress}%</strong><span>até o próximo nível</span></div>
      <p>${pending.length ? `${pending.length} tarefa${pending.length > 1 ? 's' : ''} em aberto • ${escapeHtml(nextQuest.title)}` : 'Você está em dia. Escolha um novo alvo.'}</p>
    `;
  } catch (error) {
    summary.innerHTML = '<p class="mini-empty">Não foi possível carregar o momentum.</p>';
  }
}

async function loadNextFocus() {
  const focus = document.querySelector('#next-focus');
  if (!focus) return;

  try {
    const quests = await request('/quests/');
    const pending = Array.isArray(quests)
      ? quests.filter((quest) => quest.status !== 'completed').sort((a, b) => {
          const scoreA = (a.xp_reward ?? 0) / Math.max(1, a.estimated_minutes ?? 1);
          const scoreB = (b.xp_reward ?? 0) / Math.max(1, b.estimated_minutes ?? 1);
          return scoreB - scoreA;
        })
      : [];

    if (!pending.length) {
      focus.innerHTML = '<strong>Sem missão pendente.</strong><span>Escolha a próxima tarefa para manter o ritmo.</span>';
      return;
    }

    const nextQuest = pending[0];
    focus.innerHTML = `
      <strong>${escapeHtml(nextQuest.title)}</strong>
      <span>${Number(nextQuest.xp_reward ?? 0)} XP • ${Number(nextQuest.estimated_minutes ?? 0)} min</span>
      <button class="focus-action" data-quest-id="${nextQuest.id}" type="button">Marcar como concluída</button>
    `;

    const button = focus.querySelector('[data-quest-id]');
    if (button) {
      button.addEventListener('click', () => completeQuest(button.dataset.questId));
    }
  } catch (error) {
    focus.innerHTML = '<strong>Não foi possível calcular.</strong><span>Confira sua conexão ou tente novamente.</span>';
  }
}

async function loadLeaderboard() {
  const list = document.querySelector('#leaderboard-list');
  if (!list) return;

  try {
    const leaderboard = await request('/users/leaderboard');
    const topUsers = Array.isArray(leaderboard) ? leaderboard.slice(0, 3) : [];

    if (!topUsers.length) {
      list.innerHTML = '<p class="mini-empty">Ranking vazio ainda.</p>';
      return;
    }

    list.innerHTML = topUsers.map((user) => `
      <div class="mini-row">
        <span>#${user.rank}</span>
        <strong>${escapeHtml(user.name.split(' ')[0])}</strong>
        <em>${user.xp} XP</em>
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = `<p class="mini-empty">${escapeHtml(error.message)}</p>`;
  }
}

async function loadAchievements() {
  const list = document.querySelector('#achievement-list');
  if (!list) return;

  try {
    const achievements = await request('/achievements/me');
    if (!Array.isArray(achievements) || !achievements.length) {
      list.innerHTML = '<p class="mini-empty">Nenhuma conquista desbloqueada.</p>';
      return;
    }

    list.innerHTML = achievements.map((achievement) => `
      <div class="mini-row">
        <span>${achievement.icon || '🏅'}</span>
        <strong>${escapeHtml(achievement.title)}</strong>
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = `<p class="mini-empty">${escapeHtml(error.message)}</p>`;
  }
}

async function showDashboard() {
  try {
    const dashboard = await request('/users/dashboard');
    updateDashboard(dashboard);
    const analytics = await request('/users/analytics');
    document.querySelector('#study-minutes').textContent = analytics.total_study_minutes;
    showAppView();
    await Promise.all([loadQuests(), loadSubjects(), loadSubjectsList(), loadSessionQuestOptions(), loadSessions(), loadBosses(), loadRewards(), loadNextFocus(), loadLeaderboard(), loadAchievements(), loadInsights(), loadMomentum()]);
  } catch (error) { clearSession(); showAuthError(error.message); }
}

function applyAiProviderPreset(type = 'openai') {
  const providerType = document.querySelector('#plan-provider-type');
  const baseUrl = document.querySelector('#plan-provider-base-url');
  const model = document.querySelector('#plan-provider-model');
  if (!providerType || !baseUrl || !model) return;

  const preset = PLAN_PROVIDER_PRESETS[type] || PLAN_PROVIDER_PRESETS.custom;
  providerType.value = type;
  baseUrl.value = preset.base_url;
  model.value = preset.model;
}

function restorePlanProviderSettings() {
  const providerType = document.querySelector('#plan-provider-type');
  if (!providerType) return;

  const savedType = localStorage.getItem(PLAN_PROVIDER_KEY) || 'openai';
  const selected = Object.prototype.hasOwnProperty.call(PLAN_PROVIDER_PRESETS, savedType) ? savedType : 'openai';
  applyAiProviderPreset(selected);
}

async function handlePlanMaterialFileUpload(event) {
  const file = event.target.files?.[0];
  const contentField = document.querySelector('#plan-content');
  if (!file || !contentField) return;

  if (!file.name.match(/\.(txt|md|markdown)$/i)) {
    window.alert('Use um arquivo em texto ou Markdown (.txt, .md).');
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    contentField.value = (text || '').trim();
    contentField.focus();
  } catch (error) {
    window.alert('Não foi possível ler o arquivo. Tente outro arquivo de texto.');
  } finally {
    event.target.value = '';
  }
}

function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value ?? ''; return element.innerHTML; }
function escapeAttribute(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
authForm.addEventListener('submit', authenticate);
authToggle.addEventListener('click', () => setRegisterMode(!state.registerMode));
document.querySelector('#logout-button').addEventListener('click', () => {
  clearSession();
  showAuthError('Sessão encerrada com sucesso.');
});
document.querySelector('#refresh-button').addEventListener('click', showDashboard);
document.querySelector('#plan-provider-type').addEventListener('change', () => {
  const providerType = document.querySelector('#plan-provider-type');
  if (!providerType) return;
  localStorage.setItem(PLAN_PROVIDER_KEY, providerType.value);
  applyAiProviderPreset(providerType.value);
});
document.querySelector('#plan-material-file').addEventListener('change', handlePlanMaterialFileUpload);
document.querySelector('#plan-provider-base-url').addEventListener('input', () => {
  const providerType = document.querySelector('#plan-provider-type');
  if (providerType && providerType.value !== 'custom') {
    providerType.value = 'custom';
    localStorage.setItem(PLAN_PROVIDER_KEY, 'custom');
  }
});
document.querySelector('#plan-provider-model').addEventListener('input', () => {
  const providerType = document.querySelector('#plan-provider-type');
  if (providerType && providerType.value !== 'custom') {
    providerType.value = 'custom';
    localStorage.setItem(PLAN_PROVIDER_KEY, 'custom');
  }
});
document.querySelectorAll('.preset-button').forEach((button) => {
  button.addEventListener('click', () => {
    const duration = document.querySelector('#session-duration');
    if (!duration) return;
    duration.value = button.dataset.duration;
    document.querySelectorAll('.preset-button').forEach((item) => item.classList.toggle('active', item === button));
    persistSessionPreferences();
    duration.focus();
  });
});
document.querySelector('#session-subject').addEventListener('change', () => {
  persistSessionPreferences();
  loadSessionQuestOptions();
});
document.querySelector('#session-quest').addEventListener('change', persistSessionPreferences);
document.querySelector('#session-duration').addEventListener('input', () => {
  persistSessionPreferences();
  document.querySelectorAll('.preset-button').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.duration) === Number(document.querySelector('#session-duration').value));
  });
});
document.querySelector('#quest-filter').addEventListener('change', () => {
  localStorage.setItem(QUEST_FILTER_KEY, document.querySelector('#quest-filter').value);
  loadQuests();
});
document.querySelector('#quest-sort').addEventListener('change', () => {
  localStorage.setItem(QUEST_SORT_KEY, document.querySelector('#quest-sort').value);
  loadQuests();
});
document.querySelector('#subject-form').addEventListener('submit', createSubject);
document.querySelector('#quest-form').addEventListener('submit', createQuest);
document.querySelector('#generate-plan-form').addEventListener('submit', generateStudyPlan);
document.querySelector('#session-form').addEventListener('submit', createStudySession);
document.querySelector('#boss-form').addEventListener('submit', createBossFight);
restorePlanProviderSettings();
if (state.token) showDashboard(); else showAuthView();
