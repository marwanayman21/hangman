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

function createGameState() {
  return {
    word: '',
    hint: '',
    lang: 'en',
    guessedLetters: [],
    wrongGuesses: 0,
    phase: 'waiting', // waiting | setting-word | playing | finished
    winner: null
  };
}

// ─── Socket.IO Events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Create Room ──
  socket.on('create-room', ({ playerName, lang }) => {
    const code = generateRoomCode();
    const room = {
      code,
      players: [{ id: socket.id, name: playerName, role: 'setter' }],
      game: createGameState(),
      lang: lang || 'en'
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

    room.players.push({ id: socket.id, name: playerName, role: 'guesser' });
    socket.join(code);
    socket.roomCode = code;

    const setter = room.players.find(p => p.role === 'setter');
    socket.emit('room-joined', { code, role: 'guesser', opponentName: setter.name, lang: room.lang });
    io.to(setter.id).emit('opponent-joined', { opponentName: playerName });

    // Move to word-setting phase
    room.game.phase = 'setting-word';
    io.to(setter.id).emit('set-word-prompt');
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

    if (useRandom) {
      const rw = getRandomWord(gameLang);
      room.game.word = rw.word.toLowerCase();
      room.game.hint = rw.hint;
    } else {
      room.game.word = word.trim().toLowerCase();
      room.game.hint = hint || '';
    }

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
        lang: gameLang
      });
    }
    io.to(player.id).emit('game-started-setter', {
      word: room.game.word,
      hint: room.game.hint,
      lang: gameLang
    });

    console.log(`[Game] Word set in room ${socket.roomCode}: ${room.game.word}`);
  });

  // ── Guess Letter ──
  socket.on('guess-letter', ({ letter }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.game.phase !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'guesser') return;

    const lowerLetter = letter.toLowerCase();
    if (room.game.guessedLetters.includes(lowerLetter)) return;

    room.game.guessedLetters.push(lowerLetter);

    const isCorrect = room.game.word.includes(lowerLetter);
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
      gameOver = true;
    } else if (room.game.wrongGuesses >= MAX_WRONG) {
      room.game.phase = 'finished';
      room.game.winner = 'setter';
      gameOver = true;
    }

    io.to(socket.roomCode).emit('guess-result', {
      letter: lowerLetter,
      isCorrect,
      maskedWord,
      wrongGuesses: room.game.wrongGuesses,
      guessedLetters: room.game.guessedLetters,
      gameOver,
      winner: room.game.winner,
      word: gameOver ? room.game.word : null
    });

    if (gameOver) {
      console.log(`[Game] Room ${socket.roomCode} finished. Winner: ${room.game.winner}`);
    }
  });

  // ── Play Again (swap roles) ──
  socket.on('play-again', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    // Swap roles
    room.players.forEach(p => {
      p.role = p.role === 'setter' ? 'guesser' : 'setter';
    });

    room.game = createGameState();
    room.game.phase = 'setting-word';

    room.players.forEach(p => {
      io.to(p.id).emit('new-round', { role: p.role });
    });

    const newSetter = room.players.find(p => p.role === 'setter');
    if (newSetter) {
      io.to(newSetter.id).emit('set-word-prompt');
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const remaining = room.players.filter(p => p.id !== socket.id);
    if (remaining.length === 0) {
      rooms.delete(code);
      console.log(`[Room] Room ${code} deleted (empty)`);
    } else {
      room.players = remaining;
      remaining.forEach(p => {
        io.to(p.id).emit('opponent-left');
      });
    }
  });
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Hangman server running on http://localhost:${PORT}`);
});
