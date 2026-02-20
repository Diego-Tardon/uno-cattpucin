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

// ===== RUTAS HTTP =====
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

// ===== GESTIÓN DE SALAS =====
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`🟢 Nuevo cliente conectado: ${socket.id}`);

    // ===== CREAR SALA =====
    socket.on('create-room', (data) => {
        console.log('📝 Evento create-room recibido:', data);
        
        const { playerName, roomCode, maxPlayers = 8 } = data;
        
        // Validar código de 6 dígitos
        if (!roomCode || roomCode.length !== 6 || !/^\d+$/.test(roomCode)) {
            console.log('❌ Código inválido:', roomCode);
            socket.emit('error-message', 'La contraseña debe ser exactamente 6 dígitos');
            return;
        }
        
        // Verificar si la sala ya existe
        if (rooms.has(roomCode)) {
            console.log('❌ Sala ya existe:', roomCode);
            socket.emit('error-message', 'Ya existe una sala con ese código');
            return;
        }
        
        try {
            // Crear nueva sala
            console.log('✅ Creando sala:', roomCode);
            const room = new GameRoom(roomCode, playerName, socket.id, maxPlayers);
            rooms.set(roomCode, room);
            
            // Unir al socket a la sala
            socket.join(roomCode);
            console.log(`✅ Socket ${socket.id} unido a sala ${roomCode}`);
            
            // Obtener lista de jugadores
            const playersList = room.getPlayers();
            console.log('👥 Jugadores en sala:', playersList);
            
            // Enviar confirmación al cliente
            socket.emit('room-created', {
                roomCode,
                playerId: socket.id,
                players: playersList
            });
            
            console.log(`✅ Sala ${roomCode} creada exitosamente`);
            
        } catch (error) {
            console.error('❌ Error al crear sala:', error);
            socket.emit('error-message', 'Error interno al crear la sala');
        }
    });

    // ===== UNIRSE A SALA =====
    socket.on('join-room', (data) => {
        console.log('🔑 Evento join-room recibido:', data);
        
        const { playerName, roomCode } = data;
        
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
        
        try {
            room.addPlayer(socket.id, playerName, false);
            socket.join(roomCode);
            
            const playersList = room.getPlayers();
            
            // Notificar a todos
            io.to(roomCode).emit('player-joined', {
                players: playersList
            });
            
            // Confirmar al jugador
            socket.emit('room-joined', {
                roomCode,
                playerId: socket.id,
                players: playersList
            });
            
            console.log(`✅ ${playerName} se unió a sala ${roomCode}`);
            
        } catch (error) {
            console.error('❌ Error al unirse:', error);
            socket.emit('error-message', 'Error al unirse a la sala');
        }
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
        
        try {
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
            
        } catch (error) {
            console.error('❌ Error al iniciar juego:', error);
            socket.emit('error-message', 'Error al iniciar el juego');
        }
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
        console.log(`🔴 Cliente desconectado: ${socket.id}`);
        
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
});