class GameManager {
    constructor() {
        this.SERVER_URL = 'http://localhost:3000';
        
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
    }

    attachEvents() {
        this.drawPile.addEventListener('click', () => this.handleDraw());
        this.unoCallBtn.addEventListener('click', () => this.callUno());
        this.leaveBtn.addEventListener('click', () => this.leaveGame());
        
        // Color picker
        this.wildPicker.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                if (this.wildPicker.dataset.active === 'true') {
                    this.selectWildColor(e.target.dataset.color);
                }
            });
        });
    }

    initSocket() {
        this.socket.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.updateGame();
        });

        this.socket.on('error-message', (msg) => {
            alert(msg);
        });
    }

    updateGame() {
        if (!this.gameState) return;
        
        // Encontrar mi índice
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
        this.playersContainer.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            if (index === this.myIndex) return;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = 'other-player-hand';
            
            const cardCount = player.cardCount || 0;
            const isCurrentTurn = index === this.gameState.currentPlayer;
            
            playerDiv.innerHTML = `
                <div class="player-info">
                    <span>${this.getAvatar(index)} ${player.name}</span>
                    <span>${cardCount}</span>
                </div>
                <div class="player-cards-back">
                    ${Array(Math.min(cardCount, 5)).fill(0).map(() => '<div class="mini-card"></div>').join('')}
                    ${cardCount > 5 ? '<span>...</span>' : ''}
                </div>
            `;
            
            if (isCurrentTurn) {
                playerDiv.style.border = '2px solid #a6e3a1';
            }
            
            this.playersContainer.appendChild(playerDiv);
        });
    }

    renderMyHand(hand) {
        this.handCardsDiv.innerHTML = '';
        hand.forEach((card, index) => {
            const el = this.createCardElement(card);
            el.addEventListener('click', () => {
                if (this.gameState.currentPlayer === this.myIndex && !this.gameLocked) {
                    this.playCard(index);
                }
            });
            this.handCardsDiv.appendChild(el);
        });
    }

    createCardElement(card) {
        const div = document.createElement('div');
        div.className = `card ${card.color || 'wild'}`;
        
        let icon = card.value;
        let displayValue = card.value;
        
        if (card.value === 'skip') { icon = '⊘'; displayValue = 'skip'; }
        else if (card.value === 'reverse') { icon = '↻'; displayValue = 'reverse'; }
        else if (card.value === '+2') { icon = '+2'; displayValue = '+2'; }
        else if (card.value === 'wild') { icon = '◈'; displayValue = 'wild'; }
        else if (card.value === 'wild+4') { icon = '+4'; displayValue = '+4'; }
        
        div.innerHTML = `
            <div class="card-icon">${icon}</div>
            <div class="card-value">${displayValue}</div>
        `;
        
        return div;
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
        this.socket.emit('playCard', {
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
        this.socket.emit('drawCard', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
        
        setTimeout(() => {
            this.gameLocked = false;
        }, 500);
    }

    callUno() {
        if (this.gameState.currentPlayer !== this.myIndex) return;
        
        this.socket.emit('callUno', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
        this.setMessage('✅ ¡UNO!');
    }

    selectWildColor(color) {
        this.socket.emit('selectWildColor', {
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