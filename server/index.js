const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameRoom = require('./GameRoom');
const UnoGame = require('./UnoGame');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ===== RUTA PRINCIPAL PARA VERIFICAR QUE EL SERVIDOR FUNCIONA =====
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Servidor de UNO Cattpucin funcionando',
        endpoints: {
            health: '/health',
            rooms: '/api/rooms'
        }
    });
});

// ===== RUTA DE SALUD =====
app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

// ===== ENDPOINT PARA VER SALAS ACTIVAS =====
app.get('/api/rooms', (req, res) => {
    const activeRooms = [];
    rooms.forEach((room, code) => {
        activeRooms.push({
            code,
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            gameStarted: room.gameStarted
        });
    });
    res.json(activeRooms);
});

// ===== GESTIÓN DE SALAS =====
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`🟢 Jugador conectado: ${socket.id}`);

    // ===== CREAR SALA =====
    socket.on('create-room', ({ playerName, roomCode, maxPlayers = 8 }) => {
        console.log(`📝 Creando sala: ${roomCode} por ${playerName}`);
        
        if (!roomCode || roomCode.length !== 6 || !/^\d+$/.test(roomCode)) {
            socket.emit('error-message', 'La contraseña debe ser exactamente 6 dígitos');
            return;
        }
        
        if (rooms.has(roomCode)) {
            socket.emit('error-message', 'Ya existe una sala con ese código');
            return;
        }
        
        const room = new GameRoom(roomCode, playerName, socket.id, maxPlayers);
        rooms.set(roomCode, room);
        socket.join(roomCode);
        
        socket.emit('room-created', {
            roomCode,
            playerId: socket.id,
            players: room.getPlayers()
        });
        
        console.log(`✅ Sala ${roomCode} creada. Total salas: ${rooms.size}`);
    });

    // ===== UNIRSE A SALA =====
    socket.on('join-room', ({ playerName, roomCode }) => {
        console.log(`🔑 Intentando unirse: ${playerName} a sala ${roomCode}`);
        
        if (!roomCode || roomCode.length !== 6) {
            socket.emit('error-message', 'El código debe tener 6 dígitos');
            return;
        }
        
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error-message', 'Sala no encontrada');
            return;
        }
        
        if (room.isFull()) {
            socket.emit('error-message', 'La sala está llena (máximo 8 jugadores)');
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('error-message', 'El juego ya comenzó');
            return;
        }
        
        room.addPlayer(socket.id, playerName, false);
        socket.join(roomCode);
        
        io.to(roomCode).emit('player-joined', {
            players: room.getPlayers()
        });
        
        socket.emit('room-joined', {
            roomCode,
            playerId: socket.id,
            players: room.getPlayers()
        });
        
        console.log(`✅ ${playerName} se unió a sala ${roomCode}. Jugadores: ${room.players.length}/8`);
    });

    // ===== INICIAR JUEGO =====
    socket.on('start-game', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error-message', 'Sala no encontrada');
            return;
        }
        
        if (!room.isHost(socket.id)) {
            socket.emit('error-message', 'Solo el anfitrión puede iniciar el juego');
            return;
        }
        
        if (room.players.length < 2) {
            socket.emit('error-message', 'Se necesitan al menos 2 jugadores');
            return;
        }
        
        const game = new UnoGame(room.players.length);
        room.gameStarted = true;
        room.game = game;
        
        room.players.forEach((player, index) => {
            game.players[index].name = player.name;
            game.players[index].id = player.id;
        });
        
        room.players.forEach((player, index) => {
            io.to(player.id).emit('game-starting', {
                playerIndex: index,
                gameState: game.getPublicState(index)
            });
        });
        
        console.log(`🎮 Juego iniciado en sala ${roomCode}`);
    });

    // ===== JUGAR CARTA =====
    socket.on('play-card', ({ roomCode, playerId, cardIndex }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.game) return;
        
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        const result = room.game.playCard(playerIndex, cardIndex);
        
        if (result) {
            room.players.forEach((player, index) => {
                io.to(player.id).emit('game-state', room.game.getPublicState(index));
            });
            
            if (room.game.gameOver) {
                io.to(roomCode).emit('game-over', {
                    winner: room.game.winner,
                    winnerName: room.players[room.game.winner]?.name
                });
            }
        }
    });

    // ===== ROBAR CARTA =====
    socket.on('draw-card', ({ roomCode, playerId }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.game) return;
        
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        const result = room.game.drawCard(playerIndex);
        
        if (result) {
            room.players.forEach((player, index) => {
                io.to(player.id).emit('game-state', room.game.getPublicState(index));
            });
        }
    });

    // ===== GRITAR UNO =====
    socket.on('call-uno', ({ roomCode, playerId }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.game) return;
        
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        room.game.callUno(playerIndex);
        
        io.to(roomCode).emit('uno-called', {
            playerIndex,
            playerName: room.players[playerIndex]?.name
        });
    });

    // ===== SELECCIONAR COLOR WILD =====
    socket.on('select-wild-color', ({ roomCode, playerId, color }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.game) return;
        
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        const result = room.game.selectWildColor(playerIndex, color);
        
        if (result) {
            room.players.forEach((player, index) => {
                io.to(player.id).emit('game-state', room.game.getPublicState(index));
            });
        }
    });

    // ===== SALIR DE LA SALA =====
    socket.on('leave-room', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (room) {
            room.removePlayer(socket.id);
            
            io.to(roomCode).emit('player-left', {
                players: room.getPlayers()
            });
            
            socket.leave(roomCode);
            
            if (room.isEmpty()) {
                rooms.delete(roomCode);
                console.log(`🗑️ Sala ${roomCode} eliminada (vacía)`);
            }
        }
    });

    // ===== DESCONEXIÓN =====
    socket.on('disconnect', () => {
        console.log(`🔴 Jugador desconectado: ${socket.id}`);
        
        rooms.forEach((room, roomCode) => {
            if (room.hasPlayer(socket.id)) {
                room.removePlayer(socket.id);
                
                io.to(roomCode).emit('player-left', {
                    players: room.getPlayers()
                });
                
                if (room.isEmpty()) {
                    rooms.delete(roomCode);
                    console.log(`🗑️ Sala ${roomCode} eliminada (todos desconectados)`);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 Monitoreo: http://localhost:${PORT}/api/rooms`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`🏠 Ruta principal: http://localhost:${PORT}/`);
});