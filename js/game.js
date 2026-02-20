class GameManager {
    constructor() {
        this.SERVER_URL = 'https://uno-server.onrender.com'; // Tu URL de Render
        
        // Obtener datos de sessionStorage
        this.playerId = sessionStorage.getItem('playerId');
        this.playerName = sessionStorage.getItem('playerName');
        this.roomCode = sessionStorage.getItem('roomCode');
        this.isHost = sessionStorage.getItem('isHost') === 'true';
        this.players = JSON.parse(sessionStorage.getItem('players') || '[]');
        this.myIndex = -1;
        
        if (!this.roomCode) {
            window.location.href = 'lobby.html';
            return;
        }
        
        this.socket = io(this.SERVER_URL);
        this.gameState = null;
        this.gameLocked = false;
        
        this.initDOM();
        this.attachEvents();
        this.initSocket();
        
        // Mostrar el código de sala
        this.showRoomCode();
    }

    initDOM() {
        this.turnDisplay = document.getElementById('turnDisplay');
        this.handCardsDiv = document.getElementById('handCards');
        this.discardPileDiv = document.getElementById('discardPile');
        this.globalMsg = document.getElementById('globalMessage');
        this.wildPicker = document.getElementById('wildColorPicker');
        this.handCount = document.getElementById('handCount');
        this.scoreDisplay = document.getElementById('scoreDisplay');
        this.drawPile = document.getElementById('drawPile');
        this.unoCallBtn = document.getElementById('unoCallBtn');
        this.playersContainer = document.getElementById('playersContainer');
        this.leaveBtn = document.getElementById('leaveGameBtn');
        this.gameRoomCode = document.getElementById('gameRoomCode');
        this.copyCodeBtn = document.getElementById('copyGameCodeBtn');
    }

    showRoomCode() {
        if (this.gameRoomCode) {
            this.gameRoomCode.textContent = this.roomCode;
        }
    }

    attachEvents() {
        this.drawPile.addEventListener('click', () => this.handleDraw());
        this.unoCallBtn.addEventListener('click', () => this.callUno());
        this.leaveBtn.addEventListener('click', () => this.leaveGame());
        
        if (this.copyCodeBtn) {
            this.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        }
        
        // Color picker
        this.wildPicker.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                if (this.wildPicker.dataset.active === 'true') {
                    this.selectWildColor(e.target.dataset.color);
                }
            });
        });
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode);
        this.copyCodeBtn.textContent = '✅';
        this.copyCodeBtn.classList.add('copied');
        
        setTimeout(() => {
            this.copyCodeBtn.textContent = '📋';
            this.copyCodeBtn.classList.remove('copied');
        }, 2000);
        
        this.setMessage('📋 Código copiado. Compártelo con tus amigos');
    }

    initSocket() {
        this.socket.on('connect', () => {
            console.log('Conectado al servidor');
            // Unirse a la sala automáticamente
            this.socket.emit('join-room', {
                playerName: this.playerName,
                roomCode: this.roomCode
            });
        });

        this.socket.on('room-joined', (data) => {
            console.log('Unido a sala:', data);
            this.players = data.players;
            this.updatePlayersList();
        });

        this.socket.on('player-joined', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.setMessage(`👥 ${this.players.length} jugadores en la sala`);
            
            // Si soy el host y hay 2 jugadores, mostrar botón para iniciar
            if (this.isHost && this.players.length >= 2) {
                // Aquí puedes mostrar un botón de iniciar si quieres
            }
        });

        this.socket.on('game-starting', (data) => {
            this.gameState = data.gameState;
            this.myIndex = data.playerIndex;
            this.setMessage('🎮 ¡El juego comienza!');
        });

        this.socket.on('game-state', (gameState) => {
            this.gameState = gameState;
            this.updateGame();
        });

        this.socket.on('player-left', (data) => {
            this.players = data.players;
            this.updatePlayersList();
        });

        this.socket.on('error-message', (msg) => {
            alert(msg);
        });
    }

    updatePlayersList() {
        if (!this.playersContainer) return;
        
        this.playersContainer.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'other-player-hand';
            
            playerDiv.innerHTML = `
                <div class="player-info">
                    <span>${this.getAvatar(index)} ${player.name}</span>
                    ${player.isHost ? '<span>👑</span>' : ''}
                </div>
                <div class="player-status">Esperando...</div>
            `;
            
            this.playersContainer.appendChild(playerDiv);
        });
    }

    updateGame() {
        if (!this.gameState) return;
        
        // Encontrar mi índice si no lo tengo
        if (this.myIndex === -1) {
            this.myIndex = this.gameState.players.findIndex(p => p.id === this.playerId);
        }
        
        const isMyTurn = this.gameState.currentPlayer === this.myIndex;
        
        // Actualizar turno
        if (isMyTurn) {
            this.turnDisplay.innerHTML = '<span class="dot"></span> tu turno';
        } else {
            const playerName = this.gameState.players[this.gameState.currentPlayer]?.name || 'Oponente';
            this.turnDisplay.innerHTML = `<span class="dot" style="background:#6c7086"></span> turno de ${playerName}`;
        }
        
        // Actualizar otros jugadores
        this.updateOtherPlayers();
        
        // Actualizar mi mano
        if (this.gameState.players[this.myIndex]) {
            const myHand = this.gameState.players[this.myIndex].hand || [];
            this.handCount.textContent = myHand.length;
            this.renderMyHand(myHand);
        }
        
        // Actualizar descarte
        const top = this.gameState.discardPile[this.gameState.discardPile.length - 1];
        if (top) {
            this.discardPileDiv.innerHTML = '';
            this.discardPileDiv.appendChild(this.createCardElement(top));
        }
        
        // Mostrar selector de color
        if (isMyTurn && this.wildPicker.dataset.active === 'true') {
            this.wildPicker.style.display = 'flex';
        }
    }

    updateOtherPlayers() {
        // Esta función se mantiene igual que antes
        // ... (el código que ya tenías)
    }

    renderMyHand(hand) {
        // Esta función se mantiene igual que antes
        // ... (el código que ya tenías)
    }

    createCardElement(card) {
        // Esta función se mantiene igual que antes
        // ... (el código que ya tenías)
    }

    getAvatar(index) {
        const avatars = ['🐱', '🐶', '🐼', '🦊', '🐸', '🐨', '🦁', '🐧'];
        return avatars[index % avatars.length];
    }

    playCard(index) {
        if (this.gameState.currentPlayer !== this.myIndex) {
            this.setMessage('❌ No es tu turno');
            return;
        }
        
        if (this.gameLocked) return;
        
        this.gameLocked = true;
        this.socket.emit('play-card', {
            roomCode: this.roomCode,
            playerId: this.playerId,
            cardIndex: index
        });
        
        setTimeout(() => {
            this.gameLocked = false;
        }, 500);
    }

    handleDraw() {
        if (this.gameState.currentPlayer !== this.myIndex) {
            this.setMessage('❌ No es tu turno');
            return;
        }
        
        if (this.gameLocked) return;
        
        this.gameLocked = true;
        this.socket.emit('draw-card', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
        
        setTimeout(() => {
            this.gameLocked = false;
        }, 500);
    }

    callUno() {
        if (this.gameState.currentPlayer !== this.myIndex) return;
        
        this.socket.emit('call-uno', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
        this.setMessage('✅ ¡UNO!');
    }

    selectWildColor(color) {
        this.socket.emit('select-wild-color', {
            roomCode: this.roomCode,
            playerId: this.playerId,
            color: color
        });
        this.wildPicker.style.display = 'none';
        this.wildPicker.dataset.active = 'false';
    }

    leaveGame() {
        this.socket.emit('leave-room', { roomCode: this.roomCode });
        sessionStorage.clear();
        window.location.href = 'lobby.html';
    }

    setMessage(msg) {
        this.globalMsg.textContent = msg;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameManager();
});