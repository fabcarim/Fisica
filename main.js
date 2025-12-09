// main.js - Mia Science Quest V2.0
// Gestisce livelli di padronanza, cronologia e selezione smart delle domande

const SUBJECTS = ['Fisica', 'Chimica', 'Tecnica'];
const LEVELS = [
  { min: 0, max: 2, label: 'Principiante' },
  { min: 2, max: 4, label: 'Base' },
  { min: 4, max: 6, label: 'Intermedio' },
  { min: 6, max: 8, label: 'Avanzato' },
  { min: 8, max: 10.01, label: 'Esperto' },
];

let weeksData = [];
let questionsData = [];
let grades = loadGrades();
let historyLog = loadHistory();
let currentPractice = {
  weekId: null,
  subject: null,
  pool: [],
  currentQuestion: null,
};

async function loadWeeks() {
  const response = await fetch('data/weeks.json');
  if (!response.ok) throw new Error('Impossibile caricare le settimane');
  return response.json();
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

function getQuestionGroup(weekId, subject) {
  return questionsData.find((q) => q.weekId === weekId && q.subject === subject);
}

function getHistoryByQuestion(questionId) {
  return historyLog.filter((h) => h.questionId === questionId).sort((a, b) => b.timestamp - a.timestamp);
}

function getLastCorrectEntries(limit = 20) {
  return historyLog.filter((h) => h.wasCorrect).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function getSubjectStats(subject) {
  const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const entries = historyLog.filter((h) => h.subject === subject && h.timestamp >= last30);
  const correct = entries.filter((h) => h.wasCorrect).length;
  const total = entries.length || 1;
  const questionsAnswered = historyLog.filter((h) => h.subject === subject).length;
  return {
    accuracy: Math.round((correct / total) * 100),
    answered: questionsAnswered,
  };
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

function renderNavigation() {
  const tabs = document.querySelectorAll('.nav-btn');
  const sections = {
    training: document.getElementById('training-view'),
    history: document.getElementById('history-view'),
    stats: document.getElementById('stats-view'),
  };

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      Object.keys(sections).forEach((key) => {
        sections[key].style.display = key === target ? 'block' : 'none';
      });
      if (target === 'history') renderHistory();
      if (target === 'stats') renderStats();
    });
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

function renderWeekList(weeks) {
  const listContainer = document.getElementById('weeks-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  weeks.forEach((week) => {
    const card = document.createElement('div');
    card.className = 'week-card';
    card.dataset.id = week.id;
    card.innerHTML = `<strong>Settimana ${week.weekNumber}</strong> – ${week.title}<br/><small>${week.month}</small>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.week-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      renderWeekDetail(week);
    });
    listContainer.appendChild(card);
  });
}

function renderWeekDetail(week) {
  const container = document.getElementById('week-content');
  if (!container) return;
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `
    <h2>Settimana ${week.weekNumber} – ${week.title}</h2>
    <p class="muted">${week.month}</p>
  `;
  container.appendChild(header);

  const overview = document.createElement('div');
  overview.className = 'card';
  overview.innerHTML = '<h3>Panoramica argomenti</h3>';
  week.sections.forEach((section) => {
    const block = document.createElement('div');
    block.className = 'section-block';
    const objectivesPreview = section.objectives.slice(0, 3);
    block.innerHTML = `
      <div class="section-head">
        <strong>${section.subject}</strong> – ${section.topic}
      </div>
      <ul>${objectivesPreview.map((obj) => `<li>${obj}</li>`).join('')}</ul>
    `;
    overview.appendChild(block);
  });
  container.appendChild(overview);

  const practice = document.createElement('div');
  practice.className = 'card';
  practice.innerHTML = '<h3>Allenamento</h3>';
  const subjectRow = document.createElement('div');
  subjectRow.className = 'practice-subjects';
  const subjects = [...new Set(week.sections.map((s) => s.subject))];
  subjects.forEach((subject) => {
    const btn = document.createElement('button');
    btn.className = 'practice-btn';
    btn.textContent = subject;
    btn.addEventListener('click', () => startPractice(week, subject));
    subjectRow.appendChild(btn);
  });
  practice.appendChild(subjectRow);
  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = 'Le domande appariranno nello stage in alto per tenere sempre la focus area visibile.';
  practice.appendChild(hint);
  container.appendChild(practice);
}

function startPractice(week, subject) {
  const questionStage = document.getElementById('question-stage');
  if (!questionStage) return;
  const group = getQuestionGroup(week.id, subject);
  if (!group || !group.questions?.length) {
    questionStage.innerHTML = `<p>Nessuna domanda disponibile per ${subject}.</p>`;
    return;
  }
  currentPractice = {
    weekId: week.id,
    subject,
    pool: group.questions,
    currentQuestion: null,
  };
  questionStage.innerHTML = '<div class="spinner">Caricamento domanda...</div>';
  questionStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    const next = selectQuestion(group.questions, subject);
    renderQuestion(next);
  }, 250);
}

function focusQuestionStage() {
  const stage = document.getElementById('question-stage');
  if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectQuestion(questions, subject) {
  const now = Date.now();
  const last20Correct = new Set(getLastCorrectEntries(20).map((h) => h.questionId));
  const eligible = questions.filter((q) => {
    if (last20Correct.has(q.id)) return false;
    const history = getHistoryByQuestion(q.id);
    const lastCorrect = history.find((h) => h.wasCorrect);
    if (lastCorrect && now - lastCorrect.timestamp < 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  });

  const pool = (eligible.length ? eligible : questions).slice();
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
  return pool[0];
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
  const info = document.createElement('div');
  info.className = 'question-header';
  info.innerHTML = `
    <div class="difficulty-badge tag ${question.difficulty}">${question.difficulty}</div>
    <p>${question.question}</p>
  `;
  block.appendChild(info);

  const answerArea = document.createElement('div');
  answerArea.className = 'answer-area';
  const mcqOptions = question.options || [];
  if (mcqOptions.length < 4) {
    const warn = document.createElement('p');
    warn.className = 'muted';
    warn.textContent = 'Questa domanda richiede almeno 4 opzioni a scelta multipla.';
    answerArea.appendChild(warn);
  }
  mcqOptions.forEach((opt, idx) => {
    const label = document.createElement('label');
    label.className = 'option';
    label.innerHTML = `<input type="radio" name="mcq-option" value="${idx}" /> ${opt}`;
    answerArea.appendChild(label);
  });
  block.appendChild(answerArea);

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  block.appendChild(feedback);

  const controls = document.createElement('div');
  controls.className = 'question-controls';
  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Verifica risposta';
  checkBtn.addEventListener('click', () => handleCheckAnswer(question, feedback, checkBtn));
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Domanda successiva';
  nextBtn.addEventListener('click', () => {
    block.classList.add('fade-out');
    setTimeout(() => {
      const next = selectQuestion(currentPractice.pool, currentPractice.subject);
      renderQuestion(next);
    }, 200);
  });
  controls.appendChild(checkBtn);
  controls.appendChild(nextBtn);
  block.appendChild(controls);

  quizArea.appendChild(block);
  focusQuestionStage();
}

function handleCheckAnswer(question, feedbackEl, btn) {
  let userCorrect = false;
  let userAnswer = '';
  if (question.type === 'mcq') {
    const selected = document.querySelector('input[name="mcq-option"]:checked');
    if (!selected) {
      feedbackEl.textContent = 'Seleziona una risposta.';
      return;
    }
    userAnswer = question.options[Number(selected.value)];
    userCorrect = Number(selected.value) === question.correctIndex;
  } else if (question.type === 'truefalse') {
    const selected = document.querySelector('input[name="tf-option"]:checked');
    if (!selected) {
      feedbackEl.textContent = 'Seleziona Vero o Falso.';
      return;
    }
    userAnswer = selected.value;
    userCorrect = String(question.correctAnswer) === selected.value;
  } else if (question.type === 'open') {
    const input = document.querySelector('input[name="open-answer"]');
    userAnswer = input ? input.value.trim() : '';
    if (!userAnswer) {
      feedbackEl.textContent = 'Inserisci una risposta.';
      return;
    }
    userCorrect = userAnswer.toLowerCase().includes(String(question.correctAnswer).toLowerCase());
  }

  const delta = userCorrect ? question.weight * 0.15 : -question.weight * 0.1;
  grades[currentPractice.subject] = clampGrade(grades[currentPractice.subject] + delta);
  saveGrades();

  historyLog.push({
    questionId: question.id,
    subject: currentPractice.subject,
    difficulty: question.difficulty,
    wasCorrect: userCorrect,
    userAnswer,
    timestamp: Date.now(),
    gradeDelta: Number(delta.toFixed(2)),
    questionText: question.question,
  });
  saveHistory();

  feedbackEl.innerHTML = '';
  const msg = document.createElement('p');
  msg.textContent = userCorrect ? 'Corretto! ' : 'Risposta errata.';
  msg.className = userCorrect ? 'positive' : 'negative';
  feedbackEl.appendChild(msg);

  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = userCorrect
    ? 'Ottimo lavoro! Continua con la prossima domanda.'
    : question.explanation || 'Rivedi il concetto e riprova.';
  feedbackEl.appendChild(hint);

  const impact = document.createElement('p');
  impact.textContent = `${currentPractice.subject}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)} punti`; 
  feedbackEl.appendChild(impact);

  renderDashboard();
  renderMissions();
}

function attachFilterListeners() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const subject = btn.dataset.subject || 'all';
      applyFilter(subject);
    });
  });
}

function applyFilter(subject) {
  document.querySelectorAll('.week-card').forEach((card) => {
    const week = weeksData.find((w) => w.id === card.dataset.id);
    if (!week) return;
    if (subject === 'all') {
      card.style.display = 'block';
      return;
    }
    const hasSubject = week.sections.some((section) => section.subject === subject);
    card.style.display = hasSubject ? 'block' : 'none';
  });
}

async function initApp() {
  try {
    const [weeks, questions] = await Promise.all([loadWeeks(), loadQuestions()]);
    weeksData = weeks;
    questionsData = questions;
    renderNavigation();
    renderDashboard();
    renderMissions();
    renderWeekList(weeksData);
    attachFilterListeners();
    const firstWeekCard = document.querySelector('.week-card');
    if (firstWeekCard) {
      firstWeekCard.classList.add('active');
      const firstWeek = weeksData.find((w) => w.id === firstWeekCard.dataset.id);
      if (firstWeek) renderWeekDetail(firstWeek);
    }
  } catch (error) {
    console.error('Errore inizializzazione app:', error);
    const container = document.getElementById('week-content');
    if (container) container.innerHTML = '<p class="error">Errore nel caricamento.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initApp);
