// ============================
// BACK4APP ONLINE MULTIPLAYER - IMPROVED
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
        placedShips: 0,
        connectedPlayers: [],
        sessionId: null
    },
    
    // Initialize
    initialize: function() {
        console.log("Initializing Back4App Online Multiplayer...");
        
        // Initialize Parse
        Parse.initialize(this.config.appId, this.config.clientKey);
        Parse.serverURL = this.config.serverURL;
        
        // Generate player ID and name
        this.state.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        
        // Get player name from localStorage or create new
        const savedName = localStorage.getItem('battleship_playerName');
        if (savedName) {
            this.state.playerName = savedName;
        } else {
            this.state.playerName = "Captain_" + Math.floor(Math.random() * 1000);
            localStorage.setItem('battleship_playerName', this.state.playerName);
        }
        
        // Create a player session
        this.createPlayerSession();
        
        // Update UI
        document.getElementById('playerName').textContent = this.state.playerName;
        document.getElementById('playerIdDisplay').textContent = this.state.playerId;
        
        // Start checking for online players
        this.updateOnlineCount();
        setInterval(() => this.updateOnlineCount(), 5000);
        
        // Load available rooms
        this.loadAvailableRooms();
        
        console.log("Player initialized:", this.state.playerId, this.state.playerName);
    },
    
    // Create player session
    createPlayerSession: async function() {
        try {
            const PlayerSession = Parse.Object.extend("PlayerSession");
            const session = new PlayerSession();
            
            session.set("playerId", this.state.playerId);
            session.set("playerName", this.state.playerName);
            session.set("status", "online");
            session.set("lastActive", new Date());
            
            const savedSession = await session.save();
            this.state.sessionId = savedSession.id;
            
            console.log("Player session created:", this.state.sessionId);
            
        } catch (error) {
            console.error("Error creating session:", error);
        }
    },
    
    // Update online player count (REAL implementation)
    updateOnlineCount: async function() {
        try {
            const PlayerSession = Parse.Object.extend("PlayerSession");
            const query = new Parse.Query(PlayerSession);
            
            // Only count sessions active in last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            query.greaterThan("lastActive", fiveMinutesAgo);
            query.equalTo("status", "online");
            
            const count = await query.count();
            
            // Update UI with real count
            document.getElementById('onlineCount').textContent = count;
            
            // Also update active sessions list every 30 seconds
            if (Date.now() % 30000 < 5000) { // Every ~30 seconds
                await this.updateSessionActivity();
            }
            
        } catch (error) {
            console.error("Error updating online count:", error);
            // Fallback to reasonable estimate
            document.getElementById('onlineCount').textContent = "?";
        }
    },
    
    // Update session activity
    updateSessionActivity: async function() {
        if (!this.state.sessionId) return;
        
        try {
            const query = new Parse.Query("PlayerSession");
            const session = await query.get(this.state.sessionId);
            session.set("lastActive", new Date());
            await session.save();
        } catch (error) {
            console.error("Error updating session:", error);
        }
    },
    
    // Load available rooms
    loadAvailableRooms: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            query.equalTo("status", "waiting");
            query.notEqualTo("player1Id", this.state.playerId); // Don't show own rooms
            query.descending("createdAt");
            query.limit(10);
            
            const rooms = await query.find();
            this.displayAvailableRooms(rooms);
            
        } catch (error) {
            console.error("Error loading rooms:", error);
        }
    },
    
    displayAvailableRooms: function(rooms) {
        const roomsList = document.getElementById('availableRooms');
        if (!roomsList) return;
        
        roomsList.innerHTML = '';
        
        if (rooms.length === 0) {
            roomsList.innerHTML = '<p class="no-rooms">No rooms available. Create one!</p>';
            return;
        }
        
        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.innerHTML = `
                <div class="room-info">
                    <strong>${room.get("player1Name") || "Unknown"}</strong>
                    <span class="room-id">Room: ${room.id.substr(0, 8)}...</span>
                </div>
                <button class="btn btn-join" onclick="onlineBackend.joinRoom('${room.id}')">
                    Join
                </button>
            `;
            roomsList.appendChild(roomDiv);
        });
    },
    
    // ============================
    // MATCHMAKING SYSTEM - IMPROVED
    // ============================
    
    startMatchmaking: async function() {
        console.log("Starting matchmaking...");
        document.getElementById('matchmakingStatus').textContent = "Searching for opponent...";
        
        try {
            // First, check for existing rooms
            const query = new Parse.Query("GameRoom");
            query.equalTo("status", "waiting");
            query.notEqualTo("player1Id", this.state.playerId);
            query.ascending("createdAt");
            
            const availableRooms = await query.first();
            
            if (availableRooms) {
                // Join existing room
                await this.joinRoom(availableRooms.id);
                return;
            }
            
            // No rooms available, create new one
            await this.createNewRoom();
            
        } catch (error) {
            console.error("Error in matchmaking:", error);
            await this.createNewRoom();
        }
    },
    
    createNewRoom: async function() {
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
        gameRoom.set("createdAt", new Date());
        
        try {
            const savedRoom = await gameRoom.save();
            this.state.gameId = savedRoom.id;
            console.log("Game room created:", this.state.gameId);
            
            // Update UI
            document.getElementById('roomId').textContent = this.state.gameId.substr(0, 10) + "...";
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.remove('hidden');
            document.getElementById('matchmakingStatus').textContent = "Room created! Waiting...";
            document.getElementById('roomCreator').textContent = "You (Host)";
            
            // Start polling for opponent
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating game room:", error);
            alert("Failed to create game room. Please try again.");
            this.cancelMatchmaking();
        }
    },
    
    joinRoom: async function(roomId) {
        console.log("Joining room:", roomId);
        
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(roomId);
            
            // Check if room is still available
            if (gameRoom.get("status") !== "waiting") {
                alert("Room is no longer available.");
                this.loadAvailableRooms();
                return;
            }
            
            // Check if trying to join own room
            if (gameRoom.get("player1Id") === this.state.playerId) {
                alert("You cannot join your own room!");
                return;
            }
            
            // Join the room
            gameRoom.set("player2Id", this.state.playerId);
            gameRoom.set("player2Name", this.state.playerName);
            gameRoom.set("player2Ready", false);
            
            await gameRoom.save();
            
            this.state.gameId = roomId;
            this.state.playerNumber = 2;
            this.state.opponentId = gameRoom.get("player1Id");
            this.state.opponentName = gameRoom.get("player1Name");
            
            // Update UI
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.add('hidden');
            document.getElementById('foundOpponent').classList.remove('hidden');
            document.getElementById('roomCreator').textContent = this.state.opponentName;
            
            // Start the game
            this.startGame();
            
        } catch (error) {
            console.error("Error joining room:", error);
            alert("Failed to join room. It may no longer be available.");
            this.loadAvailableRooms();
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
                
                if (status === "active") {
                    // Game started by other player
                    clearInterval(this.state.pollingInterval);
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = gameRoom.get("player2Name");
                    this.startGame();
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = gameRoom.get("player2Name") || "Opponent";
                    
                    // Mark room as active
                    gameRoom.set("status", "active");
                    await gameRoom.save();
                    
                    document.getElementById('opponentName').textContent = this.state.opponentName;
                    this.opponentFound();
                    
                } else if (status === "cancelled") {
                    // Room was cancelled
                    clearInterval(this.state.pollingInterval);
                    alert("Room was cancelled by creator.");
                    this.cancelMatchmaking();
                }
                
            } catch (error) {
                console.error("Error polling for opponent:", error);
            }
        }, 2000);
    },
    
    opponentFound: function() {
        console.log("Opponent found:", this.state.opponentId);
        
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.remove('hidden');
        document.getElementById('matchmakingStatus').textContent = "Opponent found!";
        
        // Countdown to game start
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
            // Mark room as cancelled in Back4App
            this.markRoomAsCancelled();
        }
        
        // Reset state
        this.state.gameId = null;
        this.state.opponentId = null;
        this.state.playerNumber = null;
        
        // Reset UI
        document.getElementById('matchmakingStatus').textContent = "Finding Opponent...";
        document.getElementById('queueStatus').classList.add('hidden');
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.add('hidden');
        document.getElementById('findBtn').classList.remove('hidden');
        document.getElementById('cancelBtn').classList.add('hidden');
        
        // Reload available rooms
        this.loadAvailableRooms();
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
    // GAME LOGIC - IMPROVED
    // ============================
    
    startGame: function() {
        console.log("Starting online game...");
        console.log("Player number:", this.state.playerNumber, "Opponent:", this.state.opponentName);
        
        // Hide matchmaking screen, show game screen
        document.getElementById('matchmakingScreen').classList.add('hidden');
        document.getElementById('gameScreen').style.display = 'block';
        
        // Update opponent name
        document.getElementById('opponentName').textContent = this.state.opponentName;
        
        // Initialize game grids
        this.createGrids();
        
        // Start game polling
        this.startGamePolling();
        
        // Set initial game state
        this.state.gameActive = true;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        
        this.updateTurnIndicator();
        
        // Add chat message
        this.addChatMessage("System", `Game started! You are Player ${this.state.playerNumber}`);
        this.addChatMessage("System", "Place your 5 ships on your grid.");
        
        // Auto-place ships if player 2 (for testing - remove in production)
        if (this.state.playerNumber === 2) {
            // Give a moment for UI to load
            setTimeout(() => this.autoPlaceShips(), 1000);
        }
    },
    
    autoPlaceShips: function() {
        // For demo purposes - auto-place ships
        console.log("Auto-placing ships for player 2...");
        
        const positions = [
            { row: 0, col: 0, vertical: true },  // Carrier
            { row: 0, col: 2, vertical: true },  // Battleship
            { row: 0, col: 4, vertical: true },  // Cruiser
            { row: 0, col: 6, vertical: true },  // Submarine
            { row: 0, col: 8, vertical: false }  // Destroyer
        ];
        
        positions.forEach((pos, index) => {
            setTimeout(() => {
                this.placeShip(pos.row, pos.col, pos.vertical);
            }, index * 500);
        });
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
                cell.addEventListener('click', () => this.placeShip(row, col, true));
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
    
    placeShip: function(row, col, vertical = true) {
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
        
        // Check if ship can be placed
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
                sunk: false,
                vertical: vertical
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
                this.addChatMessage("System", "All ships placed! Waiting for opponent...");
            }
        } else {
            this.addChatMessage("System", `Cannot place ${shipType.name} there! Try another location.`);
        }
    },
    
    canPlaceShip: function(startRow, startCol, size, vertical, playerKey) {
        for (let i = 0; i < size; i++) {
            const row = vertical ? startRow + i : startRow;
            const col = vertical ? startCol : startCol + i;
            
            // Check bounds
            if (row >= 10 || col >= 10) {
                return false;
            }
            
            // Check overlap with existing ships
            const existingShip = this.state.ships[playerKey].find(ship => 
                ship.cells.some(cell => cell.row === row && cell.col === col)
            );
            if (existingShip) {
                return false;
            }
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
            this.addChatMessage("System", "Waiting for both players to place ships...");
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
                        this.addChatMessage("System", `🔥 ${ship.name} sunk!`);
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
            this.addChatMessage("You", `Hit at (${row},${col})!`);
        } else {
            this.addChatMessage("You", `Miss at (${row},${col})`);
        }
        
        // Check for win
        if (this.checkWin(enemyKey)) {
            await this.endGame(this.state.playerNumber);
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
            
            if (newTurn === this.state.playerNumber) {
                this.addChatMessage("System", "🎯 Your turn! Attack the enemy grid.");
            } else {
                this.addChatMessage("System", "⏳ Opponent's turn. Waiting...");
            }
            
        } catch (error) {
            console.error("Error switching turns:", error);
        }
    },
    
    checkWin: function(playerKey) {
        const allSunk = this.state.ships[playerKey].every(ship => ship.sunk);
        if (allSunk) {
            console.log("All ships sunk for player:", playerKey);
        }
        return allSunk;
    },
    
    // ============================
    // BACKEND POLLING - IMPROVED
    // ============================
    
    startGamePolling: function() {
        // Clear any existing interval
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        // Poll for game updates every 2 seconds
        this.state.pollingInterval = setInterval(async () => {
            if (!this.state.gameActive || !this.state.gameId) return;
            
            try {
                const query = new Parse.Query("GameRoom");
                const gameRoom = await query.get(this.state.gameId);
                
                // Check if game ended
                const status = gameRoom.get("status");
                const winner = gameRoom.get("winner");
                
                if (status === "ended") {
                    this.state.gameActive = false;
                    clearInterval(this.state.pollingInterval);
                    
                    if (winner === this.state.playerId) {
                        this.showGameOver("🎉 VICTORY! You win! 🎉", true);
                    } else {
                        this.showGameOver("💀 DEFEAT! You lose! 💀", false);
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
                    this.addChatMessage("System", "⚔️ BATTLE PHASE BEGINS! ⚔️");
                    this.addChatMessage("System", currentTurn === 1 ? "Player 1's turn first!" : "Player 2's turn first!");
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
        
        enemyAttacks.forEach(attackStr => {
            const [row, col, result] = attackStr.split(',');
            // Attacks are already processed in updateGrids()
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
        
        // Update player grid (your ships)
        for (let i = 0; i < 100; i++) {
            const row = Math.floor(i / 10);
            const col = i % 10;
            const cell = playerGrid.children[i];
            
            if (!cell) continue;
            
            cell.className = 'cell';
            
            // Check if ship occupies this cell
            const shipHere = this.state.ships[playerKey].find(ship => 
                ship.cells.some(c => c.row === row && c.col === col)
            );
            
            if (shipHere) {
                cell.classList.add('ship');
                
                // Check if this ship cell is hit
                const enemyAttacks = this.state.attacks[enemyKey] || [];
                const wasHit = enemyAttacks.some(attack => {
                    const [r, c] = attack.split(',');
                    return parseInt(r) === row && parseInt(c) === col;
                });
                
                if (wasHit) {
                    cell.classList.add('hit');
                }
            }
            
            // Show opponent's attacks (misses)
            const enemyAttacks = this.state.attacks[enemyKey] || [];
            enemyAttacks.forEach(attackStr => {
                const [r, c, result] = attackStr.split(',');
                if (parseInt(r) === row && parseInt(c) === col && result === 'miss') {
                    cell.classList.add('miss');
                }
            });
        }
        
        // Update attack grid (enemy territory)
        for (let i = 0; i < 100; i++) {
            const row = Math.floor(i / 10);
            const col = i % 10;
            const cell = attackGrid.children[i];
            
            if (!cell) continue;
            
            cell.className = 'cell';
            
            // Show your attacks
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
            text = `Place your ships (${this.state.placedShips}/5 placed)`;
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 YOUR TURN - Attack!";
        } else {
            text = "⏳ OPPONENT'S TURN - Wait...";
        }
        document.getElementById('turnIndicator').textContent = text;
    },
    
    updateShipStatus: function() {
        const shipStatus = document.getElementById('shipStatus');
        shipStatus.innerHTML = '';
        
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Show enemy ship status
        this.state.ships[enemyKey].forEach(ship => {
            const item = document.createElement('div');
            item.className = `ship-status-item ${ship.sunk ? 'sunk' : ''}`;
            const statusIcon = ship.sunk ? '💀' : (ship.hits > 0 ? '🔥' : '🚢');
            item.innerHTML = `${statusIcon} ${ship.name} (${ship.hits}/${ship.size})`;
            shipStatus.appendChild(item);
        });
    },
    
    addChatMessage: function(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // Style system messages differently
        if (sender === "System") {
            messageDiv.style.color = '#3498db';
            messageDiv.style.fontStyle = 'italic';
        } else if (sender === "You") {
            messageDiv.style.color = '#2ecc71';
            messageDiv.style.fontWeight = 'bold';
        }
        
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    sendChatMessage: function() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message) {
            this.addChatMessage("You", message);
            
            // In a real app, you'd save chat to Back4App
            // For now, just display locally
            
            input.value = '';
            input.focus();
        }
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
    
    showGameOver: function(message, isWin) {
        // Create game over overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            z-index: 10000;
            text-align: center;
            padding: 20px;
        `;
        
        overlay.innerHTML = `
            <h1 style="font-size: 3rem; margin-bottom: 20px; color: ${isWin ? '#2ecc71' : '#e74c3c'}">
                ${isWin ? '🎉' : '💀'} ${message} ${isWin ? '🎉' : '💀'}
            </h1>
            <p style="font-size: 1.5rem; margin-bottom: 30px;">Thanks for playing!</p>
            <div style="display: flex; gap: 20px;">
                <button id="rematchBtn" style="
                    padding: 15px 30px;
                    font-size: 1.2rem;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                ">Play Again</button>
                <button id="menuBtn" style="
                    padding: 15px 30px;
                    font-size: 1.2rem;
                    background: #95a5a6;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                ">Main Menu</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add event listeners
        document.getElementById('rematchBtn').onclick = () => {
            document.body.removeChild(overlay);
            this.rematch();
        };
        
        document.getElementById('menuBtn').onclick = () => {
            window.location.href = '../index.html';
        };
    },
    
    rematch: function() {
        // Reset game state
        this.state.gameId = null;
        this.state.gameActive = false;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        
        // Show matchmaking screen
        document.getElementById('matchmakingScreen').classList.remove('hidden');
        document.getElementById('gameScreen').style.display = 'none';
        
        // Start new matchmaking
        this.startMatchmaking();
    },
    
    surrenderGame: async function() {
        if (!confirm("Are you sure you want to surrender?")) return;
        
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
    
    leaveGame: async function() {
        if (!confirm("Exit this game? Your opponent will win.")) return;
        
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            
            gameRoom.set("status", "ended");
            gameRoom.set("winner", this.state.opponentId);
            await gameRoom.save();
            
            window.location.href = "../index.html";
            
        } catch (error) {
            console.error("Error leaving game:", error);
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
                this.showGameOver("🎉 VICTORY! You win! 🎉", true);
            } else {
                this.showGameOver("💀 DEFEAT! You lose! 💀", false);
            }
            
        } catch (error) {
            console.error("Error ending game:", error);
        }
    },
    
    // Cleanup on page unload
    cleanup: function() {
        if (this.state.sessionId) {
            // Mark session as offline
            this.markSessionOffline();
        }
        
        if (this.state.gameActive) {
            this.leaveGame();
        }
    },
    
    markSessionOffline: async function() {
        try {
            const query = new Parse.Query("PlayerSession");
            const session = await query.get(this.state.sessionId);
            session.set("status", "offline");
            await session.save();
        } catch (error) {
            console.error("Error marking session offline:", error);
        }
    }
};

// Make it globally available
window.onlineBackend = onlineBackend;

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    onlineBackend.cleanup();
});
