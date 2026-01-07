// ============================
// BACK4APP ONLINE MULTIPLAYER - IMPROVED
// ============================

const onlineBackend = {
    // Configuration with YOUR Back4App credentials
    config: {
        appId: "okHWTaxUkPKB140QAbSIcC4719YSK3Hdgn53BKR7",
        clientKey: "Z0uBJX8qdQav4YIKpmsfsFxhqMLnEo6BfK7vbOsG",
        javascriptKey: "ZDkeTkYgyvV9pqObdQueuhj5E7uoWBs5NMDX6hDy",
        restKey: "wDymhiZmZoAJgoXtP87csVgW8XFQARoyASyCJ68a",
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
        sessionId: null,
        orientation: "vertical" // For ship placement
    },
    
    // Initialize
    initialize: function() {
        console.log("Initializing Back4App Online Multiplayer...");
        console.log("Using App ID:", this.config.appId);
        
        try {
            // Initialize Parse with correct parameters for your version
            Parse.initialize(this.config.appId, this.config.javascriptKey);
            Parse.serverURL = this.config.serverURL;
            
            // Set additional headers if needed
            Parse.ajax = function({ url, method, data, headers }) {
                headers = headers || {};
                headers['X-Parse-Application-Id'] = onlineBackend.config.appId;
                headers['X-Parse-JavaScript-Key'] = onlineBackend.config.javascriptKey;
                headers['X-Parse-REST-API-Key'] = onlineBackend.config.restKey;
                headers['Content-Type'] = 'application/json';
                
                return fetch(url, {
                    method: method || 'GET',
                    headers: headers,
                    body: data ? JSON.stringify(data) : undefined
                }).then(response => response.json());
            };
            
            // Generate player ID and name
            this.state.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
            
            // Get player name from localStorage or create new
            const savedName = localStorage.getItem('battleship_playerName');
            if (savedName) {
                this.state.playerName = savedName;
            } else {
                const names = ["Captain", "Admiral", "Commander", "Privateer", "Navigator", "Sailor"];
                const randomName = names[Math.floor(Math.random() * names.length)];
                this.state.playerName = `${randomName}_${Math.floor(Math.random() * 1000)}`;
                localStorage.setItem('battleship_playerName', this.state.playerName);
            }
            
            // Create a player session
            this.createPlayerSession();
            
            // Update UI
            document.getElementById('playerName').textContent = this.state.playerName;
            document.getElementById('playerIdDisplay').textContent = this.state.playerId.substr(0, 12) + "...";
            
            // Start checking for online players
            this.updateOnlineCount();
            setInterval(() => this.updateOnlineCount(), 10000); // Every 10 seconds
            
            // Load available rooms
            this.loadAvailableRooms();
            
            // Add ship orientation toggle button
            this.addOrientationToggle();
            
            console.log("Player initialized:", this.state.playerId, this.state.playerName);
            
        } catch (error) {
            console.error("Failed to initialize Parse:", error);
            alert("Failed to connect to game server. Please refresh the page.");
        }
    },
    
    // Add ship orientation toggle
    addOrientationToggle: function() {
        const controls = document.querySelector('.controls');
        if (!controls) return;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-primary';
        toggleBtn.innerHTML = '🔄 Vertical';
        toggleBtn.style.marginTop = '10px';
        toggleBtn.onclick = () => {
            this.state.orientation = this.state.orientation === "vertical" ? "horizontal" : "vertical";
            toggleBtn.innerHTML = this.state.orientation === "vertical" ? '🔄 Vertical' : '🔄 Horizontal';
        };
        
        const placementControls = document.createElement('div');
        placementControls.style.textAlign = 'center';
        placementControls.style.marginTop = '10px';
        placementControls.innerHTML = '<p><small>Click your grid to place ships. Toggle orientation with button above.</small></p>';
        placementControls.appendChild(toggleBtn);
        
        // Add to controls section when game starts
        // This will be added dynamically when game starts
        this.state.orientationToggle = toggleBtn;
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
            session.set("createdAt", new Date());
            
            const savedSession = await session.save();
            this.state.sessionId = savedSession.id;
            
            console.log("Player session created:", this.state.sessionId);
            
            // Set up session cleanup
            this.setupSessionCleanup();
            
        } catch (error) {
            console.error("Error creating session:", error);
            // Continue without session tracking
        }
    },
    
    setupSessionCleanup: function() {
        // Clean up old sessions every 10 minutes
        setInterval(async () => {
            try {
                // Clean up sessions older than 30 minutes
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
                const query = new Parse.Query("PlayerSession");
                query.lessThan("lastActive", thirtyMinutesAgo);
                
                const oldSessions = await query.find();
                for (const session of oldSessions) {
                    await session.destroy();
                }
                
                if (oldSessions.length > 0) {
                    console.log("Cleaned up", oldSessions.length, "old sessions");
                }
            } catch (error) {
                console.error("Error cleaning up sessions:", error);
            }
        }, 10 * 60 * 1000); // Every 10 minutes
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
            
            // Update own session activity
            await this.updateSessionActivity();
            
        } catch (error) {
            console.error("Error updating online count:", error);
            // Show offline mode
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
            // If session doesn't exist, create new one
            if (error.code === 101) { // Object not found
                await this.createPlayerSession();
            } else {
                console.error("Error updating session:", error);
            }
        }
    },
    
    // Load available rooms
    loadAvailableRooms: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            query.equalTo("status", "waiting");
            query.notEqualTo("player1Id", this.state.playerId); // Don't show own rooms
            query.ascending("createdAt");
            query.limit(20);
            
            const rooms = await query.find();
            this.displayAvailableRooms(rooms);
            
        } catch (error) {
            console.error("Error loading rooms:", error);
            this.displayAvailableRooms([]);
        }
    },
    
    displayAvailableRooms: function(rooms) {
        const roomsList = document.getElementById('availableRooms');
        if (!roomsList) return;
        
        roomsList.innerHTML = '';
        
        if (rooms.length === 0) {
            roomsList.innerHTML = '<p class="no-rooms">No active rooms. Create one!</p>';
            return;
        }
        
        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            
            const createdAt = room.get("createdAt");
            const timeAgo = createdAt ? this.getTimeAgo(createdAt) : "Just now";
            const playerName = room.get("player1Name") || "Anonymous";
            
            roomDiv.innerHTML = `
                <div class="room-info">
                    <strong>${playerName}</strong>
                    <span class="room-id">Room: ${room.id.substr(0, 8)}...</span>
                    <small style="color: #95a5a6; font-size: 0.8rem;">Created ${timeAgo}</small>
                </div>
                <button class="btn-join" onclick="onlineBackend.joinRoom('${room.id}')">
                    Join Room
                </button>
            `;
            roomsList.appendChild(roomDiv);
        });
    },
    
    getTimeAgo: function(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + " year" + (interval === 1 ? "" : "s") + " ago";
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + " month" + (interval === 1 ? "" : "s") + " ago";
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + " day" + (interval === 1 ? "" : "s") + " ago";
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + " hour" + (interval === 1 ? "" : "s") + " ago";
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + " minute" + (interval === 1 ? "" : "s") + " ago";
        
        return "Just now";
    },
    
    // ============================
    // MATCHMAKING SYSTEM - IMPROVED
    // ============================
    
    startMatchmaking: async function() {
        console.log("Starting matchmaking...");
        document.getElementById('matchmakingStatus').textContent = "Searching for opponent...";
        document.getElementById('matchmakingStatus').style.color = "#3498db";
        
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
            const shortId = this.state.gameId.substr(0, 10) + "...";
            document.getElementById('roomId').textContent = shortId;
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.remove('hidden');
            document.getElementById('matchmakingStatus').textContent = "Room created!";
            document.getElementById('roomCreator').textContent = "You (Host)";
            
            // Update wait time counter
            this.startWaitTimer();
            
            // Start polling for opponent
            this.pollForOpponent();
            
        } catch (error) {
            console.error("Error creating game room:", error);
            alert("Failed to create game room. Please try again.");
            this.cancelMatchmaking();
        }
    },
    
    startWaitTimer: function() {
        let seconds = 0;
        const waitElement = document.getElementById('waitTime');
        
        this.waitTimer = setInterval(() => {
            seconds++;
            if (waitElement) {
                waitElement.textContent = Math.max(0, 30 - seconds);
                
                if (seconds >= 30) {
                    document.getElementById('matchmakingStatus').textContent = "Still waiting...";
                    document.getElementById('matchmakingStatus').style.color = "#e74c3c";
                }
            }
        }, 1000);
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
            
            // Check if room already has player2
            if (gameRoom.get("player2Id") && gameRoom.get("player2Id") !== "") {
                alert("Room is already full!");
                this.loadAvailableRooms();
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
            this.state.opponentName = gameRoom.get("player1Name") || "Player 1";
            
            // Update UI
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.add('hidden');
            document.getElementById('foundOpponent').classList.remove('hidden');
            document.getElementById('roomCreator').textContent = this.state.opponentName;
            document.getElementById('matchmakingStatus').textContent = "Joining game...";
            
            // Start the game
            setTimeout(() => this.startGame(), 1000);
            
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
                    clearInterval(this.waitTimer);
                    this.state.playerNumber = 1;
                    this.state.opponentId = player2Id;
                    this.state.opponentName = gameRoom.get("player2Name") || "Player 2";
                    this.startGame();
                    return;
                }
                
                if (player2Id && player2Id !== "") {
                    // Opponent found!
                    clearInterval(this.state.pollingInterval);
                    clearInterval(this.waitTimer);
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
                    clearInterval(this.waitTimer);
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
        
        if (this.waitTimer) {
            clearInterval(this.waitTimer);
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
        document.getElementById('matchmakingStatus').textContent = "Ready to Battle?";
        document.getElementById('matchmakingStatus').style.color = "#3498db";
        document.getElementById('queueStatus').classList.add('hidden');
        document.getElementById('roomStatus').classList.add('hidden');
        document.getElementById('foundOpponent').classList.add('hidden');
        document.getElementById('findBtn').classList.remove('hidden');
        document.getElementById('cancelBtn').classList.add('hidden');
        document.getElementById('quickMatch').classList.remove('hidden');
        
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
        
        // Add placement controls
        this.addPlacementControls();
        
        // Add chat message
        this.addChatMessage("System", `Game started! You are Player ${this.state.playerNumber}`);
        this.addChatMessage("System", "Place your 5 ships on your grid (click cells).");
        
        // Auto-place ships for demo if needed
        if (this.state.playerNumber === 2) {
            // Give a moment for UI to load
            setTimeout(() => this.autoPlaceShips(), 1500);
        }
    },
    
    addPlacementControls: function() {
        const controls = document.querySelector('.controls');
        if (!controls) return;
        
        // Add orientation toggle to controls
        const placementDiv = document.createElement('div');
        placementDiv.style.textAlign = 'center';
        placementDiv.style.margin = '15px 0';
        placementDiv.style.padding = '15px';
        placementDiv.style.background = 'rgba(52, 152, 219, 0.1)';
        placementDiv.style.borderRadius = '10px';
        
        placementDiv.innerHTML = `
            <h4 style="color: #2c3e50; margin-bottom: 10px;">Ship Placement</h4>
            <p style="margin-bottom: 10px; color: #34495e;">
                Click on your grid to place ships. Current: <span id="currentShip">Carrier (5)</span>
            </p>
            <button id="orientationToggle" class="btn btn-primary" style="padding: 10px 20px;">
                🔄 Ship Orientation: Vertical
            </button>
            <p style="margin-top: 10px; font-size: 0.9rem; color: #7f8c8d;">
                Ships to place: <span id="shipsToPlace">5</span> | Current: <span id="shipType">Carrier</span>
            </p>
        `;
        
        controls.parentNode.insertBefore(placementDiv, controls);
        
        // Add event listener for orientation toggle
        document.getElementById('orientationToggle').onclick = () => {
            this.state.orientation = this.state.orientation === "vertical" ? "horizontal" : "vertical";
            document.getElementById('orientationToggle').innerHTML = 
                `🔄 Ship Orientation: ${this.state.orientation.charAt(0).toUpperCase() + this.state.orientation.slice(1)}`;
        };
    },
    
    autoPlaceShips: function() {
        // For demo purposes - auto-place ships for player 2
        console.log("Auto-placing ships for player 2...");
        
        // Try different positions to avoid conflicts
        const attempts = [
            { row: 0, col: 0, vertical: true },
            { row: 0, col: 2, vertical: true },
            { row: 0, col: 4, vertical: true },
            { row: 0, col: 6, vertical: true },
            { row: 2, col: 8, vertical: false }
        ];
        
        let placed = 0;
        const tryPlace = () => {
            if (placed >= 5) return;
            
            const pos = attempts[placed];
            if (this.placeShip(pos.row, pos.col, pos.vertical)) {
                placed++;
            }
            
            if (placed < 5) {
                setTimeout(tryPlace, 800);
            }
        };
        
        tryPlace();
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
                cell.title = `Row ${row}, Column ${col}`;
                
                // Add click handler with current orientation
                cell.addEventListener('click', () => this.placeShip(row, col, this.state.orientation));
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
                cell.title = `Attack position ${row},${col}`;
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
            return false;
        }
        
        if (this.state.placedShips >= 5) {
            this.addChatMessage("System", "All ships placed! Waiting for opponent...");
            return false;
        }
        
        const shipType = this.state.shipTypes[this.state.placedShips];
        const playerKey = `player${this.state.playerNumber}`;
        
        // Update UI indicators
        if (document.getElementById('currentShip')) {
            document.getElementById('currentShip').textContent = `${shipType.name} (${shipType.size})`;
        }
        if (document.getElementById('shipType')) {
            document.getElementById('shipType').textContent = shipType.name;
        }
        if (document.getElementById('shipsToPlace')) {
            document.getElementById('shipsToPlace').textContent = 5 - this.state.placedShips;
        }
        
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
            this.addChatMessage("You", `Placed ${shipType.name} at (${row},${col})`);
            
            // Save to backend
            this.saveGameState();
            
            // If all ships placed, mark as ready
            if (this.state.placedShips >= 5) {
                this.markPlacementComplete();
                this.addChatMessage("System", "✅ All ships placed! Waiting for opponent...");
                
                // Disable placement grid
                const cells = document.querySelectorAll('#playerGrid .cell');
                cells.forEach(cell => {
                    cell.style.cursor = 'default';
                    cell.onclick = null;
                });
            }
            return true;
        } else {
            this.addChatMessage("System", `❌ Cannot place ${shipType.name} there! Try another location.`);
            return false;
        }
    },
    
    canPlaceShip: function(startRow, startCol, size, vertical, playerKey) {
        // Check bounds
        if (vertical) {
            if (startRow + size > 10) return false;
        } else {
            if (startCol + size > 10) return false;
        }
        
        // Check each cell
        for (let i = 0; i < size; i++) {
            const row = vertical ? startRow + i : startRow;
            const col = vertical ? startCol : startCol + i;
            
            // Check bounds again (just in case)
            if (row >= 10 || col >= 10) return false;
            
            // Check overlap with existing ships
            const existingShip = this.state.ships[playerKey].find(ship => 
                ship.cells.some(cell => cell.row === row && cell.col === col)
            );
            if (existingShip) {
                return false;
            }
            
            // Optional: Add buffer zone around ships
            // for (let dr = -1; dr <= 1; dr++) {
            //     for (let dc = -1; dc <= 1; dc++) {
            //         const r = row + dr;
            //         const c = col + dc;
            //         if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            //             const hasNeighbor = this.state.ships[playerKey].find(ship => 
            //                 ship.cells.some(cell => cell.row === r && cell.col === c)
            //             );
            //             if (hasNeighbor) return false;
            //         }
            //     }
            // }
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
            
        } catch (error) {
            console.error("Error marking placement complete:", error);
        }
    },
    
    attack: async function(row, col) {
        if (this.state.gamePhase !== "battle") {
            this.addChatMessage("System", "⏳ Waiting for both players to place ships...");
            return;
        }
        
        if (this.state.currentTurn !== this.state.playerNumber) {
            this.addChatMessage("System", "⏳ Wait for your turn!");
            return;
        }
        
        const attackKey = `${row},${col}`;
        const playerKey = `player${this.state.playerNumber}`;
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Check if already attacked
        if (this.state.attacks[playerKey].includes(attackKey)) {
            this.addChatMessage("System", "❌ You already attacked here!");
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
                        this.addChatMessage("System", `🔥 ${ship.name} has been SUNK!`);
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
            this.addChatMessage("You", `🎯 HIT at (${row},${col})!`);
        } else {
            this.addChatMessage("You", `💧 MISS at (${row},${col})`);
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
            
            // Update game room
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
                this.addChatMessage("System", "🎯 YOUR TURN! Attack the enemy grid.");
            } else {
                this.addChatMessage("System", "⏳ OPPONENT'S TURN. Waiting...");
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
                    
                    // Remove placement controls
                    const placementDiv = document.querySelector('.controls').previousElementSibling;
                    if (placementDiv && placementDiv.style.background.includes('rgba(52, 152, 219')) {
                        placementDiv.remove();
                    }
                }
                
                // Update UI
                this.updateGrids();
                this.updateTurnIndicator();
                this.updateShipStatus();
                
            } catch (error) {
                console.error("Error polling game state:", error);
                
                // If game room not found, game might have been deleted
                if (error.code === 101) {
                    this.addChatMessage("System", "❌ Game room not found. Opponent may have left.");
                    setTimeout(() => {
                        window.location.href = "../index.html";
                    }, 3000);
                }
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
                    
                    // If it's a hit and we're in battle phase, show a different style
                    if (result === 'hit' && this.state.gamePhase === 'battle') {
                        cell.style.backgroundColor = '#e74c3c';
                    }
                }
            });
        }
    },
    
    updateTurnIndicator: function() {
        let text = "";
        let color = "#3498db";
        
        if (this.state.gamePhase === "placement") {
            text = `🏗️ Placement Phase (${this.state.placedShips}/5 ships placed)`;
            color = "#3498db";
        } else if (this.state.currentTurn === this.state.playerNumber) {
            text = "🎯 YOUR TURN - Attack Now!";
            color = "#2ecc71";
        } else {
            text = "⏳ OPPONENT'S TURN - Waiting...";
            color = "#e74c3c";
        }
        
        const indicator = document.getElementById('turnIndicator');
        indicator.textContent = text;
        indicator.style.color = color;
        indicator.style.background = `rgba(${this.hexToRgb(color)}, 0.1)`;
    },
    
    hexToRgb: function(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
            : '52, 152, 219';
    },
    
    updateShipStatus: function() {
        const shipStatus = document.getElementById('shipStatus');
        shipStatus.innerHTML = '';
        
        const enemyKey = `player${this.state.playerNumber === 1 ? 2 : 1}`;
        
        // Show enemy ship status
        this.state.ships[enemyKey].forEach(ship => {
            const item = document.createElement('div');
            item.className = `ship-status-item ${ship.sunk ? 'sunk' : ''}`;
            
            let statusIcon = '🚢'; // Default
            if (ship.sunk) {
                statusIcon = '💀';
            } else if (ship.hits > 0) {
                statusIcon = '🔥';
            }
            
            let statusText = `${ship.name}`;
            if (ship.sunk) {
                statusText += ` (SUNK!)`;
                item.style.background = '#e74c3c';
                item.style.color = 'white';
            } else {
                statusText += ` (${ship.hits}/${ship.size})`;
            }
            
            item.innerHTML = `${statusIcon} ${statusText}`;
            shipStatus.appendChild(item);
        });
        
        // If no enemy ships yet (placement phase), show placeholder
        if (this.state.ships[enemyKey].length === 0) {
            this.state.shipTypes.forEach(shipType => {
                const item = document.createElement('div');
                item.className = 'ship-status-item';
                item.innerHTML = `🚢 ${shipType.name} (0/${shipType.size})`;
                shipStatus.appendChild(item);
            });
        }
    },
    
    addChatMessage: function(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // Style based on sender
        if (sender === "System") {
            messageDiv.style.color = '#3498db';
            messageDiv.style.fontStyle = 'italic';
            messageDiv.style.borderLeft = '3px solid #3498db';
            messageDiv.style.paddingLeft = '10px';
        } else if (sender === "You") {
            messageDiv.style.color = '#2ecc71';
            messageDiv.style.fontWeight = 'bold';
            messageDiv.style.borderLeft = '3px solid #2ecc71';
            messageDiv.style.paddingLeft = '10px';
        } else {
            messageDiv.style.color = '#e74c3c';
            messageDiv.style.borderLeft = '3px solid #e74c3c';
            messageDiv.style.paddingLeft = '10px';
        }
        
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Limit messages to 50
        if (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
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
            await gameRoom.save();
            
        } catch (error) {
            console.error("Error saving game state:", error);
        }
    },
    
    showGameOver: function(message, isWin) {
        window.showGameOver(message, isWin);
    },
    
    rematch: function() {
        // Reset game state
        this.state.gameId = null;
        this.state.gameActive = false;
        this.state.gamePhase = "placement";
        this.state.placedShips = 0;
        this.state.ships = { player1: [], player2: [] };
        this.state.attacks = { player1: [], player2: [] };
        this.state.currentTurn = 1;
        
        // Clear intervals
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        // Show matchmaking screen
        document.getElementById('matchmakingScreen').classList.remove('hidden');
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameOverOverlay').style.display = 'none';
        
        // Reset UI
        document.getElementById('matchmakingStatus').textContent = "Ready for Rematch?";
        document.getElementById('findBtn').classList.remove('hidden');
        document.getElementById('quickMatch').classList.remove('hidden');
        
        // Reload rooms
        this.loadAvailableRooms();
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
        
        if (this.state.gameActive && this.state.gameId) {
            // If game is active, surrender
            this.surrenderGameSilently();
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
    },
    
    surrenderGameSilently: async function() {
        try {
            const query = new Parse.Query("GameRoom");
            const gameRoom = await query.get(this.state.gameId);
            gameRoom.set("status", "ended");
            gameRoom.set("winner", this.state.opponentId);
            await gameRoom.save();
        } catch (error) {
            console.error("Error surrendering silently:", error);
        }
    }
};

// Make it globally available
window.onlineBackend = onlineBackend;

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    onlineBackend.cleanup();
});

// Handle page visibility change (tab switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, update session activity
        onlineBackend.updateSessionActivity();
    }
});
