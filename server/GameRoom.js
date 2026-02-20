class UnoGame {
    constructor(numPlayers) {
        this.COLORS = ['red', 'blue', 'green', 'yellow'];
        this.SPECIALS = ['skip', 'reverse', '+2'];
        
        this.numPlayers = numPlayers;
        this.players = [];
        for (let i = 0; i < numPlayers; i++) {
            this.players.push({
                id: null,
                name: `Jugador ${i + 1}`,
                hand: [],
                uno: false,
                cardCount: 0
            });
        }
        
        this.currentPlayer = 0;
        this.direction = 1;
        this.discardPile = [];
        this.drawDeck = this.createDeck();
        this.currentColor = null;
        this.pendingDraw = 0;
        this.gameOver = false;
        this.winner = null;
        this.gameLocked = false;
        
        this.dealInitialCards();
    }

    createDeck() {
        let deck = [];
        this.COLORS.forEach(c => {
            deck.push({ color: c, type: 'number', value: '0' });
            for (let i = 1; i <= 9; i++) {
                deck.push({ color: c, type: 'number', value: i.toString() });
                deck.push({ color: c, type: 'number', value: i.toString() });
            }
            this.SPECIALS.forEach(sp => {
                deck.push({ color: c, type: 'special', value: sp });
                deck.push({ color: c, type: 'special', value: sp });
            });
        });
        for (let i = 0; i < 4; i++) {
            deck.push({ color: null, type: 'wild', value: 'wild' });
            deck.push({ color: null, type: 'wild', value: 'wild+4' });
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    dealInitialCards() {
        // Repartir 7 cartas a cada jugador
        for (let i = 0; i < 7; i++) {
            this.players.forEach(player => {
                player.hand.push(this.drawDeck.pop());
            });
        }
        
        // Actualizar contadores
        this.players.forEach(p => {
            p.cardCount = p.hand.length;
        });
        
        // Primera carta no comodín
        let firstCard;
        do {
            firstCard = this.drawDeck.pop();
        } while (firstCard.type === 'wild' && this.drawDeck.length > 0);
        
        this.discardPile = [firstCard];
        this.currentColor = firstCard.color;
    }

    getPublicState(playerIndex) {
        // Estado para un jugador específico (oculta manos de otros)
        const publicPlayers = this.players.map((p, i) => {
            if (i === playerIndex) {
                return {
                    id: p.id,
                    name: p.name,
                    hand: p.hand,
                    cardCount: p.hand.length,
                    uno: p.uno
                };
            } else {
                return {
                    id: p.id,
                    name: p.name,
                    cardCount: p.hand.length,
                    uno: p.uno
                };
            }
        });
        
        return {
            players: publicPlayers,
            currentPlayer: this.currentPlayer,
            direction: this.direction,
            discardPile: this.discardPile,
            drawDeckLength: this.drawDeck.length,
            currentColor: this.currentColor,
            pendingDraw: this.pendingDraw,
            gameOver: this.gameOver,
            winner: this.winner
        };
    }

    isPlayable(card) {
        const top = this.discardPile[this.discardPile.length - 1];
        
        if (this.pendingDraw > 0) {
            return (card.value === '+2' || card.value === 'wild+4');
        }
        
        if (card.type === 'wild') return true;
        if (card.color === this.currentColor) return true;
        if (card.value === top.value) return true;
        
        return false;
    }

    nextPlayer() {
        this.currentPlayer = (this.currentPlayer + this.direction + this.numPlayers) % this.numPlayers;
    }

    playCard(playerIndex, cardIndex) {
        if (this.gameLocked || this.gameOver) return null;
        if (playerIndex !== this.currentPlayer) return null;
        
        const player = this.players[playerIndex];
        const card = player.hand[cardIndex];
        
        if (!this.isPlayable(card)) return null;
        
        // Quitar carta de la mano
        player.hand.splice(cardIndex, 1);
        player.cardCount = player.hand.length;
        this.discardPile.push(card);
        
        // Actualizar color si no es comodín
        if (card.color) {
            this.currentColor = card.color;
        }
        
        // Aplicar efecto de carta
        this.applyCardEffect(card, playerIndex);
        
        // Verificar si ganó
        if (player.hand.length === 0) {
            this.gameOver = true;
            this.winner = playerIndex;
        }
        
        return this.getPublicState(playerIndex);
    }

    applyCardEffect(card, playerIndex) {
        const isPenalty = (card.value === '+2' || card.value === 'wild+4');
        const penaltyAmount = card.value === '+2' ? 2 : (card.value === 'wild+4' ? 4 : 0);
        
        if (isPenalty) {
            this.pendingDraw += penaltyAmount;
            this.nextPlayer();
        } 
        else if (card.value === 'skip') {
            this.nextPlayer();
        }
        else if (card.value === 'reverse') {
            this.direction *= -1;
            if (this.numPlayers === 2) {
                this.nextPlayer();
            }
        }
        else {
            this.nextPlayer();
        }
    }

    drawCard(playerIndex) {
        if (this.gameLocked || this.gameOver) return null;
        if (playerIndex !== this.currentPlayer) return null;
        
        const player = this.players[playerIndex];
        const drawCount = this.pendingDraw > 0 ? this.pendingDraw : 1;
        
        // Robar cartas
        for (let i = 0; i < drawCount; i++) {
            if (this.drawDeck.length > 0) {
                player.hand.push(this.drawDeck.pop());
            } else {
                // Rebarajar el mazo de descarte
                if (this.discardPile.length > 1) {
                    const top = this.discardPile.pop();
                    this.drawDeck = this.shuffle(this.discardPile);
                    this.discardPile = [top];
                    player.hand.push(this.drawDeck.pop());
                }
            }
        }
        
        player.cardCount = player.hand.length;
        this.pendingDraw = 0;
        
        // Después de robar, pasa al siguiente
        this.nextPlayer();
        
        return this.getPublicState(playerIndex);
    }

    callUno(playerIndex) {
        const player = this.players[playerIndex];
        if (player.hand.length === 1 && !player.uno) {
            player.uno = true;
        }
    }

    selectWildColor(playerIndex, color) {
        if (playerIndex !== this.currentPlayer) return null;
        
        this.currentColor = color;
        this.nextPlayer();
        
        return this.getPublicState(playerIndex);
    }
}

module.exports = UnoGame;