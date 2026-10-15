import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jsonRequest, request, setAccessToken } from './api.js';

const EMPTY_DATA = {
  dashboard: null,
  streak: null,
  quests: [],
  subjects: [],
  sessions: [],
  bosses: [],
  achievements: [],
  leaderboard: [],
  analytics: null,
  rewards: null,
};

function formatDuration(minutes = 0) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
}

function formatDate(value) {
  if (!value) return 'Sem prazo';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleDateString('pt-BR');
}

function parseApiDateTime(value) {
  if (!value) return new Date(Number.NaN);
  const serialized = String(value);
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(serialized);
  return new Date(hasTimezone ? serialized : `${serialized}Z`);
}

function formatDateTime(value) {
  const date = parseApiDateTime(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Algo deu errado. Tente novamente.';
}

function AuthScreen({ onAuthenticated, initialError = '' }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || ''),
    };
    if (register) payload.name = String(form.get('name') || '').trim();
    setBusy(true);
    setError('');
    try {
      const response = await request(register ? '/auth/register' : '/auth/login', jsonRequest('POST', payload));
      setAccessToken(response.access_token);
      await onAuthenticated();
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <span className="eyebrow">STUDYQUEST / 01</span>
        <h1>Transforme estudo em <em>aventura.</em></h1>
        <p>Uma central tranquila para acompanhar suas missões, XP e ritmo de aprendizagem.</p>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="brand-note">FOCO · RITMO · EVOLUÇÃO</div>
      </section>
      <section className="auth-panel">
        <div className="panel-heading">
          <span className="kicker">{register ? 'SUA PRÓXIMA JORNADA' : 'BEM-VINDO DE VOLTA'}</span>
          <h2>{register ? 'Começar uma nova jornada' : 'Entrar na sua jornada'}</h2>
        </div>
        <form onSubmit={submit}>
          {register && <label className="field">Nome<input name="name" type="text" autoComplete="name" maxLength="120" required /></label>}
          <label className="field">E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label className="field">Senha<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required /></label>
          <button className="primary-button" type="submit" disabled={busy}>
            <span>{busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}</span><span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="error-message" role="alert">{error}</p>
        <button className="text-button" type="button" onClick={() => { setRegister((value) => !value); setError(''); }}>
          {register ? 'Já tenho uma conta' : 'Ainda não tenho uma conta'}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ data, refresh, onLogout, onError }) {
  const [filter, setFilter] = useState(localStorage.getItem('studyquest_quest_filter') || 'all');
  const [sort, setSort] = useState(localStorage.getItem('studyquest_quest_sort') || 'priority');
  const [questSubjectFilter, setQuestSubjectFilter] = useState(localStorage.getItem('studyquest_quest_subject_filter') || 'all');
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [sessionSubject, setSessionSubject] = useState('');
  const [sessionQuest, setSessionQuest] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all');
  const [sessionSubjectFilter, setSessionSubjectFilter] = useState('all');
  const [sessionPeriodFilter, setSessionPeriodFilter] = useState('all');
  const [sessionSearch, setSessionSearch] = useState('');
  const [planProvider, setPlanProvider] = useState('server');
  const [planProviderUrl, setPlanProviderUrl] = useState('');
  const [planProviderModel, setPlanProviderModel] = useState('');
  const [planProviderApiKey, setPlanProviderApiKey] = useState('');
  const [planContent, setPlanContent] = useState('');
  const [planMaterialName, setPlanMaterialName] = useState('');
  const [planMaterialError, setPlanMaterialError] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingQuestId, setEditingQuestId] = useState(null);
  const [editingQuestSubject, setEditingQuestSubject] = useState('');
  const [editingQuestBossId, setEditingQuestBossId] = useState('');
  const [questSubject, setQuestSubject] = useState('');
  const [planDraft, setPlanDraft] = useState(null);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const busyKeysRef = useRef(new Set());
  const [now, setNow] = useState(Date.now());
  const user = data.dashboard?.user;
  const stats = data.dashboard?.stats;
  const recentRewards = data.rewards?.xp_history?.slice(0, 4) || [];
  const weeklyActivity = data.analytics?.weekly_activity || [];
  const weeklyStudyMinutes = weeklyActivity.reduce((total, day) => total + (Number(day.minutes) || 0), 0);
  const weeklySessionCount = weeklyActivity.reduce((total, day) => total + (Number(day.sessions) || 0), 0);
  const weeklyAverageMinutes = weeklySessionCount ? Math.round(weeklyStudyMinutes / weeklySessionCount) : 0;
  const weeklyPeakMinutes = Math.max(1, ...weeklyActivity.map((day) => Number(day.minutes) || 0));
  const topLeaderboard = data.leaderboard.slice(0, 5);
  const currentLeaderboard = data.leaderboard.find((item) => item.id === user?.id);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const questList = useMemo(() => {
    const today = localDateKey();
    const effectiveSubjectFilter = ['all', 'none'].includes(questSubjectFilter) || data.subjects.some((subject) => String(subject.id) === questSubjectFilter) ? questSubjectFilter : 'all';
    const filtered = data.quests.filter((quest) => {
      if (effectiveSubjectFilter === 'none' && quest.subject_id != null) return false;
      if (effectiveSubjectFilter !== 'all' && effectiveSubjectFilter !== 'none' && String(quest.subject_id) !== effectiveSubjectFilter) return false;
      if (filter === 'pending') return quest.status === 'pending';
      if (filter === 'in_progress') return quest.status === 'in_progress';
      if (filter === 'completed') return quest.status === 'completed';
      if (filter === 'archived') return quest.status === 'archived';
      if (filter === 'overdue') return quest.due_date && quest.due_date < today && !['completed', 'archived'].includes(quest.status);
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'due_date') return (a.due_date || '9999').localeCompare(b.due_date || '9999');
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'minutes') return (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
      if (sort === 'xp') return (b.xp_reward || 0) - (a.xp_reward || 0);
      if (a.status === b.status) return (b.xp_reward || 0) - (a.xp_reward || 0);
      const statusOrder = { in_progress: 0, pending: 1, archived: 2, completed: 3 };
      return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    });
  }, [data.quests, data.subjects, filter, sort, questSubjectFilter]);

  const nextFocusQuest = useMemo(() => data.quests
    .filter((quest) => !['completed', 'archived'].includes(quest.status))
    .sort((a, b) => (Number(b.xp_reward) || 0) / Math.max(1, Number(b.estimated_minutes) || 1) - (Number(a.xp_reward) || 0) / Math.max(1, Number(a.estimated_minutes) || 1))[0], [data.quests]);

  const activeSession = useMemo(
    () => data.sessions.find((session) => session.status === 'in_progress'),
    [data.sessions],
  );

  const filteredSessions = useMemo(() => {
    const cutoff = sessionPeriodFilter === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : sessionPeriodFilter === '7days' ? Date.now() - 7 * 86_400_000
        : sessionPeriodFilter === '30days' ? Date.now() - 30 * 86_400_000 : null;
    const term = sessionSearch.trim().toLocaleLowerCase('pt-BR');
    return [...data.sessions].filter((session) => {
      if (sessionStatusFilter !== 'all' && session.status !== sessionStatusFilter) return false;
      if (sessionSubjectFilter === 'none' && session.subject_id != null) return false;
      if (sessionSubjectFilter !== 'all' && sessionSubjectFilter !== 'none' && String(session.subject_id) !== sessionSubjectFilter) return false;
      const startedAt = parseApiDateTime(session.started_at).getTime();
      if (cutoff != null && (!Number.isFinite(startedAt) || startedAt < cutoff)) return false;
      const subject = data.subjects.find((item) => item.id === session.subject_id)?.name || '';
      const quest = data.quests.find((item) => item.id === session.quest_id)?.title || '';
      return !term || `${subject} ${quest}`.toLocaleLowerCase('pt-BR').includes(term);
    }).sort((a, b) => parseApiDateTime(b.started_at).getTime() - parseApiDateTime(a.started_at).getTime());
  }, [data.sessions, data.subjects, data.quests, sessionStatusFilter, sessionSubjectFilter, sessionPeriodFilter, sessionSearch]);

  async function run(key, action) {
    if (busyKeysRef.current.has(key)) return;
    const started = new Set(busyKeysRef.current);
    started.add(key);
    busyKeysRef.current = started;
    setBusyKeys(started);
    try {
      await action();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      const finished = new Set(busyKeysRef.current);
      finished.delete(key);
      busyKeysRef.current = finished;
      setBusyKeys(finished);
    }
  }

  async function createSubject(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run('subject', async () => {
      await request('/subjects/', jsonRequest('POST', {
        name: String(form.get('name')).trim(),
        color: String(form.get('color') || '#c7f36b'),
      }));
      formElement.reset();
      await refresh();
    });
  }

  async function updateSubject(event, subjectId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(`subject-${subjectId}`, async () => {
      await request(`/subjects/${subjectId}`, jsonRequest('PUT', {
        name: String(form.get('name')).trim(),
        description: String(form.get('description') || '').trim() || null,
        professor: String(form.get('professor') || '').trim() || null,
        semester: String(form.get('semester') || '').trim() || null,
        icon: String(form.get('icon') || '').trim() || null,
        color: String(form.get('color') || '#c7f36b'),
      }));
      setEditingSubjectId(null);
      await refresh();
    });
  }

  async function createQuest(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run('quest', async () => {
      const subjectId = form.get('subject_id');
      const bossFightId = form.get('boss_fight_id');
      await request('/quests/', jsonRequest('POST', {
        title: String(form.get('title')).trim(),
        description: String(form.get('description') || '').trim() || null,
        type: String(form.get('type') || 'study'),
        difficulty: String(form.get('difficulty') || 'medium'),
        xp_reward: Number(form.get('xp_reward') || 0),
        boss_damage: Number(form.get('boss_damage') || 0),
        estimated_minutes: Number(form.get('estimated_minutes') || 30),
        due_date: String(form.get('due_date') || '') || null,
        subject_id: subjectId ? Number(subjectId) : null,
        boss_fight_id: bossFightId ? Number(bossFightId) : null,
        status: 'pending',
      }));
      formElement.reset();
      setQuestSubject('');
      await refresh();
    });
  }

  async function completeQuest(questId) {
    await run(`quest-${questId}`, async () => {
      await request(`/quests/${questId}/complete`, jsonRequest('POST', { notes: 'Concluída pelo painel React' }));
      await refresh();
    });
  }

  async function updateQuestStatus(quest, status) {
    await run(`quest-${quest.id}`, async () => {
      await request(`/quests/${quest.id}`, jsonRequest('PUT', { status }));
      await refresh();
    });
  }

  async function updateQuest(event, questId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(`quest-${questId}`, async () => {
      await request(`/quests/${questId}`, jsonRequest('PUT', {
        title: String(form.get('title')).trim(),
        description: String(form.get('description') || '').trim() || null,
        type: String(form.get('type')),
        difficulty: String(form.get('difficulty')),
        xp_reward: Number(form.get('xp_reward')),
        boss_damage: Number(form.get('boss_damage')),
        estimated_minutes: Number(form.get('estimated_minutes')),
        due_date: String(form.get('due_date') || '') || null,
        subject_id: form.get('subject_id') ? Number(form.get('subject_id')) : null,
        boss_fight_id: form.get('boss_fight_id') ? Number(form.get('boss_fight_id')) : null,
      }));
      setEditingQuestId(null);
      setEditingQuestSubject('');
      setEditingQuestBossId('');
      await refresh();
    });
  }

  function editQuest(quest) {
    setEditingQuestId(quest.id);
    setEditingQuestSubject(String(quest.subject_id || ''));
    setEditingQuestBossId(String(quest.boss_fight_id || ''));
  }

  async function deleteQuest(quest) {
    if (!window.confirm(`Excluir a missão “${quest.title}”?`)) return;
    await run(`quest-${quest.id}`, async () => {
      await request(`/quests/${quest.id}`, { method: 'DELETE' });
      await refresh();
    });
  }

  async function deleteSubject(subject) {
    if (!window.confirm(`Excluir a disciplina “${subject.name}”? As missões e os desafios vinculados também serão excluídos.`)) return;
    await run(`subject-${subject.id}`, async () => {
      await request(`/subjects/${subject.id}`, { method: 'DELETE' });
      await refresh();
    });
  }

  async function startSession(event) {
    event.preventDefault();
    await run('session', async () => {
      await request('/study-sessions/', jsonRequest('POST', {
        duration_minutes: Number(sessionMinutes),
        subject_id: sessionSubject ? Number(sessionSubject) : null,
        quest_id: sessionQuest ? Number(sessionQuest) : null,
      }));
      await refresh();
    });
  }

  async function completeSession(sessionId) {
    await run(`session-${sessionId}`, async () => {
      await request(`/study-sessions/${sessionId}/complete`, { method: 'PATCH' });
      await refresh();
    });
  }

  async function deleteSession(session) {
    if (!window.confirm(`Excluir a sessão de ${formatDateTime(session.started_at)} do histórico?`)) return;
    await run(`session-${session.id}`, async () => {
      await request(`/study-sessions/${session.id}`, { method: 'DELETE' });
      await refresh();
    });
  }

  function exportSessions() {
    const rows = [
      ['Data', 'Situação', 'Disciplina', 'Missão', 'Duração (min)'],
      ...filteredSessions.map((session) => [
        formatDateTime(session.started_at),
        session.status === 'completed' ? 'Concluída' : 'Em andamento',
        data.subjects.find((item) => item.id === session.subject_id)?.name || 'Estudo livre',
        data.quests.find((item) => item.id === session.quest_id)?.title || '',
        session.duration_minutes ?? '',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'studyquest-sessoes.csv';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createBossFight(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run('boss', async () => {
      const hp = Number(form.get('hp_max'));
      await request('/boss-fights/', jsonRequest('POST', {
        subject_id: Number(form.get('subject_id')),
        title: String(form.get('title')).trim(),
        hp_max: hp,
        hp_current: hp,
        xp_reward: Number(form.get('xp_reward')),
      }));
      formElement.reset();
      await refresh();
    });
  }

  async function deleteBossFight(boss) {
    if (!window.confirm(`Excluir o desafio “${boss.title}”?`)) return;
    await run(`boss-${boss.id}`, async () => {
      await request(`/boss-fights/${boss.id}`, { method: 'DELETE' });
      await refresh();
    });
  }

  async function completeBossFight(boss) {
    await run(`boss-${boss.id}`, async () => {
      await request(`/boss-fights/${boss.id}/complete`, { method: 'PATCH' });
      await refresh();
    });
  }

  async function generatePlan(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run('plan', async () => {
      const subjectId = form.get('subject_id');
      const payload = {
        title: String(form.get('title')).trim(),
        content: String(form.get('content') || '').trim(),
        goal: String(form.get('goal') || '').trim() || null,
        audience: String(form.get('audience') || '').trim() || null,
        learning_style: String(form.get('learning_style') || 'objetivo'),
        provider_base_url: String(form.get('provider_base_url') || '').trim() || null,
        provider_model: String(form.get('provider_model') || '').trim() || null,
        provider_api_key: String(form.get('provider_api_key') || '').trim() || null,
        subject_id: subjectId ? Number(subjectId) : null,
        preview_only: true,
      };
      const preview = await request('/quests/generate-plan', jsonRequest('POST', payload));
      setPlanDraft({ ...preview, payload });
    });
  }

  async function loadPlanMaterial(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPlanMaterialError('');
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setPlanMaterialName('');
      setPlanMaterialError('Escolha um arquivo de texto ou Markdown (.txt, .md ou .markdown).');
      return;
    }
    if (file.size > 50_000) {
      setPlanMaterialName('');
      setPlanMaterialError('O arquivo deve ter no máximo 50 KB.');
      return;
    }
    try {
      const text = await file.text();
      if (text.length > 5000) {
        setPlanMaterialName('');
        setPlanMaterialError('O conteúdo do arquivo deve ter no máximo 5.000 caracteres.');
        return;
      }
      setPlanContent(text.trim());
      setPlanMaterialName(file.name);
    } catch {
      setPlanMaterialName('');
      setPlanMaterialError('Não foi possível ler o arquivo. Tente outro arquivo de texto.');
    }
  }

  async function savePlan() {
    if (!planDraft) return;
    const tasks = planDraft.tasks.map((task) => ({
      ...task,
      title: String(task.title || '').trim(),
      description: String(task.description || '').trim() || null,
      xp_reward: Number(task.xp_reward),
      estimated_minutes: Number(task.estimated_minutes),
    }));
    if (tasks.some((task) => !task.title)) {
      onError('Cada missão do plano precisa ter um título.');
      return;
    }
    if (tasks.some((task) => String(task.xp_reward).trim() === '' || String(task.estimated_minutes).trim() === '' || !Number.isInteger(task.xp_reward) || task.xp_reward < 0 || !Number.isInteger(task.estimated_minutes) || task.estimated_minutes < 1)) {
      onError('Revise os valores de XP e duração: XP deve ser zero ou maior e os minutos devem ser pelo menos 1.');
      return;
    }
    await run('plan', async () => {
      const { provider_api_key: _providerApiKey, ...planPayload } = planDraft.payload;
      await request('/quests/generate-plan', jsonRequest('POST', {
        ...planPayload,
        preview_only: false,
        learning_objectives: planDraft.learning_objectives,
        tasks,
      }));
      setPlanDraft(null);
      await refresh();
    });
  }

  function updatePlanTask(index, field, value) {
    setPlanDraft((current) => current ? {
      ...current,
      tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, [field]: value } : task),
    } : current);
  }

  async function updateProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run('profile', async () => {
      await request('/users/me', jsonRequest('PUT', { name: String(form.get('name')).trim() }));
      setProfileEditing(false);
      await refresh();
    });
  }

  const activeElapsed = activeSession
    ? Math.max(0, Math.floor((now - parseApiDateTime(activeSession.started_at).getTime()) / 60_000))
    : 0;
  const activeSessionGoal = Number(activeSession?.duration_minutes) || 0;
  const activeSessionProgress = activeSessionGoal ? Math.min(100, Math.round(activeElapsed / activeSessionGoal * 100)) : 0;

  return (
    <section className="app-view">
      <header className="topbar">
        <a className="wordmark" href="#top">study<span>quest</span></a>
        <div className="topbar-actions">
          <span>Olá, {user?.name}</span>
          <a className="legacy-link" href="/legacy.html">Interface completa</a>
          <button className="icon-button" type="button" onClick={onLogout}>Sair <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="dashboard-grid" id="top">
        <section className="intro-block"><span className="eyebrow">PAINEL DE COMANDO</span><h1>Olá, {user?.name?.split(' ')[0]}. Vamos avançar?</h1><p>Pequenos avanços, registrados todos os dias.</p></section>
        <section className="level-card">
          <div className="level-top"><span>NÍVEL <strong>{user?.level ?? 1}</strong></span><span>{user?.xp ?? 0} XP</span></div>
          <div className="progress-track"><span style={{ width: `${user?.progress_percent ?? 0}%` }} /></div>
          <small>{Math.max(0, (user?.next_level_xp ?? 100) - (user?.xp ?? 0))} XP para o próximo nível</small>
        </section>

        <section className="stats-row">
          <article className="stat-card accent"><span className="stat-label">MISSÕES FEITAS</span><strong>{stats?.quests_completed ?? 0}</strong><span>de {stats?.quests_total ?? 0} no total</span></article>
          <article className="stat-card"><span className="stat-label">SEQUÊNCIA ATUAL</span><strong>{data.streak?.current_streak ?? 0} <small>dias</small></strong><span>melhor: {data.streak?.best_streak ?? 0} dias</span></article>
          <article className="stat-card"><span className="stat-label">TEMPO DE ESTUDO</span><strong>{data.analytics?.total_study_minutes ?? 0}</strong><span>minutos acumulados</span></article>
        </section>

        <section className="quests-section">
          <div className="section-heading"><div><span className="kicker">SEU MAPA</span><h2>Missões</h2></div><div className="row-actions">
            <label className="compact-field inline-filter"><span>Filtrar</span><select value={filter} onChange={(event) => { setFilter(event.target.value); localStorage.setItem('studyquest_quest_filter', event.target.value); }}><option value="all">Todas</option><option value="pending">Pendentes</option><option value="in_progress">Em andamento</option><option value="completed">Concluídas</option><option value="archived">Arquivadas</option><option value="overdue">Atrasadas</option></select></label>
            <label className="compact-field inline-filter"><span>Disciplina</span><select value={['all', 'none'].includes(questSubjectFilter) || data.subjects.some((subject) => String(subject.id) === questSubjectFilter) ? questSubjectFilter : 'all'} onChange={(event) => { setQuestSubjectFilter(event.target.value); localStorage.setItem('studyquest_quest_subject_filter', event.target.value); }}><option value="all">Todas</option><option value="none">Sem disciplina</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="compact-field inline-filter"><span>Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value); localStorage.setItem('studyquest_quest_sort', event.target.value); }}><option value="priority">Prioridade</option><option value="due_date">Prazo</option><option value="xp">XP</option><option value="minutes">Tempo</option><option value="title">Título</option></select></label>
            <button className="icon-button" type="button" onClick={refresh}>Atualizar <span aria-hidden="true">↻</span></button>
          </div></div>
          <div className="quests-list">
            {questList.length === 0 ? <p className="empty-state">Nenhuma missão neste filtro. Crie uma missão para começar.</p> : questList.map((quest) => {
              const subject = data.subjects.find((item) => item.id === quest.subject_id);
              return <article className={`quest-item ${quest.status === 'completed' ? 'completed' : ''} ${quest.status === 'archived' ? 'archived' : ''}`} key={quest.id}>
                {editingQuestId === quest.id ? <form className="quest-edit-form" onSubmit={(event) => updateQuest(event, quest.id)}>
                  <label className="compact-field">Título<input name="title" defaultValue={quest.title} maxLength="200" required /></label>
                  <label className="compact-field">Descrição<textarea name="description" rows="2" defaultValue={quest.description || ''} /></label>
                  <label className="compact-field">Disciplina<select name="subject_id" value={editingQuestSubject} onChange={(event) => { const subjectId = event.target.value; setEditingQuestSubject(subjectId); const linkedBoss = data.bosses.find((boss) => String(boss.id) === editingQuestBossId); if (linkedBoss && String(linkedBoss.subject_id) !== subjectId) setEditingQuestBossId(''); }}><option value="">Sem disciplina</option>{data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label className="compact-field">Boss Fight<select name="boss_fight_id" value={editingQuestBossId} onChange={(event) => setEditingQuestBossId(event.target.value)}><option value="">Sem desafio</option>{data.bosses.filter((boss) => String(boss.subject_id) === editingQuestSubject).map((boss) => <option key={boss.id} value={boss.id}>{boss.title}{boss.status === 'completed' ? ' (concluído)' : ''}</option>)}</select></label>
                  <label className="compact-field">Tipo<select name="type" defaultValue={quest.type}><option value="study">Estudo</option><option value="exercises">Exercícios</option><option value="practice">Prática</option><option value="review">Revisão</option><option value="project">Projeto</option><option value="boss_fight">Boss Fight</option></select></label>
                  <label className="compact-field">Dificuldade<select name="difficulty" defaultValue={quest.difficulty}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option><option value="boss">Chefe</option></select></label>
                  <label className="compact-field">XP<input name="xp_reward" type="number" min="0" defaultValue={quest.xp_reward} /></label>
                  <label className="compact-field">Dano no Boss<input name="boss_damage" type="number" min="0" defaultValue={quest.boss_damage} /></label>
                  <label className="compact-field">Minutos<input name="estimated_minutes" type="number" min="1" defaultValue={quest.estimated_minutes} /></label>
                  <label className="compact-field">Prazo<input name="due_date" type="date" defaultValue={quest.due_date || ''} /></label>
                  <div className="quest-edit-actions"><button className="secondary-button" type="submit" disabled={busyKeys.has(`quest-${quest.id}`)}>Salvar</button><button className="text-button" type="button" onClick={() => { setEditingQuestId(null); setEditingQuestSubject(''); setEditingQuestBossId(''); }}>Cancelar</button></div>
                </form> : <>
                  <div><div className="quest-title-line"><h3 className="quest-title">{quest.title}</h3>{quest.status === 'archived' && <span className="quest-status-badge">Arquivada</span>}{quest.status === 'in_progress' && <span className="quest-status-badge in-progress-badge">Em andamento</span>}{quest.due_date && <span className="quest-due-badge">{formatDate(quest.due_date)}</span>}</div>
                    <div className="quest-meta">{subject?.name || 'Sem disciplina'} · {quest.xp_reward} XP · {formatDuration(quest.estimated_minutes)}</div>
                    {quest.description && <details className="quest-details"><summary>Ver detalhes</summary><p>{quest.description}</p></details>}
                  </div>
                  <div className="quest-actions">{quest.status === 'pending' && <button className="mini-edit" type="button" disabled={busyKeys.has(`quest-${quest.id}`)} onClick={() => updateQuestStatus(quest, 'in_progress')}>Iniciar</button>}{quest.status !== 'archived' && <button className="complete-button" type="button" disabled={quest.status === 'completed' || busyKeys.has(`quest-${quest.id}`)} onClick={() => completeQuest(quest.id)}>{quest.status === 'completed' ? 'Concluída' : 'Concluir'}</button>}{quest.status !== 'completed' && <button className="mini-edit" type="button" onClick={() => editQuest(quest)}>Editar</button>}{quest.status === 'archived' ? <button className="archive-button" type="button" disabled={busyKeys.has(`quest-${quest.id}`)} onClick={() => updateQuestStatus(quest, 'pending')}>Restaurar</button> : quest.status === 'in_progress' ? <button className="archive-button" type="button" disabled={busyKeys.has(`quest-${quest.id}`)} onClick={() => updateQuestStatus(quest, 'pending')}>Voltar para pendentes</button> : quest.status === 'pending' && <button className="archive-button" type="button" disabled={busyKeys.has(`quest-${quest.id}`)} onClick={() => updateQuestStatus(quest, 'archived')}>Arquivar</button>}<button className="delete-button" type="button" disabled={busyKeys.has(`quest-${quest.id}`)} onClick={() => deleteQuest(quest)}>Excluir</button></div>
                </>}
              </article>;
            })}
          </div>
        </section>

        <aside className="side-panel">
          <span className="kicker">SEU PERFIL</span><h2>{user?.name}</h2>
          <p className="profile-email">{user?.email}</p>
          {!profileEditing ? <button className="mini-edit" type="button" onClick={() => setProfileEditing(true)}>Editar nome</button> : <form className="profile-edit-form" onSubmit={updateProfile}><label className="compact-field">Nome<input name="name" defaultValue={user?.name} maxLength="120" required /></label><div className="quest-edit-actions"><button className="secondary-button" type="submit" disabled={busyKeys.has('profile')}>Salvar</button><button className="text-button" type="button" onClick={() => setProfileEditing(false)}>Cancelar</button></div></form>}
          <div className="side-rule" />
          <span className="kicker">XP RECENTE</span><div className="activity-list">{recentRewards.length ? recentRewards.map((item) => <div className="activity-row" key={item.id}><span className="activity-badge">+{item.amount}</span><div><strong>{item.reason}</strong><small>{formatDateTime(item.created_at)} · XP conquistado</small></div></div>) : <p className="mini-empty">Conclua uma missão ou Boss Fight para ganhar XP.</p>}</div>
          <div className="side-rule" />
          <span className="kicker">PRÓXIMO FOCO</span>{nextFocusQuest ? <div className="next-focus-card"><strong>{nextFocusQuest.title}</strong><span>{nextFocusQuest.xp_reward} XP · {formatDuration(nextFocusQuest.estimated_minutes)}</span><button className="mini-edit" type="button" disabled={busyKeys.has(`quest-${nextFocusQuest.id}`)} onClick={() => completeQuest(nextFocusQuest.id)}>Marcar como concluída</button></div> : <p className="mini-empty">Sem missões pendentes. Crie uma nova para continuar.</p>}
          <div className="side-rule" />
          <span className="kicker">CONQUISTAS</span><div className="achievement-list">{data.achievements.length === 0 ? <p className="mini-empty">Nenhuma conquista disponível ainda.</p> : data.achievements.map((item) => {
            const progress = item.criteria_value > 0 ? Math.min(100, Math.round(item.current_value / item.criteria_value * 100)) : 0;
            return <article className={`achievement-row ${item.unlocked ? 'unlocked' : 'locked'}`} key={item.id}><span aria-hidden="true">{item.icon || '✦'}</span><div><strong>{item.title}</strong><small>{item.description}</small><div className="achievement-progress" role="progressbar" aria-label={`Progresso: ${item.title}`} aria-valuemin="0" aria-valuemax={item.criteria_value} aria-valuenow={item.current_value}><span style={{ width: `${progress}%` }} /></div><small>{item.unlocked ? `Desbloqueada${item.unlocked_at ? ` em ${formatDateTime(item.unlocked_at)}` : ''}` : `${item.current_value} de ${item.criteria_value} missões`}</small></div></article>;
          })}</div>
          <div className="side-rule" />
          <span className="kicker">RANKING</span><div className="leaderboard-list">{data.leaderboard.length === 0 ? <p className="mini-empty">O ranking ainda está vazio.</p> : <>
            {topLeaderboard.map((item) => <div className={`leaderboard-row ${item.id === user?.id ? 'current-user' : ''}`} key={item.id}><span className="rank-number">{item.rank}</span><strong>{item.name}{item.id === user?.id ? ' (você)' : ''}</strong><small>Nv. {item.level} · {item.xp} XP</small></div>)}
            {currentLeaderboard && currentLeaderboard.rank > topLeaderboard.length && <><p className="leaderboard-separator">Sua posição</p><div className="leaderboard-row current-user"><span className="rank-number">{currentLeaderboard.rank}</span><strong>{currentLeaderboard.name} (você)</strong><small>Nv. {currentLeaderboard.level} · {currentLeaderboard.xp} XP</small></div></>}
          </>}</div>
          <div className="side-rule" />
          <span className="kicker">ESTA SEMANA</span>
          <figure className="weekly-chart" aria-label="Minutos de estudo por dia nos últimos sete dias">
            <div className="weekly-bars" role="img" aria-label={weeklyActivity.map((day) => `${formatDate(day.date)}: ${day.minutes} minutos em ${day.sessions} sessões`).join('; ')}>
              {weeklyActivity.map((day) => {
                const date = new Date(`${day.date}T12:00:00`);
                const label = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                const minutes = Number(day.minutes) || 0;
                return <div className="weekly-bar-column" key={day.date} title={`${formatDate(day.date)} · ${minutes} min · ${day.sessions} sessões`}><span className="weekly-bar-value">{minutes || ''}</span><span className="weekly-bar-track"><span style={{ height: minutes ? `${Math.max(8, minutes / weeklyPeakMinutes * 100)}%` : '0%' }} /></span><small>{label}</small></div>;
              })}
            </div>
            {weeklySessionCount === 0 && <figcaption>Conclua uma sessão para começar seu histórico semanal.</figcaption>}
          </figure>
          <div className="insights-list"><p className="insight-row"><span>Tempo estudado</span><strong>{formatDuration(weeklyStudyMinutes)}</strong></p><p className="insight-row"><span>Sessões concluídas</span><strong>{weeklySessionCount}</strong></p><p className="insight-row"><span>Média por sessão</span><strong>{weeklySessionCount ? formatDuration(weeklyAverageMinutes) : '—'}</strong></p></div>
        </aside>

        <section className="creation-grid">
          <form className="creation-card" onSubmit={createSubject}>
            <div><span className="kicker">NOVO FOCO</span><h2>Criar disciplina</h2></div>
            <label className="compact-field">Nome<input name="name" type="text" placeholder="Ex.: História" maxLength="120" required /></label>
            <label className="compact-field">Cor<input name="color" type="color" defaultValue="#c7f36b" /></label>
            <button className="secondary-button" type="submit" disabled={busyKeys.has('subject')}>Adicionar disciplina <span aria-hidden="true">→</span></button>
            <div className="subjects-list">{data.subjects.length === 0 ? <p className="small-empty">Suas disciplinas aparecem aqui.</p> : data.subjects.map((subject) => <div className="subject-entry" key={subject.id}>
              <div className="subject-row"><div className="subject-row-heading"><span className="subject-color-dot" style={{ '--subject-color': subject.color || '#c7f36b' }} /><div><strong>{subject.name}</strong><small>{data.quests.filter((quest) => quest.subject_id === subject.id).length} missões{subject.professor ? ` · ${subject.professor}` : ''}{subject.semester ? ` · ${subject.semester}` : ''}</small></div></div><div className="subject-actions"><button className="mini-edit" type="button" onClick={() => setEditingSubjectId(editingSubjectId === subject.id ? null : subject.id)}>{editingSubjectId === subject.id ? 'Fechar' : 'Editar'}</button><button className="mini-delete" type="button" disabled={busyKeys.has(`subject-${subject.id}`)} onClick={() => deleteSubject(subject)}>Excluir</button></div></div>
              {editingSubjectId === subject.id && <form className="subject-edit-form" onSubmit={(event) => updateSubject(event, subject.id)}>
                <label className="compact-field">Nome<input name="name" defaultValue={subject.name} maxLength="120" required /></label>
                <label className="compact-field">Descrição<textarea name="description" defaultValue={subject.description || ''} maxLength="500" rows="2" /></label>
                <label className="compact-field">Professor<input name="professor" defaultValue={subject.professor || ''} maxLength="120" /></label>
                <label className="compact-field">Semestre<input name="semester" defaultValue={subject.semester || ''} maxLength="50" placeholder="Ex.: 2026/1" /></label>
                <label className="compact-field">Ícone<input name="icon" defaultValue={subject.icon || ''} maxLength="64" placeholder="Ex.: 📚" /></label>
                <label className="compact-field">Cor<input name="color" type="color" defaultValue={/^#[0-9a-f]{6}$/i.test(subject.color || '') ? subject.color : '#c7f36b'} /></label>
                <div className="quest-edit-actions"><button className="secondary-button" type="submit" disabled={busyKeys.has(`subject-${subject.id}`)}>Salvar disciplina</button><button className="text-button" type="button" onClick={() => setEditingSubjectId(null)}>Cancelar</button></div>
              </form>}
            </div>)}</div>
          </form>

          <form className="creation-card wide-creation-card" onSubmit={createQuest}>
            <div><span className="kicker">PRÓXIMO PASSO</span><h2>Criar missão</h2></div>
            <label className="compact-field">Título<input name="title" type="text" placeholder="Ex.: Revisar capítulo 3" maxLength="200" required /></label>
            <label className="compact-field">Descrição<textarea name="description" rows="2" placeholder="O que precisa ser feito nesta missão?" /></label>
            <label className="compact-field">Disciplina<select name="subject_id" value={questSubject} onChange={(event) => setQuestSubject(event.target.value)}><option value="">Sem disciplina</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="compact-field">Boss Fight<select name="boss_fight_id"><option value="">Sem desafio</option>{data.bosses.filter((boss) => boss.status === 'active' && (!questSubject || String(boss.subject_id) === questSubject)).map((boss) => <option key={boss.id} value={boss.id}>{boss.title}</option>)}</select></label>
            <label className="compact-field">Tipo<select name="type"><option value="study">Estudo</option><option value="exercises">Exercícios</option><option value="practice">Prática</option><option value="review">Revisão</option><option value="project">Projeto</option><option value="boss_fight">Boss Fight</option></select></label>
            <label className="compact-field">Dificuldade<select name="difficulty" defaultValue="medium"><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option><option value="boss">Chefe</option></select></label>
            <label className="compact-field">XP<input name="xp_reward" type="number" min="0" defaultValue="40" /></label>
            <label className="compact-field">Dano no Boss<input name="boss_damage" type="number" min="0" defaultValue="10" /></label>
            <label className="compact-field">Minutos<input name="estimated_minutes" type="number" min="1" defaultValue="30" /></label>
            <label className="compact-field">Prazo<input name="due_date" type="date" /></label>
            <button className="secondary-button" type="submit" disabled={busyKeys.has('quest')}>Adicionar missão <span aria-hidden="true">→</span></button>
          </form>

          <form className="creation-card" onSubmit={createBossFight}>
            <div><span className="kicker">DESAFIO ÉPICO</span><h2>Criar Boss Fight</h2></div>
            <label className="compact-field">Disciplina<select name="subject_id" required defaultValue=""><option value="" disabled>Escolha uma disciplina</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="compact-field">Nome do desafio<input name="title" placeholder="Ex.: Prova de cálculo" maxLength="200" required /></label>
            <label className="compact-field">Pontos de vida<input name="hp_max" type="number" min="1" defaultValue="100" required /></label>
            <label className="compact-field">Recompensa em XP<input name="xp_reward" type="number" min="0" defaultValue="150" /></label>
            <button className="secondary-button" type="submit" disabled={busyKeys.has('boss') || data.subjects.length === 0}>Criar desafio <span aria-hidden="true">→</span></button>
            <div className="boss-list">{data.bosses.length === 0 ? <p className="small-empty">Crie um desafio e vincule missões para reduzir sua vida.</p> : data.bosses.map((boss) => {
              const linkedQuests = data.quests.filter((quest) => quest.boss_fight_id === boss.id);
              const percent = boss.hp_max ? Math.max(0, Math.min(100, boss.hp_current / boss.hp_max * 100)) : 0;
              return <div className={`boss-row ${boss.status === 'completed' ? 'boss-completed' : ''}`} key={boss.id}><div className="boss-heading"><strong>{boss.title}</strong><button className="mini-delete" type="button" disabled={busyKeys.has(`boss-${boss.id}`)} onClick={() => deleteBossFight(boss)}>Excluir</button></div><div className="boss-hp-track" role="progressbar" aria-label={`Vida de ${boss.title}`} aria-valuemin="0" aria-valuemax={boss.hp_max} aria-valuenow={boss.hp_current}><span style={{ width: `${percent}%` }} /></div><small>{boss.hp_current} / {boss.hp_max} HP · {linkedQuests.length} missões{boss.status === 'completed' ? ` · Derrotado! +${boss.xp_reward} XP` : ''}</small>{boss.status === 'active' && <button className="boss-complete-button" type="button" disabled={busyKeys.has(`boss-${boss.id}`)} onClick={() => completeBossFight(boss)}>Concluir desafio · +{boss.xp_reward} XP</button>}</div>;
            })}</div>
          </form>

          <form className="creation-card plan-card" onSubmit={generatePlan}>
            <div><span className="kicker">PLANEJAMENTO</span><h2>Gerar plano de estudo</h2></div>
            <p className="plan-explainer">Descreva o tema e receba uma sequência de missões para revisar antes de adicionar.</p>
            <label className="compact-field">Tema<input name="title" placeholder="Ex.: Álgebra linear" maxLength="120" required /></label>
            <label className="compact-field">Conteúdo<textarea name="content" value={planContent} onChange={(event) => setPlanContent(event.target.value)} rows="3" maxLength="5000" placeholder="Tópicos, capítulos ou conceitos que quer estudar" /></label>
            <label className="compact-field">Carregar material (.txt ou Markdown)<input type="file" accept=".txt,.md,.markdown,text/plain" onChange={loadPlanMaterial} /></label>
            {planMaterialName && <p className="provider-help">Material carregado: {planMaterialName}</p>}
            {planMaterialError && <p className="error-message plan-file-error" role="alert">{planMaterialError}</p>}
            <label className="compact-field">Objetivo<input name="goal" maxLength="300" placeholder="Ex.: resolver sistemas de equações" /></label>
            <label className="compact-field">Público<input name="audience" maxLength="200" placeholder="Ex.: iniciante" /></label>
            <label className="compact-field">Estilo<select name="learning_style"><option value="objetivo">Objetivo</option><option value="prática">Prático</option><option value="intensivo">Intensivo</option></select></label>
            <label className="compact-field">Disciplina<select name="subject_id" defaultValue=""><option value="">Criar nova disciplina</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="compact-field">Provedor de IA<select value={planProvider} onChange={(event) => {
              const provider = event.target.value;
              setPlanProvider(provider);
              if (provider === 'server') { setPlanProviderUrl(''); setPlanProviderModel(''); setPlanProviderApiKey(''); }
              if (provider === 'ollama') { setPlanProviderUrl('http://localhost:11434/v1'); setPlanProviderModel('llama3.1'); setPlanProviderApiKey(''); }
              if (provider === 'custom') { setPlanProviderUrl(''); setPlanProviderModel(''); setPlanProviderApiKey(''); }
            }}><option value="server">Configuração do servidor</option><option value="ollama">Ollama local</option><option value="custom">API compatível personalizada</option></select></label>
            {planProvider !== 'server' && <>
              <label className="compact-field">Endpoint compatível com OpenAI<input name="provider_base_url" type="url" value={planProviderUrl} onChange={(event) => setPlanProviderUrl(event.target.value)} placeholder="Ex.: http://localhost:11434/v1" /></label>
              <label className="compact-field">Modelo<input name="provider_model" value={planProviderModel} onChange={(event) => setPlanProviderModel(event.target.value)} placeholder="Ex.: llama3.1" /></label>
              {planProvider === 'custom' && <label className="compact-field">Chave do provedor<input name="provider_api_key" type="password" autoComplete="new-password" value={planProviderApiKey} onChange={(event) => setPlanProviderApiKey(event.target.value)} maxLength="500" /></label>}
              {planProvider === 'custom' && <p className="provider-help">A chave é usada para gerar a prévia e não é incluída nas missões salvas.</p>}
              <p className="provider-help">Habilite <code>AI_GENERATION_ENABLED=true</code> no backend. O endpoint precisa estar acessível a partir do backend; no Docker Desktop, use <code>host.docker.internal</code> para acessar um provedor rodando no computador.</p>
            </>}
            <button className="secondary-button" type="submit" disabled={busyKeys.has('plan')}>{busyKeys.has('plan') ? 'Gerando…' : 'Gerar prévia'} <span aria-hidden="true">→</span></button>
            {planDraft && <div className="plan-preview" aria-live="polite">
              <h3>{planDraft.generated_from}</h3>
              <p className="plan-subject">Disciplina: {planDraft.subject?.name}</p>
              <strong>Objetivos de aprendizagem</strong>
              <ul>{planDraft.learning_objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul>
              <strong>Missões propostas</strong>
              <div className="plan-task-list">{planDraft.tasks.map((task, index) => <div className="plan-task plan-task-edit" key={index}>
                <label className="compact-field">Título<input value={task.title} maxLength="200" onChange={(event) => updatePlanTask(index, 'title', event.target.value)} /></label>
                <label className="compact-field">Tipo<select value={task.type} onChange={(event) => updatePlanTask(index, 'type', event.target.value)}><option value="review">Revisão</option><option value="exercises">Exercícios</option><option value="practice">Prática</option><option value="project">Projeto</option><option value="study">Estudo</option></select></label>
                <label className="compact-field">Dificuldade<select value={task.difficulty} onChange={(event) => updatePlanTask(index, 'difficulty', event.target.value)}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label>
                <div className="plan-task-numbers"><label className="compact-field">XP<input type="number" min="0" step="1" value={task.xp_reward} onChange={(event) => updatePlanTask(index, 'xp_reward', event.target.value)} /></label><label className="compact-field">Minutos<input type="number" min="1" step="1" value={task.estimated_minutes} onChange={(event) => updatePlanTask(index, 'estimated_minutes', event.target.value)} /></label></div>
                <label className="compact-field">Descrição<textarea rows="2" value={task.description || ''} onChange={(event) => updatePlanTask(index, 'description', event.target.value)} /></label>
              </div>)}</div>
              <div className="quest-edit-actions"><button className="secondary-button" type="button" onClick={savePlan} disabled={busyKeys.has('plan')}>Adicionar plano</button><button className="text-button" type="button" onClick={() => setPlanDraft(null)}>Descartar</button></div>
            </div>}
          </form>

          <section className="creation-card session-card">
            <div><span className="kicker">FOCO NO AGORA</span><h2>Sessão de estudo</h2></div>
            {activeSession ? <div className="active-session-box"><strong>Sessão em andamento</strong><span>{formatDuration(activeElapsed)} decorridos · {activeSessionProgress >= 100 ? `meta atingida${activeElapsed > activeSessionGoal ? ` · ${formatDuration(activeElapsed - activeSessionGoal)} além da meta` : ''}` : `meta de ${formatDuration(activeSession.duration_minutes)} · ${activeSessionProgress}%`}</span><div className={`session-goal-progress ${activeSessionProgress >= 100 ? 'session-goal-progress-reached' : ''}`} role="progressbar" aria-label="Progresso da meta da sessão" aria-valuemin="0" aria-valuemax={activeSessionGoal || 1} aria-valuenow={activeSessionGoal ? Math.min(activeElapsed, activeSessionGoal) : 0}><span style={{ width: `${activeSessionProgress}%` }} /></div><button className="secondary-button" type="button" disabled={busyKeys.has(`session-${activeSession.id}`)} onClick={() => completeSession(activeSession.id)}>Concluir sessão</button></div> : <form className="session-start-form" onSubmit={startSession}>
              <label className="compact-field">Disciplina<select value={sessionSubject} onChange={(event) => { setSessionSubject(event.target.value); setSessionQuest(''); }}><option value="">Sem disciplina</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label className="compact-field">Missão<select value={sessionQuest} onChange={(event) => setSessionQuest(event.target.value)}><option value="">Sem missão</option>{data.quests.filter((quest) => quest.status !== 'completed' && (!sessionSubject || String(quest.subject_id || '') === sessionSubject)).map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}</select></label>
              <label className="compact-field">Duração (min)<input type="number" min="15" value={sessionMinutes} onChange={(event) => setSessionMinutes(event.target.value)} required /></label>
              <div className="duration-presets" aria-label="Atalhos de duração">{[15, 25, 45, 60].map((minutes) => <button className={`preset-button ${Number(sessionMinutes) === minutes ? 'active' : ''}`} type="button" key={minutes} aria-pressed={Number(sessionMinutes) === minutes} onClick={() => setSessionMinutes(minutes)}>{minutes} min</button>)}</div>
              <button className="secondary-button" type="submit" disabled={busyKeys.has('session')}>Começar estudo <span aria-hidden="true">→</span></button>
            </form>}
            <div className="session-history-controls">
              <label className="compact-field">Situação<select value={sessionStatusFilter} onChange={(event) => setSessionStatusFilter(event.target.value)}><option value="all">Todas</option><option value="in_progress">Em andamento</option><option value="completed">Concluídas</option></select></label>
              <label className="compact-field">Disciplina<select value={sessionSubjectFilter} onChange={(event) => setSessionSubjectFilter(event.target.value)}><option value="all">Todas</option><option value="none">Estudo livre</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
              <label className="compact-field">Período<select value={sessionPeriodFilter} onChange={(event) => setSessionPeriodFilter(event.target.value)}><option value="all">Todo o histórico</option><option value="today">Hoje</option><option value="7days">Últimos 7 dias</option><option value="30days">Últimos 30 dias</option></select></label>
              <label className="compact-field session-search-field">Buscar<input type="search" value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="Disciplina ou missão" /></label>
              <button className="mini-edit" type="button" onClick={exportSessions}>Exportar CSV</button>
            </div>
            <p className="sessions-summary" role="status" aria-live="polite">{filteredSessions.length} de {data.sessions.length} sessões · {filteredSessions.filter((session) => session.status === 'in_progress').length} em andamento · {formatDuration(filteredSessions.filter((session) => session.status === 'completed').reduce((total, session) => total + (Number(session.duration_minutes) || 0), 0))} concluídos</p>
            <div className="sessions-list">{filteredSessions.length === 0 ? <p className="small-empty">Nenhuma sessão encontrada com estes filtros.</p> : filteredSessions.map((session) => {
              const subject = data.subjects.find((item) => item.id === session.subject_id);
              const quest = data.quests.find((item) => item.id === session.quest_id);
              const elapsed = Math.max(0, Math.floor((now - parseApiDateTime(session.started_at).getTime()) / 60_000));
              return <div className={`session-row ${session.status === 'in_progress' ? 'session-active' : 'session-completed'}`} key={session.id}><div className="session-info"><strong>{subject?.name || (session.subject_id ? 'Disciplina removida' : 'Estudo livre')}</strong>{quest && <span>{quest.title}</span>}<small>{session.status === 'in_progress' ? `Em andamento · meta ${formatDuration(session.duration_minutes)} · ${formatDuration(elapsed)} decorridos` : `Concluída · ${formatDateTime(session.started_at)} · ${formatDuration(session.duration_minutes)}`}</small></div><div className="session-row-actions">{session.status === 'in_progress' && <button className="mini-edit" type="button" disabled={busyKeys.has(`session-${session.id}`)} onClick={() => completeSession(session.id)}>Finalizar</button>}<button className="mini-delete" type="button" disabled={busyKeys.has(`session-${session.id}`)} onClick={() => deleteSession(session)}>Excluir</button></div></div>;
            })}</div>
          </section>
        </section>
      </div>
      <footer className="dashboard-footer"><span>STUDYQUEST · FOCO · RITMO · EVOLUÇÃO</span><a href="/legacy.html">Abrir a interface anterior com recursos avançados</a></footer>
    </section>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('studyquest_token'));
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('studyquest_token')));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const labels = ['perfil', 'sequência', 'missões', 'disciplinas', 'sessões', 'análises', 'recompensas', 'desafios', 'conquistas', 'ranking'];
    const activityTimezone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const results = await Promise.allSettled([
      request('/users/dashboard'), request(`/users/streak?timezone=${activityTimezone}`), request('/quests/'), request('/subjects/'),
      request('/study-sessions/'), request(`/users/analytics?timezone=${activityTimezone}`), request('/users/rewards'), request('/boss-fights/'),
      request('/achievements/progress'), request('/users/leaderboard'),
    ]);
    if (results[0].status === 'rejected') throw results[0].reason;

    const keys = ['dashboard', 'streak', 'quests', 'subjects', 'sessions', 'analytics', 'rewards', 'bosses', 'achievements', 'leaderboard'];
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : []);
    setData((current) => Object.fromEntries(keys.map((key, index) => [
      key,
      results[index].status === 'fulfilled' ? results[index].value : current[key] ?? EMPTY_DATA[key],
    ])));
    setError(failed.length ? `Não foi possível atualizar: ${failed.join(', ')}. Os dados anteriores foram mantidos.` : '');
  }, []);

  useEffect(() => {
    function expireSession() {
      setToken(null);
      setData(EMPTY_DATA);
      setError('Sua sessão expirou. Entre novamente.');
    }
    window.addEventListener('studyquest:session-expired', expireSession);
    return () => window.removeEventListener('studyquest:session-expired', expireSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    refresh().catch((loadError) => {
      if (!cancelled) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, refresh]);

  async function handleAuthenticated() {
    setToken(localStorage.getItem('studyquest_token'));
  }

  function logout() {
    setAccessToken(null);
    setData(EMPTY_DATA);
    setToken(null);
  }

  if (!token) return <main className="shell"><AuthScreen onAuthenticated={handleAuthenticated} initialError={error} /></main>;
  if (loading) return <main className="loading-screen"><div className="loading-mark">study<span>quest</span></div><p>Carregando sua jornada…</p>{error && <p className="error-message" role="alert">{error}<br /><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Tentar novamente</button></p>}</main>;
  if (!data.dashboard) return <main className="loading-screen"><div className="loading-mark">study<span>quest</span></div><p className="error-message" role="alert">{error || 'Não foi possível carregar sua jornada.'}<br /><button className="secondary-button" type="button" onClick={() => { setLoading(true); refresh().catch((loadError) => setError(getErrorMessage(loadError))).finally(() => setLoading(false)); }}>Tentar novamente</button><br /><button className="text-button" type="button" onClick={logout}>Sair</button></p></main>;

  return <main className="shell">{error && <div className="global-notice" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}<Dashboard data={data} refresh={() => refresh().catch((loadError) => setError(getErrorMessage(loadError)))} onLogout={logout} onError={setError} /></main>;
}
