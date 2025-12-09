// main.js - logica della webapp Mia Science Quest V1.1

let weeksData = [];
let questionsData = [];
let quizProgress = {};
let streakData = {};
let missionProgress = {};
let currentPractice = {
  weekId: null,
  subject: null,
  questions: [],
  currentIndex: 0,
};

async function loadWeeks() {
  try {
    const response = await fetch('data/weeks.json');
    if (!response.ok) throw new Error('Impossibile caricare le settimane');
    return await response.json();
  } catch (error) {
    console.error('Errore caricamento settimane:', error);
    showErrorMessage('#week-content', 'Errore nel caricamento delle settimane.');
    return [];
  }
}

async function loadQuestions() {
  try {
    const response = await fetch('data/questions.json');
    if (!response.ok) throw new Error('Impossibile caricare le domande');
    return await response.json();
  } catch (error) {
    console.error('Errore caricamento domande:', error);
    showErrorMessage('#week-content', 'Errore nel caricamento delle domande.');
    return [];
  }
}

function showErrorMessage(selector, message) {
  const container = document.querySelector(selector);
  if (container) {
    container.innerHTML = `<p class="error">${message}</p>`;
  }
}

function loadQuizProgress() {
  try {
    const saved = localStorage.getItem('mia-science-quiz');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Errore nel caricamento del progresso quiz:', error);
    return {};
  }
}

function saveQuizProgress(progress) {
  try {
    localStorage.setItem('mia-science-quiz', JSON.stringify(progress));
  } catch (error) {
    console.error('Errore nel salvataggio del progresso quiz:', error);
  }
}

function loadStreak() {
  try {
    const saved = localStorage.getItem('mia-science-streak');
    return saved ? JSON.parse(saved) : { count: 0, lastDate: null };
  } catch (error) {
    console.error('Errore nel caricamento della streak:', error);
    return { count: 0, lastDate: null };
  }
}

function saveStreak(data) {
  try {
    localStorage.setItem('mia-science-streak', JSON.stringify(data));
  } catch (error) {
    console.error('Errore nel salvataggio della streak:', error);
  }
}

function loadMissionProgress() {
  try {
    const saved = localStorage.getItem('mia-science-missions');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Errore nel caricamento delle missioni:', error);
    return {};
  }
}

function saveMissionProgress(progress) {
  try {
    localStorage.setItem('mia-science-missions', JSON.stringify(progress));
  } catch (error) {
    console.error('Errore nel salvataggio delle missioni:', error);
  }
}

function getBadgeForXP(xp) {
  if (xp >= 300) return 'Lab Hero';
  if (xp >= 180) return 'Experiment Pro';
  if (xp >= 120) return 'Junior Scientist';
  if (xp >= 50) return 'Starter';
  return 'New Explorer';
}

function ensureGamificationPanel() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  let panel = document.getElementById('gamification-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'gamification-panel';
    panel.innerHTML = `
      <h3>Ricompense V1.1</h3>
      <div class="xp-progress">
        <div class="xp-bar"><span id="xp-fill"></span></div>
        <p class="xp-note">XP verso il livello successivo</p>
      </div>
      <div class="badge-line">Badge: <span id="badge-display">-</span></div>
      <div class="streak-line" id="streak-display">Streak: 0 giorni</div>
      <div class="leaderboard">
        <div class="leaderboard-header">Classifica amichevole</div>
        <div id="leaderboard-list"></div>
      </div>
    `;
    sidebar.appendChild(panel);
  }
}

function getLeaderboardData(userXP) {
  const rivals = [
    { name: 'Luca', xp: 210 },
    { name: 'Giulia', xp: 140 },
    { name: 'Sofia', xp: 85 },
    { name: 'Ali', xp: 60 },
  ];
  const combined = [...rivals, { name: 'Tu', xp: userXP }];
  return combined.sort((a, b) => b.xp - a.xp).map((player, index) => ({ ...player, rank: index + 1 }));
}

function renderLeaderboard(userXP) {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  const leaderboard = getLeaderboardData(userXP);
  list.innerHTML = '';
  leaderboard.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (entry.name === 'Tu' ? ' me' : '');
    row.innerHTML = `<span>#${entry.rank}</span><span class="name">${entry.name}</span><span class="xp">${entry.xp} XP</span>`;
    list.appendChild(row);
  });
}

function updateStreakOnCorrect() {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const lastDate = streakData.lastDate;
  if (lastDate === todayKey) {
    return streakData.count;
  }

  if (lastDate) {
    const diff = Math.floor((today - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    streakData.count = diff === 1 ? streakData.count + 1 : 1;
  } else {
    streakData.count = 1;
  }

  streakData.lastDate = todayKey;
  saveStreak(streakData);
  return streakData.count;
}

function renderStreak() {
  const streakEl = document.getElementById('streak-display');
  if (streakEl) {
    streakEl.textContent = `Streak: ${streakData.count} ${streakData.count === 1 ? 'giorno' : 'giorni'}`;
  }
}

function updateXPFromProgress(progress) {
  const xpDisplay = document.getElementById('xp-display');
  const levelDisplay = document.getElementById('level-display');
  const correctCount = Object.values(progress).filter((entry) => entry.correct).length;
  const xp = correctCount * 5;
  const level = Math.floor(xp / 50) + 1;

  if (xpDisplay) xpDisplay.textContent = `XP: ${xp}`;
  if (levelDisplay) levelDisplay.textContent = `Livello: ${level}`;

  const badgeDisplay = document.getElementById('badge-display');
  if (badgeDisplay) badgeDisplay.textContent = getBadgeForXP(xp);

  const xpFill = document.getElementById('xp-fill');
  if (xpFill) {
    const percent = Math.min(100, Math.round(((xp % 50) / 50) * 100));
    xpFill.style.width = `${percent}%`;
    xpFill.title = `${percent}% del livello ${level}`;
  }

  renderStreak();
  renderLeaderboard(xp);
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

function applyFilter(subject) {
  const cards = document.querySelectorAll('.week-card');
  cards.forEach((card) => {
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

function renderWeekDetail(week) {
  const container = document.getElementById('week-content');
  if (!container) return;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `
    <h2>Settimana ${week.weekNumber} – ${week.title}</h2>
    <p><strong>Mese:</strong> ${week.month}</p>
  `;
  container.appendChild(header);

  const missions = document.createElement('div');
  missions.className = 'mini-missions';
  missions.innerHTML = `
    <div class="missions-head">
      <h3>Missioni rapide</h3>
      <p>Scegli l'ordine che preferisci: ogni spunta vale motivazione extra.</p>
    </div>
  `;
  const missionList = document.createElement('div');
  missionList.className = 'mission-list';
  const quickTasks = [
    'Ripeti le unità di misura base e verifica due esempi reali.',
    'Completa almeno 2 domande per ogni materia della settimana.',
    "Rispondi a una domanda aperta scrivendo il perché dell'errore se sbagli.",
    'Condividi un trucco di memoria (mnemonico) per ricordare un concetto.',
  ];
  quickTasks.forEach((task, idx) => {
    const item = document.createElement('label');
    item.className = 'mission-item';
    const missionKey = `${week.id}-${idx}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.mission = missionKey;
    checkbox.checked = !!missionProgress[missionKey];
    checkbox.addEventListener('change', () => {
      missionProgress[missionKey] = checkbox.checked;
      saveMissionProgress(missionProgress);
    });

    const text = document.createElement('span');
    text.textContent = task;
    item.appendChild(checkbox);
    item.appendChild(text);
    missionList.appendChild(item);
  });
  missions.appendChild(missionList);
  container.appendChild(missions);

  const overview = document.createElement('div');
  overview.innerHTML = '<h3>Panoramica</h3>';
  week.sections.forEach((section) => {
    const block = document.createElement('div');
    block.className = 'section-block';
    const objectivesPreview = section.objectives.slice(0, 3);
    block.innerHTML = `
      <h4>${section.subject}: ${section.topic}</h4>
      <p><strong>Obiettivi:</strong></p>
      <ul>${objectivesPreview.map((obj) => `<li>${obj}</li>`).join('')}</ul>
    `;
    overview.appendChild(block);
  });
  container.appendChild(overview);

  const practice = document.createElement('div');
  practice.className = 'section-block';
  practice.innerHTML = '<h3>Allenamento / Practice</h3>';

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

  const quizArea = document.createElement('div');
  quizArea.id = 'quiz-area';
  quizArea.innerHTML = '<p>Seleziona una materia per iniziare le domande.</p>';
  practice.appendChild(quizArea);

  container.appendChild(practice);
}

function startPractice(week, subject) {
  const quizArea = document.getElementById('quiz-area');
  if (!quizArea) return;
  const group = questionsData.find((q) => q.weekId === week.id && q.subject === subject);
  if (!group || !group.questions || group.questions.length === 0) {
    quizArea.innerHTML = `<p>Nessuna domanda disponibile per ${subject}.</p>`;
    return;
  }

  currentPractice = {
    weekId: week.id,
    subject,
    questions: group.questions,
    currentIndex: 0,
  };

  quizArea.innerHTML = '';
  renderQuestion(group.questions[0]);
}

function renderQuestion(question) {
  const quizArea = document.getElementById('quiz-area');
  if (!quizArea) return;

  const alreadyCorrect = !!quizProgress[question.id]?.correct;

  quizArea.innerHTML = '';
  const questionBlock = document.createElement('div');
  questionBlock.className = 'question-block';

  const header = document.createElement('div');
  header.className = 'question-header';
  header.innerHTML = `
    <p><strong>Domanda ${currentPractice.currentIndex + 1} di ${currentPractice.questions.length}</strong></p>
    <p>${question.question}</p>
    ${alreadyCorrect ? '<span class="badge">Già corretta</span>' : ''}
  `;
  questionBlock.appendChild(header);

  const answerArea = document.createElement('div');
  answerArea.className = 'answer-area';

  if (question.type === 'mcq') {
    question.options.forEach((opt, idx) => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mcq-option';
      input.value = idx;
      if (alreadyCorrect && idx === question.correctIndex) input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(opt));
      answerArea.appendChild(label);
    });
  } else if (question.type === 'truefalse') {
    ['true', 'false'].forEach((val) => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'tf-option';
      input.value = val;
      if (alreadyCorrect && String(question.correctAnswer) === val) input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(val === 'true' ? 'True' : 'False'));
      answerArea.appendChild(label);
    });
  } else if (question.type === 'open') {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'open-answer';
    input.placeholder = 'Scrivi la risposta';
    if (alreadyCorrect) input.value = question.correctAnswer;
    answerArea.appendChild(input);
  }

  questionBlock.appendChild(answerArea);

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  if (alreadyCorrect) {
    feedback.textContent = 'Corretto!';
    if (question.explanation) {
      const exp = document.createElement('p');
      exp.textContent = question.explanation;
      feedback.appendChild(exp);
    }
  }
  questionBlock.appendChild(feedback);

  const controls = document.createElement('div');
  controls.className = 'question-controls';
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Precedente';
  prevBtn.disabled = currentPractice.currentIndex === 0;
  prevBtn.addEventListener('click', () => {
    if (currentPractice.currentIndex > 0) {
      currentPractice.currentIndex -= 1;
      renderQuestion(currentPractice.questions[currentPractice.currentIndex]);
    }
  });

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Verifica risposta';
  checkBtn.addEventListener('click', () => handleCheckAnswer(question, feedback, controls));

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Successiva';
  nextBtn.disabled = currentPractice.currentIndex >= currentPractice.questions.length - 1;
  nextBtn.addEventListener('click', () => {
    if (currentPractice.currentIndex < currentPractice.questions.length - 1) {
      currentPractice.currentIndex += 1;
      renderQuestion(currentPractice.questions[currentPractice.currentIndex]);
    }
  });

  controls.appendChild(prevBtn);
  controls.appendChild(checkBtn);
  controls.appendChild(nextBtn);

  questionBlock.appendChild(controls);
  quizArea.appendChild(questionBlock);
}

function handleCheckAnswer(question, feedbackEl, controlsEl) {
  const alreadyCorrect = !!quizProgress[question.id]?.correct;
  let userCorrect = false;

  if (question.type === 'mcq') {
    const selected = document.querySelector('input[name="mcq-option"]:checked');
    if (!selected) {
      feedbackEl.textContent = 'Seleziona una risposta.';
      return;
    }
    userCorrect = Number(selected.value) === question.correctIndex;
  } else if (question.type === 'truefalse') {
    const selected = document.querySelector('input[name="tf-option"]:checked');
    if (!selected) {
      feedbackEl.textContent = 'Seleziona True o False.';
      return;
    }
    userCorrect = String(question.correctAnswer) === selected.value;
  } else if (question.type === 'open') {
    const input = document.querySelector('input[name="open-answer"]');
    const value = input ? input.value.trim().toLowerCase() : '';
    if (!value) {
      feedbackEl.textContent = 'Inserisci una risposta.';
      return;
    }
    userCorrect = value === question.correctAnswer.toLowerCase();
  }

  feedbackEl.innerHTML = '';
  if (userCorrect) {
    const msg = document.createElement('p');
    msg.textContent = 'Corretto!';
    feedbackEl.appendChild(msg);
    if (question.explanation) {
      const exp = document.createElement('p');
      exp.textContent = question.explanation;
      feedbackEl.appendChild(exp);
    }
    if (!alreadyCorrect) {
      quizProgress[question.id] = { correct: true };
      saveQuizProgress(quizProgress);
      updateXPFromProgress(quizProgress);
      const streakCount = updateStreakOnCorrect();
      renderStreak();
      const xpGain = document.createElement('p');
      xpGain.textContent = '+5 XP guadagnati!';
      feedbackEl.appendChild(xpGain);
      const streakMsg = document.createElement('p');
      streakMsg.textContent = `Streak attiva: ${streakCount} ${streakCount === 1 ? 'giorno' : 'giorni'}!`;
      feedbackEl.appendChild(streakMsg);
    }
  } else {
    feedbackEl.textContent = 'Non ancora, riprova.';
  }
}

async function initApp() {
  quizProgress = loadQuizProgress();
  streakData = loadStreak();
  missionProgress = loadMissionProgress();
  ensureGamificationPanel();
  updateXPFromProgress(quizProgress);

  try {
    const [weeks, questions] = await Promise.all([loadWeeks(), loadQuestions()]);
    weeksData = weeks;
    questionsData = questions;

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
    showErrorMessage('#week-content', 'Errore di inizializzazione.');
  }
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

document.addEventListener('DOMContentLoaded', initApp);
