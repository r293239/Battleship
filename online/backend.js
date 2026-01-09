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
        orientation: "vertical",
        matchmakingType: null // "quick" or "room"
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
    // MATCHMAKING - QUICK MATCH
    // ============================
    
    startQuickMatch: async function() {
        console.log("Starting quick match...");
        this.state.matchmakingType = "quick";
        
        try {
            // First try to find existing waiting room
            const foundRoom = await this.findWaitingRoom();
            if (foundRoom) {
                console.log("Found existing room, joining:", foundRoom.id);
                await this.joinRoomAsPlayer2(foundRoom);
                return;
            }
            
            // No room found, create new one
            console.log("No waiting rooms, creating new room...");
            await this.createRoom(true); // true = quick match
            
        } catch (error) {
            console.error("Quick match error:", error);
            window.showMatchmakingError("Quick match failed. Try again.");
        }
    },
    
    findWaitingRoom: async function() {
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const query = new Parse.Query(GameRoom);
            
            // Look for rooms in waiting state that aren't full
            query.equalTo("status", "waiting");
            query.equalTo("matchmakingType", "quick");
            query.notEqualTo("player1Id", this.state.playerId); // Don't find our own room
            
            const results = await query.find();
            
            if (results.length > 0) {
                return results[0]; // Return first available room
            }
            
            return null;
            
        } catch (error) {
            console.error("Error finding waiting rooms:", error);
            return null;
        }
    },
    
    // ============================
    // ROOM SYSTEM
    // ============================
    
    createRoom: async function(isQuickMatch = false) {
        console.log("Creating new room...");
        
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const gameRoom = new GameRoom();
            
            // Generate room code
            const roomCode = this.generateRoomCode();
            
            // Set room data
            gameRoom.set("roomCode", roomCode);
            gameRoom.set("player1Id", this.state.playerId);
            gameRoom.set("player1Name", this.state.playerName);
            gameRoom.set("status", "waiting");
            gameRoom.set("matchmakingType", isQuickMatch ? "quick" : "private");
            gameRoom.set("createdAt", new Date());
            
            // Default values
            gameRoom.set("player2Id", "");
            gameRoom.set("player2Name", "");
            gameRoom.set("player1Ready", false);
            gameRoom.set("player2Ready", false);
            gameRoom.set("winner", "");
            gameRoom.set("currentTurn", 1);
            gameRoom.set("ships", JSON.stringify({ player1: [], player2: [] }));
            gameRoom.set("attacks", JSON.stringify({ player1: [], player2: [] }));
            
            const savedRoom = await gameRoom.save();
            this.state.gameId = savedRoom.id;
            
            console.log("Room created! Code:", roomCode, "ID:", this.state.gameId);
            
            // Update UI
            window.showRoomCreated(roomCode);
            
            // Start polling for opponent
            if (isQuickMatch) {
                this.pollForQuickMatchOpponent();
            } else {
                this.pollForPrivateRoomOpponent();
            }
            
        } catch (error) {
            console.error("Error creating room:", error);
            throw error;
        }
    },
    
    joinRoom: async function(roomCode) {
        console.log("Attempting to join room:", roomCode);
        this.state.matchmakingType = "room";
        
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const query = new Parse.Query(GameRoom);
            
            query.equalTo("roomCode", roomCode);
            const results = await query.find();
            
            if (results.length === 0) {
                window.showMatchmakingError("Room not found!");
                return;
            }
            
            const room = results[0];
            const status = room.get("status");
            const matchmakingType = room.get("matchmakingType");
            
            if (status !== "waiting") {
                window.showMatchmakingError("Room is not available!");
                return;
            }
            
            const player2Id = room.get("player2Id");
            if (player2Id && player2Id !== "") {
                window.showMatchmakingError("Room is already full!");
                return;
            }
            
            // Check if trying to join own room
            if (room.get("player1Id") === this.state.playerId) {
                window.showMatchmakingError("Cannot join your own room!");
                return;
            }
            
            // Join the room as player 2
            await this.joinRoomAsPlayer2(room);
            
        } catch (error) {
            console.error("Error joining room:", error);
            window.showMatchmakingError("Failed to join room!");
        }
    },
    
    joinRoomAsPlayer2: async function(room) {
        try {
            room.set("player2Id", this.state.playerId);
            room.set("player2Name", this.state.playerName);
            room.set("status", "active");
            
            await room.save();
            
            this.state.gameId = room.id;
            this.state.playerNumber = 2;
            this.state.opponentId = room.get("player1Id");
            this.state.opponentName = room.get("player1Name") || "Player 1";
            
            console.log("Successfully joined room as Player 2");
            
            // Start game immediately
            window.showOpponentFound(this.state.opponentName);
            
        } catch (error) {
            console.error("Error joining room as player 2:", error);
            throw error;
        }
    },
    
    generateRoomCode: function() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // ============================
    // POLLING FUNCTIONS
    // ============================
    
    pollForQuickMatchOpponent: function() {
        if (!this.state.gameId) return;
        
        console.log("Polling for quick match opponent...");
        
        this.state.pollingInterval = setInterval(async () => {
            try {
                const query = new Parse.Query("GameRoom");
                const room = await query.get(this.state.gameId);
                
                const status = room.get("status");
                const player2Id = room.get("player2Id");
                
                if (status === "cancelled") {
                    clearInterval(this.state.pollingInterval);
                    window.showMatchmakingError("Room was cancelled!");
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = room.get("player2Name") || "Opponent";
                    
                    // Update room status
                    room.set("status", "active");
                    await room.save();
                    
                    console.log("Quick match opponent found:", this.state.opponentName);
                    window.showOpponentFound(this.state.opponentName);
                }
                
            } catch (error) {
                console.error("Polling error:", error);
                if (error.code === 101) {
                    clearInterval(this.state.pollingInterval);
                    window.showMatchmakingError("Room was deleted!");
                }
            }
        }, 2000);
    },
    
    pollForPrivateRoomOpponent: function() {
        if (!this.state.gameId) return;
        
        console.log("Polling for private room opponent...");
        
        this.state.pollingInterval = setInterval(async () => {
            try {
                const query = new Parse.Query("GameRoom");
                const room = await query.get(this.state.gameId);
                
                const status = room.get("status");
                const player2Id = room.get("player2Id");
                
                if (status === "cancelled") {
                    clearInterval(this.state.pollingInterval);
                    window.showMatchmakingError("Room was cancelled!");
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = room.get("player2Name") || "Opponent";
                    
                    // Update room status
                    room.set("status", "active");
                    await room.save();
                    
                    console.log("Private room opponent found:", this.state.opponentName);
                    window.showOpponentFound(this.state.opponentName);
                }
                
            } catch (error) {
                console.error("Polling error:", error);
                if (error.code === 101) {
                    clearInterval(this.state.pollingInterval);
                    window.showMatchmakingError("Room was deleted!");
                }
            }
        }, 2000);
    },
    
    cancelMatchmaking: async function() {
        console.log("Cancelling matchmaking...");
        
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        if (this.state.gameId) {
            await this.deleteRoom();
        }
        
        this.state.matchmakingType = null;
    },
    
    deleteRoom: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            await room.destroy();
            console.log("Room deleted successfully");
        } catch (error) {
            console.error("Error deleting room:", error);
        }
    },
    
    // ============================
    // GAME LOGIC
    // ============================
    
    startGame: function() {
        console.log("Starting game! Player:", this.state.playerNumber);
        
        // Hide matchmaking, show game
        const matchmakingScreen = document.getElementById('matchmakingScreen');
        if (matchmakingScreen) {
            matchmakingScreen.style.opacity = '0';
            setTimeout(() => {
                matchmakingScreen.style.display = 'none';
                const gameScreen = document.getElementById('gameScreen');
                if (gameScreen) {
                    gameScreen.style.display = 'block';
                    setTimeout(() => {
                        gameScreen.style.opacity = '1';
                    }, 10);
                }
            }, 500);
        }
        
        // Update opponent name
        const opponentNameElement = document.getElementById('opponentName');
        if (opponentNameElement) {
            opponentNameElement.textContent = this.state.opponentName;
        }
        
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
        if (playerGrid) playerGrid.innerHTML = '';
        if (attackGrid) attackGrid.innerHTML = '';
        
        // Create player grid
        if (playerGrid) {
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
        }
        
        // Create attack grid
        if (attackGrid) {
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
            const room = await query.get(this.state.gameId);
            
            if (this.state.playerNumber === 1) {
                room.set("player1Ready", true);
            } else {
                room.set("player2Ready", true);
            }
            
            room.set("ships", JSON.stringify(this.state.ships));
            await room.save();
            
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
        
        if (this.state.ships[enemyKey]) {
            this.state.ships[enemyKey].forEach(ship => {
                if (ship.cells) {
                    ship.cells.forEach(cell => {
                        if (cell.row === row && cell.col === col) {
                            hit = true;
                            if (ship.hits !== undefined) {
                                ship.hits++;
                                shipHit = ship;
                                
                                if (ship.hits === ship.size) {
                                    ship.sunk = true;
                                    this.addChatMessage("System", `Sunk ${ship.name}!`);
                                }
                            }
                        }
                    });
                }
            });
        }
        
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
            const room = await query.get(this.state.gameId);
            
            let attacks = {};
            try {
                attacks = JSON.parse(room.get("attacks") || '{"player1":[],"player2":[]}');
            } catch (e) {
                attacks = { player1: [], player2: [] };
            }
            
            const playerKey = `player${this.state.playerNumber}`;
            if (!attacks[playerKey]) attacks[playerKey] = [];
            
            attacks[playerKey].push(`${row},${col},${hit ? 'hit' : 'miss'}`);
            
            room.set("attacks", JSON.stringify(attacks));
            await room.save();
            
        } catch (error) {
            console.error("Error saving attack:", error);
        }
    },
    
    switchTurns: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            
            const newTurn = room.get("currentTurn") === 1 ? 2 : 1;
            room.set("currentTurn", newTurn);
            await room.save();
            
            this.state.currentTurn = newTurn;
            this.updateTurnIndicator();
            
        } catch (error) {
            console.error("Error switching turns:", error);
        }
    },
    
    checkWin: function(playerKey) {
        if (!this.state.ships[playerKey]) return false;
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
                const room = await query.get(this.state.gameId);
                
                const status = room.get("status");
                if (status === "ended") {
                    this.state.gameActive = false;
                    clearInterval(this.state.pollingInterval);
                    
                    const winner = room.get("winner");
                    if (winner === this.state.playerId) {
                        this.showGameOver("🎉 You Win! 🎉", true);
                    } else {
                        this.showGameOver("💀 You Lose! 💀", false);
                    }
                    return;
                }
                
                // Parse ships
                let ships = { player1: [], player2: [] };
                try {
                    ships = JSON.parse(room.get("ships") || '{"player1":[],"player2":[]}');
                } catch (e) {
                    console.error("Error parsing ships:", e);
                }
                
                // Parse attacks
                let attacks = { player1: [], player2: [] };
                try {
                    attacks = JSON.parse(room.get("attacks") || '{"player1":[],"player2":[]}');
                } catch (e) {
                    console.error("Error parsing attacks:", e);
                }
                
                const currentTurn = room.get("currentTurn") || 1;
                const player1Ready = room.get("player1Ready") || false;
                const player2Ready = room.get("player2Ready") || false;
                
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
        if (playerGrid && playerGrid.children.length > 0) {
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(i / 10);
                const col = i % 10;
                const cell = playerGrid.children[i];
                
                if (!cell) continue;
                
                cell.className = 'cell';
                
                // Show ships
                if (this.state.ships[playerKey]) {
                    const shipHere = this.state.ships[playerKey].find(ship =>
                        ship.cells && ship.cells.some(c => c.row === row && c.col === col)
                    );
                    
                    if (shipHere) {
                        cell.classList.add('ship');
                        
                        // Check hits
                        const enemyAttacks = this.state.attacks[enemyKey] || [];
                        const wasHit = enemyAttacks.some(attack => {
                            const parts = attack.split(',');
                            if (parts.length >= 2) {
                                const r = parseInt(parts[0]);
                                const c = parseInt(parts[1]);
                                return r === row && c === col;
                            }
                            return false;
                        });
                        
                        if (wasHit) {
                            cell.classList.add('hit');
                        }
                    }
                }
                
                // Show misses
                const enemyAttacks = this.state.attacks[enemyKey] || [];
                enemyAttacks.forEach(attackStr => {
                    const parts = attackStr.split(',');
                    if (parts.length >= 3) {
                        const r = parseInt(parts[0]);
                        const c = parseInt(parts[1]);
                        const result = parts[2];
                        if (r === row && c === col && result === 'miss') {
                            cell.classList.add('miss');
                        }
                    }
                });
            }
        }
        
        // Attack grid
        if (attackGrid && attackGrid.children.length > 0) {
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(i / 10);
                const col = i % 10;
                const cell = attackGrid.children[i];
                
                if (!cell) continue;
                
                cell.className = 'cell';
                
                // Show attacks
                const playerAttacks = this.state.attacks[playerKey] || [];
                playerAttacks.forEach(attackStr => {
                    const parts = attackStr.split(',');
                    if (parts.length >= 3) {
                        const r = parseInt(parts[0]);
                        const c = parseInt(parts[1]);
                        const result = parts[2];
                        if (r === row && c === col) {
                            cell.classList.add(result);
                        }
                    }
                });
            }
        }
    },
    
    updateTurnIndicator: function() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (!turnIndicator) return;
        
        let text = "";
        if (this.state.gamePhase === "placement") {
            text = `Place ships (${this.state.placedShips}/5)`;
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 Your Turn!";
        } else {
            text = "⏳ Opponent's Turn";
        }
        turnIndicator.textContent = text;
    },
    
    updateShipStatus: function() {
        const shipStatus = document.getElementById('shipStatus');
        if (!shipStatus) return;
        
        shipStatus.innerHTML = '';
        
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        if (this.state.ships[enemyKey] && this.state.ships[enemyKey].length > 0) {
            this.state.ships[enemyKey].forEach(ship => {
                const item = document.createElement('div');
                item.className = `ship-status-item ${ship.sunk ? 'sunk' : ''}`;
                const icon = ship.sunk ? '💀' : (ship.hits > 0 ? '🔥' : '🚢');
                item.innerHTML = `${icon} ${ship.name} (${ship.hits || 0}/${ship.size})`;
                shipStatus.appendChild(item);
            });
        } else {
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
        if (!chatMessages) return;
        
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
        if (!input) return;
        
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
        if (window.showGameOver) {
            window.showGameOver(message, isWin);
        }
    },
    
    rematch: function() {
        this.state.gameId = null;
        this.state.gameActive = false;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        this.state.matchmakingType = null;
        
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        
        const matchmakingScreen = document.getElementById('matchmakingScreen');
        if (matchmakingScreen) {
            matchmakingScreen.style.display = 'flex';
            matchmakingScreen.style.opacity = '1';
        }
        
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'none';
        }
    },
    
    surrenderGame: async function() {
        if (!confirm("Surrender?")) return;
        
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            room.set("status", "ended");
            room.set("winner", this.state.opponentId);
            await room.save();
            
            this.showGameOver("You surrendered!", false);
            
        } catch (error) {
            console.error("Error surrendering:", error);
        }
    },
    
    leaveGame: function() {
        if (confirm("Leave game?")) {
            this.cleanup();
            window.location.href = "../index.html";
        }
    },
    
    endGame: async function(winnerNumber) {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            
            const winnerId = winnerNumber === 1 ? 
                room.get("player1Id") : room.get("player2Id");
            
            room.set("status", "ended");
            room.set("winner", winnerId);
            await room.save();
            
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
        
        if (this.state.gameId && this.state.gameActive) {
            // Mark game as abandoned
            this.markGameAsAbandoned();
        }
    },
    
    markGameAsAbandoned: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            room.set("status", "abandoned");
            await room.save();
        } catch (error) {
            console.error("Error marking game as abandoned:", error);
        }
    }
};

// Make it globally available
window.onlineBackend = onlineBackend;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    onlineBackend.cleanup();
});

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onlineBackend.initialize();
    });
} else {
    onlineBackend.initialize();
}
