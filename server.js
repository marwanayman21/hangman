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
app.get('/keep-alive', (req, res) => res.send('OK'));

// ─── Room & Game State ───────────────────────────────────────────────
const rooms = new Map();
const DEFAULT_MAX_WRONG = 6;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function getRandomWord(lang, mode) {
  const langData = words[lang] || words['en'];
  const list = mode === 'sentence' ? langData.sentences : langData.words;
  return list[Math.floor(Math.random() * list.length)];
}

function calculateMaxWrong(normalizedWord) {
  const uniqueLetters = new Set(normalizedWord.split('').filter(ch => ch !== ' '));
  const count = uniqueLetters.size;
  return Math.min(Math.max(Math.ceil(count * 0.45), 6), 12);
}

function normalizeArabic(text) {
  return text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

function createGameState() {
  return {
    word: '', displayWord: '', hint: '', lang: 'en',
    mode: 'word', maxWrong: DEFAULT_MAX_WRONG,
    guessedLetters: [], wrongGuesses: 0,
    phase: 'waiting', winner: null
  };
}

// ─── Room Helpers ────────────────────────────────────────────────────
function getPublicRoomList() {
  const list = [];
  rooms.forEach((room, code) => {
    if (room.visibility === 'public' && room.players.length < 2) {
      const connectedCount = room.players.filter(p => p.connected !== false).length;
      if (connectedCount > 0) {
        list.push({
          code,
          ownerName: room.ownerName,
          playerCount: connectedCount,
          lang: room.lang
        });
      }
    }
  });
  return list;
}

function broadcastRoomList() {
  io.emit('room-list', getPublicRoomList());
}

function getRoomStateForPlayer(room, player) {
  const otherPlayer = room.players.find(p => p.id !== player.id);
  const scores = room.players.map(p => ({ name: p.name, score: p.score }));
  const maskedWord = room.game.word ? room.game.word.split('').map(ch => {
    if (ch === ' ') return ' ';
    return room.game.guessedLetters.includes(ch) ? ch : '_';
  }) : [];

  return {
    code: room.code, role: player.role,
    opponentName: otherPlayer ? otherPlayer.name : null,
    lang: room.lang, scores, phase: room.game.phase,
    roundNumber: room.roundNumber,
    isOwner: room.ownerName === player.name,
    visibility: room.visibility,
    game: {
      maskedWord, hint: room.game.hint, lang: room.game.lang,
      mode: room.game.mode, maxWrong: room.game.maxWrong,
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

  // Send current public rooms on connect
  socket.emit('room-list', getPublicRoomList());

  // ── Request Room List ──
  socket.on('get-rooms', () => {
    socket.emit('room-list', getPublicRoomList());
  });

  // ── Rejoin Room ──
  socket.on('rejoin-room', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('rejoin-failed');

    let player = room.players.find(p => p.name === playerName);
    if (player) {
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const state = getRoomStateForPlayer(room, player);
      socket.emit('rejoin-success', state);

      const opponent = room.players.find(p => p.id !== socket.id && p.connected !== false);
      if (opponent) {
        io.to(opponent.id).emit('opponent-reconnected', { opponentName: playerName });
      }
      broadcastRoomList();
      console.log(`[Room] ${playerName} rejoined room ${roomCode}`);
    } else if (room.players.length < 2) {
      room.players.push({ id: socket.id, name: playerName, role: 'guesser', score: 0, connected: true });
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const setter = room.players.find(p => p.role === 'setter');
      const scores = room.players.map(p => ({ name: p.name, score: p.score }));

      socket.emit('room-joined', {
        code: roomCode, role: 'guesser',
        opponentName: setter?.name || '',
        lang: room.lang, scores, isOwner: false
      });
      if (setter) {
        io.to(setter.id).emit('opponent-joined', { opponentName: playerName, scores });
        room.game.phase = 'setting-word';
        room.roundNumber++;
        io.to(setter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
      }
      broadcastRoomList();
      console.log(`[Room] ${playerName} joined room ${roomCode} (as new player)`);
    } else {
      socket.emit('rejoin-failed');
    }
  });

  // ── Create Room ──
  socket.on('create-room', ({ playerName, lang, visibility }) => {
    const code = generateRoomCode();
    const vis = visibility || 'public';
    const room = {
      code,
      players: [{ id: socket.id, name: playerName, role: 'setter', score: 0, connected: true }],
      game: createGameState(),
      lang: lang || 'en',
      roundNumber: 0,
      ownerName: playerName,
      visibility: vis
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room-created', { code, role: 'setter', isOwner: true, visibility: vis });
    broadcastRoomList();
    console.log(`[Room] ${playerName} created ${vis} room ${code}`);
  });

  // ── Join Room ──
  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) return socket.emit('error-msg', { msg: 'room-not-found' });
    if (room.players.length >= 2) return socket.emit('error-msg', { msg: 'room-full' });

    room.players.push({ id: socket.id, name: playerName, role: 'guesser', score: 0, connected: true });
    socket.join(code);
    socket.roomCode = code;

    const setter = room.players.find(p => p.role === 'setter');
    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    socket.emit('room-joined', {
      code, role: 'guesser',
      opponentName: setter.name,
      lang: room.lang, scores,
      isOwner: false
    });
    io.to(setter.id).emit('opponent-joined', { opponentName: playerName, scores });

    room.game.phase = 'setting-word';
    room.roundNumber++;
    io.to(setter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
    broadcastRoomList();
    console.log(`[Room] ${playerName} joined room ${code}`);
  });

  // ── Leave Room (voluntary) ──
  socket.on('leave-room', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const playerName = player.name;
    const wasOwner = room.ownerName === playerName;

    // Remove the player
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(code);
    socket.roomCode = null;

    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`[Room] Room ${code} deleted (empty after leave)`);
    } else {
      // Transfer ownership if owner left
      if (wasOwner) {
        const newOwner = room.players[0];
        room.ownerName = newOwner.name;
        io.to(newOwner.id).emit('became-owner');
        console.log(`[Room] Ownership of ${code} transferred to ${newOwner.name}`);
      }
      // Reset game state
      room.game = createGameState();
      room.game.phase = 'waiting';
      // Notify remaining player
      room.players.forEach(p => {
        io.to(p.id).emit('opponent-left');
      });
    }
    socket.emit('left-room');
    broadcastRoomList();
    console.log(`[Room] ${playerName} left room ${code}`);
  });

  // ── Kick Player (owner only) ──
  socket.on('kick-player', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const kicker = room.players.find(p => p.id === socket.id);
    if (!kicker || room.ownerName !== kicker.name) return;

    const target = room.players.find(p => p.id !== socket.id);
    if (!target) return;

    const targetSocket = io.sockets.sockets.get(target.id);

    // Remove kicked player
    room.players = room.players.filter(p => p.id !== target.id);
    room.game = createGameState();
    room.game.phase = 'waiting';

    if (targetSocket) {
      targetSocket.leave(code);
      targetSocket.roomCode = null;
      targetSocket.emit('kicked');
    }

    socket.emit('player-kicked', { kickedName: target.name });
    broadcastRoomList();
    console.log(`[Room] ${kicker.name} kicked ${target.name} from room ${code}`);
  });

  // ── Toggle Room Visibility ──
  socket.on('toggle-visibility', ({ visibility }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.ownerName !== player.name) return;

    room.visibility = visibility;
    io.to(code).emit('visibility-changed', { visibility });
    broadcastRoomList();
    console.log(`[Room] Room ${code} is now ${visibility}`);
  });

  // ── Set Word ──
  socket.on('set-word', ({ word, hint, useRandom, lang, mode }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'setter') return;

    const gameLang = lang || room.lang || 'en';
    const gameMode = mode || 'word';
    room.lang = gameLang;

    let originalWord, gameHint;

    if (useRandom) {
      const rw = getRandomWord(gameLang, gameMode);
      originalWord = rw.word;
      gameHint = rw.hint;
    } else {
      originalWord = word.trim();
      gameHint = hint || '';
    }

    room.game.displayWord = originalWord;
    room.game.word = gameLang === 'ar'
      ? normalizeArabic(originalWord)
      : originalWord.toLowerCase();

    const maxWrong = gameMode === 'sentence'
      ? calculateMaxWrong(room.game.word)
      : DEFAULT_MAX_WRONG;

    room.game.hint = gameHint;
    room.game.lang = gameLang;
    room.game.mode = gameMode;
    room.game.maxWrong = maxWrong;
    room.game.guessedLetters = [];
    room.game.wrongGuesses = 0;
    room.game.phase = 'playing';
    room.game.winner = null;

    const maskedWord = room.game.word.split('').map(ch => ch === ' ' ? ' ' : '_');

    const guesser = room.players.find(p => p.role === 'guesser');
    if (guesser) {
      io.to(guesser.id).emit('game-started', {
        wordLength: room.game.word.length, maskedWord,
        hint: room.game.hint, lang: gameLang,
        mode: gameMode, maxWrong, roundNumber: room.roundNumber
      });
    }
    io.to(player.id).emit('game-started-setter', {
      word: room.game.displayWord, hint: room.game.hint,
      lang: gameLang, mode: gameMode, maxWrong,
      roundNumber: room.roundNumber, maskedWord
    });

    console.log(`[Game] ${gameMode} set in room ${socket.roomCode}: ${room.game.displayWord} (maxWrong: ${maxWrong})`);
  });

  // ── Guess Letter ──
  socket.on('guess-letter', ({ letter }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.game.phase !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'guesser') return;

    const normalizedLetter = room.game.lang === 'ar'
      ? normalizeArabic(letter)
      : letter.toLowerCase();

    if (room.game.guessedLetters.includes(normalizedLetter)) return;
    room.game.guessedLetters.push(normalizedLetter);

    const isCorrect = room.game.word.includes(normalizedLetter);
    if (!isCorrect) room.game.wrongGuesses++;

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
      if (guesserPlayer) guesserPlayer.score += (room.game.maxWrong - room.game.wrongGuesses) * 10 + 10;
      gameOver = true;
    } else if (room.game.wrongGuesses >= room.game.maxWrong) {
      room.game.phase = 'finished';
      room.game.winner = 'setter';
      const setterPlayer = room.players.find(p => p.role === 'setter');
      if (setterPlayer) setterPlayer.score += 30;
      gameOver = true;
    }

    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    io.to(socket.roomCode).emit('guess-result', {
      letter: normalizedLetter, isCorrect, maskedWord,
      wrongGuesses: room.game.wrongGuesses,
      guessedLetters: room.game.guessedLetters,
      gameOver, winner: room.game.winner,
      word: gameOver ? room.game.displayWord : null, scores
    });

    if (gameOver) console.log(`[Game] Room ${socket.roomCode} finished. Winner: ${room.game.winner}`);
  });

  // ── Chat Message ──
  socket.on('chat-msg', ({ text }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const msg = text.trim().slice(0, 200);
    if (!msg) return;

    io.to(socket.roomCode).emit('chat-msg', { sender: player.name, text: msg });
  });

  // ── Play Again (swap roles — guarded) ──
  socket.on('play-again', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.game.phase !== 'finished') return;

    room.players.forEach(p => { p.role = p.role === 'setter' ? 'guesser' : 'setter'; });

    room.game = createGameState();
    room.game.phase = 'setting-word';
    room.roundNumber++;

    const scores = room.players.map(p => ({ name: p.name, score: p.score }));
    room.players.forEach(p => {
      io.to(p.id).emit('new-round', { role: p.role, scores, roundNumber: room.roundNumber });
    });

    const newSetter = room.players.find(p => p.role === 'setter');
    if (newSetter) io.to(newSetter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.disconnectedAt = Date.now();
    player.connected = false;

    const opponent = room.players.find(p => p.id !== socket.id && p.connected !== false);
    if (opponent) io.to(opponent.id).emit('opponent-disconnected', { opponentName: player.name });

    broadcastRoomList();

    setTimeout(() => {
      const currentRoom = rooms.get(code);
      if (!currentRoom) return;
      const allDisconnected = currentRoom.players.every(p => p.connected === false);
      if (allDisconnected) {
        rooms.delete(code);
        broadcastRoomList();
        console.log(`[Room] Room ${code} deleted (all players disconnected for 10 min)`);
      }
    }, 600000);
  });
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Hangman server running on http://localhost:${PORT}`);
});
