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
    phase: 'waiting', winner: null,
    guessers: {} // Map of guesserId -> { guessedLetters, wrongGuesses, status: 'playing'|'won'|'lost' }
  };
}

// ─── Room Helpers ────────────────────────────────────────────────────
function getPublicRoomList() {
  const list = [];
  rooms.forEach((room, code) => {
    if (room.visibility === 'public' && room.players.length < room.maxPlayers) {
      const connectedCount = room.players.filter(p => p.connected !== false).length;
      if (connectedCount > 0) {
        list.push({
          code,
          ownerName: room.ownerName,
          playerCount: connectedCount,
          maxPlayers: room.maxPlayers,
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
  const scores = room.players.map(p => ({ name: p.name, score: p.score }));
  
  // Prepare game state response based on role
  let maskedWord = [];
  let guessedLetters = [];
  let wrongGuesses = 0;

  if (room.game.word && room.game.phase !== 'waiting' && room.game.phase !== 'setting-word') {
    if (player.role === 'guesser' && room.game.guessers[player.id]) {
        guessedLetters = room.game.guessers[player.id].guessedLetters;
        wrongGuesses = room.game.guessers[player.id].wrongGuesses;
    }
    maskedWord = room.game.word.split('').map(ch => {
      if (ch === ' ') return ' ';
      return guessedLetters.includes(ch) ? ch : '_';
    });
  }

  return {
    code: room.code, role: player.role,
    players: room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected, id: p.id })),
    lang: room.lang, scores, phase: room.game.phase,
    roundNumber: room.roundNumber,
    isOwner: room.ownerName === player.name,
    visibility: room.visibility,
    maxPlayers: room.maxPlayers,
    game: {
      maskedWord, hint: room.game.hint, lang: room.game.lang,
      mode: room.game.mode, maxWrong: room.game.maxWrong,
      wrongGuesses, guessedLetters,
      displayWord: player.role === 'setter' || room.game.phase === 'finished' ? room.game.displayWord : null,
      winner: room.game.winner,
      word: room.game.phase === 'finished' ? room.game.displayWord : null,
      guessers: player.role === 'setter' ? room.game.guessers : null
    }
  };
}

// ─── Socket.IO Events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  socket.emit('room-list', getPublicRoomList());

  socket.on('get-rooms', () => {
    socket.emit('room-list', getPublicRoomList());
  });

  socket.on('rejoin-room', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('rejoin-failed');

    let player = room.players.find(p => p.name === playerName);
    if (player) {
      const oldId = player.id;
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      socket.join(roomCode);
      socket.roomCode = roomCode;

      // Update guessers map key if game is running
      if (room.game.guessers && room.game.guessers[oldId]) {
         room.game.guessers[socket.id] = room.game.guessers[oldId];
         delete room.game.guessers[oldId];
      }

      const state = getRoomStateForPlayer(room, player);
      socket.emit('rejoin-success', state);

      // Notify others
      room.players.forEach(p => {
        if (p.id !== socket.id && p.connected) {
          io.to(p.id).emit('lobby-players-updated', room.players.map(x => ({ name: x.name, connected: x.connected, role: x.role })));
          io.to(p.id).emit('opponent-reconnected', { opponentName: playerName });
        }
      });
      broadcastRoomList();
      console.log(`[Room] ${playerName} rejoined room ${roomCode}`);
    } else if (room.players.length < room.maxPlayers) {
      room.players.push({ id: socket.id, name: playerName, role: 'guesser', score: 0, connected: true });
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const scores = room.players.map(p => ({ name: p.name, score: p.score }));
      const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected, id: p.id }));

      socket.emit('room-joined', {
        code: roomCode, role: 'guesser',
        players: playersList,
        lang: room.lang, scores, isOwner: false, maxPlayers: room.maxPlayers
      });
      
      room.players.forEach(p => {
          if (p.id !== socket.id) {
              io.to(p.id).emit('lobby-players-updated', playersList);
              io.to(p.id).emit('opponent-joined', { opponentName: playerName, scores });
          }
      });

      broadcastRoomList();
      console.log(`[Room] ${playerName} joined room ${roomCode} (as new player)`);
    } else {
      socket.emit('error-msg', { msg: 'room-full' });
    }
  });

  socket.on('create-room', ({ playerName, lang, visibility, maxPlayers }) => {
    const code = generateRoomCode();
    const vis = visibility || 'public';
    const maxP = Math.max(2, Math.min(8, parseInt(maxPlayers) || 2));
    const room = {
      code,
      players: [{ id: socket.id, name: playerName, role: 'setter', score: 0, connected: true }],
      game: createGameState(),
      lang: lang || 'en',
      roundNumber: 0,
      ownerName: playerName,
      visibility: vis,
      maxPlayers: maxP
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    
    const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected }));
    socket.emit('room-created', { code, role: 'setter', isOwner: true, visibility: vis, players: playersList, maxPlayers: maxP });
    broadcastRoomList();
    console.log(`[Room] ${playerName} created ${vis} room ${code} (Max: ${maxP})`);
  });

  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) return socket.emit('error-msg', { msg: 'room-not-found' });

    let player = room.players.find(p => p.name === playerName);
    if (player) {
        player.id = socket.id;
        player.connected = true;
        socket.join(code);
        socket.roomCode = code;
    } else {
        if (room.players.length >= room.maxPlayers) return socket.emit('error-msg', { msg: 'room-full' });
        player = { id: socket.id, name: playerName, role: 'guesser', score: 0, connected: true };
        room.players.push(player);
        socket.join(code);
        socket.roomCode = code;
    }

    const scores = room.players.map(p => ({ name: p.name, score: p.score }));
    const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected, id: p.id }));

    const activeSetters = room.players.filter(p => p.role.includes('setter')).map(p => p.name);

    socket.emit('room-joined', {
      code, role: 'guesser',
      players: playersList,
      lang: room.lang, scores,
      isOwner: false, maxPlayers: room.maxPlayers,
      setters: activeSetters
    });

    room.players.forEach(p => {
        if (p.id !== socket.id) {
            io.to(p.id).emit('lobby-players-updated', playersList);
            io.to(p.id).emit('opponent-joined', { opponentName: playerName, scores });
        }
    });

    broadcastRoomList();
    console.log(`[Room] ${playerName} joined room ${code}`);
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.ownerName !== room.players.find(p => p.id === socket.id)?.name) return;
    if (room.players.length < 2) return;

    room.game.phase = 'setting-word';
    room.roundNumber++;
    room.players.forEach(p => p.score = 0);
    
    room.gameMode = room.players.length >= 4 ? 'team-race' : 'classic';

    if (room.gameMode === 'team-race') {
      // Split into Team A and Team B
      const shuffled = [...room.players].sort(() => 0.5 - Math.random());
      // Ensure owner is in Team A and is the setter for A
      const ownerIdx = shuffled.findIndex(p => p.name === room.ownerName);
      if (ownerIdx > -1) {
          const ownerObj = shuffled.splice(ownerIdx, 1)[0];
          shuffled.unshift(ownerObj);
      }

      const teamA = [];
      const teamB = [];
      shuffled.forEach((p, idx) => {
          if (idx % 2 === 0) {
              p.team = 'A';
              p.role = teamA.length === 0 ? 'setterA' : 'guesserA';
              teamA.push(p);
          } else {
              p.team = 'B';
              p.role = teamB.length === 0 ? 'setterB' : 'guesserB';
              teamB.push(p);
          }
      });
      room.game.teams = { A: teamA, B: teamB };
      room.game.words = { A: null, B: null }; // Words chosen for this team to guess
      room.game.guessStates = { A: {}, B: {} };
      
      room.players.forEach(p => {
          if (p.role === 'setterA' || p.role === 'setterB') {
              io.to(p.id).emit('set-word-prompt', { roundNumber: room.roundNumber, teamMode: true, yourTeam: p.team });
          } else {
              const setters = room.players.filter(x => x.role.includes('setter')).map(x => x.name);
              io.to(p.id).emit('game-starting-soon', { roundNumber: room.roundNumber, teamMode: true, yourTeam: p.team, setters });
          }
      });
    } else {
      // Classic 1v1 or 1v2 Race Mode
      const setters = [];
      const guessers = [];
      room.players.forEach(p => {
          if (p.name === room.ownerName) {
              p.role = 'setter';
              p.team = null;
              setters.push(p);
          } else {
              p.role = 'guesser';
              p.team = null;
              guessers.push(p);
          }
      });

      setters.forEach(p => io.to(p.id).emit('set-word-prompt', { roundNumber: room.roundNumber }));
      guessers.forEach(p => io.to(p.id).emit('game-starting-soon', { roundNumber: room.roundNumber, setters: setters.map(s => s.name) }));
    }

    // Refresh lobby
    const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected, team: p.team }));
    room.players.forEach(p => io.to(p.id).emit('lobby-players-updated', playersList));
  });

  socket.on('leave-room', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const playerName = player.name;
    const wasOwner = room.ownerName === playerName;

    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(code);
    socket.roomCode = null;

    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`[Room] Room ${code} deleted (empty after leave)`);
    } else {
      if (wasOwner) {
        const newOwner = room.players[0];
        room.ownerName = newOwner.name;
        io.to(newOwner.id).emit('became-owner');
      }
      room.game = createGameState();
      room.game.phase = 'waiting';
      
      const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected, id: p.id }));
      room.players.forEach(p => {
        io.to(p.id).emit('lobby-players-updated', playersList);
        io.to(p.id).emit('opponent-left');
      });
    }
    socket.emit('left-room');
    broadcastRoomList();
  });

  socket.on('kick-player', (data) => {
    if (!data || !data.targetPlayerName) return;
    const { targetPlayerName } = data;
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const kicker = room.players.find(p => p.id === socket.id);
    if (!kicker || room.ownerName !== kicker.name) return;

    const target = room.players.find(p => p.name === targetPlayerName);
    if (!target) return;

    const targetSocket = io.sockets.sockets.get(target.id);

    room.players = room.players.filter(p => p.id !== target.id);
    room.game = createGameState();
    room.game.phase = 'waiting';

    if (targetSocket) {
      targetSocket.leave(code);
      targetSocket.roomCode = null;
      targetSocket.emit('kicked');
    }

    const playersList = room.players.map(p => ({ name: p.name, role: p.role, connected: p.connected }));
    room.players.forEach(p => {
        io.to(p.id).emit('lobby-players-updated', playersList);
        io.to(p.id).emit('player-kicked', { kickedName: target.name });
    });
    
    broadcastRoomList();
  });

  socket.on('toggle-visibility', ({ visibility }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.ownerName !== player.name) return;

    room.visibility = visibility;
    io.to(room.code).emit('visibility-changed', { visibility });
    broadcastRoomList();
  });

  socket.on('set-word', ({ word, hint, useRandom, lang, mode }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || (player.role !== 'setter' && player.role !== 'setterA' && player.role !== 'setterB')) return;

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

    const normalized = gameLang === 'ar' ? normalizeArabic(originalWord) : originalWord.toLowerCase();
    const maxWrong = gameMode === 'sentence' ? calculateMaxWrong(normalized) : DEFAULT_MAX_WRONG;

    if (room.gameMode === 'team-race') {
      const myTeam = player.role === 'setterA' ? 'A' : 'B';
      const targetTeam = myTeam === 'A' ? 'B' : 'A'; // Word is for the OTHER team
      
      room.game.words[targetTeam] = {
         displayWord: originalWord,
         word: normalized,
         hint: gameHint,
         lang: gameLang,
         mode: gameMode,
         maxWrong: maxWrong
      };

      // Have both setters submitted their words?
      if (room.game.words.A && room.game.words.B) {
         room.game.phase = 'playing';
         room.game.winner = null;

         // Initialize guess states
         ['A', 'B'].forEach(t => {
            const guessers = room.players.filter(p => p.team === t && p.role.startsWith('guesser'));
            guessers.forEach(g => {
               room.game.guessStates[t][g.id] = {
                  guessedLetters: [],
                  wrongGuesses: 0,
                  status: 'playing'
               };
               
               const wObj = room.game.words[t];
               const maskedWord = wObj.word.split('').map(ch => ch === ' ' ? ' ' : '_');

               io.to(g.id).emit('game-started', {
                 wordLength: wObj.word.length, maskedWord,
                 hint: wObj.hint, lang: wObj.lang,
                 mode: wObj.mode, maxWrong: wObj.maxWrong, roundNumber: room.roundNumber,
                 playerId: g.id, teamMode: true, yourTeam: t,
                 guessers: room.game.guessStates[t],
                 playerNames: room.players.reduce((map, p) => { map[p.id] = p.name; return map; }, {})
               });
            });

            // Emit to the setter of the OTHER team who set this word
            const setterId = room.players.find(p => p.role === (t === 'A' ? 'setterB' : 'setterA'))?.id;
            if (setterId) {
               const wObj = room.game.words[t];
               const maskedWord = wObj.word.split('').map(ch => ch === ' ' ? ' ' : '_');
               io.to(setterId).emit('game-started-setter', {
                 word: wObj.displayWord, hint: wObj.hint,
                 lang: wObj.lang, mode: wObj.mode, maxWrong: wObj.maxWrong,
                 roundNumber: room.roundNumber, maskedWord,
                 guessers: room.game.guessStates[t],
                 playerNames: room.players.reduce((map, p) => { map[p.id] = p.name; return map; }, {}),
                 teamMode: true, targetTeam: t
               });
            }
         });
      } else {
         // Waiting for the other setter
         io.to(player.id).emit('waiting-for-other-setter');
      }
    } else {
      // Classic Mode
      room.game.displayWord = originalWord;
      room.game.word = normalized;
      room.game.hint = gameHint;
      room.game.lang = gameLang;
      room.game.mode = gameMode;
      room.game.maxWrong = maxWrong;
      room.game.phase = 'playing';
      room.game.winner = null;
      room.game.guessers = {};

      const guessers = room.players.filter(p => p.role === 'guesser');
      guessers.forEach(g => {
          room.game.guessers[g.id] = {
              guessedLetters: [],
              wrongGuesses: 0,
              correctCount: 0,
              status: 'playing'
          };
      });

      const maskedWord = room.game.word.split('').map(ch => ch === ' ' ? ' ' : '_');

      guessers.forEach(g => {
        io.to(g.id).emit('game-started', {
          wordLength: room.game.word.length, maskedWord,
          hint: room.game.hint, lang: gameLang,
          mode: gameMode, maxWrong, roundNumber: room.roundNumber,
          playerId: g.id,
          guessers: room.game.guessers,
          playerNames: room.players.reduce((map, p) => { map[p.id] = p.name; return map; }, {})
        });
      });

      io.to(player.id).emit('game-started-setter', {
        word: room.game.displayWord, hint: room.game.hint,
        lang: gameLang, mode: gameMode, maxWrong,
        roundNumber: room.roundNumber, maskedWord,
        guessers: room.game.guessers,
        playerNames: room.players.reduce((map, p) => { map[p.id] = p.name; return map; }, {})
      });
    }
  });

  socket.on('guess-letter', ({ letter }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.game.phase !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || (!player.role.startsWith('guesser') && player.role !== 'guesser')) return;

    const normalizedLetter = (room.lang === 'ar' || room.game.words?.A?.lang === 'ar') ? normalizeArabic(letter) : letter.toLowerCase();
    let gameOver = false;
    const scores = room.players.map(p => ({ name: p.name, score: p.score }));

    if (room.gameMode === 'team-race') {
      const myTeam = player.team; // 'A' or 'B'
      const guesserState = room.game.guessStates[myTeam][player.id];
      if (!guesserState || guesserState.status !== 'playing') return;

      if (guesserState.guessedLetters.includes(normalizedLetter)) return;
      guesserState.guessedLetters.push(normalizedLetter);

      const targetWordObj = room.game.words[myTeam];
      const isCorrect = targetWordObj.word.includes(normalizedLetter);
      if (!isCorrect) guesserState.wrongGuesses++;
      else guesserState.correctCount++; // Added this line for team-race mode

      const maskedWord = targetWordObj.word.split('').map(ch => {
        if (ch === ' ') return ' ';
        return guesserState.guessedLetters.includes(ch) ? ch : '_';
      });

      const allRevealed = targetWordObj.word.split('').every(ch =>
        ch === ' ' || guesserState.guessedLetters.includes(ch)
      );

      if (allRevealed) {
        guesserState.status = 'won';
      } else if (guesserState.wrongGuesses >= targetWordObj.maxWrong) {
        guesserState.status = 'lost';
      }

      // Check Team Race Game Phase
      const allGuessersA = Object.values(room.game.guessStates.A);
      const allGuessersB = Object.values(room.game.guessStates.B);

      const teamAWon = allGuessersA.some(g => g.status === 'won');
      const teamBWon = allGuessersB.some(g => g.status === 'won');
      const teamALost = allGuessersA.every(g => g.status === 'lost') && allGuessersA.length > 0;
      const teamBLost = allGuessersB.every(g => g.status === 'lost') && allGuessersB.length > 0;

      let winningWordStr = null;

      if (teamAWon || (teamBLost && !teamBWon)) {
         room.game.phase = 'finished';
         room.game.winner = 'Team A';
         winningWordStr = room.game.words.A.displayWord;
         gameOver = true;
         // Give points to Team A
         room.players.forEach(p => { if (p.team === 'A') p.score += 20; });
      } else if (teamBWon || (teamALost && !teamAWon)) {
         room.game.phase = 'finished';
         room.game.winner = 'Team B';
         winningWordStr = room.game.words.B.displayWord;
         gameOver = true;
         room.players.forEach(p => { if (p.team === 'B') p.score += 20; });
      }

      // Update fresh scores
      const newScores = room.players.map(p => ({ name: p.name, score: p.score }));

      // Send result to THIS guesser
      socket.emit('guess-result', {
        letter: normalizedLetter, isCorrect, maskedWord,
        wrongGuesses: guesserState.wrongGuesses,
        guessedLetters: guesserState.guessedLetters,
        gameOver, winner: room.game.winner,
        word: gameOver ? winningWordStr : null, scores: newScores,
        status: guesserState.status, teamMode: true
      });

      // Broadcast to setter and others
      room.players.forEach(p => {
        if (p.id !== player.id) {
          io.to(p.id).emit('guesser-progress', {
            guesserId: player.id,
            guesserName: player.name,
            wrongGuesses: guesserState.wrongGuesses,
            correctCount: guesserState.correctCount,
            guessedLetters: guesserState.guessedLetters,
            status: guesserState.status,
            gameOver, winner: room.game.winner,
            scores: newScores
          });
        }
      });
      
      if (gameOver) {
         room.players.forEach(p => {
             if (p.id !== player.id) {
                 io.to(p.id).emit('game-over-broadcast', {
                      winner: room.game.winner,
                      word: winningWordStr,
                      scores: newScores, teamMode: true
                 });
             }
         });
      }

    } else {
      // Classic Mode
      const guesserState = room.game.guessers[player.id];
      if (!guesserState || guesserState.status !== 'playing') return;

      if (guesserState.guessedLetters.includes(normalizedLetter)) return;
      guesserState.guessedLetters.push(normalizedLetter);

      const isCorrect = room.game.word.includes(normalizedLetter);
      if (!isCorrect) {
          guesserState.wrongGuesses++;
      } else {
          // Count occurrences of this letter in the word as 'correct progress'
          // Or just unique letters? User says "how many letters he got right"
          // Usually means unique correct letters.
          guesserState.correctCount++;
      }

      const maskedWord = room.game.word.split('').map(ch => {
        if (ch === ' ') return ' ';
        return guesserState.guessedLetters.includes(ch) ? ch : '_';
      });

      const allRevealed = room.game.word.split('').every(ch =>
        ch === ' ' || guesserState.guessedLetters.includes(ch)
      );

      if (allRevealed) {
        guesserState.status = 'won';
      } else if (guesserState.wrongGuesses >= room.game.maxWrong) {
        guesserState.status = 'lost';
      }

      const allGuessers = Object.values(room.game.guessers);
      const anyWon = allGuessers.some(g => g.status === 'won');
      const allLost = allGuessers.every(g => g.status === 'lost');

      if (anyWon) {
        room.game.phase = 'finished';
        room.game.winner = 'guesser'; // A guesser won
        player.score += (room.game.maxWrong - guesserState.wrongGuesses) * 10 + 10;
        gameOver = true;
      } else if (allLost) {
        room.game.phase = 'finished';
        room.game.winner = 'setter'; // Setter wins
        const setterPlayer = room.players.find(p => p.role === 'setter');
        if (setterPlayer) setterPlayer.score += 30;
        gameOver = true;
      }

      const newScores = room.players.map(p => ({ name: p.name, score: p.score }));

      socket.emit('guess-result', {
        letter: normalizedLetter, isCorrect, maskedWord,
        wrongGuesses: guesserState.wrongGuesses,
        guessedLetters: guesserState.guessedLetters,
        gameOver, winner: room.game.winner,
        word: gameOver ? room.game.displayWord : null, scores: newScores,
        status: guesserState.status
      });

      // Let everyone tracking this word (setter + rival guessers) see progress
      room.players.forEach(p => {
          if (p.id !== player.id) {
              const shouldReceive = room.gameMode === 'team-race' ? 
                  (p.role === (myTeam === 'A' ? 'setterB' : 'setterA') || p.team === myTeam) : 
                  true;
                  
              if (shouldReceive) {
                  io.to(p.id).emit('guesser-progress', {
                      guesserId: player.id,
                      guesserName: player.name,
                      wrongGuesses: guesserState.wrongGuesses,
                      correctCount: guesserState.correctCount,
                      guessedLetters: guesserState.guessedLetters,
                      status: guesserState.status,
                      gameOver,
                      winner: room.game.winner,
                      scores: newScores
                  });
              }
          }
      });
      
      if (gameOver) {
         room.players.forEach(p => {
             if (p.id !== player.id && p.role !== 'setter') {
                 io.to(p.id).emit('game-over-broadcast', {
                      winner: room.game.winner,
                      word: room.game.displayWord,
                      scores: newScores
                 });
             }
         });
      }
    }
  });

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

    if (room.gameMode === 'team-race') {
      ['A', 'B'].forEach(t => {
         const teamPlayers = room.players.filter(p => p.team === t);
         if (teamPlayers.length > 0) {
            const currentSetterIdx = teamPlayers.findIndex(p => p.role === `setter${t}`);
            const nextSetterIdx = (currentSetterIdx + 1) % teamPlayers.length;
            
            teamPlayers.forEach((p, idx) => {
               p.role = (idx === nextSetterIdx) ? `setter${t}` : `guesser${t}`;
            });
         }
      });

      room.game = createGameState();
      room.game.teams = { A: room.players.filter(p => p.team === 'A'), B: room.players.filter(p => p.team === 'B') };
      room.game.words = { A: null, B: null };
      room.game.guessStates = { A: {}, B: {} };
      room.game.phase = 'setting-word';
      room.roundNumber++;

      const scores = room.players.map(p => ({ name: p.name, score: p.score }));
      const setterNames = room.players.filter(p => p.role.startsWith('setter')).map(p => p.name);
      
      room.players.forEach(p => {
        io.to(p.id).emit('new-round', { 
            role: p.role, 
            scores, 
            roundNumber: room.roundNumber, 
            teamMode: true, 
            yourTeam: p.team,
            setters: setterNames
        });
      });

      room.players.forEach(p => {
        if (p.role === 'setterA' || p.role === 'setterB') {
           io.to(p.id).emit('set-word-prompt', { roundNumber: room.roundNumber, teamMode: true, yourTeam: p.team });
        }
      });
    } else {
      const curSetterIdx = room.players.findIndex(p => p.role === 'setter');
      const nextSetterIdx = (curSetterIdx + 1) % room.players.length;
      room.players.forEach((p, idx) => { p.role = idx === nextSetterIdx ? 'setter' : 'guesser'; });

      room.game = createGameState();
      room.game.phase = 'setting-word';
      room.roundNumber++;

      const scores = room.players.map(p => ({ name: p.name, score: p.score }));
      const setterNames = room.players.filter(p => p.role === 'setter').map(p => p.name);

      room.players.forEach(p => {
        io.to(p.id).emit('new-round', { 
            role: p.role, 
            scores, 
            roundNumber: room.roundNumber,
            setters: setterNames
        });
      });

      const newSetter = room.players.find(p => p.role === 'setter');
      if (newSetter) io.to(newSetter.id).emit('set-word-prompt', { roundNumber: room.roundNumber });
    }
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
