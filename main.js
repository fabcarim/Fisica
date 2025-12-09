// main.js - logica della webapp Mia Science Quest V1.0

let weeksData = [];
let questionsData = [];
let quizProgress = {};
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

function updateXPFromProgress(progress) {
  const xpDisplay = document.getElementById('xp-display');
  const levelDisplay = document.getElementById('level-display');
  const correctCount = Object.values(progress).filter((entry) => entry.correct).length;
  const xp = correctCount * 5;
  const level = Math.floor(xp / 50) + 1;

  if (xpDisplay) xpDisplay.textContent = `XP: ${xp}`;
  if (levelDisplay) levelDisplay.textContent = `Livello: ${level}`;
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
    }
  } else {
    feedbackEl.textContent = 'Non ancora, riprova.';
  }
}

async function initApp() {
  quizProgress = loadQuizProgress();
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
