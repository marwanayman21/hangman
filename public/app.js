/* ══════════════════════════════════════════════════════════════
   Hangman Online – Client App v3
   ══════════════════════════════════════════════════════════════ */

// ─── i18n Translations ───────────────────────────────────────
const i18n = {
  en: {
    title: 'Hangman',
    welcome: 'Play Hangman Online',
    welcomeSub: 'Real-time multiplayer • Arabic & English',
    enterName: 'Your Name',
    namePlaceholder: 'Enter your name...',
    createTitle: 'Create Room',
    createDesc: 'Start a new game and share the code',
    createBtn: 'Create Room',
    joinTitle: 'Join Room',
    joinDesc: 'Enter a room code to join a game',
    joinBtn: 'Join Room',
    lobbyWaiting: 'Waiting for opponent...',
    roomCode: 'Room Code',
    copyCode: 'Copy',
    lobbyHint: 'Share this code with your friend!',
    setWordTitle: 'Choose a Word',
    setWordDesc: 'Pick a word for your opponent to guess',
    wordPlaceholder: 'Type a word...',
    hintPlaceholder: 'Add a hint (optional)',
    setWordBtn: 'Set Word',
    or: 'or',
    randomBtn: 'Random Word',
    hintLabel: 'Hint:',
    setterWatching: 'Watching your opponent guess...',
    yourWord: 'Your word:',
    playAgain: 'Play Again',
    goHome: 'Back to Home',
    opponentLeft: 'Opponent Left',
    opponentLeftDesc: 'Your opponent has disconnected.',
    roleGuesser: 'Guesser',
    roleSetter: 'Setter',
    youWin: '🎉 You Win!',
    youLose: '😵 Game Over!',
    guesserWon: 'The guesser cracked it!',
    setterWon: 'The word was not guessed!',
    theWord: 'The word was:',
    nameMissing: 'Please enter your name!',
    codeMissing: 'Please enter a room code!',
    wordMissing: 'Please enter a word!',
    roomNotFound: 'Room not found!',
    roomFull: 'Room is full!',
    copied: 'Copied!',
    opponentJoined: 'Opponent joined! 🎮',
    langSwitch: 'عربي',
    chat: '💬 Chat',
    chatPlaceholder: 'Type a message...',
    connected: 'Connected',
    waiting: 'Waiting',
    waitingDots: '...',
    round: 'Round',
    opponentDisconnected: 'Opponent disconnected. Waiting to reconnect...',
    opponentReconnected: 'Opponent reconnected! 🎮',
    wordLangError: 'Please type using the correct language!',
    wordNoNumbers: 'Numbers are not allowed!'
  },
  ar: {
    title: 'المشنقة',
    welcome: 'العب المشنقة أونلاين',
    welcomeSub: 'لعب جماعي في الوقت الحقيقي • عربي وإنجليزي',
    enterName: 'اسمك',
    namePlaceholder: 'اكتب اسمك...',
    createTitle: 'إنشاء غرفة',
    createDesc: 'ابدأ لعبة جديدة وشارك الكود',
    createBtn: 'إنشاء غرفة',
    joinTitle: 'دخول غرفة',
    joinDesc: 'اكتب كود الغرفة للانضمام',
    joinBtn: 'دخول الغرفة',
    lobbyWaiting: 'في انتظار الخصم...',
    roomCode: 'كود الغرفة',
    copyCode: 'نسخ',
    lobbyHint: 'شارك الكود مع صاحبك!',
    setWordTitle: 'اختر كلمة',
    setWordDesc: 'اختار كلمة عشان الخصم يخمنها',
    wordPlaceholder: 'اكتب كلمة...',
    hintPlaceholder: 'أضف تلميح (اختياري)',
    setWordBtn: 'تأكيد الكلمة',
    or: 'أو',
    randomBtn: 'كلمة عشوائية',
    hintLabel: 'تلميح:',
    setterWatching: 'بتتفرج على الخصم وهو بيخمن...',
    yourWord: 'كلمتك:',
    playAgain: 'العب تاني',
    goHome: 'الرجوع للرئيسية',
    opponentLeft: 'الخصم خرج',
    opponentLeftDesc: 'الخصم قطع الاتصال.',
    roleGuesser: 'مُخمِّن',
    roleSetter: 'صاحب الكلمة',
    youWin: '🎉 كسبت!',
    youLose: '😵 خسرت!',
    guesserWon: 'المُخمِّن عرف الكلمة!',
    setterWon: 'الكلمة ما اتعرفتش!',
    theWord: 'الكلمة كانت:',
    nameMissing: 'اكتب اسمك الأول!',
    codeMissing: 'اكتب كود الغرفة!',
    wordMissing: 'اكتب كلمة الأول!',
    roomNotFound: 'الغرفة مش موجودة!',
    roomFull: 'الغرفة مليانة!',
    copied: 'تم النسخ!',
    opponentJoined: 'الخصم دخل! 🎮',
    langSwitch: 'English',
    chat: '💬 الشات',
    chatPlaceholder: 'اكتب رسالة...',
    connected: 'متصل',
    waiting: 'مستني',
    waitingDots: '...',
    round: 'الجولة',
    opponentDisconnected: 'الخصم اتقطع. مستنيه يرجع...',
    opponentReconnected: 'الخصم رجع! 🎮',
    wordLangError: 'اكتب باللغة الصح!',
    wordNoNumbers: 'مينفعش تكتب أرقام!'
  }
};

// ─── Arabic & English Keyboards ──────────────────────────────
const KEYS_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const KEYS_AR = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز',
  'س','ش','ص','ض','ط','ظ','ع','غ','ف','ق',
  'ك','ل','م','ن','ه','و','ي','ة','ء'
];

// ─── Arabic Normalization (client-side mirror of server) ─────
function normalizeArabic(text) {
  return text
    .replaceAll(/[أإآٱ]/g, 'ا')
    .replaceAll(/ى/g, 'ي')
    .replaceAll(/[\u064B-\u065F\u0670]/g, '');
}

// ─── Word Validation ─────────────────────────────────────────
function isArabicOnly(text) {
  // Allow Arabic letters, spaces, and Arabic-specific chars
  return /^[\u0600-\u06FF\s]+$/.test(text);
}

function isEnglishOnly(text) {
  return /^[a-zA-Z\s]+$/.test(text);
}

function hasNumbers(text) {
  return /\d/.test(text);
}

// ─── Session Persistence ─────────────────────────────────────
function saveSession(roomCode, playerName, role) {
  sessionStorage.setItem('hangman_session', JSON.stringify({ roomCode, playerName, role }));
}

function getSession() {
  try {
    const data = sessionStorage.getItem('hangman_session');
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function clearSession() {
  sessionStorage.removeItem('hangman_session');
}

// ─── State ───────────────────────────────────────────────────
let currentLang = 'en';
let currentRole = null;
let currentRoomCode = null;
let gameLang = 'en';
let opponentName = '';
let playerName = '';
let chatOpen = false;

// ─── DOM Refs ────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  home: $('#screen-home'),
  lobby: $('#screen-lobby'),
  setWord: $('#screen-set-word'),
  game: $('#screen-game')
};

// ─── Socket Connection ──────────────────────────────────────
const socket = io();

// ─── Helpers ─────────────────────────────────────────────────
function t(key) { return i18n[currentLang][key] || key; }

function applyI18n() {
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $('#lang-label').textContent = t('langSwitch');
  const html = document.documentElement;
  if (currentLang === 'ar') {
    html.setAttribute('dir', 'rtl'); html.setAttribute('lang', 'ar');
    document.body.style.fontFamily = 'var(--font-ar)';
  } else {
    html.setAttribute('dir', 'ltr'); html.setAttribute('lang', 'en');
    document.body.style.fontFamily = 'var(--font-en)';
  }
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  screens[name].style.animation = 'none';
  screens[name].offsetHeight;
  screens[name].style.animation = '';

  if (name === 'game') {
    $('#chat-toggle-btn').classList.remove('hidden');
    $('#header-scores').classList.remove('hidden');
  } else {
    $('#chat-toggle-btn').classList.add('hidden');
    if (name !== 'setWord') $('#header-scores').classList.add('hidden');
  }
}

function showToast(msg, type = '') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function hideAllOverlays() {
  $('#game-over-overlay').classList.add('hidden');
  $('#opponent-left-overlay').classList.add('hidden');
}

// ─── Scores ──────────────────────────────────────────────────
function updateScoreDisplay(scores) {
  if (!scores || scores.length < 2) return;
  $('#score-p1-name').textContent = scores[0].name;
  $('#score-p1-val').textContent = scores[0].score;
  $('#score-p2-name').textContent = scores[1].name;
  $('#score-p2-val').textContent = scores[1].score;
  $('#header-scores').classList.remove('hidden');
}

function renderGameOverScores(scores) {
  const container = $('#go-scores');
  container.innerHTML = '';
  if (!scores) return;
  scores.forEach(s => {
    const div = document.createElement('div');
    div.className = 'go-score-item';
    div.innerHTML = `<span class="go-score-name">${s.name}</span><span class="go-score-val">${s.score}</span>`;
    container.appendChild(div);
  });
}

// ─── Hangman Parts ───────────────────────────────────────────
const HM_PARTS = ['hm-head','hm-body','hm-larm','hm-rarm','hm-lleg','hm-rleg'];

function resetHangman() {
  HM_PARTS.forEach(id => {
    const el = $(`#${id}`);
    el.classList.remove('visible');
    el.classList.add('hidden');
  });
}

function showHangmanPart(index) {
  if (index < HM_PARTS.length) {
    const el = $(`#${HM_PARTS[index]}`);
    el.classList.remove('hidden');
    el.classList.add('visible');
  }
}

// ─── Word Display ────────────────────────────────────────────
function renderWord(maskedWord) {
  const container = $('#word-display');
  container.innerHTML = '';
  container.style.direction = gameLang === 'ar' ? 'rtl' : 'ltr';

  maskedWord.forEach((ch, i) => {
    const slot = document.createElement('div');
    slot.className = 'letter-slot';
    if (ch === ' ') {
      slot.classList.add('space-slot');
    } else if (ch !== '_') {
      slot.textContent = ch;
      slot.classList.add('revealed');
    }
    slot.dataset.index = i;
    container.appendChild(slot);
  });
}

function updateWord(maskedWord) {
  const slots = $$('.letter-slot');
  maskedWord.forEach((ch, i) => {
    if (i < slots.length && ch !== '_' && ch !== ' ') {
      if (!slots[i].classList.contains('revealed')) {
        slots[i].textContent = ch;
        slots[i].classList.add('revealed');
      }
    }
  });
}

function revealFullWord(word) {
  const normalized = gameLang === 'ar' ? normalizeArabic(word) : word;
  const slots = $$('.letter-slot');
  normalized.split('').forEach((ch, i) => {
    if (i < slots.length && ch !== ' ') {
      slots[i].textContent = ch;
      if (!slots[i].classList.contains('revealed')) {
        slots[i].classList.add('final-reveal');
      }
    }
  });
}

// ─── Keyboard ────────────────────────────────────────────────
function renderKeyboard(lang, containerId = '#keyboard') {
  const container = $(containerId);
  container.innerHTML = '';
  const keys = lang === 'ar' ? KEYS_AR : KEYS_EN;
  keys.forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = key;
    btn.dataset.letter = key.toLowerCase();
    if (containerId === '#keyboard') {
      btn.addEventListener('click', () => onKeyPress(key.toLowerCase(), btn));
    }
    container.appendChild(btn);
  });
}

function onKeyPress(letter, btn) {
  if (btn.classList.contains('used') || currentRole !== 'guesser') return;
  btn.classList.add('used');
  socket.emit('guess-letter', { letter });
}

function updateSetterKeyboard(letter, isCorrect) {
  const setterKeys = $$('#setter-keyboard .key-btn');
  setterKeys.forEach(btn => {
    if (btn.dataset.letter === letter) {
      btn.classList.add('used', isCorrect ? 'correct' : 'wrong');
    }
  });
}

// Restore keyboard state from guessedLetters array
function restoreKeyboardState(guessedLetters, word, containerId = '#keyboard') {
  const container = $(containerId);
  if (!container) return;
  const buttons = container.querySelectorAll('.key-btn');
  buttons.forEach(btn => {
    const letter = btn.dataset.letter;
    if (guessedLetters.includes(letter)) {
      const isCorrect = word.includes(letter);
      btn.classList.add('used', isCorrect ? 'correct' : 'wrong');
    }
  });
}

// ─── Chat ────────────────────────────────────────────────────
function addChatMessage(sender, text, isMe) {
  const container = $('#chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMe ? 'me' : 'other'}`;

  if (!isMe) {
    const nameEl = document.createElement('div');
    nameEl.className = 'chat-sender';
    nameEl.textContent = sender;
    bubble.appendChild(nameEl);
  }

  const textEl = document.createElement('div');
  textEl.textContent = text;
  bubble.appendChild(textEl);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

$('#btn-send-chat').addEventListener('click', sendChat);
$('#chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat-msg', { text });
  addChatMessage(playerName, text, true);
  input.value = '';
}

$('#chat-toggle-btn').addEventListener('click', () => {
  chatOpen = !chatOpen;
  const panel = $('#chat-panel');
  if (chatOpen) {
    panel.classList.add('mobile-open');
  } else {
    panel.classList.remove('mobile-open');
  }
});

// ─── Screen: Home ────────────────────────────────────────────
$('#lang-toggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  applyI18n();
});

$('#btn-create').addEventListener('click', () => {
  playerName = $('#player-name').value.trim();
  if (!playerName) { $('#home-error').textContent = t('nameMissing'); return; }
  $('#home-error').textContent = '';
  socket.emit('create-room', { playerName, lang: currentLang });
});

$('#btn-join').addEventListener('click', () => {
  playerName = $('#player-name').value.trim();
  const code = $('#room-code-input').value.trim();
  if (!playerName) { $('#home-error').textContent = t('nameMissing'); return; }
  if (!code) { $('#home-error').textContent = t('codeMissing'); return; }
  $('#home-error').textContent = '';
  socket.emit('join-room', { roomCode: code, playerName });
});

$('#room-code-input').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

// ─── Screen: Lobby ───────────────────────────────────────────
$('#btn-copy-code').addEventListener('click', () => {
  if (currentRoomCode) {
    navigator.clipboard.writeText(currentRoomCode).then(() => showToast(t('copied'), 'success'));
  }
});

// ─── Screen: Set Word ────────────────────────────────────────
$$('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameLang = btn.dataset.lang;
  });
});

$('#btn-set-word').addEventListener('click', () => {
  const word = $('#custom-word').value.trim();
  if (!word) { showToast(t('wordMissing'), 'error'); return; }

  // Validate language
  if (hasNumbers(word)) {
    showToast(t('wordNoNumbers'), 'error');
    return;
  }
  if (gameLang === 'ar' && !isArabicOnly(word)) {
    showToast(t('wordLangError'), 'error');
    return;
  }
  if (gameLang === 'en' && !isEnglishOnly(word)) {
    showToast(t('wordLangError'), 'error');
    return;
  }

  const hint = $('#custom-hint').value.trim();
  socket.emit('set-word', { word, hint, useRandom: false, lang: gameLang });
});

$('#btn-random-word').addEventListener('click', () => {
  socket.emit('set-word', { word: '', hint: '', useRandom: true, lang: gameLang });
});

// ─── Screen: Game Over ───────────────────────────────────────
$('#btn-play-again').addEventListener('click', () => { hideAllOverlays(); socket.emit('play-again'); });
$('#btn-go-home').addEventListener('click', () => { hideAllOverlays(); clearSession(); location.reload(); });
$('#btn-left-home').addEventListener('click', () => { hideAllOverlays(); clearSession(); location.reload(); });

// ─── Socket Events ───────────────────────────────────────────

socket.on('room-created', ({ code, role }) => {
  currentRoomCode = code;
  currentRole = role;
  saveSession(code, playerName, role);
  $('#lobby-code').textContent = code;
  $('#lobby-p1-name').textContent = playerName;
  showScreen('lobby');
});

socket.on('room-joined', ({ code, role, opponentName: oppName, lang, scores }) => {
  currentRoomCode = code;
  currentRole = role;
  opponentName = oppName;
  currentLang = lang;
  saveSession(code, playerName, role);
  applyI18n();
  if (scores) updateScoreDisplay(scores);
  showScreen('lobby');
  $('#lobby-code').textContent = code;
  $('#lobby-title').textContent = t('lobbyWaiting');
  $('#lobby-p1-name').textContent = playerName;
  $('#lobby-p2-name').textContent = oppName;
  $('#lobby-p2').querySelector('.lp-avatar').textContent = '👤';
  $('#lobby-p2-status').textContent = t('connected');
  $('#lobby-p2-status').className = 'lp-status connected';
});

socket.on('opponent-joined', ({ opponentName: oppName, scores }) => {
  opponentName = oppName;
  showToast(t('opponentJoined'), 'success');
  if (scores) updateScoreDisplay(scores);
  $('#lobby-p2-name').textContent = oppName;
  $('#lobby-p2').querySelector('.lp-avatar').textContent = '👤';
  $('#lobby-p2-status').textContent = t('connected');
  $('#lobby-p2-status').className = 'lp-status connected';
});

socket.on('set-word-prompt', ({ roundNumber }) => {
  $('#custom-word').value = '';
  $('#custom-hint').value = '';
  gameLang = currentLang || 'en';
  $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === gameLang));
  if (roundNumber) $('#round-badge').textContent = `${t('round')} ${roundNumber}`;
  showScreen('setWord');
});

socket.on('game-started', ({ maskedWord, hint, lang, roundNumber }) => {
  gameLang = lang;
  showScreen('game');
  hideAllOverlays();
  $('#chat-messages').innerHTML = '';

  $('#role-badge').textContent = t('roleGuesser');
  $('#game-round-label').textContent = `${t('round')} ${roundNumber || 1}`;
  $('#hint-text').textContent = hint;
  $('#lives-count').textContent = '6';
  $('#setter-view').classList.add('hidden');
  $('#keyboard').classList.remove('hidden');

  resetHangman();
  renderWord(maskedWord);
  renderKeyboard(lang);
});

socket.on('game-started-setter', ({ word, hint, lang, roundNumber, maskedWord }) => {
  gameLang = lang;
  showScreen('game');
  hideAllOverlays();
  $('#chat-messages').innerHTML = '';

  $('#role-badge').textContent = t('roleSetter');
  $('#game-round-label').textContent = `${t('round')} ${roundNumber || 1}`;
  $('#hint-text').textContent = hint;
  $('#lives-count').textContent = '6';
  $('#setter-view').classList.remove('hidden');
  $('#setter-word-text').textContent = word;
  $('#keyboard').classList.add('hidden');

  resetHangman();
  renderWord(maskedWord);
  renderKeyboard(lang, '#setter-keyboard');
});

socket.on('guess-result', ({ letter, isCorrect, maskedWord, wrongGuesses, guessedLetters, gameOver, winner, word, scores }) => {
  updateWord(maskedWord);

  // Update guesser keyboard
  const keyBtn = Array.from($$('#keyboard .key-btn')).find(b => b.dataset.letter === letter);
  if (keyBtn) {
    keyBtn.classList.add('used', isCorrect ? 'correct' : 'wrong');
  }

  // Update setter keyboard
  updateSetterKeyboard(letter, isCorrect);

  const lives = 6 - wrongGuesses;
  $('#lives-count').textContent = lives;

  if (!isCorrect) showHangmanPart(wrongGuesses - 1);
  if (scores) updateScoreDisplay(scores);

  if (gameOver) {
    setTimeout(() => {
      if (word) revealFullWord(word);
      const overlay = $('#game-over-overlay');
      overlay.classList.remove('hidden');
      const isGuesserWin = winner === 'guesser';

      if (currentRole === 'guesser') {
        $('#go-title').textContent = isGuesserWin ? t('youWin') : t('youLose');
        $('#go-icon').textContent = isGuesserWin ? '🎉' : '😵';
      } else {
        $('#go-title').textContent = isGuesserWin ? t('guesserWon') : t('setterWon');
        $('#go-icon').textContent = isGuesserWin ? '😬' : '🎉';
      }

      $('#go-word').innerHTML = `${t('theWord')} <strong>${word}</strong>`;
      renderGameOverScores(scores);
    }, 600);
  }
});

socket.on('new-round', ({ role, scores, roundNumber }) => {
  currentRole = role;
  saveSession(currentRoomCode, playerName, role);
  hideAllOverlays();
  if (scores) updateScoreDisplay(scores);
  if (role === 'setter') {
    // will receive set-word-prompt
  } else {
    showScreen('lobby');
    $('#lobby-title').textContent = t('lobbyWaiting');
  }
});

socket.on('chat-msg', ({ sender, text }) => {
  if (sender !== playerName) {
    addChatMessage(sender, text, false);
  }
});

socket.on('opponent-disconnected', ({ opponentName: name }) => {
  showToast(t('opponentDisconnected'), 'error');
});

socket.on('opponent-reconnected', ({ opponentName: name }) => {
  showToast(t('opponentReconnected'), 'success');
});

socket.on('opponent-left', () => {
  clearSession();
  $('#opponent-left-overlay').classList.remove('hidden');
});

socket.on('error-msg', ({ msg }) => {
  const errorTexts = { 'room-not-found': t('roomNotFound'), 'room-full': t('roomFull') };
  showToast(errorTexts[msg] || msg, 'error');
  $('#home-error').textContent = errorTexts[msg] || msg;
});

// ─── Rejoin Handling ─────────────────────────────────────────
socket.on('rejoin-success', (state) => {
  currentRoomCode = state.code;
  currentRole = state.role;
  opponentName = state.opponentName || '';
  currentLang = state.lang || 'en';
  applyI18n();

  if (state.scores) updateScoreDisplay(state.scores);

  const phase = state.phase;
  const game = state.game;

  if (phase === 'waiting' || phase === 'setting-word') {
    if (state.role === 'setter') {
      gameLang = currentLang || 'en';
      $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === gameLang));
      if (state.roundNumber) $('#round-badge').textContent = `${t('round')} ${state.roundNumber}`;
      showScreen('setWord');
    } else {
      showScreen('lobby');
      $('#lobby-code').textContent = state.code;
      $('#lobby-p1-name').textContent = playerName;
      if (opponentName) {
        $('#lobby-p2-name').textContent = opponentName;
        $('#lobby-p2').querySelector('.lp-avatar').textContent = '👤';
        $('#lobby-p2-status').textContent = t('connected');
        $('#lobby-p2-status').className = 'lp-status connected';
      }
      $('#lobby-title').textContent = t('lobbyWaiting');
    }
  } else if (phase === 'playing' || phase === 'finished') {
    gameLang = game.lang || 'en';
    showScreen('game');
    hideAllOverlays();
    $('#chat-messages').innerHTML = '';
    $('#hint-text').textContent = game.hint;
    $('#lives-count').textContent = String(6 - game.wrongGuesses);
    $('#game-round-label').textContent = `${t('round')} ${state.roundNumber || 1}`;

    resetHangman();
    for (let i = 0; i < game.wrongGuesses; i++) {
      showHangmanPart(i);
    }

    renderWord(game.maskedWord);

    if (state.role === 'guesser') {
      $('#role-badge').textContent = t('roleGuesser');
      $('#setter-view').classList.add('hidden');
      $('#keyboard').classList.remove('hidden');
      renderKeyboard(game.lang);
      // Restore keyboard state
      const normalizedWord = game.maskedWord.filter(c => c !== ' ' && c !== '_').join('');
      restoreKeyboardState(game.guessedLetters, game.maskedWord.join(''), '#keyboard');
    } else {
      $('#role-badge').textContent = t('roleSetter');
      $('#setter-view').classList.remove('hidden');
      $('#setter-word-text').textContent = game.displayWord || '';
      $('#keyboard').classList.add('hidden');
      renderKeyboard(game.lang, '#setter-keyboard');
      restoreKeyboardState(game.guessedLetters, game.maskedWord.join(''), '#setter-keyboard');
    }

    if (phase === 'finished') {
      setTimeout(() => {
        if (game.word) revealFullWord(game.word);
        const overlay = $('#game-over-overlay');
        overlay.classList.remove('hidden');
        const isGuesserWin = game.winner === 'guesser';

        if (currentRole === 'guesser') {
          $('#go-title').textContent = isGuesserWin ? t('youWin') : t('youLose');
          $('#go-icon').textContent = isGuesserWin ? '🎉' : '😵';
        } else {
          $('#go-title').textContent = isGuesserWin ? t('guesserWon') : t('setterWon');
          $('#go-icon').textContent = isGuesserWin ? '😬' : '🎉';
        }

        $('#go-word').innerHTML = `${t('theWord')} <strong>${game.word}</strong>`;
        renderGameOverScores(state.scores);
      }, 300);
    }
  }

  showToast(t('opponentReconnected').replace('Opponent', 'You'), 'success');
  console.log('[Rejoin] Successfully rejoined room', state.code);
});

socket.on('rejoin-failed', () => {
  clearSession();
  console.log('[Rejoin] Failed — session expired');
});

// ─── Physical Keyboard Support ───────────────────────────────
document.addEventListener('keydown', (e) => {
  if (currentRole !== 'guesser') return;
  if (!screens.game.classList.contains('active')) return;
  if (document.activeElement === $('#chat-input')) return;

  const letter = e.key.toLowerCase();
  const keyBtn = Array.from($$('#keyboard .key-btn')).find(b => b.dataset.letter === letter);
  if (keyBtn && !keyBtn.classList.contains('used')) {
    onKeyPress(letter, keyBtn);
  }
});

// ─── Init ────────────────────────────────────────────────────
applyI18n();

// Try to rejoin if we have a saved session
const savedSession = getSession();
if (savedSession) {
  playerName = savedSession.playerName;
  currentRole = savedSession.role;
  socket.emit('rejoin-room', {
    roomCode: savedSession.roomCode,
    playerName: savedSession.playerName
  });
}
