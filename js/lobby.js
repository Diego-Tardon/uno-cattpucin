class LobbyManager {
    constructor() {
        // Configuración - CAMBIAR DESPUÉS DEL DEPLOY
this.SERVER_URL = 'https://tu-servidor.onrender.com';        
        this.socket = io(this.SERVER_URL);
        this.playerName = '';
        
        this.initDOM();
        this.attachEvents();
        this.initSocket();
        
        // Verificar código en URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            document.getElementById('roomCodeInput').value = roomParam;
        }
    }

    initDOM() {
        this.creatorName = document.getElementById('creatorName');
        this.roomPassword = document.getElementById('roomPassword');
        this.joinerName = document.getElementById('joinerName');
        this.roomCodeInput = document.getElementById('roomCodeInput');
        this.createBtn = document.getElementById('createRoomBtn');
        this.joinBtn = document.getElementById('joinRoomBtn');
        this.toast = document.getElementById('messageToast');
    }

    attachEvents() {
        this.createBtn.addEventListener('click', () => this.createRoom());
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        
        // Enter en inputs
        this.roomPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
    }

    initSocket() {
        this.socket.on('connect', () => {
            console.log('Conectado al servidor');
        });

        this.socket.on('room-created', (data) => {
            // Guardar datos en sessionStorage
            sessionStorage.setItem('playerId', data.playerId);
            sessionStorage.setItem('playerName', this.playerName);
            sessionStorage.setItem('roomCode', data.roomCode);
            sessionStorage.setItem('isHost', 'true');
            sessionStorage.setItem('players', JSON.stringify(data.players));
            
            window.location.href = 'room.html';
        });

        this.socket.on('room-joined', (data) => {
            sessionStorage.setItem('playerId', data.playerId);
            sessionStorage.setItem('playerName', this.playerName);
            sessionStorage.setItem('roomCode', data.roomCode);
            sessionStorage.setItem('isHost', 'false');
            sessionStorage.setItem('players', JSON.stringify(data.players));
            
            window.location.href = 'room.html';
        });

        this.socket.on('error-message', (msg) => {
            this.showToast(msg, 'error');
        });
    }

    createRoom() {
        const playerName = this.creatorName.value.trim() || 'Anfitrión';
        const password = this.roomPassword.value.trim();
        
        if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
            this.showToast('La contraseña debe ser 6 dígitos', 'error');
            return;
        }
        
        this.playerName = playerName;
        this.socket.emit('create-room', {
            playerName,
            roomCode: password,
            maxPlayers: 8
        });
    }

    joinRoom() {
        const playerName = this.joinerName.value.trim() || 'Jugador';
        const roomCode = this.roomCodeInput.value.trim();
        
        if (!roomCode || roomCode.length !== 6 || !/^\d+$/.test(roomCode)) {
            this.showToast('El código debe ser 6 dígitos', 'error');
            return;
        }
        
        this.playerName = playerName;
        this.socket.emit('join-room', { roomCode, playerName });
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

// Iniciar cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    new LobbyManager();
});