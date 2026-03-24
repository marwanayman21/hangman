const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const words = require('./words.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Room & Game State ───────────────────────────────────────────────
const rooms = new Map();
const MAX_WRONG = 6;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function getRandomWord(lang) {
  const list = words[lang] || words['en'];
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Arabic Letter Normalization ─────────────────────────────────────
function normalizeArabic(text) {
  return text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

function createGameState() {
  return {
    word: '',
    displayWord: '',
    hint: '',
    lang: 'en',
    guessedLetters: [],
    wrongGuesses: 0,
    phase: 'waiting', // waiting | setting-word | playing | finished
    winner: null
  };
}

// Helper: get full room state for a player (used for rejoin)
function getRoomStateForPlayer(room, player) {
  const otherPlayer = room.players.find(p => p.id !== player.id);
  const scores = room.players.map(p => ({ name: p.name, score: p.score }));
  const maskedWord = room.game.word ? room.game.word.split('').map(ch => {
    if (ch === ' ') return ' ';
    return room.game.guessedLetters.includes(ch) ? ch : '_';
  }) : [];

  return {
    code: room.code,
    role: player.role,
    opponentName: otherPlayer ? otherPlayer.name : null,
    lang: room.lang,
    scores,
    phase: room.game.phase,
    roundNumber: room.roundNumber,
    game: {
      maskedWord,
      hint: room.game.hint,
      lang: room.game.lang,
      wrongGuesses: room.game.wrongGuesses,
      guessedLetters: room.game.guessedLetters,
      displayWord: player.role === 'setter' ? room.game.displayWord : null,
      winner: room.game.winner,
      word: room.game.phase === 'finished' ? room.game.displayWord : null
    }
  };
}

// ─── Socket.IO Events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Rejoin Room ──
  socket.on('rejoin-room', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      return socket.emit('rejoin-failed');
    }

    // Find the player by name (they disconnected, so old socket id is gone)
    let player = room.players.find(p => p.name === playerName);
    if (player) {
      // Update their socket id and mark as connected
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const state = getRoomStateForPlayer(room, player);
      socket.emit('rejoin-success', state);

      // Notify opponent they're back
      const opponent = room.players.find(p => p.id !== socket.id && p.connected !== false);
      if (opponent) {
        io.to(opponent.id).emit('opponent-reconnected', { opponentName: playerName });
      }
      console.log(`[Room] ${playerName} rejoined room ${roomCode}`);
    } else if (room.players.length < 2) {
      // Player not found but room has space — join as new
      room.players.push({ id: socket.id, name: playerName, role: 'guesser', score: 0 });
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const setter = room.players.find(p => p.role === 'setter');
      const scores = room.players.map(p => ({ name: p.name, score: p.score }));

      socket.emit('room-joined', {
        code: roomCode, role: 'guesser',
        opponentName: setter ? setter.name : '',
        lang: room.lang, scores
      });
      if (setter) {
        io.to(setter.id).emit('opponent-joined', { opponentName: playerName, scores });
        room.game.phase = 'setting-word';
        room.roundNumber++;
        io.to(setter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
      }
      console.log(`[Room] ${playerName} joined room ${roomCode} (as new player)`);
    } else {
      socket.emit('rejoin-failed');
    }
  });

  // ── Create Room ──
  socket.on('create-room', ({ playerName, lang }) => {
    const code = generateRoomCode();
    const room = {
      code,
      players: [{ id: socket.id, name: playerName, role: 'setter', score: 0, connected: true }],
      game: createGameState(),
      lang: lang || 'en',
      roundNumber: 0
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room-created', { code, role: 'setter' });
    console.log(`[Room] ${playerName} created room ${code}`);
  });

  // ── Join Room ──
  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      return socket.emit('error-msg', { msg: 'room-not-found' });
    }
    if (room.players.length >= 2) {
      return socket.emit('error-msg', { msg: 'room-full' });
    }

    room.players.push({ id: socket.id, name: playerName, role: 'guesser', score: 0, connected: true });
    socket.join(code);
    socket.roomCode = code;

    const setter = room.players.find(p => p.role === 'setter');
    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    socket.emit('room-joined', {
      code, role: 'guesser',
      opponentName: setter.name,
      lang: room.lang, scores
    });
    io.to(setter.id).emit('opponent-joined', { opponentName: playerName, scores });

    room.game.phase = 'setting-word';
    room.roundNumber++;
    io.to(setter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
    console.log(`[Room] ${playerName} joined room ${code}`);
  });

  // ── Set Word ──
  socket.on('set-word', ({ word, hint, useRandom, lang }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'setter') return;

    const gameLang = lang || room.lang || 'en';
    room.lang = gameLang;

    let originalWord, gameHint;

    if (useRandom) {
      const rw = getRandomWord(gameLang);
      originalWord = rw.word;
      gameHint = rw.hint;
    } else {
      originalWord = word.trim();
      gameHint = hint || '';
    }

    room.game.displayWord = originalWord;
    if (gameLang === 'ar') {
      room.game.word = normalizeArabic(originalWord);
    } else {
      room.game.word = originalWord.toLowerCase();
    }

    room.game.hint = gameHint;
    room.game.lang = gameLang;
    room.game.guessedLetters = [];
    room.game.wrongGuesses = 0;
    room.game.phase = 'playing';
    room.game.winner = null;

    const maskedWord = room.game.word.split('').map(ch => {
      if (ch === ' ') return ' ';
      return '_';
    });

    const guesser = room.players.find(p => p.role === 'guesser');
    if (guesser) {
      io.to(guesser.id).emit('game-started', {
        wordLength: room.game.word.length,
        maskedWord,
        hint: room.game.hint,
        lang: gameLang,
        roundNumber: room.roundNumber
      });
    }
    io.to(player.id).emit('game-started-setter', {
      word: room.game.displayWord,
      hint: room.game.hint,
      lang: gameLang,
      roundNumber: room.roundNumber,
      maskedWord
    });

    console.log(`[Game] Word set in room ${socket.roomCode}: ${room.game.displayWord} (normalized: ${room.game.word})`);
  });

  // ── Guess Letter ──
  socket.on('guess-letter', ({ letter }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.game.phase !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'guesser') return;

    let normalizedLetter = letter;
    if (room.game.lang === 'ar') {
      normalizedLetter = normalizeArabic(letter);
    } else {
      normalizedLetter = letter.toLowerCase();
    }

    if (room.game.guessedLetters.includes(normalizedLetter)) return;
    room.game.guessedLetters.push(normalizedLetter);

    const isCorrect = room.game.word.includes(normalizedLetter);
    if (!isCorrect) {
      room.game.wrongGuesses++;
    }

    const maskedWord = room.game.word.split('').map(ch => {
      if (ch === ' ') return ' ';
      return room.game.guessedLetters.includes(ch) ? ch : '_';
    });

    const allRevealed = room.game.word.split('').every(ch =>
      ch === ' ' || room.game.guessedLetters.includes(ch)
    );

    let gameOver = false;
    if (allRevealed) {
      room.game.phase = 'finished';
      room.game.winner = 'guesser';
      const guesserPlayer = room.players.find(p => p.role === 'guesser');
      if (guesserPlayer) {
        guesserPlayer.score += (MAX_WRONG - room.game.wrongGuesses) * 10 + 10;
      }
      gameOver = true;
    } else if (room.game.wrongGuesses >= MAX_WRONG) {
      room.game.phase = 'finished';
      room.game.winner = 'setter';
      const setterPlayer = room.players.find(p => p.role === 'setter');
      if (setterPlayer) {
        setterPlayer.score += 30;
      }
      gameOver = true;
    }

    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    io.to(socket.roomCode).emit('guess-result', {
      letter: normalizedLetter,
      isCorrect,
      maskedWord,
      wrongGuesses: room.game.wrongGuesses,
      guessedLetters: room.game.guessedLetters,
      gameOver,
      winner: room.game.winner,
      word: gameOver ? room.game.displayWord : null,
      scores
    });

    if (gameOver) {
      console.log(`[Game] Room ${socket.roomCode} finished. Winner: ${room.game.winner}`);
    }
  });

  // ── Chat Message ──
  socket.on('chat-msg', ({ text }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const msg = text.trim().slice(0, 200);
    if (!msg) return;

    io.to(socket.roomCode).emit('chat-msg', {
      sender: player.name,
      text: msg
    });
  });

  // ── Play Again (swap roles — guarded to run only once) ──
  socket.on('play-again', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    // Only process if game is still in 'finished' phase (prevents double-swap)
    if (room.game.phase !== 'finished') return;

    room.players.forEach(p => {
      p.role = p.role === 'setter' ? 'guesser' : 'setter';
    });

    room.game = createGameState();
    room.game.phase = 'setting-word';
    room.roundNumber++;

    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    room.players.forEach(p => {
      io.to(p.id).emit('new-round', { role: p.role, scores, roundNumber: room.roundNumber });
    });

    const newSetter = room.players.find(p => p.role === 'setter');
    if (newSetter) {
      io.to(newSetter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
    }
  });

  // ── Disconnect ──
  // Keep room alive for 10 minutes so players can rejoin freely
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Mark as disconnected but keep them in the room
    player.disconnectedAt = Date.now();
    player.connected = false;

    // Notify opponent
    const opponent = room.players.find(p => p.id !== socket.id && p.connected !== false);
    if (opponent) {
      io.to(opponent.id).emit('opponent-disconnected', { opponentName: player.name });
    }

    // Clean up room after 10 minutes if BOTH players are disconnected
    setTimeout(() => {
      const currentRoom = rooms.get(code);
      if (!currentRoom) return;
      const allDisconnected = currentRoom.players.every(p => p.connected === false);
      if (allDisconnected) {
        rooms.delete(code);
        console.log(`[Room] Room ${code} deleted (all players disconnected for 10 min)`);
      }
    }, 600000); // 10 minutes
  });
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Hangman server running on http://localhost:${PORT}`);
});
