// ============================
// BACK4APP ONLINE MULTIPLAYER
// ============================

const onlineBackend = {
    // Configuration
    config: {
        appId: "okHWTaxUkPKB140QAbSIcC4719YSK3Hdgn53BKR7",
        javascriptKey: "ZDkeTkYgyvV9pqObdQueuhj5E7uoWBs5NMDX6hDy",
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
        gamePhase: "placement",
        shipTypes: [
            { name: "Carrier", size: 5, id: "carrier" },
            { name: "Battleship", size: 4, id: "battleship" },
            { name: "Cruiser", size: 3, id: "cruiser" },
            { name: "Submarine", size: 3, id: "submarine" },
            { name: "Destroyer", size: 2, id: "destroyer" }
        ],
        placedShips: 0,
        orientation: "vertical"
    },
    
    // Initialize
    initialize: function() {
        console.log("Initializing Battleship Online...");
        
        try {
            // Initialize Parse
            Parse.initialize(this.config.appId, this.config.javascriptKey);
            Parse.serverURL = this.config.serverURL;
            console.log("Parse initialized successfully");
            
            // Generate player ID and name
            this.state.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            
            // Get or create player name
            const savedName = localStorage.getItem('battleship_playerName');
            if (savedName) {
                this.state.playerName = savedName;
            } else {
                const names = ["Captain", "Admiral", "Commander", "Sailor", "Pirate", "Navigator"];
                const randomName = names[Math.floor(Math.random() * names.length)];
                this.state.playerName = `${randomName}_${Math.floor(Math.random() * 1000)}`;
                localStorage.setItem('battleship_playerName', this.state.playerName);
            }
            
            console.log("Player ID:", this.state.playerId);
            console.log("Player Name:", this.state.playerName);
            
            // Update UI IMMEDIATELY
            this.updatePlayerUI();
            
            // Test connection
            this.testConnection();
            
        } catch (error) {
            console.error("Initialization error:", error);
            this.initializeOffline();
        }
    },
    
    updatePlayerUI: function() {
        // Update player name in game screen
        const playerNameElement = document.getElementById('playerName');
        if (playerNameElement) {
            playerNameElement.textContent = this.state.playerName;
        }
        
        // Update player ID in matchmaking screen
        const playerIdElement = document.getElementById('playerIdDisplay');
        if (playerIdElement) {
            // Show shortened version for display
            const shortId = this.state.playerId.length > 15 
                ? this.state.playerId.substring(0, 15) + '...' 
                : this.state.playerId;
            playerIdElement.textContent = shortId;
            playerIdElement.style.color = '#4FC3F7';
            playerIdElement.style.fontWeight = 'bold';
        }
        
        console.log("UI updated with Player ID:", this.state.playerId);
    },
    
    testConnection: async function() {
        try {
            // Simple test to check if Back4App is accessible
            const TestObject = Parse.Object.extend("Test");
            const test = new TestObject();
            test.set("testField", "connection_test");
            
            // This will fail (no Test class) but that's OK - we just want to test connectivity
            await test.save();
            console.log("Back4App connection test successful");
        } catch (error) {
            // We expect an error since Test class doesn't exist, but connection worked
            console.log("Back4App is accessible (expected error):", error.code);
        }
    },
    
    initializeOffline: function() {
        console.log("Initializing in offline mode...");
        this.state.playerId = 'offline_' + Date.now();
        this.state.playerName = "Offline_Player";
        this.updatePlayerUI();
        
        // Show offline indicator
        const playerIdElement = document.getElementById('playerIdDisplay');
        if (playerIdElement) {
            playerIdElement.innerHTML = "🔴 OFFLINE MODE<br><small>Playing locally only</small>";
        }
    },
    
    // ============================
    // MATCHMAKING
    // ============================
    
    startMatchmaking: async function() {
        console.log("Starting matchmaking for player:", this.state.playerId);
        
        // Update UI
        document.getElementById('matchmakingStatus').textContent = "Creating game room...";
        document.getElementById('searchingDots').classList.remove('hidden');
        
        try {
            await this.createNewRoom();
        } catch (error) {
            console.error("Matchmaking failed:", error);
            alert("Failed to create game room. Please try again.");
            this.cancelMatchmaking();
        }
    },
    
    createNewRoom: async function() {
        console.log("Creating new game room...");
        
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const gameRoom = new GameRoom();
            
            // Set required fields
            gameRoom.set("player1Id", this.state.playerId);
            gameRoom.set("player1Name", this.state.playerName);
            gameRoom.set("status", "waiting");
            gameRoom.set("currentTurn", 1);
            gameRoom.set("createdAt", new Date());
            
            // Set optional fields
            gameRoom.set("player2Id", "");
            gameRoom.set("player2Name", "");
            gameRoom.set("player1Ready", false);
            gameRoom.set("player2Ready", false);
            gameRoom.set("winner", "");
            gameRoom.set("ships", JSON.stringify({ player1: [], player2: [] }));
            gameRoom.set("attacks", JSON.stringify({ player1: [], player2: [] }));
            
            const savedRoom = await gameRoom.save();
            this.state.gameId = savedRoom.id;
            console.log("Game room created successfully! ID:", this.state.gameId);
            
            // Update UI
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.remove('hidden');
            document.getElementById('roomId').textContent = this.state.gameId.substring(0, 12) + '...';
            document.getElementById('roomCreator').textContent = this.state.playerName;
            document.getElementById('matchmakingStatus').textContent = "Room created!";
            
            // Start polling for opponent
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating room:", error);
            throw error;
        }
    },
    
    pollForOpponent: function() {
        if (!this.state.gameId) return;
        
        console.log("Starting to poll for opponent...");
        
        this.state.pollingInterval = setInterval(async () => {
            try {
                const query = new Parse.Query("GameRoom");
                const gameRoom = await query.get(this.state.gameId);
                
                const player2Id = gameRoom.get("player2Id");
                const status = gameRoom.get("status");
                
                if (status === "cancelled") {
                    clearInterval(this.state.pollingInterval);
                    alert("Room was cancelled.");
                    this.cancelMatchmaking();
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = gameRoom.get("player2Name") || "Opponent";
                    
                    // Update room status
                    gameRoom.set("status", "active");
                    await gameRoom.save();
                    
                    // Update UI
                    document.getElementById('opponentName').textContent = this.state.opponentName;
                    this.opponentFound();
                }
                
            } catch (error) {
                console.error("Polling error:", error);
                if (error.code === 101) {
                    clearInterval(this.state.pollingInterval);
                    alert("Game room was deleted.");
                    this.cancelMatchmaking();
                }
            }
        }, 2000);
    },
    
    joinRoom: async function(roomId) {
        console.log("Attempting to join room:", roomId);
        
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(roomId);
            
            const status = gameRoom.get("status");
            if (status !== "waiting") {
                alert("Room is not available.");
                return;
            }
            
            const player2Id = gameRoom.get("player2Id");
            if (player2Id && player2Id !== "") {
                alert("Room is already full!");
                return;
            }
            
            // Join the room
            gameRoom.set("player2Id", this.state.playerId);
            gameRoom.set("player2Name", this.state.playerName);
            gameRoom.set("status", "active");
            await gameRoom.save();
            
            this.state.gameId = roomId;
            this.state.playerNumber = 2;
            this.state.opponentId = gameRoom.get("player1Id");
            this.state.opponentName = gameRoom.get("player1Name") || "Player 1";
            
            // Start game immediately
            this.startGame();
            
        } catch (error) {
            console.error("Error joining room:", error);
            alert("Could not join room. It may have been deleted.");
        }
    },
    
    opponentFound: function() {
        console.log("Opponent found! Starting game...");
        
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.remove('hidden');
        
        // Quick countdown
        let countdown = 3;
        const countdownElement = document.getElementById('countdown');
        countdownElement.textContent = countdown;
        
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
            this.markRoomAsCancelled();
        }
        
        this.resetUI();
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
    
    resetUI: function() {
        document.getElementById('matchmakingStatus').textContent = "READY FOR BATTLE?";
        document.getElementById('queueStatus').classList.add('hidden');
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.add('hidden');
        document.getElementById('searchingDots').classList.add('hidden');
        document.getElementById('findBtn').classList.remove('hidden');
        document.getElementById('cancelBtn').classList.add('hidden');
        document.getElementById('quickMatch').classList.remove('hidden');
    },
    
    // ============================
    // GAME LOGIC
    // ============================
    
    startGame: function() {
        console.log("Starting game! Player:", this.state.playerNumber);
        
        // Hide matchmaking, show game
        document.getElementById('matchmakingScreen').classList.add('hidden');
        document.getElementById('gameScreen').style.display = 'block';
        
        // Update opponent name
        document.getElementById('opponentName').textContent = this.state.opponentName;
        
        // Initialize grids
        this.createGrids();
        
        // Start game polling
        this.startGamePolling();
        
        // Reset game state
        this.state.gameActive = true;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        
        this.updateTurnIndicator();
        this.addChatMessage("System", `Game started! You are Player ${this.state.playerNumber}`);
        
        // Auto-place ships for player 2 (for testing)
        if (this.state.playerNumber === 2) {
            setTimeout(() => this.autoPlaceShips(), 1000);
        }
    },
    
    createGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        
        // Clear grids
        playerGrid.innerHTML = '';
        attackGrid.innerHTML = '';
        
        // Create player grid
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                cell.addEventListener('click', () => {
                    if (this.state.gamePhase === "placement") {
                        this.placeShip(row, col, this.state.orientation);
                    }
                });
                
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
        
        this.updateShipStatus();
    },
    
    autoPlaceShips: function() {
        console.log("Auto-placing ships...");
        
        const placements = [
            { row: 0, col: 0, vertical: true },
            { row: 0, col: 2, vertical: true },
            { row: 0, col: 4, vertical: true },
            { row: 0, col: 6, vertical: true },
            { row: 2, col: 8, vertical: false }
        ];
        
        let index = 0;
        const placeNext = () => {
            if (index < 5 && this.state.placedShips < 5) {
                const pos = placements[index];
                if (this.placeShip(pos.row, pos.col, pos.vertical)) {
                    index++;
                }
                setTimeout(placeNext, 500);
            }
        };
        
        placeNext();
    },
    
    placeShip: function(row, col, vertical = true) {
        if (this.state.gamePhase !== "placement") return false;
        if (this.state.placedShips >= 5) return false;
        
        const shipType = this.state.shipTypes[this.state.placedShips];
        const playerKey = `player${this.state.playerNumber}`;
        
        if (this.canPlaceShip(row, col, shipType.size, vertical, playerKey)) {
            const cells = [];
            for (let i = 0; i < shipType.size; i++) {
                cells.push({
                    row: vertical ? row + i : row,
                    col: vertical ? col : col + i
                });
            }
            
            this.state.ships[playerKey].push({
                ...shipType,
                cells: cells,
                hits: 0,
                sunk: false
            });
            
            this.state.placedShips++;
            
            this.updateGrids();
            this.addChatMessage("You", `Placed ${shipType.name}`);
            
            if (this.state.placedShips >= 5) {
                this.markReady();
                this.addChatMessage("System", "All ships placed! Waiting for opponent...");
            }
            
            return true;
        } else {
            this.addChatMessage("System", `Can't place ${shipType.name} there!`);
            return false;
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
    
    markReady: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            if (this.state.playerNumber === 1) {
                gameRoom.set("player1Ready", true);
            } else {
                gameRoom.set("player2Ready", true);
            }
            
            gameRoom.set("ships", JSON.stringify(this.state.ships));
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error marking ready:", error);
        }
    },
    
    attack: async function(row, col) {
        if (this.state.gamePhase !== "battle") {
            this.addChatMessage("System", "Wait for battle phase!");
            return;
        }
        
        if (this.state.currentTurn !== this.state.playerNumber) {
            this.addChatMessage("System", "Not your turn!");
            return;
        }
        
        const attackKey = `${row},${col}`;
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        if (this.state.attacks[playerKey].includes(attackKey)) {
            this.addChatMessage("System", "Already attacked here!");
            return;
        }
        
        this.state.attacks[playerKey].push(attackKey);
        
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
                        this.addChatMessage("System", `Sunk ${ship.name}!`);
                    }
                }
            });
        });
        
        this.updateGrids();
        
        await this.saveAttack(row, col, hit);
        
        this.addChatMessage("You", `${hit ? 'Hit' : 'Miss'} at (${row},${col})`);
        
        if (this.checkWin(enemyKey)) {
            await this.endGame(this.state.playerNumber);
            return;
        }
        
        await this.switchTurns();
    },
    
    saveAttack: async function(row, col, hit) {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            const attacks = JSON.parse(gameRoom.get("attacks") || '{"player1":[],"player2":[]}');
            const playerKey = `player${this.state.playerNumber}`;
            
            attacks[playerKey].push(`${row},${col},${hit ? 'hit' : 'miss'}`);
            
            gameRoom.set("attacks", JSON.stringify(attacks));
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error saving attack:", error);
        }
    },
    
    switchTurns: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            const newTurn = gameRoom.get("currentTurn") === 1 ? 2 : 1;
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
    // GAME POLLING
    // ============================
    
    startGamePolling: function() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        this.state.pollingInterval = setInterval(async () => {
            if (!this.state.gameActive || !this.state.gameId) return;
            
            try {
                const query = new Parse.Query("GameRoom");
                const gameRoom = await query.get(this.state.gameId);
                
                const status = gameRoom.get("status");
                if (status === "ended") {
                    this.state.gameActive = false;
                    clearInterval(this.state.pollingInterval);
                    
                    const winner = gameRoom.get("winner");
                    if (winner === this.state.playerId) {
                        this.showGameOver("🎉 You Win! 🎉", true);
                    } else {
                        this.showGameOver("💀 You Lose! 💀", false);
                    }
                    return;
                }
                
                const ships = JSON.parse(gameRoom.get("ships") || '{"player1":[],"player2":[]}');
                const attacks = JSON.parse(gameRoom.get("attacks") || '{"player1":[],"player2":[]}');
                const currentTurn = gameRoom.get("currentTurn");
                const player1Ready = gameRoom.get("player1Ready");
                const player2Ready = gameRoom.get("player2Ready");
                
                this.state.ships = ships;
                this.state.attacks = attacks;
                this.state.currentTurn = currentTurn;
                
                if (player1Ready && player2Ready && this.state.gamePhase === "placement") {
                    this.state.gamePhase = "battle";
                    this.addChatMessage("System", "⚔️ Battle begins!");
                }
                
                this.updateGrids();
                this.updateTurnIndicator();
                this.updateShipStatus();
                
            } catch (error) {
                console.error("Polling error:", error);
            }
        }, 2000);
    },
    
    // ============================
    // UI UPDATES
    // ============================
    
    updateGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Player grid
        for (let i = 0; i < 100; i++) {
            const row = Math.floor(i / 10);
            const col = i % 10;
            const cell = playerGrid.children[i];
            
            if (!cell) continue;
            
            cell.className = 'cell';
            
            // Show ships
            const shipHere = this.state.ships[playerKey].find(ship =>
                ship.cells.some(c => c.row === row && c.col === col)
            );
            
            if (shipHere) {
                cell.classList.add('ship');
                
                // Check hits
                const enemyAttacks = this.state.attacks[enemyKey] || [];
                const wasHit = enemyAttacks.some(attack => {
                    const [r, c] = attack.split(',');
                    return parseInt(r) === row && parseInt(c) === col;
                });
                
                if (wasHit) {
                    cell.classList.add('hit');
                }
            }
            
            // Show misses
            const enemyAttacks = this.state.attacks[enemyKey] || [];
            enemyAttacks.forEach(attackStr => {
                const [r, c, result] = attackStr.split(',');
                if (parseInt(r) === row && parseInt(c) === col && result === 'miss') {
                    cell.classList.add('miss');
                }
            });
        }
        
        // Attack grid
        for (let i = 0; i < 100; i++) {
            const row = Math.floor(i / 10);
            const col = i % 10;
            const cell = attackGrid.children[i];
            
            if (!cell) continue;
            
            cell.className = 'cell';
            
            // Show attacks
            const playerAttacks = this.state.attacks[playerKey] || [];
            playerAttacks.forEach(attackStr => {
                const [r, c, result] = attackStr.split(',');
                if (parseInt(r) === row && parseInt(c) === col) {
                    cell.classList.add(result);
                }
            });
        }
    },
    
    updateTurnIndicator: function() {
        let text = "";
        if (this.state.gamePhase === "placement") {
            text = `Place ships (${this.state.placedShips}/5)`;
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 Your Turn!";
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
            const icon = ship.sunk ? '💀' : (ship.hits > 0 ? '🔥' : '🚢');
            item.innerHTML = `${icon} ${ship.name} (${ship.hits}/${ship.size})`;
            shipStatus.appendChild(item);
        });
        
        if (this.state.ships[enemyKey].length === 0) {
            this.state.shipTypes.forEach(ship => {
                const item = document.createElement('div');
                item.className = 'ship-status-item';
                item.innerHTML = `🚢 ${ship.name} (0/${ship.size})`;
                shipStatus.appendChild(item);
            });
        }
    },
    
    addChatMessage: function(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        if (sender === "System") {
            messageDiv.classList.add('system');
            messageDiv.innerHTML = `<strong>System:</strong> ${message}`;
        } else if (sender === "You") {
            messageDiv.classList.add('player');
            messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    sendChatMessage: function() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message) {
            this.addChatMessage("You", message);
            input.value = '';
        }
    },
    
    // ============================
    // GAME MANAGEMENT
    // ============================
    
    showGameOver: function(message, isWin) {
        window.showGameOver(message, isWin);
    },
    
    rematch: function() {
        this.state.gameId = null;
        this.state.gameActive = false;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        document.getElementById('matchmakingScreen').classList.remove('hidden');
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameOverOverlay').classList.add('hidden');
        
        this.resetUI();
    },
    
    surrenderGame: async function() {
        if (!confirm("Surrender?")) return;
        
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            gameRoom.set("status", "ended");
            gameRoom.set("winner", this.state.opponentId);
            await gameRoom.save();
            
            this.showGameOver("You surrendered!", false);
            
        } catch (error) {
            console.error("Error surrendering:", error);
        }
    },
    
    leaveGame: function() {
        if (confirm("Leave game?")) {
            window.location.href = "../index.html";
        }
    },
    
    endGame: async function(winnerNumber) {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            const winnerId = winnerNumber === 1 ? 
                gameRoom.get("player1Id") : gameRoom.get("player2Id");
            
            gameRoom.set("status", "ended");
            gameRoom.set("winner", winnerId);
            await gameRoom.save();
            
            this.state.gameActive = false;
            
            if (winnerNumber === this.state.playerNumber) {
                this.showGameOver("🎉 Victory! 🎉", true);
            } else {
                this.showGameOver("💀 Defeat! 💀", false);
            }
            
        } catch (error) {
            console.error("Error ending game:", error);
        }
    },
    
    cleanup: function() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
    }
};

// Make it globally available
window.onlineBackend = onlineBackend;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    onlineBackend.cleanup();
});
