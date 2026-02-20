class RoomManager {
    constructor() {
        this.SERVER_URL = 'http://localhost:3000';
        
        // Obtener datos de sessionStorage
        this.playerId = sessionStorage.getItem('playerId');
        this.playerName = sessionStorage.getItem('playerName');
        this.roomCode = sessionStorage.getItem('roomCode');
        this.isHost = sessionStorage.getItem('isHost') === 'true';
        this.players = JSON.parse(sessionStorage.getItem('players') || '[]');
        
        if (!this.roomCode) {
            window.location.href = 'lobby.html';
            return;
        }
        
        this.socket = io(this.SERVER_URL);
        
        this.initDOM();
        this.attachEvents();
        this.initSocket();
        this.updatePlayersGrid();
    }

    initDOM() {
        this.roomCodeDisplay = document.getElementById('roomCodeDisplay');
        this.playersGrid = document.getElementById('playersGrid');
        this.playerStatus = document.getElementById('playerStatus');
        this.startGameBtn = document.getElementById('startGameBtn');
        this.leaveBtn = document.getElementById('leaveRoomBtn');
        this.copyBtn = document.getElementById('copyInviteBtn');
        this.toast = document.getElementById('messageToast');
        
        this.roomCodeDisplay.textContent = this.roomCode;
        this.playerStatus.textContent = `👥 ${this.players.length}/8 jugadores`;
        
        if (this.isHost && this.players.length >= 2) {
            this.startGameBtn.style.display = 'block';
        }
    }

    attachEvents() {
        this.copyBtn.addEventListener('click', () => this.copyInvite());
        this.leaveBtn.addEventListener('click', () => this.leaveRoom());
        this.startGameBtn.addEventListener('click', () => this.startGame());
    }

    initSocket() {
        this.socket.on('player-joined', (data) => {
            this.players = data.players;
            this.updatePlayersGrid();
            this.playerStatus.textContent = `👥 ${this.players.length}/8 jugadores`;
            
            if (this.isHost && this.players.length >= 2) {
                this.startGameBtn.style.display = 'block';
            }
        });

        this.socket.on('player-left', (data) => {
            this.players = data.players;
            this.updatePlayersGrid();
            this.playerStatus.textContent = `👥 ${this.players.length}/8 jugadores`;
            
            if (this.isHost && this.players.length < 2) {
                this.startGameBtn.style.display = 'none';
            }
        });

        this.socket.on('game-starting', () => {
            window.location.href = 'game.html';
        });

        this.socket.on('error-message', (msg) => {
            this.showToast(msg, 'error');
        });
    }

    updatePlayersGrid() {
        this.playersGrid.innerHTML = '';
        
        // Grid de 8 jugadores
        for (let i = 0; i < 8; i++) {
            const player = this.players[i];
            const slot = document.createElement('div');
            slot.className = `player-slot ${player ? 'occupied' : ''}`;
            
            if (player) {
                slot.innerHTML = `
                    <div class="player-avatar">${this.getAvatar(i)}</div>
                    <div class="player-name">${player.name}</div>
                    ${player.isHost ? '<div class="player-host-badge">👑 ANFITRIÓN</div>' : ''}
                `;
            } else {
                slot.innerHTML = `
                    <div class="player-avatar">⬜</div>
                    <div class="player-name">Esperando...</div>
                `;
            }
            
            this.playersGrid.appendChild(slot);
        }
    }

    getAvatar(index) {
        const avatars = ['🐱', '🐶', '🐼', '🦊', '🐸', '🐨', '🦁', '🐧'];
        return avatars[index % avatars.length];
    }

    copyInvite() {
        const inviteText = `🎮 UNO Cattpucin\n📍 Código: ${this.roomCode}\n🔗 ${window.location.origin}/lobby.html?room=${this.roomCode}`;
        navigator.clipboard.writeText(inviteText);
        
        this.copyBtn.textContent = '✅ COPIADO';
        this.copyBtn.classList.add('copied');
        
        setTimeout(() => {
            this.copyBtn.innerHTML = '📋 COPIAR CÓDIGO';
            this.copyBtn.classList.remove('copied');
        }, 2000);
    }

    leaveRoom() {
        this.socket.emit('leave-room', { roomCode: this.roomCode });
        sessionStorage.clear();
        window.location.href = 'lobby.html';
    }

    startGame() {
        if (this.isHost) {
            this.socket.emit('start-game', { roomCode: this.roomCode });
        }
    }

    showToast(message, type = 'info') {
        this.toast.textContent = message;
        this.toast.className = `toast ${type}`;
        this.toast.style.display = 'block';
        
        setTimeout(() => {
            this.toast.style.display = 'none';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RoomManager();
});