const io = require('socket.io-client');
const http = require('http');

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;

const owner = io(URL);
let guesser1, guesser2;
let roomCode = '';

owner.on('connect', () => {
    console.log('Owner connected');
    owner.emit('create-room', { playerName: 'Owner', lang: 'en', visibility: 'public', maxPlayers: '3' });
});

owner.on('room-created', (data) => {
    console.log('Room created:', data.code);
    roomCode = data.code;
    
    guesser1 = io(URL);
    guesser1.on('connect', () => {
        console.log('Guesser 1 connected');
        guesser1.emit('join-room', { roomCode, playerName: 'Guesser 1' });
    });
    
    guesser1.on('room-joined', () => {
        guesser2 = io(URL);
        guesser2.on('connect', () => {
            console.log('Guesser 2 connected');
            guesser2.emit('join-room', { roomCode, playerName: 'Guesser 2' });
        });
        
        guesser2.on('room-joined', () => {
            console.log('All 3 players in lobby. Owner starting game...');
            owner.emit('start-game');
        });
    });
});

let setWordReceived = 0;
const onSetWordPrompt = () => {
    setWordReceived++;
    if (setWordReceived === 1) {
        console.log('Owner received set-word-prompt');
        owner.emit('set-word', { word: 'apple', hint: 'fruit', useRandom: false, lang: 'en', mode: 'word' });
    }
};
owner.on('set-word-prompt', onSetWordPrompt);

owner.on('game-started-setter', (data) => {
    console.log('Owner game started with guessers:', Object.keys(data.guessers).length);
});

let guessersStarted = 0;
const onGuesserStarted = (data) => {
    guessersStarted++;
    if (guessersStarted === 2) {
        console.log('Both guessers started game.');
        console.log('Guesser 1 guessing "A" (correct)');
        guesser1.emit('guess-letter', { letter: 'a' });
        
        setTimeout(() => {
            console.log('Guesser 1 guessing "P" (correct)');
            guesser1.emit('guess-letter', { letter: 'p' });
        }, 500);
        
        setTimeout(() => {
            console.log('Guesser 2 guessing "Z" (wrong)');
            guesser2.emit('guess-letter', { letter: 'z' });
        }, 1000);
    }
};


owner.on('guesser-progress', (data) => {
    console.log('Owner received progress update:', data);
});

owner.on('game-over-broadcast', (data) => {
    console.log('Owner received game over broadcast:', data);
});

setTimeout(() => {
    console.log('Test completed. Exiting.');
    process.exit(0);
}, 6000);
