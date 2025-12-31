// main.js - Mia Science Quest V2.35
// Migliora la gamification, rimuove le settimane, mantiene le domande sempre al centro e aggiunge una modalità mista

const APP_VERSION = 'V2.35';

const SUBJECTS = ['Fisica', 'Chimica', 'Tecnica'];
const LEVELS = [
  { min: 0, max: 2, label: 'Principiante' },
  { min: 2, max: 4, label: 'Base' },
  { min: 4, max: 6, label: 'Intermedio' },
  { min: 6, max: 8, label: 'Avanzato' },
  { min: 8, max: 10.01, label: 'Esperto' },
];

let questionsData = [];
let grades = loadGrades();
let historyLog = loadHistory();
let metaState = loadMeta();
let currentPractice = {
  subject: SUBJECTS[0],
  pool: [],
  currentQuestion: null,
  mode: 'mixed',
  difficultyFilter: 'all',
};

function applyVersionStamp() {
  document.title = `Mia Science Quest ${APP_VERSION}`;
  const brandTitle = document.querySelector('[data-app-version]');
  if (brandTitle) brandTitle.textContent = `Mia Science Quest ${APP_VERSION}`;
  const badge = document.getElementById('app-version');
  if (badge) badge.textContent = APP_VERSION;
}

async function loadQuestions() {
  const response = await fetch('data/questions.json');
  if (!response.ok) throw new Error('Impossibile caricare le domande');
  return response.json();
}

function loadGrades() {
  try {
    const saved = localStorage.getItem('mia-science-grades');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Impossibile leggere i livelli salvati', e);
  }
  return { Fisica: 5, Chimica: 5, Tecnica: 5 };
}

function saveGrades() {
  try {
    localStorage.setItem('mia-science-grades', JSON.stringify(grades));
  } catch (e) {
    console.warn('Impossibile salvare i livelli', e);
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('mia-science-history');
    if (saved) return JSON.parse(saved).history || [];
  } catch (e) {
    console.warn('Impossibile leggere la cronologia', e);
  }
  return [];
}

function saveHistory() {
  try {
    localStorage.setItem('mia-science-history', JSON.stringify({ history: historyLog.slice(-200) }));
  } catch (e) {
    console.warn('Impossibile salvare la cronologia', e);
  }
}

function loadMeta() {
  try {
    const saved = localStorage.getItem('mia-science-meta');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Impossibile leggere i metadati', e);
  }
  return { metricsResetAt: 0 };
}

function saveMeta() {
  try {
    localStorage.setItem('mia-science-meta', JSON.stringify(metaState));
  } catch (e) {
    console.warn('Impossibile salvare i metadati', e);
  }
}

function clampGrade(value) {
  return Math.min(10, Math.max(0, Number(value.toFixed(2))));
}

function getLevelName(grade) {
  const level = LEVELS.find((lvl) => grade >= lvl.min && grade < lvl.max);
  return level ? level.label : 'Principiante';
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('it-IT');
}

function getHistoryByQuestion(questionId) {
  return historyLog.filter((h) => h.questionId === questionId).sort((a, b) => b.timestamp - a.timestamp);
}

function getLastCorrectEntries(limit = 20) {
  return historyLog.filter((h) => h.wasCorrect).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function getRecentQuestionIds(limit = 50) {
  const seen = new Set();
  const ids = [];
  for (let i = historyLog.length - 1; i >= 0 && ids.length < limit; i -= 1) {
    const id = historyLog[i].questionId;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function getSubjectStats(subject) {
  const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const entries = historyLog.filter(
    (h) => h.subject === subject && h.timestamp >= last30 && h.timestamp >= (metaState.metricsResetAt || 0)
  );
  const correct = entries.filter((h) => h.wasCorrect).length;
  const total = entries.length || 1;
  const questionsAnswered = historyLog.filter(
    (h) => h.subject === subject && h.timestamp >= (metaState.metricsResetAt || 0)
  ).length;
  return {
    accuracy: Math.round((correct / total) * 100),
    answered: questionsAnswered,
  };
}

function getCorrectCount(subject) {
  return historyLog.filter(
    (h) => h.subject === subject && h.wasCorrect && h.timestamp >= (metaState.metricsResetAt || 0)
  ).length;
}

function getCurrentStreak(subject) {
  let streak = 0;
  for (let i = historyLog.length - 1; i >= 0; i -= 1) {
    const entry = historyLog[i];
    if (entry.timestamp < (metaState.metricsResetAt || 0)) continue;
    if (entry.subject !== subject) continue;
    if (entry.wasCorrect) streak += 1;
    else break;
  }
  return streak;
}

function generateMissions() {
  const subjectsByWeakness = [...SUBJECTS].sort((a, b) => grades[a] - grades[b]);
  const topics = {
    Fisica: 'Misure e strumenti',
    Chimica: 'Stati della materia',
    Tecnica: 'Materiali e proprietà',
  };
  return [
    `${subjectsByWeakness[0]}: Rispondi a 3 domande facili su ${topics[subjectsByWeakness[0]]}`,
    `${subjectsByWeakness[1]}: Ripassa 2 domande di difficoltà media con correzione`,
    `${subjectsByWeakness[2]}: Completa 1 domanda difficile per consolidare ${topics[subjectsByWeakness[2]]}`,
  ];
}

function getBadgeData() {
  const thresholds = [
    { value: 60, label: 'Oro', emoji: '🥇' },
    { value: 30, label: 'Argento', emoji: '🥈' },
    { value: 10, label: 'Bronzo', emoji: '🥉' },
  ];
  return SUBJECTS.map((subject) => {
    const correct = getCorrectCount(subject);
    const badge = thresholds.find((t) => correct >= t.value);
    const next = thresholds.find((t) => correct < t.value);
    return {
      subject,
      correct,
      badge: badge ? `${badge.emoji} ${badge.label}` : 'Inizia la collezione',
      progress: next ? Math.min(100, Math.round((correct / next.value) * 100)) : 100,
      nextLabel: next ? `${next.value - correct} alla ${next.label}` : 'Livello massimo raggiunto',
    };
  });
}

function showCelebration(message) {
  const stage = document.getElementById('question-stage');
  if (!stage) return;
  const toast = document.createElement('div');
  toast.className = 'celebration-toast';
  toast.textContent = message;
  stage.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 20);
  setTimeout(() => toast.classList.remove('visible'), 2200);
  setTimeout(() => toast.remove(), 2600);
}

function celebrateMilestones(prevGrade, nextGrade, wasCorrect, subject) {
  const levelBefore = getLevelName(prevGrade);
  const levelAfter = getLevelName(nextGrade);
  if (levelAfter !== levelBefore) {
    showCelebration(`Nuovo livello ${levelAfter} in ${subject}!`);
  }
  if (wasCorrect) {
    const thresholds = [10, 30, 60];
    const correctBefore = getCorrectCount(subject) - 1;
    const correctNow = getCorrectCount(subject);
    const unlocked = thresholds.find((t) => correctBefore < t && correctNow >= t);
    if (unlocked) {
      showCelebration(`🎉 Traguardo raggiunto: ${unlocked} risposte corrette in ${subject}!`);
    }
  }
}

function renderNavigation() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      document.querySelectorAll('main section[id$="-view"]').forEach((section) => {
        section.style.display = section.id === `${target}-view` ? 'block' : 'none';
      });
      if (target === 'history') renderHistory();
      if (target === 'stats') renderStats();
      if (target === 'training') renderDashboard();
    });
  });
}

function renderModeToolbar() {
  const modeContainer = document.getElementById('mode-switcher');
  const difficultySelect = document.getElementById('difficulty-filter');
  if (modeContainer) {
    modeContainer.innerHTML = '';
    const modes = [
      { id: 'mixed', label: 'Misto materie' },
      { id: 'subject', label: 'Per materia' },
    ];
    modes.forEach((mode) => {
      const btn = document.createElement('button');
      btn.className = `mode-btn${currentPractice.mode === mode.id ? ' active' : ''}`;
      btn.textContent = mode.label;
      btn.addEventListener('click', () => {
        currentPractice.mode = mode.id;
        renderModeToolbar();
        renderSubjectSwitcher();
        startPractice(currentPractice.subject);
      });
      modeContainer.appendChild(btn);
    });
  }
  if (difficultySelect) {
    difficultySelect.value = currentPractice.difficultyFilter;
    difficultySelect.onchange = (e) => {
      currentPractice.difficultyFilter = e.target.value;
      startPractice(currentPractice.subject);
    };
  }
}

function bindResetButton() {
  const resetBtn = document.getElementById('reset-stats');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => {
    grades = { Fisica: 5, Chimica: 5, Tecnica: 5 };
    saveGrades();
    metaState.metricsResetAt = Date.now();
    saveMeta();
    renderDashboard();
    renderBadges();
    renderMissions();
    renderStats();
    if (currentPractice.currentQuestion) {
      renderQuestion(currentPractice.currentQuestion);
    }
    showCelebration('Statistiche azzerate! Continua ad allenarti.');
  });
}

function renderSubjectSwitcher() {
  const container = document.getElementById('subject-switcher');
  if (!container) return;
  container.innerHTML = '';
  SUBJECTS.forEach((subject) => {
    const btn = document.createElement('button');
    const disabled = currentPractice.mode === 'mixed';
    btn.className = `subject-chip${currentPractice.subject === subject ? ' active' : ''}${
      disabled ? ' disabled' : ''
    }`;
    btn.textContent = subject;
    if (!disabled) {
      btn.addEventListener('click', () => startPractice(subject));
    }
    container.appendChild(btn);
  });
}

function renderDashboard() {
  const container = document.getElementById('subject-dashboard');
  if (!container) return;
  container.innerHTML = '';
  SUBJECTS.forEach((subject) => {
    const grade = grades[subject] ?? 5;
    const level = getLevelName(grade);
    const stats = getSubjectStats(subject);
    const progressPercent = Math.round((grade / 10) * 100);
    const streak = getCurrentStreak(subject);
    const card = document.createElement('div');
    card.className = 'card subject-card';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h3>${subject}</h3>
          <p class="muted">Livello: ${level}</p>
        </div>
        <div class="grade">${grade.toFixed(1)}/10</div>
      </div>
      <div class="progress-bar"><span style="width:${progressPercent}%"></span></div>
      <div class="subject-meta">
        <span>${stats.answered} domande</span>
        <span>Accuratezza 30gg: ${stats.accuracy}%</span>
        <span>Streak: ${streak} 🔥</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderMissions() {
  const container = document.getElementById('mission-box');
  if (!container) return;
  const list = generateMissions();
  container.innerHTML = '<h3>Missioni settimanali suggerite</h3>';
  const ul = document.createElement('ul');
  list.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

function renderBadges() {
  const container = document.getElementById('badges-box');
  if (!container) return;
  const badges = getBadgeData();
  container.innerHTML = '<h3>Badge & collezioni</h3>';
  const grid = document.createElement('div');
  grid.className = 'badge-grid';
  badges.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = 'badge-pill';
    pill.innerHTML = `
      <strong>${item.subject}</strong>
      <span>${item.badge}</span>
      <span class="muted">${item.nextLabel}</span>
      <div class="progress-bar"><span style="width:${item.progress}%"></span></div>
    `;
    grid.appendChild(pill);
  });
  container.appendChild(grid);
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const lastEntries = historyLog.slice(-20).sort((a, b) => b.timestamp - a.timestamp);
  container.innerHTML = '';
  if (!lastEntries.length) {
    container.innerHTML = '<p class="muted">Ancora nessuna risposta registrata.</p>';
    return;
  }
  lastEntries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <div class="history-title">${entry.questionText || entry.questionId}</div>
      <div class="history-meta">
        <span class="tag ${entry.difficulty}">${entry.difficulty}</span>
        <span>${entry.subject}</span>
        <span>${entry.wasCorrect ? '✅ Corretto' : '❌ Errato'}</span>
        <span>${formatDate(entry.timestamp)}</span>
      </div>
      <div class="history-answer">Risposta: <strong>${entry.userAnswer || '-'}</strong></div>
      <div class="history-impact">Impatto su voto: ${entry.gradeDelta > 0 ? '+' : ''}${entry.gradeDelta.toFixed(2)} → ${entry.subject}</div>
    `;
    container.appendChild(row);
  });
}

function renderStats() {
  const statsBox = document.getElementById('stats-overview');
  if (!statsBox) return;
  const total = historyLog.length;
  const correct = historyLog.filter((h) => h.wasCorrect).length;
  statsBox.innerHTML = `
    <div class="card">
      <h3>Panoramica</h3>
      <p>Domande totali: ${total}</p>
      <p>Corrette: ${correct} (${total ? Math.round((correct / total) * 100) : 0}% )</p>
    </div>
  `;
}

function buildPracticePool() {
  let pool = [...questionsData];
  if (currentPractice.mode === 'subject') {
    pool = pool.filter((q) => q.subject === currentPractice.subject);
  }
  if (currentPractice.difficultyFilter !== 'all') {
    pool = pool.filter((q) => q.difficulty === currentPractice.difficultyFilter);
  }
  return pool;
}

function startPractice(subject) {
  if (subject) currentPractice.subject = subject;
  renderSubjectSwitcher();
  const questionStage = document.getElementById('question-stage');
  if (!questionStage) return;
  const pool = buildPracticePool();
  currentPractice.pool = pool;
  const subjectLabel = currentPractice.mode === 'mixed' ? 'mix materie' : currentPractice.subject;
  if (!pool.length) {
    questionStage.innerHTML = `<p>Nessuna domanda disponibile per ${subjectLabel}.</p>`;
    return;
  }
  questionStage.innerHTML = '<div class="spinner">Caricamento domanda...</div>';
  setTimeout(() => {
    const next = selectQuestion(pool);
    renderQuestion(next);
  }, 150);
}

function chooseSubjectForMixed(pool) {
  const grouped = SUBJECTS.map((subject) => ({
    subject,
    questions: pool.filter((q) => q.subject === subject),
  })).filter((entry) => entry.questions.length);

  if (!grouped.length) return null;

  const weighted = grouped.map((entry) => {
    const grade = grades[entry.subject] ?? 5;
    const weight = Math.max(1, Math.round(12 - grade));
    return { ...entry, weight };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let pick = Math.random() * total;
  for (const entry of weighted) {
    if ((pick -= entry.weight) <= 0) return entry.subject;
  }
  return weighted[0].subject;
}

function selectQuestion(questions) {
  const now = Date.now();
  const last20Correct = new Set(getLastCorrectEntries(20).map((h) => h.questionId));
  const recentSet = new Set(getRecentQuestionIds(50));
  const eligible = questions.filter((q) => {
    if (last20Correct.has(q.id)) return false;
    if (recentSet.has(q.id)) return false;
    const history = getHistoryByQuestion(q.id);
    const lastCorrect = history.find((h) => h.wasCorrect);
    if (lastCorrect && now - lastCorrect.timestamp < 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  });

  let pool = (eligible.length ? eligible : questions).slice();
  pool.sort((a, b) => {
    const aHistory = getHistoryByQuestion(a.id);
    const bHistory = getHistoryByQuestion(b.id);
    const aLast = aHistory[0];
    const bLast = bHistory[0];
    const priority = (entry) => (entry ? (entry.wasCorrect ? 0 : 2) : 1);
    const diff = priority(bLast) - priority(aLast);
    if (diff !== 0) return diff;
    return (bHistory.length || 0) - (aHistory.length || 0);
  });

  if (currentPractice.mode === 'mixed') {
    const subjectChoice = chooseSubjectForMixed(pool);
    const subjectPool = pool.filter((q) => q.subject === subjectChoice);
    if (subjectPool.length) pool = subjectPool;
  }

  const topSlice = pool.slice(0, Math.min(4, pool.length));
  return topSlice[Math.floor(Math.random() * topSlice.length)] || pool[0];
}

function renderQuestion(question) {
  currentPractice.currentQuestion = question;
  const quizArea = document.getElementById('question-stage');
  if (!quizArea) return;
  if (!question) {
    quizArea.innerHTML = '<p>Nessuna domanda trovata.</p>';
    return;
  }
  quizArea.innerHTML = '';
  const block = document.createElement('div');
  block.className = 'question-block card';
  block.dataset.answered = 'false';

  const subject = question.subject;
  const level = getLevelName(grades[subject] ?? 5);
  const streak = getCurrentStreak(subject);
  const badge = getBadgeData().find((b) => b.subject === subject);

  const info = document.createElement('div');
  info.className = 'question-header';
  info.innerHTML = `
    <div class="difficulty-badge tag ${question.difficulty}">${question.difficulty}</div>
    <p>${question.question}</p>
  `;
  block.appendChild(info);

  const metaRow = document.createElement('div');
  metaRow.className = 'subject-meta';
  metaRow.innerHTML = `
    <span>Materia: <strong>${subject}</strong></span>
    <span>Livello: ${level}</span>
    <span>Streak: ${streak} 🔥</span>
    <span>Badge: ${badge ? badge.badge : 'Inizia ora'}</span>
    <span>Modalità: ${currentPractice.mode === 'mixed' ? 'Mix materie' : 'Materia singola'}</span>
    <span>Filtro: ${currentPractice.difficultyFilter === 'all' ? 'Tutte' : currentPractice.difficultyFilter}</span>
  `;
  block.appendChild(metaRow);

  const answerArea = document.createElement('div');
  answerArea.className = 'answer-area';
  const mcqOptions = question.options || [];
  mcqOptions.forEach((opt, idx) => {
    const label = document.createElement('label');
    label.className = 'option';
    label.innerHTML = `<input type="radio" name="mcq-option" value="${idx}" /> ${opt}`;
    label.querySelector('input').addEventListener('change', () => {
      const checkBtn = block.querySelector('.verify-btn');
      if (block.dataset.answered === 'true') return;
      checkBtn.disabled = false;
      checkBtn.textContent = 'Verifico...';
      setTimeout(() => {
        if (block.dataset.answered === 'false') {
          handleCheckAnswer(question, feedback, checkBtn, block);
        }
      }, 200);
    });
    answerArea.appendChild(label);
  });
  block.appendChild(answerArea);

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  block.appendChild(feedback);

  const controls = document.createElement('div');
  controls.className = 'question-controls';
  const checkBtn = document.createElement('button');
  checkBtn.className = 'verify-btn';
  checkBtn.textContent = 'Verifica automatica';
  checkBtn.disabled = true;
  checkBtn.addEventListener('click', () => handleCheckAnswer(question, feedback, checkBtn, block));

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Prossima domanda';
  nextBtn.addEventListener('click', () => {
    const next = selectQuestion(currentPractice.pool);
    renderQuestion(next);
  });
  controls.appendChild(checkBtn);
  controls.appendChild(nextBtn);
  block.appendChild(controls);

  quizArea.appendChild(block);
  focusQuestionStage();
}

function focusQuestionStage() {
  const quizArea = document.getElementById('question-stage');
  if (!quizArea) return;
  quizArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function handleCheckAnswer(question, feedbackEl, btn, block) {
  if (!question || (block && block.dataset.answered === 'true')) return;

  let userCorrect = false;
  let userAnswer = '';
  const selected = document.querySelector('input[name="mcq-option"]:checked');
  if (!selected) {
    feedbackEl.textContent = 'Seleziona una risposta.';
    return;
  }
  userAnswer = question.options[Number(selected.value)];
  userCorrect = Number(selected.value) === question.correctIndex;

  if (block) block.dataset.answered = 'true';
  btn.disabled = true;
  btn.textContent = 'Verificata';
  const subject = question.subject;
  const delta = userCorrect ? question.weight * 0.15 : -question.weight * 0.1;
  const previousGrade = grades[subject];
  grades[subject] = clampGrade(grades[subject] + delta);
  saveGrades();

  historyLog.push({
    questionId: question.id,
    subject,
    difficulty: question.difficulty,
    wasCorrect: userCorrect,
    userAnswer,
    timestamp: Date.now(),
    gradeDelta: Number(delta.toFixed(2)),
    questionText: question.question,
  });
  saveHistory();

  const inputs = document.querySelectorAll('input[name="mcq-option"]');
  inputs.forEach((inp) => {
    inp.disabled = true;
    const wrapper = inp.closest('label');
    if (wrapper) wrapper.classList.add('locked');
  });

  feedbackEl.innerHTML = '';
  const msg = document.createElement('p');
  msg.textContent = userCorrect ? 'Corretto! ' : 'Risposta errata.';
  msg.className = userCorrect ? 'positive flash' : 'negative flash';
  feedbackEl.appendChild(msg);

  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = userCorrect
    ? 'Ottimo lavoro! Continua con la prossima domanda.'
    : question.explanation || 'Rivedi il concetto e riprova.';
  feedbackEl.appendChild(hint);

  const impact = document.createElement('p');
  impact.textContent = `${subject}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)} punti`;
  impact.className = 'impact';
  feedbackEl.appendChild(impact);

  if (block) {
    block.classList.add(userCorrect ? 'glow-correct' : 'glow-wrong');
    setTimeout(() => block.classList.remove('glow-correct', 'glow-wrong'), 1600);
  }

  renderDashboard();
  renderMissions();
  renderBadges();

  celebrateMilestones(previousGrade, grades[subject], userCorrect, subject);
}

async function initApp() {
  try {
    applyVersionStamp();
    const questions = await loadQuestions();
    questionsData = questions;
    renderNavigation();
    bindResetButton();
    renderModeToolbar();
    renderSubjectSwitcher();
    renderDashboard();
    renderMissions();
    renderBadges();
    startPractice(currentPractice.subject);
  } catch (error) {
    console.error('Errore inizializzazione app:', error);
    const container = document.getElementById('question-stage');
    if (container) container.innerHTML = '<p class="error">Errore nel caricamento.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initApp);
