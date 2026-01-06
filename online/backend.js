// ============================
// BACK4APP ONLINE MULTIPLAYER
// ============================

const onlineBackend = {
    // Configuration
    config: {
        appId: "e1PnoCEK4f9GTBhmr8pVzVpWS13PmBVjB8NdukOw",
        clientKey: "RwrFadzzSnx8mcy2TQMtO2kiwxpMJT3vPDjojDLD",
        restKey: "gzzTOzv9KUzqcrmRK8pAQYDdReUZTYJModsGP4fl",
        serverURL: "https://parseapi.back4app.com/"
    },
    
    // Game state
    state: {
        playerId: null,
        playerName: "",
        gameId: null,
        playerNumber: null,
        opponentId: null,
        opponentName: "Opponent",
        gameActive: false,
        currentTurn: 1,
        ships: { player1: [], player2: [] },
        attacks: { player1: [], player2: [] },
        pollingInterval: null,
        gamePhase: "placement", // placement, battle, ended
        shipTypes: [
            { name: "Carrier", size: 5, id: "carrier" },
            { name: "Battleship", size: 4, id: "battleship" },
            { name: "Cruiser", size: 3, id: "cruiser" },
            { name: "Submarine", size: 3, id: "submarine" },
            { name: "Destroyer", size: 2, id: "destroyer" }
        ],
        placedShips: 0
    },
    
    // Initialize
    initialize: function() {
        console.log("Initializing Back4App Online Multiplayer...");
        
        // Initialize Parse
        Parse.initialize(this.config.appId, this.config.clientKey);
        Parse.serverURL = this.config.serverURL;
        
        // Generate player ID and name
        this.state.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.state.playerName = "Player_" + Math.floor(Math.random() * 10000);
        
        // Update UI
        document.getElementById('playerName').textContent = this.state.playerName;
        
        // Start checking for online players
        this.updateOnlineCount();
        setInterval(() => this.updateOnlineCount(), 5000);
        
        console.log("Player initialized:", this.state.playerId, this.state.playerName);
    },
    
    // Update online player count
    updateOnlineCount: async function() {
        try {
            // In a real app, you'd query active sessions
            // For now, we'll simulate
            const fakeCount = Math.floor(Math.random() * 50) + 10;
            document.getElementById('onlineCount').textContent = fakeCount;
        } catch (error) {
            console.error("Error updating online count:", error);
        }
    },
    
    // ============================
    // MATCHMAKING SYSTEM
    // ============================
    
    startMatchmaking: async function() {
        console.log("Starting matchmaking...");
        document.getElementById('matchmakingStatus').textContent = "Searching for opponent...";
        
        // Create a GameRoom in Back4App
        const GameRoom = Parse.Object.extend("GameRoom");
        const gameRoom = new GameRoom();
        
        gameRoom.set("player1Id", this.state.playerId);
        gameRoom.set("player1Name", this.state.playerName);
        gameRoom.set("player1Ready", false);
        gameRoom.set("player2Id", "");
        gameRoom.set("player2Name", "");
        gameRoom.set("player2Ready", false);
        gameRoom.set("status", "waiting"); // waiting, active, ended
        gameRoom.set("currentTurn", 1);
        gameRoom.set("winner", "");
        gameRoom.set("ships", JSON.stringify({ player1: [], player2: [] }));
        gameRoom.set("attacks", JSON.stringify({ player1: [], player2: [] }));
        
        try {
            const savedRoom = await gameRoom.save();
            this.state.gameId = savedRoom.id;
            console.log("Game room created:", this.state.gameId);
            
            // Update UI
            document.getElementById('roomId').textContent = this.state.gameId;
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.remove('hidden');
            document.getElementById('matchmakingStatus').textContent = "Room created!";
            
            // Start polling for opponent
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating game room:", error);
            alert("Failed to create game room. Please try again.");
            this.cancelMatchmaking();
        }
    },
    
    pollForOpponent: async function() {
        if (!this.state.gameId) return;
        
        this.state.pollingInterval = setInterval(async () => {
            try {
                const query = new Parse.Query("GameRoom");
                const gameRoom = await query.get(this.state.gameId);
                
                const player2Id = gameRoom.get("player2Id");
                const status = gameRoom.get("status");
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    this.state.opponentId = player2Id;
                    this.state.opponentName = gameRoom.get("player2Name") || "Opponent";
                    this.state.playerNumber = 1;
                    
                    document.getElementById('opponentName').textContent = this.state.opponentName;
                    this.opponentFound();
                    
                } else if (status === "cancelled") {
                    // Room was cancelled
                    clearInterval(this.state.pollingInterval);
                    alert("Matchmaking cancelled.");
                    this.cancelMatchmaking();
                }
                
            } catch (error) {
                console.error("Error polling for opponent:", error);
            }
        }, 2000); // Check every 2 seconds
    },
    
    opponentFound: function() {
        console.log("Opponent found:", this.state.opponentId);
        
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.remove('hidden');
        document.getElementById('matchmakingStatus').textContent = "Opponent found!";
        
        // Countdown to game start
        let countdown = 3;
        const countdownElement = document.getElementById('countdown');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.startGame();
            }
        }, 1000);
    },
    
    cancelMatchmaking: function() {
        console.log("Cancelling matchmaking...");
        
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        if (this.state.gameId) {
            // Mark room as cancelled in Back4App
            this.markRoomAsCancelled();
        }
        
        // Reset state
        this.state.gameId = null;
        this.state.opponentId = null;
        
        // Reset UI
        document.getElementById('matchmakingStatus').textContent = "Finding Opponent...";
        document.getElementById('queueStatus').classList.add('hidden');
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.add('hidden');
    },
    
    markRoomAsCancelled: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            gameRoom.set("status", "cancelled");
            await gameRoom.save();
        } catch (error) {
            console.error("Error cancelling room:", error);
        }
    },
    
    // ============================
    // GAME LOGIC
    // ============================
    
    startGame: function() {
        console.log("Starting online game...");
        
        // Hide matchmaking screen, show game screen
        document.getElementById('matchmakingScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        
        // Initialize game grids
        this.createGrids();
        
        // Start game polling
        this.startGamePolling();
        
        // Set player as ready
        this.markPlayerReady();
        
        this.state.gameActive = true;
        this.updateTurnIndicator();
        
        // Add chat message
        this.addChatMessage("System", "Game started! Place your ships.");
    },
    
    createGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        
        // Clear grids
        playerGrid.innerHTML = '';
        attackGrid.innerHTML = '';
        
        // Create player grid (for placing ships)
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener('click', () => this.placeShip(row, col));
                playerGrid.appendChild(cell);
            }
        }
        
        // Create attack grid
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener('click', () => this.attack(row, col));
                attackGrid.appendChild(cell);
            }
        }
        
        // Update ship status display
        this.updateShipStatus();
    },
    
    placeShip: function(row, col) {
        if (this.state.gamePhase !== "placement") {
            this.addChatMessage("System", "Battle has already started!");
            return;
        }
        
        if (this.state.placedShips >= 5) {
            this.addChatMessage("System", "All ships placed! Waiting for opponent...");
            return;
        }
        
        const shipType = this.state.shipTypes[this.state.placedShips];
        const playerKey = `player${this.state.playerNumber}`;
        
        // For simplicity, auto-place ships (you can enhance with drag & drop)
        if (this.canPlaceShip(row, col, shipType.size, true, playerKey)) {
            const cells = [];
            for (let i = 0; i < shipType.size; i++) {
                cells.push({ row: row + i, col: col });
            }
            
            this.state.ships[playerKey].push({
                ...shipType,
                cells: cells,
                hits: 0,
                sunk: false
            });
            
            this.state.placedShips++;
            
            // Update display
            this.updateGrids();
            this.updateShipStatus();
            this.addChatMessage("You", `Placed ${shipType.name}`);
            
            // Save to backend
            this.saveGameState();
            
            // If all ships placed, mark as ready
            if (this.state.placedShips >= 5) {
                this.markPlacementComplete();
            }
        }
    },
    
    canPlaceShip: function(startRow, startCol, size, vertical, playerKey) {
        for (let i = 0; i < size; i++) {
            const row = vertical ? startRow + i : startRow;
            const col = vertical ? startCol : startCol + i;
            
            if (row >= 10 || col >= 10) return false;
            
            const existingShip = this.state.ships[playerKey].find(ship => 
                ship.cells.some(cell => cell.row === row && cell.col === col)
            );
            if (existingShip) return false;
        }
        return true;
    },
    
    markPlacementComplete: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            if (this.state.playerNumber === 1) {
                gameRoom.set("player1Ready", true);
            } else {
                gameRoom.set("player2Ready", true);
            }
            
            await gameRoom.save();
            this.addChatMessage("System", "Your ships are placed! Waiting for opponent...");
            
        } catch (error) {
            console.error("Error marking placement complete:", error);
        }
    },
    
    attack: async function(row, col) {
        if (this.state.gamePhase !== "battle") {
            this.addChatMessage("System", "Placement phase still in progress.");
            return;
        }
        
        if (this.state.currentTurn !== this.state.playerNumber) {
            this.addChatMessage("System", "Wait for your turn!");
            return;
        }
        
        const attackKey = `${row},${col}`;
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Check if already attacked
        if (this.state.attacks[playerKey].includes(attackKey)) {
            this.addChatMessage("System", "You already attacked here!");
            return;
        }
        
        // Register attack locally
        this.state.attacks[playerKey].push(attackKey);
        
        // Check for hit
        let hit = false;
        let shipHit = null;
        
        this.state.ships[enemyKey].forEach(ship => {
            ship.cells.forEach(cell => {
                if (cell.row === row && cell.col === col) {
                    hit = true;
                    ship.hits++;
                    shipHit = ship;
                    
                    if (ship.hits === ship.size) {
                        ship.sunk = true;
                    }
                }
            });
        });
        
        // Update display
        this.updateGrids();
        
        // Send attack to backend
        await this.sendAttackToBackend(row, col, hit);
        
        // Add chat message
        if (hit) {
            this.addChatMessage("You", `Hit at (${row},${col})! ${shipHit.sunk ? `Sunk ${shipHit.name}!` : ''}`);
        } else {
            this.addChatMessage("You", `Miss at (${row},${col})`);
        }
        
        // Check for win
        if (this.checkWin(enemyKey)) {
            this.endGame(this.state.playerNumber);
            return;
        }
        
        // Switch turns in backend
        await this.switchTurns();
    },
    
    sendAttackToBackend: async function(row, col, hit) {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            // Get current attacks
            const attacks = JSON.parse(gameRoom.get("attacks") || '{"player1":[],"player2":[]}');
            const playerKey = `player${this.state.playerNumber}`;
            
            // Add new attack
            attacks[playerKey].push(`${row},${col},${hit ? 'hit' : 'miss'}`);
            
            // Update ships if hit
            if (hit) {
                const ships = JSON.parse(gameRoom.get("ships") || '{"player1":[],"player2":[]}');
                const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
                
                // Find and update ship (simplified - in real app you'd track ship states)
                ships[enemyKey] = ships[enemyKey] || [];
                // You'd need more complex logic to track which ship was hit
                
                gameRoom.set("ships", JSON.stringify(ships));
            }
            
            gameRoom.set("attacks", JSON.stringify(attacks));
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error sending attack to backend:", error);
        }
    },
    
    switchTurns: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            const currentTurn = gameRoom.get("currentTurn");
            const newTurn = currentTurn === 1 ? 2 : 1;
            
            gameRoom.set("currentTurn", newTurn);
            await gameRoom.save();
            
            this.state.currentTurn = newTurn;
            this.updateTurnIndicator();
            
        } catch (error) {
            console.error("Error switching turns:", error);
        }
    },
    
    checkWin: function(playerKey) {
        return this.state.ships[playerKey].every(ship => ship.sunk);
    },
    
    // ============================
    // BACKEND POLLING
    // ============================
    
    startGamePolling: function() {
        // Poll for game updates every 2 seconds
        setInterval(async () => {
            if (!this.state.gameActive || !this.state.gameId) return;
            
            try {
                const query = new Parse.Query("GameRoom");
                const gameRoom = await query.get(this.state.gameId);
                
                // Check if game ended
                const status = gameRoom.get("status");
                const winner = gameRoom.get("winner");
                
                if (status === "ended") {
                    this.state.gameActive = false;
                    if (winner === this.state.playerId) {
                        alert("🎉 You win! 🎉");
                    } else {
                        alert("💀 You lose! 💀");
                    }
                    return;
                }
                
                // Update game state from backend
                const ships = JSON.parse(gameRoom.get("ships") || '{"player1":[],"player2":[]}');
                const attacks = JSON.parse(gameRoom.get("attacks") || '{"player1":[],"player2":[]}');
                const currentTurn = gameRoom.get("currentTurn");
                const player1Ready = gameRoom.get("player1Ready");
                const player2Ready = gameRoom.get("player2Ready");
                
                // Update local state
                this.state.ships = ships;
                this.state.attacks = attacks;
                this.state.currentTurn = currentTurn;
                
                // Check if both players ready (start battle)
                if (player1Ready && player2Ready && this.state.gamePhase === "placement") {
                    this.state.gamePhase = "battle";
                    this.addChatMessage("System", "Battle begins! Player 1's turn.");
                }
                
                // Update UI
                this.updateGrids();
                this.updateTurnIndicator();
                this.updateShipStatus();
                
                // Check for opponent attacks
                this.checkNewAttacks();
                
            } catch (error) {
                console.error("Error polling game state:", error);
            }
        }, 2000);
    },
    
    checkNewAttacks: function() {
        // Check for new attacks from opponent
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        const enemyAttacks = this.state.attacks[enemyKey] || [];
        
        enemyAttacks.forEach(attack => {
            const [row, col, result] = attack.split(',');
            // Process opponent's attack
            // You'd update your ships if hit
        });
    },
    
    // ============================
    // UI UPDATES
    // ============================
    
    updateGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Clear grids
        for (let cell of playerGrid.children) {
            cell.className = 'cell';
        }
        for (let cell of attackGrid.children) {
            cell.className = 'cell';
        }
        
        // Show player's ships
        this.state.ships[playerKey].forEach(ship => {
            ship.cells.forEach(pos => {
                const index = pos.row * 10 + pos.col;
                if (playerGrid.children[index]) {
                    playerGrid.children[index].classList.add('ship');
                }
            });
        });
        
        // Show opponent's attacks on player's grid
        const enemyAttacks = this.state.attacks[enemyKey] || [];
        enemyAttacks.forEach(attackStr => {
            const [row, col, result] = attackStr.split(',');
            const index = parseInt(row) * 10 + parseInt(col);
            if (playerGrid.children[index]) {
                playerGrid.children[index].classList.add(result);
            }
        });
        
        // Show player's attacks on enemy grid
        const playerAttacks = this.state.attacks[playerKey] || [];
        playerAttacks.forEach(attackStr => {
            const [row, col, result] = attackStr.split(',');
            const index = parseInt(row) * 10 + parseInt(col);
            if (attackGrid.children[index]) {
                attackGrid.children[index].classList.add(result);
            }
        });
    },
    
    updateTurnIndicator: function() {
        let text = "";
        if (this.state.gamePhase === "placement") {
            text = "Place your ships";
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 Your Turn - Attack!";
        } else {
            text = "⏳ Opponent's Turn";
        }
        document.getElementById('turnIndicator').textContent = text;
    },
    
    updateShipStatus: function() {
        const shipStatus = document.getElementById('shipStatus');
        shipStatus.innerHTML = '';
        
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        this.state.ships[enemyKey].forEach(ship => {
            const item = document.createElement('div');
            item.className = `ship-status-item ${ship.sunk ? 'sunk' : ''}`;
            item.innerHTML = `${ship.sunk ? '💀' : '🚢'} ${ship.name} (${ship.hits}/${ship.size})`;
            shipStatus.appendChild(item);
        });
    },
    
    addChatMessage: function(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    sendChatMessage: async function(message) {
        this.addChatMessage("You", message);
        
        // In a real app, you'd save chat to Back4App
        // For now, just display locally
    },
    
    // ============================
    // GAME MANAGEMENT
    // ============================
    
    saveGameState: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            gameRoom.set("ships", JSON.stringify(this.state.ships));
            gameRoom.set("attacks", JSON.stringify(this.state.attacks));
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error saving game state:", error);
        }
    },
    
    surrenderGame: async function() {
        if (!confirm("Are you sure you want to surrender?")) return;
        
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            gameRoom.set("status", "ended");
            gameRoom.set("winner", this.state.opponentId);
            await gameRoom.save();
            
            alert("You surrendered. Game over!");
            window.location.href = "../index.html";
            
        } catch (error) {
            console.error("Error surrendering:", error);
        }
    },
    
    leaveGame: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            gameRoom.set("status", "ended");
            gameRoom.set("winner", this.state.opponentId);
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error leaving game:", error);
        }
    },
    
    endGame: async function(winnerNumber) {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            gameRoom.set("status", "ended");
            gameRoom.set("winner", winnerNumber === 1 ? 
                gameRoom.get("player1Id") : gameRoom.get("player2Id"));
            await gameRoom.save();
            
            this.state.gameActive = false;
            
            if (winnerNumber === this.state.playerNumber) {
                alert("🎉 YOU WIN! 🎉");
            } else {
                alert("💀 YOU LOSE! 💀");
            }
            
            // Return to menu after delay
            setTimeout(() => {
                window.location.href = "../index.html";
            }, 3000);
            
        } catch (error) {
            console.error("Error ending game:", error);
        }
    }
};

// Make it globally available
window.onlineBackend = onlineBackend;
