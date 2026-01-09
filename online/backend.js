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
            { name: "Carrier", size: 5, id: "carrier", placed: false },
            { name: "Battleship", size: 4, id: "battleship", placed: false },
            { name: "Cruiser", size: 3, id: "cruiser", placed: false },
            { name: "Submarine", size: 3, id: "submarine", placed: false },
            { name: "Destroyer", size: 2, id: "destroyer", placed: false }
        ],
        placedShips: 0,
        orientation: "vertical",
        matchmakingType: null,
        isWaitingForOpponent: false,
        currentDraggingShip: null,
        dragStartPosition: null,
        availableShips: [],
        selectedShipIndex: -1
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
            // Create a test game class to ensure it exists
            const GameRoom = Parse.Object.extend("GameRoom");
            const testRoom = new GameRoom();
            testRoom.set("testField", "connection_test");
            
            await testRoom.save();
            console.log("Back4App connection test successful");
            
            // Clean up test object
            await testRoom.destroy();
            
        } catch (error) {
            console.log("Back4App is accessible:", error.message);
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
        
        // Show searching UI
        const quickMatchEl = document.getElementById('quickMatch');
        const queueStatusEl = document.getElementById('queueStatus');
        if (quickMatchEl) quickMatchEl.classList.add('hidden');
        if (queueStatusEl) queueStatusEl.classList.remove('hidden');
        
        try {
            // First try to find existing waiting room
            console.log("Searching for existing rooms...");
            const foundRoom = await this.findWaitingRoom();
            
            if (foundRoom) {
                console.log("Found existing room! Joining as Player 2...");
                await this.joinExistingRoom(foundRoom);
                return;
            }
            
            // No room found, create new one
            console.log("No waiting rooms found. Creating new room...");
            await this.createQuickMatchRoom();
            
        } catch (error) {
            console.error("Quick match error:", error);
            this.showError("Quick match failed. Please try again.");
            this.resetMatchmakingUI();
        }
    },
    
    findWaitingRoom: async function() {
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const query = new Parse.Query(GameRoom);
            
            query.equalTo("status", "waiting");
            query.equalTo("matchmakingType", "quick");
            query.notEqualTo("player1Id", this.state.playerId);
            
            query.ascending("createdAt");
            
            const results = await query.find();
            console.log("Found", results.length, "waiting rooms");
            
            if (results.length > 0) {
                const room = results[0];
                console.log("Available room:", room.id, "by", room.get("player1Name"));
                return room;
            }
            
            return null;
            
        } catch (error) {
            console.error("Error finding waiting rooms:", error);
            return null;
        }
    },
    
    createQuickMatchRoom: async function() {
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const gameRoom = new GameRoom();
            
            const roomCode = this.generateRoomCode();
            
            gameRoom.set("roomCode", roomCode);
            gameRoom.set("player1Id", this.state.playerId);
            gameRoom.set("player1Name", this.state.playerName);
            gameRoom.set("status", "waiting");
            gameRoom.set("matchmakingType", "quick");
            gameRoom.set("createdAt", new Date());
            
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
            
            console.log("Quick match room created! Code:", roomCode, "ID:", this.state.gameId);
            
            this.showRoomCreatedUI(roomCode);
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating room:", error);
            throw error;
        }
    },
    
    joinExistingRoom: async function(room) {
        try {
            room.set("player2Id", this.state.playerId);
            room.set("player2Name", this.state.playerName);
            room.set("status", "active");
            
            await room.save();
            
            this.state.gameId = room.id;
            this.state.playerNumber = 2;
            this.state.opponentId = room.get("player1Id");
            this.state.opponentName = room.get("player1Name") || "Opponent";
            
            console.log("Successfully joined room as Player 2");
            this.startGame();
            
        } catch (error) {
            console.error("Error joining existing room:", error);
            throw error;
        }
    },
    
    // ============================
    // ROOM SYSTEM
    // ============================
    
    createRoom: async function() {
        console.log("Creating private room...");
        this.state.matchmakingType = "room";
        
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const gameRoom = new GameRoom();
            
            const roomCode = this.generateRoomCode();
            
            gameRoom.set("roomCode", roomCode);
            gameRoom.set("player1Id", this.state.playerId);
            gameRoom.set("player1Name", this.state.playerName);
            gameRoom.set("status", "waiting");
            gameRoom.set("matchmakingType", "private");
            gameRoom.set("createdAt", new Date());
            
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
            
            console.log("Private room created! Code:", roomCode, "ID:", this.state.gameId);
            
            this.showRoomCreatedUI(roomCode);
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating room:", error);
            this.showError("Failed to create room. Please try again.");
        }
    },
    
    joinRoom: async function(roomCode) {
        console.log("Attempting to join room:", roomCode);
        this.state.matchmakingType = "room";
        
        const joinRoomForm = document.getElementById('joinRoomForm');
        const queueStatusEl = document.getElementById('queueStatus');
        if (joinRoomForm) joinRoomForm.classList.add('hidden');
        if (queueStatusEl) queueStatusEl.classList.remove('hidden');
        
        try {
            const GameRoom = Parse.Object.extend("GameRoom");
            const query = new Parse.Query(GameRoom);
            
            query.equalTo("roomCode", roomCode.toUpperCase());
            const results = await query.find();
            
            if (results.length === 0) {
                this.showError("Room not found!");
                this.resetMatchmakingUI();
                return;
            }
            
            const room = results[0];
            const status = room.get("status");
            
            if (status !== "waiting") {
                this.showError("Room is not available!");
                this.resetMatchmakingUI();
                return;
            }
            
            const player2Id = room.get("player2Id");
            if (player2Id && player2Id !== "") {
                this.showError("Room is already full!");
                this.resetMatchmakingUI();
                return;
            }
            
            if (room.get("player1Id") === this.state.playerId) {
                this.showError("Cannot join your own room!");
                this.resetMatchmakingUI();
                return;
            }
            
            room.set("player2Id", this.state.playerId);
            room.set("player2Name", this.state.playerName);
            room.set("status", "active");
            
            await room.save();
            
            this.state.gameId = room.id;
            this.state.playerNumber = 2;
            this.state.opponentId = room.get("player1Id");
            this.state.opponentName = room.get("player1Name") || "Player 1";
            
            console.log("Successfully joined room as Player 2");
            this.startGame();
            
        } catch (error) {
            console.error("Error joining room:", error);
            this.showError("Failed to join room!");
            this.resetMatchmakingUI();
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
    
    pollForOpponent: function() {
        if (!this.state.gameId) return;
        
        console.log("Polling for opponent...");
        this.state.isWaitingForOpponent = true;
        
        this.state.pollingInterval = setInterval(async () => {
            try {
                const query = new Parse.Query("GameRoom");
                const room = await query.get(this.state.gameId);
                
                const status = room.get("status");
                const player2Id = room.get("player2Id");
                
                if (status === "cancelled") {
                    clearInterval(this.state.pollingInterval);
                    this.showError("Room was cancelled!");
                    this.resetMatchmakingUI();
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    clearInterval(this.state.pollingInterval);
                    this.state.isWaitingForOpponent = false;
                    
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = room.get("player2Name") || "Opponent";
                    
                    room.set("status", "active");
                    await room.save();
                    
                    console.log("Opponent found:", this.state.opponentName);
                    this.startGame();
                }
                
            } catch (error) {
                console.error("Polling error:", error);
                if (error.code === 101) {
                    clearInterval(this.state.pollingInterval);
                    this.showError("Room was deleted!");
                    this.resetMatchmakingUI();
                }
            }
        }, 3000);
    },
    
    // ============================
    // GAME LOGIC
    // ============================
    
    startGame: function() {
        console.log("Starting game! Player:", this.state.playerNumber, "Opponent:", this.state.opponentName);
        
        // Hide matchmaking, show game
        const matchmakingScreen = document.getElementById('matchmakingScreen');
        if (matchmakingScreen) {
            matchmakingScreen.style.display = 'none';
        }
        
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
        }
        
        const opponentNameElement = document.getElementById('opponentName');
        if (opponentNameElement) {
            opponentNameElement.textContent = this.state.opponentName;
        }
        
        this.createGrids();
        this.createShipSelectionPanel();
        
        this.startGamePolling();
        
        this.state.gameActive = true;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        
        this.state.availableShips = [...this.state.shipTypes];
        this.state.selectedShipIndex = 0;
        
        this.updateTurnIndicator();
        this.addChatMessage("System", `Game started! You are Player ${this.state.playerNumber}`);
        this.addChatMessage("System", `Opponent: ${this.state.opponentName}`);
        
        this.highlightSelectedShip();
    },
    
    createGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        
        if (playerGrid) playerGrid.innerHTML = '';
        if (attackGrid) attackGrid.innerHTML = '';
        
        // Create player grid with drag and drop support
        if (playerGrid) {
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    
                    // Drag and drop event listeners
                    cell.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (this.state.gamePhase === "placement" && this.state.currentDraggingShip !== null) {
                            cell.classList.add('drag-over');
                        }
                    });
                    
                    cell.addEventListener('dragleave', () => {
                        cell.classList.remove('drag-over');
                    });
                    
                    cell.addEventListener('drop', (e) => {
                        e.preventDefault();
                        cell.classList.remove('drag-over');
                        
                        if (this.state.gamePhase === "placement" && this.state.currentDraggingShip !== null) {
                            const shipType = this.state.availableShips[this.state.selectedShipIndex];
                            if (shipType && !shipType.placed) {
                                this.placeShip(row, col, this.state.orientation);
                            }
                        }
                    });
                    
                    // Click to place for mobile/touch
                    cell.addEventListener('click', () => {
                        if (this.state.gamePhase === "placement" && this.state.selectedShipIndex >= 0) {
                            const shipType = this.state.availableShips[this.state.selectedShipIndex];
                            if (shipType && !shipType.placed) {
                                this.placeShip(row, col, this.state.orientation);
                            }
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
                    cell.style.cursor = 'not-allowed';
                    cell.style.opacity = '0.5';
                    
                    attackGrid.appendChild(cell);
                }
            }
        }
        
        this.updateShipStatus();
    },
    
    createShipSelectionPanel: function() {
        const shipStatus = document.getElementById('shipStatus');
        if (!shipStatus) return;
        
        shipStatus.innerHTML = '<h3>SHIPS TO PLACE (Drag to grid)</h3>';
        
        const shipContainer = document.createElement('div');
        shipContainer.className = 'ship-selection-container';
        shipContainer.style.display = 'flex';
        shipContainer.style.flexWrap = 'wrap';
        shipContainer.style.gap = '10px';
        shipContainer.style.marginTop = '15px';
        shipContainer.style.justifyContent = 'center';
        
        this.state.availableShips.forEach((ship, index) => {
            const shipElement = document.createElement('div');
            shipElement.className = `ship-selection-item ${ship.placed ? 'placed' : ''}`;
            shipElement.dataset.shipIndex = index;
            shipElement.draggable = !ship.placed;
            shipElement.style.cssText = `
                padding: 10px 15px;
                background: ${ship.placed ? 'rgba(0, 230, 118, 0.3)' : 'rgba(41, 121, 255, 0.3)'};
                border: 2px solid ${ship.placed ? '#00E676' : '#2979FF'};
                border-radius: 8px;
                cursor: ${ship.placed ? 'default' : 'grab'};
                user-select: none;
                transition: all 0.3s;
                text-align: center;
                min-width: 120px;
            `;
            
            shipElement.innerHTML = `
                <div style="font-size: 1.2rem; margin-bottom: 5px;">${this.getShipIcon(ship.size)}</div>
                <div style="font-weight: bold;">${ship.name}</div>
                <div style="font-size: 0.9rem;">Size: ${ship.size}</div>
                <div style="font-size: 0.8rem; color: ${ship.placed ? '#00E676' : '#FF9800'}">
                    ${ship.placed ? '✓ Placed' : 'Click or drag'}
                </div>
            `;
            
            // Drag events
            shipElement.addEventListener('dragstart', (e) => {
                if (!ship.placed) {
                    this.state.currentDraggingShip = ship.id;
                    this.state.selectedShipIndex = index;
                    e.dataTransfer.setData('text/plain', ship.id);
                    shipElement.style.opacity = '0.5';
                    this.highlightSelectedShip();
                }
            });
            
            shipElement.addEventListener('dragend', () => {
                this.state.currentDraggingShip = null;
                shipElement.style.opacity = '1';
            });
            
            // Click to select
            shipElement.addEventListener('click', () => {
                if (!ship.placed) {
                    this.state.selectedShipIndex = index;
                    this.highlightSelectedShip();
                }
            });
            
            shipContainer.appendChild(shipElement);
        });
        
        shipStatus.appendChild(shipContainer);
        
        // Add ship placement instructions
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            margin-top: 15px;
            padding: 10px;
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 8px;
            font-size: 0.9rem;
            color: #FFD54F;
            text-align: center;
        `;
        instructions.innerHTML = `
            <div><strong>How to place ships:</strong></div>
            <div>1. Click a ship to select it</div>
            <div>2. Click on your grid to place it</div>
            <div>3. Use rotation button to change orientation</div>
            <div>4. Drag ships directly onto grid (desktop)</div>
        `;
        shipStatus.appendChild(instructions);
    },
    
    getShipIcon: function(size) {
        const icons = ['🚢', '⚓', '🛳️', '⛴️', '🚤'];
        return icons[Math.min(size - 2, icons.length - 1)] || '🚢';
    },
    
    highlightSelectedShip: function() {
        const shipItems = document.querySelectorAll('.ship-selection-item');
        shipItems.forEach((item, index) => {
            if (index === this.state.selectedShipIndex && !this.state.availableShips[index].placed) {
                item.style.transform = 'scale(1.05)';
                item.style.boxShadow = '0 0 15px rgba(79, 195, 247, 0.5)';
                item.style.borderColor = '#4FC3F7';
            } else {
                item.style.transform = '';
                item.style.boxShadow = '';
                item.style.borderColor = this.state.availableShips[index].placed ? '#00E676' : '#2979FF';
            }
        });
    },
    
    placeShip: function(row, col, vertical = true) {
        if (this.state.gamePhase !== "placement") return false;
        if (this.state.selectedShipIndex < 0) return false;
        
        const shipType = this.state.availableShips[this.state.selectedShipIndex];
        if (!shipType || shipType.placed) return false;
        
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
            
            // Mark ship as placed
            this.state.availableShips[this.state.selectedShipIndex].placed = true;
            this.state.placedShips++;
            
            this.updateGrids();
            this.createShipSelectionPanel();
            this.addChatMessage("You", `Placed ${shipType.name}`);
            
            // Auto-select next unplaced ship
            const nextShipIndex = this.state.availableShips.findIndex(ship => !ship.placed);
            this.state.selectedShipIndex = nextShipIndex;
            this.highlightSelectedShip();
            
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
                ship.cells && ship.cells.some(cell => cell.row === row && cell.col === col)
            );
            if (existingShip) return false;
        }
        return true;
    },
    
    markReady: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            
            const readyField = this.state.playerNumber === 1 ? "player1Ready" : "player2Ready";
            room.set(readyField, true);
            room.set("ships", JSON.stringify(this.state.ships));
            await room.save();
            
            console.log("Player", this.state.playerNumber, "marked as ready");
            
            this.checkIfBothPlayersReady();
            
        } catch (error) {
            console.error("Error marking ready:", error);
        }
    },
    
    checkIfBothPlayersReady: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const room = await query.get(this.state.gameId);
            
            const player1Ready = room.get("player1Ready") || false;
            const player2Ready = room.get("player2Ready") || false;
            
            if (player1Ready && player2Ready && this.state.gamePhase === "placement") {
                this.state.gamePhase = "battle";
                this.addChatMessage("System", "⚔️ Battle begins!");
                
                this.enableAttackGrid();
                this.updateTurnIndicator();
            }
            
        } catch (error) {
            console.error("Error checking if both players ready:", error);
        }
    },
    
    enableAttackGrid: function() {
        const attackGrid = document.getElementById('attackGrid');
        if (!attackGrid) return;
        
        for (let i = 0; i < attackGrid.children.length; i++) {
            const cell = attackGrid.children[i];
            cell.style.cursor = 'pointer';
            cell.style.opacity = '1';
        }
    },
    
    attack: async function(row, col) {
        console.log("Attack attempt at:", row, col);
        
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
        
        // Initialize attacks if needed
        if (!this.state.attacks[playerKey]) {
            this.state.attacks[playerKey] = [];
        }
        
        // Check if already attacked here
        const alreadyAttacked = this.state.attacks[playerKey].some(attack => {
            const parts = attack.split(',');
            return parseInt(parts[0]) === row && parseInt(parts[1]) === col;
        });
        
        if (alreadyAttacked) {
            this.addChatMessage("System", "Already attacked here!");
            return;
        }
        
        // Determine hit or miss
        let hit = false;
        let sunkShip = null;
        
        if (this.state.ships[enemyKey]) {
            for (const ship of this.state.ships[enemyKey]) {
                if (ship.cells) {
                    for (const cell of ship.cells) {
                        if (cell.row === row && cell.col === col) {
                            hit = true;
                            ship.hits = (ship.hits || 0) + 1;
                            
                            if (ship.hits >= ship.size) {
                                ship.sunk = true;
                                sunkShip = ship;
                            }
                            break;
                        }
                    }
                }
                if (hit) break;
            }
        }
        
        // Record attack
        this.state.attacks[playerKey].push(`${row},${col},${hit ? 'hit' : 'miss'}`);
        
        // Update grids immediately
        this.updateGrids();
        
        // Save to server
        await this.saveAttack(row, col, hit);
        
        // Chat message
        const hitMsg = hit ? '🎯 HIT!' : '🌊 MISS';
        const locationMsg = `at (${String.fromCharCode(65 + col)}${row + 1})`;
        this.addChatMessage("You", `${hitMsg} ${locationMsg}`);
        
        if (sunkShip) {
            this.addChatMessage("System", `💥 SUNK ENEMY ${sunkShip.name}!`);
        }
        
        // Check for win
        if (this.checkWin(enemyKey)) {
            await this.endGame(this.state.playerNumber);
            return;
        }
        
        // Switch turns
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
            
            this.addChatMessage("System", newTurn === this.state.playerNumber 
                ? "🎯 Your turn to attack!" 
                : "⏳ Waiting for opponent's attack...");
            
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
                
                if (status === "abandoned") {
                    this.state.gameActive = false;
                    clearInterval(this.state.pollingInterval);
                    this.showGameOver("Opponent left the game", false);
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
                    this.enableAttackGrid();
                    this.addChatMessage("System", "⚔️ Battle begins!");
                }
                
                this.updateGrids();
                this.updateTurnIndicator();
                this.updateShipStatusDisplay();
                
            } catch (error) {
                console.error("Polling error:", error);
                if (error.code === 101) {
                    this.state.gameActive = false;
                    clearInterval(this.state.pollingInterval);
                    this.showGameOver("Game room was deleted", false);
                }
            }
        }, 3000);
    },
    
    // ============================
    // UI UPDATES
    // ============================
    
    updateGrids: function() {
        const playerGrid = document.getElementById('playerGrid');
        const attackGrid = document.getElementById('attackGrid');
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Update player grid (show YOUR ships)
        if (playerGrid && playerGrid.children.length > 0) {
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(i / 10);
                const col = i % 10;
                const cell = playerGrid.children[i];
                
                if (!cell) continue;
                
                cell.className = 'cell';
                
                // Show your own ships
                if (this.state.ships[playerKey]) {
                    const shipHere = this.state.ships[playerKey].find(ship =>
                        ship.cells && ship.cells.some(c => c.row === row && c.col === col)
                    );
                    
                    if (shipHere) {
                        cell.classList.add('ship');
                        
                        // Show hits on your ships
                        const enemyAttacks = this.state.attacks[enemyKey] || [];
                        const wasHit = enemyAttacks.some(attack => {
                            const parts = attack.split(',');
                            if (parts.length >= 3) {
                                const r = parseInt(parts[0]);
                                const c = parseInt(parts[1]);
                                const result = parts[2];
                                return r === row && c === col && result === 'hit';
                            }
                            return false;
                        });
                        
                        if (wasHit) {
                            cell.classList.add('hit');
                        }
                    }
                }
                
                // Show misses on your grid
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
        
        // Update attack grid (show YOUR attacks on enemy)
        if (attackGrid && attackGrid.children.length > 0) {
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(i / 10);
                const col = i % 10;
                const cell = attackGrid.children[i];
                
                if (!cell) continue;
                
                cell.className = 'cell';
                
                // Show your attacks
                const playerAttacks = this.state.attacks[playerKey] || [];
                playerAttacks.forEach(attackStr => {
                    const parts = attackStr.split(',');
                    if (parts.length >= 3) {
                        const r = parseInt(parts[0]);
                        const c = parseInt(parts[1]);
                        const result = parts[2];
                        if (r === row && c === col) {
                            cell.classList.add(result === 'hit' ? 'hit' : 'miss');
                        }
                    }
                });
            }
        }
    },
    
    updateShipStatusDisplay: function() {
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        if (this.state.ships[enemyKey]) {
            let statusText = "Enemy Ships: ";
            this.state.ships[enemyKey].forEach((ship, index) => {
                const sunk = ship.sunk ? '💀' : (ship.hits > 0 ? '🔥' : '🚢');
                statusText += `${sunk} ${ship.name}(${ship.hits || 0}/${ship.size}) `;
            });
            
            const statusElement = document.querySelector('.ship-status-container h3');
            if (statusElement) {
                statusElement.innerHTML = statusText;
            }
        }
    },
    
    updateTurnIndicator: function() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (!turnIndicator) return;
        
        let text = "";
        if (this.state.gamePhase === "placement") {
            text = `Place ships (${this.state.placedShips}/5 placed)`;
            turnIndicator.style.background = 'linear-gradient(45deg, #FF9800, #FF5722)';
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 YOUR TURN - ATTACK!";
            turnIndicator.style.background = 'linear-gradient(45deg, #00E676, #00C853)';
            turnIndicator.style.animation = 'pulse 1s infinite';
        } else {
            text = "⏳ OPPONENT'S TURN";
            turnIndicator.style.background = 'linear-gradient(45deg, #FF3D00, #DD2C00)';
            turnIndicator.style.animation = 'none';
        }
        turnIndicator.textContent = text;
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
    // UI HELPERS
    // ============================
    
    showRoomCreatedUI: function(roomCode) {
        const queueStatusEl = document.getElementById('queueStatus');
        const roomStatusEl = document.getElementById('roomStatus');
        const roomIdEl = document.getElementById('roomId');
        
        if (queueStatusEl) queueStatusEl.classList.add('hidden');
        if (roomStatusEl) roomStatusEl.classList.remove('hidden');
        if (roomIdEl) roomIdEl.textContent = roomCode;
        
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(roomCode).then(() => {
                    alert('Room ID copied to clipboard!');
                });
            };
        }
    },
    
    showError: function(message) {
        const errorElement = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'block';
            
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    },
    
    resetMatchmakingUI: function() {
        const matchmakingOptions = document.getElementById('matchmakingOptions');
        const queueStatus = document.getElementById('queueStatus');
        const roomStatus = document.getElementById('roomStatus');
        const cancelBtn = document.getElementById('cancelBtn');
        
        if (matchmakingOptions) matchmakingOptions.classList.remove('hidden');
        if (queueStatus) queueStatus.classList.add('hidden');
        if (roomStatus) roomStatus.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        
        const roomCodeInput = document.getElementById('roomCodeInput');
        if (roomCodeInput) roomCodeInput.value = '';
    },
    
    // ============================
    // GAME MANAGEMENT
    // ============================
    
    showGameOver: function(message, isWin) {
        const overlay = document.getElementById('gameOverOverlay');
        const title = document.getElementById('gameOverTitle');
        const messageEl = document.getElementById('gameOverMessage');
        
        if (overlay && title && messageEl) {
            title.textContent = isWin ? '🎉 VICTORY! 🎉' : '💀 DEFEAT! 💀';
            title.style.color = isWin ? '#00E676' : '#FF3D00';
            messageEl.textContent = message;
            overlay.classList.remove('hidden');
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
        this.state.isWaitingForOpponent = false;
        this.state.availableShips = [...this.state.shipTypes].map(ship => ({...ship, placed: false}));
        this.state.selectedShipIndex = 0;
        
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
        }
        
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'none';
        }
        
        this.resetMatchmakingUI();
    },
    
    surrenderGame: async function() {
        if (!confirm("Are you sure you want to surrender?")) return;
        
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
    
    cancelMatchmaking: async function() {
        console.log("Cancelling matchmaking...");
        
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        if (this.state.gameId && this.state.isWaitingForOpponent) {
            await this.deleteRoom();
        }
        
        this.state.matchmakingType = null;
        this.state.isWaitingForOpponent = false;
        
        this.resetMatchmakingUI();
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
    
    cleanup: function() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        if (this.state.gameId && this.state.gameActive) {
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
