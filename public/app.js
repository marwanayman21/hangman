/* ══════════════════════════════════════════════════════════════
   Hangman Online – Client App
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
    langSwitch: 'عربي'
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
    langSwitch: 'English'
  }
};

// ─── Arabic & English Keyboards ──────────────────────────────
const KEYS_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const KEYS_AR = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز',
  'س','ش','ص','ض','ط','ظ','ع','غ','ف','ق',
  'ك','ل','م','ن','ه','و','ي','ة','ى','ء','أ','إ','آ','ؤ','ئ'
];

// ─── State ───────────────────────────────────────────────────
let currentLang = 'en';
let currentRole = null; // 'setter' | 'guesser'
let currentRoomCode = null;
let gameLang = 'en';
let opponentName = '';
let playerName = '';

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
function t(key) {
  return i18n[currentLang][key] || key;
}

function applyI18n() {
  $$('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  $$('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  $('#lang-label').textContent = t('langSwitch');

  const html = document.documentElement;
  if (currentLang === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
    document.body.style.fontFamily = 'var(--font-ar)';
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
    document.body.style.fontFamily = 'var(--font-en)';
  }
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  screens[name].style.animation = 'none';
  screens[name].offsetHeight; // trigger reflow
  screens[name].style.animation = '';
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
  maskedWord.forEach((ch, i) => {
    const slot = document.createElement('div');
    slot.className = 'letter-slot';
    if (ch === ' ') {
      slot.classList.add('space-slot');
    } else if (ch !== '_') {
      slot.textContent = ch;
      slot.classList.add('revealed');
    } else {
      slot.textContent = '';
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
  const slots = $$('.letter-slot');
  word.split('').forEach((ch, i) => {
    if (i < slots.length && ch !== ' ') {
      slots[i].textContent = ch;
      if (!slots[i].classList.contains('revealed')) {
        slots[i].classList.add('final-reveal');
      }
    }
  });
}

// ─── Keyboard ────────────────────────────────────────────────
function renderKeyboard(lang) {
  const container = $('#keyboard');
  container.innerHTML = '';
  const keys = lang === 'ar' ? KEYS_AR : KEYS_EN;
  keys.forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = key;
    btn.dataset.letter = key.toLowerCase();
    btn.addEventListener('click', () => onKeyPress(key.toLowerCase(), btn));
    container.appendChild(btn);
  });
}

function onKeyPress(letter, btn) {
  if (btn.classList.contains('used') || currentRole !== 'guesser') return;
  btn.classList.add('used');
  socket.emit('guess-letter', { letter });
}

// ─── Screen: Home ────────────────────────────────────────────
$('#lang-toggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  applyI18n();
});

$('#btn-create').addEventListener('click', () => {
  playerName = $('#player-name').value.trim();
  if (!playerName) {
    $('#home-error').textContent = t('nameMissing');
    return;
  }
  $('#home-error').textContent = '';
  socket.emit('create-room', { playerName, lang: currentLang });
});

$('#btn-join').addEventListener('click', () => {
  playerName = $('#player-name').value.trim();
  const code = $('#room-code-input').value.trim();
  if (!playerName) {
    $('#home-error').textContent = t('nameMissing');
    return;
  }
  if (!code) {
    $('#home-error').textContent = t('codeMissing');
    return;
  }
  $('#home-error').textContent = '';
  socket.emit('join-room', { roomCode: code, playerName });
});

$('#room-code-input').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// ─── Screen: Lobby ───────────────────────────────────────────
$('#btn-copy-code').addEventListener('click', () => {
  if (currentRoomCode) {
    navigator.clipboard.writeText(currentRoomCode).then(() => {
      showToast(t('copied'), 'success');
    });
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
  if (!word) {
    showToast(t('wordMissing'), 'error');
    return;
  }
  const hint = $('#custom-hint').value.trim();
  socket.emit('set-word', { word, hint, useRandom: false, lang: gameLang });
});

$('#btn-random-word').addEventListener('click', () => {
  socket.emit('set-word', { word: '', hint: '', useRandom: true, lang: gameLang });
});

// ─── Screen: Game Over ───────────────────────────────────────
$('#btn-play-again').addEventListener('click', () => {
  hideAllOverlays();
  socket.emit('play-again');
});

$('#btn-go-home').addEventListener('click', () => {
  hideAllOverlays();
  location.reload();
});

$('#btn-left-home').addEventListener('click', () => {
  hideAllOverlays();
  location.reload();
});

// ─── Socket Events ───────────────────────────────────────────

// Room created
socket.on('room-created', ({ code, role }) => {
  currentRoomCode = code;
  currentRole = role;
  $('#lobby-code').textContent = code;
  showScreen('lobby');
});

// Room joined (as guesser)
socket.on('room-joined', ({ code, role, opponentName: oppName, lang }) => {
  currentRoomCode = code;
  currentRole = role;
  opponentName = oppName;
  currentLang = lang;
  applyI18n();
  // Wait for game to start
  showScreen('lobby');
  $('#lobby-code').textContent = code;
  $('#lobby-title').textContent = t('lobbyWaiting');
});

// Opponent joined (setter receives this)
socket.on('opponent-joined', ({ opponentName: oppName }) => {
  opponentName = oppName;
  showToast(t('opponentJoined'), 'success');
});

// Setter should set word
socket.on('set-word-prompt', () => {
  $('#custom-word').value = '';
  $('#custom-hint').value = '';
  gameLang = currentLang;
  $$('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === gameLang);
  });
  showScreen('setWord');
});

// Game started (guesser)
socket.on('game-started', ({ maskedWord, hint, lang }) => {
  gameLang = lang;
  showScreen('game');
  hideAllOverlays();

  $('#role-badge').textContent = t('roleGuesser');
  $('#opponent-name-display').textContent = opponentName;
  $('#hint-text').textContent = hint;
  $('#lives-count').textContent = '6';
  $('#setter-view').classList.add('hidden');
  $('#keyboard').classList.remove('hidden');

  resetHangman();
  renderWord(maskedWord);
  renderKeyboard(lang);
});

// Game started (setter)
socket.on('game-started-setter', ({ word, hint, lang }) => {
  gameLang = lang;
  showScreen('game');
  hideAllOverlays();

  $('#role-badge').textContent = t('roleSetter');
  $('#opponent-name-display').textContent = opponentName;
  $('#hint-text').textContent = hint;
  $('#lives-count').textContent = '6';
  $('#setter-view').classList.remove('hidden');
  $('#setter-word-text').textContent = word;
  $('#keyboard').classList.add('hidden');

  resetHangman();

  const maskedWord = word.split('').map(ch => ch === ' ' ? ' ' : '_');
  renderWord(maskedWord);
});

// Guess result
socket.on('guess-result', ({ letter, isCorrect, maskedWord, wrongGuesses, guessedLetters, gameOver, winner, word }) => {
  // Update word
  updateWord(maskedWord);

  // Update keyboard
  const keyBtn = Array.from($$('.key-btn')).find(b => b.dataset.letter === letter);
  if (keyBtn) {
    keyBtn.classList.add('used');
    keyBtn.classList.add(isCorrect ? 'correct' : 'wrong');
  }

  // Update lives
  const lives = 6 - wrongGuesses;
  $('#lives-count').textContent = lives;

  // Show hangman part
  if (!isCorrect) {
    showHangmanPart(wrongGuesses - 1);
  }

  // Game over
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
    }, 600);
  }
});

// New round (after play again)
socket.on('new-round', ({ role }) => {
  currentRole = role;
  hideAllOverlays();
  if (role === 'setter') {
    // will receive set-word-prompt
  } else {
    showScreen('lobby');
    $('#lobby-title').textContent = t('lobbyWaiting');
  }
});

// Opponent left
socket.on('opponent-left', () => {
  $('#opponent-left-overlay').classList.remove('hidden');
});

// Error
socket.on('error-msg', ({ msg }) => {
  const errorTexts = {
    'room-not-found': t('roomNotFound'),
    'room-full': t('roomFull')
  };
  showToast(errorTexts[msg] || msg, 'error');
  $('#home-error').textContent = errorTexts[msg] || msg;
});

// ─── Physical Keyboard Support ───────────────────────────────
document.addEventListener('keydown', (e) => {
  if (currentRole !== 'guesser') return;
  if (!screens.game.classList.contains('active')) return;

  const letter = e.key.toLowerCase();
  const keyBtn = Array.from($$('.key-btn')).find(b => b.dataset.letter === letter);
  if (keyBtn && !keyBtn.classList.contains('used')) {
    onKeyPress(letter, keyBtn);
  }
});

// ─── Init ────────────────────────────────────────────────────
applyI18n();
