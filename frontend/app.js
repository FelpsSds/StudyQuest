const API_BASE = 'http://127.0.0.1:8000/api/v1';
const state = { token: localStorage.getItem('studyquest_token'), registerMode: false, generatedPlan: null, sessionTimerInterval: null };
const QUEST_FILTER_KEY = 'studyquest_quest_filter';
const QUEST_SORT_KEY = 'studyquest_quest_sort';
const SESSION_FILTER_KEY = 'studyquest_session_filter';
const SESSION_SUBJECT_FILTER_KEY = 'studyquest_session_subject_filter';
const SESSION_PERIOD_FILTER_KEY = 'studyquest_session_period_filter';
const SESSION_SEARCH_KEY = 'studyquest_session_search';
const SESSION_SUBJECT_KEY = 'studyquest_session_subject';
const SESSION_QUEST_KEY = 'studyquest_session_quest';
const SESSION_DURATION_KEY = 'studyquest_session_duration';
const PLAN_PROVIDER_KEY = 'studyquest_plan_provider';
const PLAN_PROVIDER_PRESETS = {
  openai: { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { base_url: 'http://localhost:11434/v1', model: 'llama3.1' },
  custom: { base_url: '', model: '' },
};
const QUEST_TYPE_LABELS = {
  study: 'Estudo',
  exercises: 'Exercícios',
  practice: 'Prática',
  review: 'Revisão',
  project: 'Projeto',
  boss_fight: 'Boss Fight',
};
const QUEST_DIFFICULTY_LABELS = { easy: 'Fácil', medium: 'Média', hard: 'Difícil', boss: 'Boss' };
const QUEST_STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  archived: 'Arquivada',
};

function getSavedQuestFilter() {
  return localStorage.getItem(QUEST_FILTER_KEY) || 'all';
}

function getSavedQuestSort() {
  return localStorage.getItem(QUEST_SORT_KEY) || 'priority';
}

function getSavedSessionFilter() {
  const filter = localStorage.getItem(SESSION_FILTER_KEY);
  return ['all', 'in_progress', 'completed'].includes(filter) ? filter : 'all';
}

function getSavedSessionPeriodFilter() {
  const filter = localStorage.getItem(SESSION_PERIOD_FILTER_KEY);
  return ['all', 'today', '7days', '30days'].includes(filter) ? filter : 'all';
}

function getFilteredSessions(
  sessions,
  filter = getSavedSessionFilter(),
  subjectFilter = localStorage.getItem(SESSION_SUBJECT_FILTER_KEY) || 'all',
  periodFilter = getSavedSessionPeriodFilter(),
  searchTerm = localStorage.getItem(SESSION_SEARCH_KEY) || '',
  subjects = [],
  quests = [],
) {
  const now = new Date();
  const earliestDate = new Date(now);
  earliestDate.setHours(0, 0, 0, 0);
  if (periodFilter === '7days') earliestDate.setDate(earliestDate.getDate() - 6);
  if (periodFilter === '30days') earliestDate.setDate(earliestDate.getDate() - 29);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-BR');

  const filtered = sessions.filter((session) => {
    const matchesStatus = filter === 'all' || session.status === filter;
    const matchesSubject = subjectFilter === 'all'
      || (subjectFilter === 'none' ? session.subject_id == null : String(session.subject_id) === subjectFilter);
    const startedAt = new Date(session.started_at);
    const matchesPeriod = periodFilter === 'all'
      || (!Number.isNaN(startedAt.getTime()) && startedAt >= earliestDate && startedAt <= now);
    const subject = subjects.find((item) => item.id === session.subject_id);
    const quest = quests.find((item) => item.id === session.quest_id);
    const matchesSearch = !normalizedSearch
      || (subject?.name || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || (quest?.title || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    return matchesStatus && matchesSubject && matchesPeriod && matchesSearch;
  });
  return [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });
}

function csvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[\t\r=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ''}`;
}

function updateActiveSessionTimers() {
  document.querySelectorAll('[data-session-timer]').forEach((timer) => {
    const startedAt = new Date(timer.dataset.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      timer.textContent = 'Tempo indisponível';
      return;
    }

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
    const plannedMinutes = Number(timer.dataset.plannedMinutes);
    const hasPlannedDuration = Number.isFinite(plannedMinutes) && plannedMinutes > 0;
    const isOverPlan = hasPlannedDuration && elapsedMinutes > plannedMinutes;
    timer.classList.toggle('session-timer-overrun', isOverPlan);
    const plannedLabel = hasPlannedDuration
      ? isOverPlan
        ? ` · meta de ${formatDuration(plannedMinutes)} ultrapassada`
        : ` / ${formatDuration(plannedMinutes)} planejados`
      : '';
    timer.textContent = `Tempo: ${formatDuration(elapsedMinutes)}${plannedLabel}`;
    timer.setAttribute(
      'aria-label',
      `Tempo decorrido: ${formatDuration(elapsedMinutes)}${hasPlannedDuration ? `; ${isOverPlan ? 'meta ultrapassada' : `meta de ${formatDuration(plannedMinutes)}`}` : ''}`,
    );
  });
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSessionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOpenQuestDueLabel(quest, today, weekEnd) {
  if (!quest.due_date || quest.status === 'completed' || quest.status === 'archived') return '';
  if (quest.due_date < today) return 'Atrasada';
  if (quest.due_date === today) return 'Vence hoje';
  if (quest.due_date <= weekEnd) return 'Vence em breve';
  return '';
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

function updateDashboard(payload, streak) {
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
  document.querySelector('#streak-value').innerHTML = `${streak.current_streak} <small>dias</small>`;
  document.querySelector('#best-streak').textContent = streak.best_streak;

  if (profileName) profileName.textContent = user.name;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profileStatus) profileStatus.textContent = `${user.level}º nível • ${user.progress_percent}% até o próximo upgrade`;
}

async function loadQuests() {
  const list = document.querySelector('#quests-list');
  const filter = document.querySelector('#quest-filter');
  const sort = document.querySelector('#quest-sort');
  const activeFilter = filter && filter.value !== 'all' ? filter.value : getSavedQuestFilter();
  const activeSort = sort && sort.value !== 'priority' ? sort.value : getSavedQuestSort();

  if (filter) filter.value = activeFilter;
  if (sort) sort.value = activeSort;

  list.innerHTML = '<p class="empty-state">Carregando suas missões...</p>';
  try {
    const quests = await request('/quests/');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = formatLocalDate(now);
    const weekEndDate = new Date(now);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEnd = formatLocalDate(weekEndDate);
    let filteredQuests = quests;

    if (activeFilter === 'pending') {
      filteredQuests = quests.filter((quest) => quest.status !== 'completed');
    } else if (activeFilter === 'completed') {
      filteredQuests = quests.filter((quest) => quest.status === 'completed');
    } else if (activeFilter === 'due:overdue') {
      filteredQuests = quests.filter((quest) =>
        quest.due_date && quest.due_date < today && quest.status !== 'completed' && quest.status !== 'archived'
      );
    } else if (activeFilter === 'due:today') {
      filteredQuests = quests.filter((quest) =>
        quest.due_date === today && quest.status !== 'completed' && quest.status !== 'archived'
      );
    } else if (activeFilter === 'due:week') {
      filteredQuests = quests.filter((quest) =>
        quest.due_date > today && quest.due_date <= weekEnd && quest.status !== 'completed' && quest.status !== 'archived'
      );
    } else if (activeFilter.startsWith('subject:')) {
      const subjectId = activeFilter.split(':')[1];
      filteredQuests = quests.filter((quest) => String(quest.subject_id ?? '') === String(subjectId));
    }

    filteredQuests = [...filteredQuests].sort((a, b) => {
      if (activeSort === 'xp') return (b.xp_reward ?? 0) - (a.xp_reward ?? 0);
      if (activeSort === 'minutes') return (a.estimated_minutes ?? 0) - (b.estimated_minutes ?? 0);
      if (activeSort === 'title') return String(a.title).localeCompare(String(b.title));
      if (activeSort === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.status === b.status) return (b.xp_reward ?? 0) - (a.xp_reward ?? 0);
      return a.status === 'completed' ? 1 : -1;
    });

    if (!filteredQuests.length) {
      list.innerHTML = '<p class="empty-state">Nenhuma missão para este filtro no momento.</p>';
      return;
    }

    list.innerHTML = filteredQuests.map((quest) => `
      <article class="quest-item ${quest.status === 'completed' ? 'completed' : ''}">
        <div class="quest-main">
          <div class="quest-title-line"><h3 class="quest-title">${escapeHtml(quest.title)}</h3>${getOpenQuestDueLabel(quest, today, weekEnd) ? `<span class="quest-due-badge ${quest.due_date < today ? 'overdue' : ''}">${getOpenQuestDueLabel(quest, today, weekEnd)}</span>` : ''}</div>
          <span class="quest-meta">${quest.xp_reward} XP &middot; ${quest.estimated_minutes} min &middot; ${quest.difficulty}</span>
          <details class="quest-details">
            <summary>Ver detalhes</summary>
            <p>${escapeHtml(quest.description || 'Esta missão não tem descrição.')}</p>
            <dl>
              <div><dt>Tipo</dt><dd>${QUEST_TYPE_LABELS[quest.type] || escapeHtml(quest.type)}</dd></div>
              <div><dt>Dificuldade</dt><dd>${QUEST_DIFFICULTY_LABELS[quest.difficulty] || escapeHtml(quest.difficulty)}</dd></div>
              <div><dt>Status</dt><dd>${QUEST_STATUS_LABELS[quest.status] || escapeHtml(quest.status)}</dd></div>
              <div><dt>Prazo</dt><dd>${quest.due_date ? new Date(`${quest.due_date}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</dd></div>
            </dl>
          </details>
          <form class="quest-edit-form hidden" data-quest-edit-form>
            <label class="compact-field">Título<input name="title" maxlength="200" required /></label>
            <label class="compact-field">Descrição<textarea name="description" rows="2"></textarea></label>
            <label class="compact-field">Disciplina<select name="subject_id"><option value="">Sem disciplina</option></select></label>
            <div class="quest-edit-fields">
              <label class="compact-field">Tipo<select name="type">
                <option value="study">Estudo</option><option value="exercises">Exercícios</option><option value="practice">Prática</option>
                <option value="review">Revisão</option><option value="project">Projeto</option><option value="boss_fight">Boss Fight</option>
              </select></label>
              <label class="compact-field">Dificuldade<select name="difficulty">
                <option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option><option value="boss">Boss</option>
              </select></label>
              <label class="compact-field">XP<input name="xp_reward" type="number" min="0" required /></label>
              <label class="compact-field">Minutos<input name="estimated_minutes" type="number" min="1" required /></label>
              <label class="compact-field">Prazo<input name="due_date" type="date" /></label>
            </div>
            <p class="quest-edit-error" role="alert"></p>
            <div class="quest-edit-actions">
              <button class="secondary-button" type="submit">Salvar alterações</button>
              <button class="text-button" data-cancel-quest-edit type="button">Cancelar</button>
            </div>
          </form>
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
        const article = button.closest('.quest-item');
        if (quest && article) startQuestEdit(quest, article);
      });
    });
    list.querySelectorAll('[data-quest-edit-form]').forEach((form) =>
      form.addEventListener('submit', saveQuestEdit)
    );
    list.querySelectorAll('[data-cancel-quest-edit]').forEach((button) =>
      button.addEventListener('click', () => button.closest('[data-quest-edit-form]').classList.add('hidden'))
    );
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadSubjects() {
  const select = document.querySelector('#quest-subject');
  const sessionSelect = document.querySelector('#session-subject');
  const bossSelect = document.querySelector('#boss-subject');
  const planSelect = document.querySelector('#plan-subject');
  const filterSelect = document.querySelector('#quest-filter');
  const subjectSelects = [select, sessionSelect, bossSelect, planSelect];

  try {
    const subjects = await request('/subjects/');
    subjectSelects.forEach((element) => {
      if (!element) return;
      const placeholder = element.options[0]?.cloneNode(true);
      element.replaceChildren();
      if (placeholder) element.appendChild(placeholder);
      subjects.forEach((subject) => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        element.appendChild(option);
      });
    });

    if (sessionSelect) {
      const saved = localStorage.getItem(SESSION_SUBJECT_KEY);
      if (saved && Array.from(sessionSelect.options).some((option) => option.value === saved)) {
        sessionSelect.value = saved;
      }
    }

    if (filterSelect) {
      const activeValue = getSavedQuestFilter();
      filterSelect.innerHTML = '<option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option><option value="due:overdue">Atrasadas</option><option value="due:today">Vencendo hoje</option><option value="due:week">Próximos 7 dias</option>';
      subjects.forEach((subject) => {
        const option = document.createElement('option');
        option.value = `subject:${subject.id}`;
        option.textContent = subject.name;
        filterSelect.appendChild(option);
      });

      const nextValue = activeValue.startsWith('subject:') && subjects.some((subject) => `subject:${subject.id}` === activeValue)
        ? activeValue
        : ['all', 'pending', 'completed', 'due:overdue', 'due:today', 'due:week'].includes(activeValue)
          ? activeValue
          : 'all';
      filterSelect.value = nextValue;
      localStorage.setItem(QUEST_FILTER_KEY, nextValue);
    }
  } catch (error) {
    subjectSelects.forEach((element) => {
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
      <article class="subject-row" style="--subject-color: ${/^#[0-9a-f]{6}$/i.test(subject.color || '') ? subject.color : '#c7f36b'};">
        <div class="subject-row-heading">
          <span class="subject-color-dot" aria-hidden="true"></span>
          <div><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml([subject.professor, subject.semester].filter(Boolean).join(' · ') || 'Disciplina')}</small></div>
        </div>
        <div class="row-actions">
          <button class="mini-edit" data-edit-subject-id="${subject.id}" type="button">Editar</button>
          <button class="mini-delete" data-subject-id="${subject.id}" type="button">Excluir</button>
        </div>
        <form class="subject-edit-form hidden" data-subject-edit-form>
          <label class="compact-field">Nome<input name="name" maxlength="120" required /></label>
          <label class="compact-field">Descrição<textarea name="description" maxlength="500" rows="2"></textarea></label>
          <div class="subject-edit-fields">
            <label class="compact-field">Professor<input name="professor" maxlength="120" /></label>
            <label class="compact-field">Período<input name="semester" maxlength="50" placeholder="Ex.: 2º semestre" /></label>
            <label class="compact-field">Ícone<input name="icon" maxlength="64" /></label>
            <label class="compact-field">Cor<input name="color" type="color" /></label>
          </div>
          <p class="subject-edit-error" role="alert"></p>
          <div class="quest-edit-actions">
            <button class="secondary-button" type="submit">Salvar alterações</button>
            <button class="text-button" data-cancel-subject-edit type="button">Cancelar</button>
          </div>
        </form>
      </article>
    `).join('');

    list.querySelectorAll('[data-subject-id]').forEach((button) => {
      button.addEventListener('click', () => deleteSubject(button.dataset.subjectId));
    });
    list.querySelectorAll('[data-edit-subject-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const subject = subjects.find((item) => item.id === Number(button.dataset.editSubjectId));
        const row = button.closest('.subject-row');
        if (subject && row) startSubjectEdit(subject, row);
      });
    });
    list.querySelectorAll('[data-subject-edit-form]').forEach((form) =>
      form.addEventListener('submit', saveSubjectEdit)
    );
    list.querySelectorAll('[data-cancel-subject-edit]').forEach((button) =>
      button.addEventListener('click', () => button.closest('[data-subject-edit-form]').classList.add('hidden'))
    );
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

function startSubjectEdit(subject, row) {
  const form = row.querySelector('[data-subject-edit-form]');
  if (!form) return;
  form.elements.name.value = subject.name || '';
  form.elements.description.value = subject.description || '';
  form.elements.professor.value = subject.professor || '';
  form.elements.semester.value = subject.semester || '';
  form.elements.icon.value = subject.icon || '';
  form.elements.color.value = /^#[0-9a-f]{6}$/i.test(subject.color || '') ? subject.color : '#c7f36b';
  form.querySelector('.subject-edit-error').textContent = '';
  form.classList.remove('hidden');
  form.elements.name.focus();
}

async function saveSubjectEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const row = form.closest('.subject-row');
  const subjectId = row?.querySelector('[data-edit-subject-id]')?.dataset.editSubjectId;
  const errorMessage = form.querySelector('.subject-edit-error');
  const submitButton = form.querySelector('[type="submit"]');
  if (!subjectId) return;

  const payload = {
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim() || null,
    professor: form.elements.professor.value.trim() || null,
    semester: form.elements.semester.value.trim() || null,
    icon: form.elements.icon.value.trim() || null,
    color: form.elements.color.value,
  };
  if (!payload.name) {
    errorMessage.textContent = 'O nome da disciplina não pode ficar vazio.';
    return;
  }

  submitButton.disabled = true;
  errorMessage.textContent = '';
  try {
    await request(`/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await showDashboard();
  } catch (error) {
    errorMessage.textContent = error.message;
    submitButton.disabled = false;
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

async function startQuestEdit(quest, article) {
  const form = article.querySelector('[data-quest-edit-form]');
  if (!form) return;
  const subjectSelect = form.elements.subject_id;
  const editButton = article.querySelector('[data-edit-quest-id]');
  editButton.disabled = true;

  try {
    const subjects = await request('/subjects/');
    subjectSelect.replaceChildren(new Option('Sem disciplina', ''));
    subjects.forEach((subject) => subjectSelect.add(new Option(subject.name, String(subject.id))));
    form.elements.title.value = quest.title || '';
    form.elements.description.value = quest.description || '';
    form.elements.subject_id.value = quest.subject_id == null ? '' : String(quest.subject_id);
    form.elements.type.value = quest.type;
    form.elements.difficulty.value = quest.difficulty;
    form.elements.xp_reward.value = String(quest.xp_reward ?? 0);
    form.elements.estimated_minutes.value = String(quest.estimated_minutes ?? 30);
    form.elements.due_date.value = quest.due_date || '';
    form.querySelector('.quest-edit-error').textContent = '';
    form.classList.remove('hidden');
    form.elements.title.focus();
  } catch (error) {
    window.alert(error.message);
  } finally {
    editButton.disabled = false;
  }
}

async function saveQuestEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const article = form.closest('.quest-item');
  const questId = article?.querySelector('[data-edit-quest-id]')?.dataset.editQuestId;
  const errorMessage = form.querySelector('.quest-edit-error');
  const submitButton = form.querySelector('[type="submit"]');
  if (!questId) return;

  const payload = {
    title: form.elements.title.value.trim(),
    description: form.elements.description.value.trim() || null,
    subject_id: form.elements.subject_id.value ? Number(form.elements.subject_id.value) : null,
    type: form.elements.type.value,
    difficulty: form.elements.difficulty.value,
    xp_reward: Number(form.elements.xp_reward.value),
    estimated_minutes: Number(form.elements.estimated_minutes.value),
    due_date: form.elements.due_date.value || null,
  };
  if (!payload.title || !Number.isInteger(payload.xp_reward) || payload.xp_reward < 0
    || !Number.isInteger(payload.estimated_minutes) || payload.estimated_minutes <= 0) {
    errorMessage.textContent = 'Confira o título, o XP e a duração antes de salvar.';
    return;
  }

  submitButton.disabled = true;
  errorMessage.textContent = '';
  try {
    await request(`/quests/${questId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await showDashboard();
  } catch (error) {
    errorMessage.textContent = error.message;
    submitButton.disabled = false;
  }
}

function toggleProfileEdit(show) {
  const form = document.querySelector('#profile-edit-form');
  const toggle = document.querySelector('#profile-edit-toggle');
  if (!form || !toggle) return;
  form.classList.toggle('hidden', !show);
  toggle.classList.toggle('hidden', show);
  if (show) {
    document.querySelector('#profile-name-input').value = document.querySelector('#profile-name').textContent;
    document.querySelector('#profile-edit-error').textContent = '';
    document.querySelector('#profile-name-input').focus();
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const error = document.querySelector('#profile-edit-error');
  const submit = form.querySelector('[type="submit"]');
  if (!name) {
    error.textContent = 'Informe um nome para salvar o perfil.';
    return;
  }

  submit.disabled = true;
  error.textContent = '';
  try {
    await request('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    toggleProfileEdit(false);
    await showDashboard();
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    submit.disabled = false;
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
        title: document.querySelector('#quest-title').value.trim(),
        description: document.querySelector('#quest-description').value.trim() || null,
        type: document.querySelector('#quest-type').value,
        difficulty: document.querySelector('#quest-difficulty').value,
        xp_reward: Number(document.querySelector('#quest-xp').value),
        estimated_minutes: Number(document.querySelector('#quest-minutes').value),
        status: 'pending',
        due_date: document.querySelector('#quest-due-date').value || null,
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
  const filter = document.querySelector('#session-filter');
  const subjectFilter = document.querySelector('#session-subject-filter');
  const periodFilter = document.querySelector('#session-period-filter');
  const searchInput = document.querySelector('#session-search');
  if (!list) return;

  const activeFilter = getSavedSessionFilter();
  let activeSubjectFilter = localStorage.getItem(SESSION_SUBJECT_FILTER_KEY) || 'all';
  const activePeriodFilter = getSavedSessionPeriodFilter();
  const activeSearch = localStorage.getItem(SESSION_SEARCH_KEY) || '';
  if (filter) filter.value = activeFilter;
  if (periodFilter) periodFilter.value = activePeriodFilter;
  if (state.sessionTimerInterval) {
    window.clearInterval(state.sessionTimerInterval);
    state.sessionTimerInterval = null;
  }
  if (searchInput) searchInput.value = activeSearch;

  try {
    const [sessions, subjects, quests] = await Promise.all([
      request('/study-sessions/'),
      request('/subjects/'),
      request('/quests/'),
    ]);
    if (!sessions.length) {
      list.innerHTML = '<p class="small-empty">Nenhuma sessão registrada ainda.</p>';
      return;
    }

    if (subjectFilter) {
      const validSubjectFilters = new Set(['all', 'none', ...subjects.map((subject) => String(subject.id))]);
      if (!validSubjectFilters.has(activeSubjectFilter)) {
        activeSubjectFilter = 'all';
        localStorage.setItem(SESSION_SUBJECT_FILTER_KEY, activeSubjectFilter);
      }
      subjectFilter.innerHTML = '<option value="all">Todas as disciplinas</option><option value="none">Sem disciplina</option>';
      subjects.forEach((subject) => {
        const option = document.createElement('option');
        option.value = String(subject.id);
        option.textContent = subject.name;
        subjectFilter.appendChild(option);
      });
      subjectFilter.value = activeSubjectFilter;
    }

    const orderedSessions = getFilteredSessions(
      sessions,
      activeFilter,
      activeSubjectFilter,
      activePeriodFilter,
      activeSearch,
      subjects,
      quests,
    );
    if (!orderedSessions.length) {
      list.innerHTML = '<p class="small-empty">Nenhuma sessão encontrada com este filtro.</p>';
      return;
    }

    list.innerHTML = orderedSessions.map((session) => {
      const subject = subjects.find((item) => item.id === session.subject_id);
      const quest = quests.find((item) => item.id === session.quest_id);
      const duration = Number(session.duration_minutes);
      const durationLabel = Number.isFinite(duration) && duration > 0
        ? formatDuration(duration)
        : session.status === 'in_progress' ? 'Duração não definida' : 'Duração indisponível';
      const activeTimer = session.status === 'in_progress'
        ? `<span class="session-timer" data-session-timer data-started-at="${escapeAttribute(session.started_at)}" data-planned-minutes="${Number.isFinite(duration) && duration > 0 ? duration : ''}" role="timer" aria-live="off"></span>`
        : '';
      return `
        <article class="session-row ${session.status === 'completed' ? 'session-completed' : 'session-active'}">
          <div class="session-info">
            <strong>${escapeHtml(subject?.name || (session.subject_id ? 'Disciplina removida' : 'Sessão livre'))}</strong>
            ${quest ? `<span>${escapeHtml(quest.title)}</span>` : session.quest_id ? '<span>Missão removida</span>' : ''}
            <small>${session.status === 'completed' ? 'Concluída' : 'Em andamento'} · ${formatSessionDate(session.started_at)}${session.status === 'in_progress' ? '' : ` · ${durationLabel}`}</small>
            ${activeTimer}
            ${session.status === 'in_progress' && durationLabel !== 'Duração não definida' ? `<small class="session-planned-duration">Meta: ${durationLabel}</small>` : ''}
          </div>
          <div class="row-actions">
            <button class="mini-delete" data-delete-session-id="${session.id}" type="button">Excluir</button>
            ${session.status === 'in_progress' ? `<button class="mini-edit" data-session-id="${session.id}" type="button">Finalizar</button>` : ''}
          </div>
        </article>
      `;
    }).join('');

    updateActiveSessionTimers();
    if (orderedSessions.some((session) => session.status === 'in_progress')) {
      state.sessionTimerInterval = window.setInterval(updateActiveSessionTimers, 15000);
    }

    list.querySelectorAll('[data-session-id]').forEach((button) => {
      button.addEventListener('click', () => completeStudySession(button.dataset.sessionId));
    });
    list.querySelectorAll('[data-delete-session-id]').forEach((button) => {
      button.addEventListener('click', () => deleteStudySession(button.dataset.deleteSessionId));
    });
  } catch (error) {
    list.innerHTML = `<p class="small-empty">${escapeHtml(error.message || 'Não foi possível carregar as sessões.')}</p>`;
  }
}

async function exportStudySessions() {
  try {
    const [sessions, subjects, quests] = await Promise.all([
      request('/study-sessions/'),
      request('/subjects/'),
      request('/quests/'),
    ]);
    const visibleSessions = getFilteredSessions(
      sessions,
      undefined,
      undefined,
      undefined,
      undefined,
      subjects,
      quests,
    );
    if (!visibleSessions.length) {
      window.alert('Não há sessões para exportar com o filtro selecionado.');
      return;
    }

    const rows = [
      ['Data de início', 'Situação', 'Disciplina', 'Missão', 'Duração (min)'],
      ...visibleSessions.map((session) => {
        const subject = subjects.find((item) => item.id === session.subject_id);
        const quest = quests.find((item) => item.id === session.quest_id);
        return [
          formatSessionDate(session.started_at),
          session.status === 'completed' ? 'Concluída' : 'Em andamento',
          subject?.name || (session.subject_id ? 'Disciplina removida' : 'Sessão livre'),
          quest?.title || (session.quest_id ? 'Missão removida' : ''),
          session.duration_minutes ?? '',
        ];
      }),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `studyquest-sessoes-${formatLocalDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    window.alert(error.message || 'Não foi possível exportar as sessões.');
  }
}

function clearSessionHistoryFilters() {
  window.clearTimeout(sessionSearchTimeout);
  localStorage.removeItem(SESSION_FILTER_KEY);
  localStorage.removeItem(SESSION_SUBJECT_FILTER_KEY);
  localStorage.removeItem(SESSION_PERIOD_FILTER_KEY);
  localStorage.removeItem(SESSION_SEARCH_KEY);
  document.querySelector('#session-filter').value = 'all';
  document.querySelector('#session-subject-filter').value = 'all';
  document.querySelector('#session-period-filter').value = 'all';
  document.querySelector('#session-search').value = '';
  loadSessions();
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
    const [bosses, quests, subjects] = await Promise.all([
      request('/boss-fights/'),
      request('/quests/'),
      request('/subjects/'),
    ]);
    if (!bosses.length) {
      list.innerHTML = '<p class="small-empty">Nenhum boss fight registrado.</p>';
      return;
    }

    list.innerHTML = bosses.map((boss) => {
      const linkedQuests = quests.filter((quest) => quest.boss_fight_id === boss.id);
      const hpPercent = Math.max(0, Math.min(100, Number(boss.hp_current) / Math.max(1, Number(boss.hp_max)) * 100));
      const subjectName = subjects.find((subject) => subject.id === boss.subject_id)?.name || 'Disciplina removida';
      return `
        <article class="boss-card ${boss.status === 'completed' ? 'completed' : ''}">
          <div class="boss-card-heading">
            <div>
              <strong>${escapeHtml(boss.title)}</strong>
              <small>${escapeHtml(subjectName)} · ${boss.status === 'completed' ? 'Derrotado' : 'Ativo'}</small>
            </div>
            <span class="boss-hp-label">${Number(boss.hp_current)} / ${Number(boss.hp_max)} HP</span>
          </div>
          <div class="boss-health" role="progressbar" aria-label="Vida de ${escapeAttribute(boss.title)}" aria-valuemin="0" aria-valuemax="${Number(boss.hp_max)}" aria-valuenow="${Number(boss.hp_current)}">
            <span style="width: ${hpPercent}%"></span>
          </div>
          <div class="boss-card-meta"><span>Recompensa: ${Number(boss.xp_reward ?? 0)} XP</span></div>
          <details class="boss-quests">
            <summary>Missões vinculadas (${linkedQuests.length})</summary>
            ${linkedQuests.length
              ? `<ul>${linkedQuests.map((quest) => `<li class="${quest.status === 'completed' ? 'completed' : ''}"><span>${escapeHtml(quest.title)}</span><small>${quest.status === 'completed' ? 'Concluída' : `${Number(quest.boss_damage)} dano`}</small></li>`).join('')}</ul>`
              : '<p>Nenhuma missão está vinculada a este Boss Fight.</p>'}
          </details>
          <div class="row-actions boss-card-actions">
            <button class="mini-delete" data-delete-boss-id="${boss.id}" type="button">Excluir</button>
            <button class="mini-delete" data-boss-id="${boss.id}" type="button" ${boss.status === 'completed' ? 'disabled' : ''}>${boss.status === 'completed' ? 'Vencido' : 'Derrotar'}</button>
          </div>
        </article>
      `;
    }).join('');

    list.querySelectorAll('[data-boss-id]').forEach((button) => {
      button.addEventListener('click', () => completeBossFight(button.dataset.bossId));
    });
    list.querySelectorAll('[data-delete-boss-id]').forEach((button) => {
      button.addEventListener('click', () => deleteBossFight(button.dataset.deleteBossId));
    });
  } catch (error) {
    list.innerHTML = `<p class="small-empty">${escapeHtml(error.message || 'Não foi possível carregar os Boss Fights.')}</p>`;
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
    const weeklyActivity = Array.isArray(analytics?.weekly_activity) ? analytics.weekly_activity : [];
    const maxDailyMinutes = Math.max(1, ...weeklyActivity.map((day) => Number(day.minutes) || 0));

    list.innerHTML = `
      <div class="insight-row"><span>Tempo</span><strong>${minutes} min</strong></div>
      <div class="insight-row"><span>Média</span><strong>${average.toFixed(0)} min</strong></div>
      <div class="insight-row"><span>Missões</span><strong>${completed}</strong></div>
      <div class="weekly-activity">
        <div class="weekly-activity-heading"><strong>Últimos 7 dias</strong><span>${weeklyActivity.reduce((total, day) => total + (Number(day.minutes) || 0), 0)} min</span></div>
        ${weeklyActivity.length
          ? `<div class="weekly-activity-chart" role="group" aria-label="Minutos de estudo concluído por dia nos últimos sete dias">${weeklyActivity.map((day) => {
              const date = new Date(`${day.date}T00:00:00Z`);
              const label = Number.isNaN(date.getTime()) ? day.date : date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
              const dayMinutes = Number(day.minutes) || 0;
              const height = dayMinutes > 0 ? Math.max(8, dayMinutes / maxDailyMinutes * 100) : 0;
              return `<div class="weekly-activity-day" role="img" aria-label="${escapeAttribute(label)}: ${dayMinutes} minutos, ${Number(day.sessions) || 0} sessões"><span class="weekly-activity-bar"><span style="height: ${height}%"></span></span><small>${escapeHtml(label)}</small></div>`;
            }).join('')}</div>`
          : '<p class="mini-empty">Sem atividade recente.</p>'}
      </div>
    `;
  } catch (error) {
    list.innerHTML = `<p class="mini-empty">${escapeHtml(error.message || 'Não foi possível carregar os insights.')}</p>`;
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
    const achievements = await request('/achievements/progress');
    if (!Array.isArray(achievements) || !achievements.length) {
      list.innerHTML = '<p class="mini-empty">Nenhuma conquista disponível.</p>';
      return;
    }

    list.innerHTML = achievements.map((achievement) => `
      <article class="achievement-row ${achievement.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-row-heading">
          <span aria-hidden="true">${escapeHtml(achievement.icon || '🏅')}</span>
          <div><strong>${escapeHtml(achievement.title)}</strong><small>${escapeHtml(achievement.description)}</small></div>
          <em>${achievement.unlocked ? 'Desbloqueada' : `${Number(achievement.current_value)} / ${Number(achievement.criteria_value)}`}</em>
        </div>
        <div class="achievement-progress" role="progressbar" aria-label="Progresso: ${escapeAttribute(achievement.title)}" aria-valuemin="0" aria-valuemax="${Number(achievement.criteria_value)}" aria-valuenow="${Number(achievement.current_value)}">
          <span style="width: ${Math.max(0, Math.min(100, Number(achievement.current_value) / Math.max(1, Number(achievement.criteria_value)) * 100))}%"></span>
        </div>
      </article>
    `).join('');
  } catch (error) {
    list.innerHTML = `<p class="mini-empty">${escapeHtml(error.message)}</p>`;
  }
}

async function showDashboard() {
  try {
    const [dashboard, streak] = await Promise.all([
      request('/users/dashboard'),
      request('/users/streak'),
    ]);
    updateDashboard(dashboard, streak);
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
document.querySelector('#session-filter').addEventListener('change', () => {
  localStorage.setItem(SESSION_FILTER_KEY, document.querySelector('#session-filter').value);
  loadSessions();
});
document.querySelector('#session-subject-filter').addEventListener('change', () => {
  localStorage.setItem(SESSION_SUBJECT_FILTER_KEY, document.querySelector('#session-subject-filter').value);
  loadSessions();
});
document.querySelector('#session-period-filter').addEventListener('change', () => {
  localStorage.setItem(SESSION_PERIOD_FILTER_KEY, document.querySelector('#session-period-filter').value);
  loadSessions();
});
let sessionSearchTimeout;
document.querySelector('#session-search').addEventListener('input', (event) => {
  localStorage.setItem(SESSION_SEARCH_KEY, event.target.value);
  window.clearTimeout(sessionSearchTimeout);
  sessionSearchTimeout = window.setTimeout(loadSessions, 250);
});
document.querySelector('#clear-session-filters').addEventListener('click', clearSessionHistoryFilters);
document.querySelector('#export-session-history').addEventListener('click', exportStudySessions);
document.querySelector('#subject-form').addEventListener('submit', createSubject);
document.querySelector('#quest-form').addEventListener('submit', createQuest);
document.querySelector('#generate-plan-form').addEventListener('submit', generateStudyPlan);
document.querySelector('#session-form').addEventListener('submit', createStudySession);
document.querySelector('#boss-form').addEventListener('submit', createBossFight);
document.querySelector('#profile-edit-toggle').addEventListener('click', () => toggleProfileEdit(true));
document.querySelector('#profile-edit-cancel').addEventListener('click', () => toggleProfileEdit(false));
document.querySelector('#profile-edit-form').addEventListener('submit', saveProfile);
restorePlanProviderSettings();
if (state.token) showDashboard(); else showAuthView();
