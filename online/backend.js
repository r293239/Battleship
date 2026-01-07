<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <title>Battleship - Online Multiplayer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            -webkit-tap-highlight-color: transparent;
            -webkit-text-size-adjust: 100%;
        }

        body {
            background: #000000;
            min-height: 100vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        /* Matchmaking Screen */
        #matchmakingScreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a2980, #26d0ce);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            color: white;
            padding: 20px;
            overflow-y: auto;
        }

        .matchmaking-container {
            max-width: 600px;
            width: 90%;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            margin: 20px;
            backdrop-filter: blur(10px);
            text-align: center;
        }

        #matchmakingScreen h1 {
            font-size: clamp(2.5rem, 8vw, 3.5rem);
            margin-bottom: 20px;
            color: white;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }

        #matchmakingScreen h2 {
            font-size: clamp(1.5rem, 5vw, 2rem);
            margin-bottom: 20px;
            color: #3498db;
        }

        .player-info-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 15px;
            padding: 15px;
            margin: 15px 0;
            text-align: center;
        }

        .player-info-card h3 {
            color: #3498db;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }

        #playerIdDisplay {
            font-family: monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 8px;
            border-radius: 8px;
            font-size: 1rem;
            word-break: break-all;
            color: #fff;
            margin: 8px 0;
        }

        .searching-dots {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
        }

        .searching-dots .dot {
            width: 16px;
            height: 16px;
            background: #2ecc71;
            border-radius: 50%;
            animation: searching 1.4s infinite;
        }

        .searching-dots .dot:nth-child(2) { animation-delay: 0.2s; }
        .searching-dots .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes searching {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
            30% { transform: translateY(-10px); opacity: 1; }
        }

        .matchmaking-option {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            margin: 15px 0;
            border: 2px solid transparent;
        }

        .matchmaking-option h3 {
            color: white;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }

        .matchmaking-option p {
            color: #ecf0f1;
            margin-bottom: 15px;
            opacity: 0.9;
        }

        .btn {
            padding: 15px 30px;
            font-size: 1.2rem;
            font-weight: bold;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s;
            margin: 8px;
            min-width: 200px;
        }

        .btn-primary {
            background: linear-gradient(to right, #2ecc71, #27ae60);
            color: white;
            box-shadow: 0 0 20px rgba(46, 204, 113, 0.5);
        }

        .btn-secondary {
            background: linear-gradient(to right, #e74c3c, #c0392b);
            color: white;
        }

        .btn:hover {
            transform: scale(1.05);
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
        }

        .room-creator {
            background: rgba(46, 204, 113, 0.2);
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            text-align: center;
        }

        .room-creator p {
            color: #2ecc71;
            font-weight: bold;
            font-size: 1rem;
        }

        #countdown {
            font-size: 2.5rem;
            font-weight: bold;
            color: #2ecc71;
            animation: pulse 1s infinite;
            display: inline-block;
            margin: 0 5px;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        .hidden {
            display: none !important;
        }

        /* Game Screen */
        #gameScreen {
            display: none;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a2980, #26d0ce);
            padding: 15px;
            overflow-y: auto;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 15px;
            padding: 15px;
        }

        .header h1 {
            font-size: clamp(1.5rem, 6vw, 2.2rem);
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            margin-bottom: 10px;
        }

        .player-turn {
            font-size: clamp(1.1rem, 4vw, 1.5rem);
            font-weight: bold;
            background: rgba(255, 255, 255, 0.2);
            padding: 10px 25px;
            border-radius: 50px;
            display: inline-block;
            margin-top: 8px;
        }

        .game-container {
            max-width: 1000px;
            margin: 0 auto 20px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .player-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 12px;
            background: rgba(52, 152, 219, 0.1);
            border-radius: 12px;
        }

        .player-info-item {
            text-align: center;
        }

        .player-info-item h3 {
            color: #2c3e50;
            margin-bottom: 5px;
            font-size: 1rem;
        }

        .player-info-item p {
            color: #3498db;
            font-size: 1.2rem;
            font-weight: bold;
        }

        .grids-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 20px 0;
        }

        @media (min-width: 768px) {
            .grids-container {
                flex-direction: row;
                justify-content: center;
                gap: 30px;
            }
        }

        .grid-wrapper {
            text-align: center;
        }

        .grid-wrapper h3 {
            color: #34495e;
            margin-bottom: 10px;
            font-size: 1.2rem;
            font-weight: bold;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            grid-template-rows: repeat(10, 1fr);
            gap: 1px;
            width: min(95vw, 300px);
            height: min(95vw, 300px);
            border: 3px solid #2c3e50;
            background-color: #3498db;
            margin: 0 auto;
        }

        .cell {
            background-color: #ecf0f1;
            border: 1px solid #bdc3c7;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            user-select: none;
            position: relative;
        }

        .cell:hover {
            background-color: #d6eaf8;
        }

        .cell.hit::after {
            content: "💥";
            font-size: 1.3rem;
            animation: hitEffect 0.5s;
        }

        .cell.miss::after {
            content: "●";
            color: #7f8c8d;
            font-size: 1.3rem;
            animation: missEffect 0.5s;
        }

        .cell.ship {
            background-color: #2c3e50;
        }

        .cell.ship.hit {
            background-color: #c0392b;
        }

        @keyframes hitEffect {
            0% { transform: scale(0); }
            70% { transform: scale(1.5); }
            100% { transform: scale(1); }
        }

        @keyframes missEffect {
            0% { transform: scale(0); }
            100% { transform: scale(1); }
        }

        .controls {
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background: rgba(236, 240, 241, 0.9);
            border-radius: 12px;
        }

        .controls h3 {
            color: #2c3e50;
            margin-bottom: 12px;
            font-size: 1.2rem;
        }

        .control-buttons {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .ship-status {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 15px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
        }

        .ship-status-item {
            background: #ecf0f1;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .ship-status-item.sunk {
            background: #e74c3c;
            color: white;
        }

        .chat-container {
            margin-top: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 12px;
            padding: 15px;
        }

        .chat-messages {
            height: 120px;
            overflow-y: auto;
            margin-bottom: 12px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #ddd;
        }

        .message {
            margin-bottom: 6px;
            padding: 4px;
            border-radius: 4px;
        }

        .chat-input {
            display: flex;
            gap: 8px;
        }

        .chat-input input {
            flex: 1;
            padding: 10px;
            border: 2px solid #3498db;
            border-radius: 8px;
            font-size: 0.9rem;
        }

        /* Game Over Overlay */
        .game-over-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            text-align: center;
            padding: 20px;
        }

        .game-over-content {
            max-width: 500px;
            width: 90%;
            background: linear-gradient(135deg, #1a2980, #26d0ce);
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 0 40px rgba(46, 204, 113, 0.5);
        }

        @media (max-width: 768px) {
            .grid {
                width: min(95vw, 280px);
                height: min(95vw, 280px);
            }
            
            .btn {
                padding: 12px 25px;
                font-size: 1rem;
                min-width: 180px;
            }
            
            .player-info {
                flex-direction: column;
                gap: 12px;
            }
        }
    </style>
    <!-- Back4App Parse SDK -->
    <script src="https://npmcdn.com/parse/dist/parse.min.js"></script>
</head>
<body>
    <!-- Matchmaking Screen -->
    <div id="matchmakingScreen">
        <div class="matchmaking-container">
            <h1>🌐 ONLINE BATTLE</h1>
            
            <!-- Player Info -->
            <div class="player-info-card">
                <h3>Your Player ID:</h3>
                <p id="playerIdDisplay">Loading...</p>
            </div>
            
            <!-- Matchmaking Status -->
            <h2 id="matchmakingStatus">Ready to Battle?</h2>
            
            <div class="searching-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
            
            <!-- Quick Match -->
            <div id="quickMatch" class="matchmaking-option">
                <h3>⚡ Quick Match</h3>
                <p>Find a random opponent instantly</p>
                <button class="btn btn-primary" onclick="startQuickMatch()" id="findBtn">
                    🔍 Find Match
                </button>
            </div>
            
            <!-- Room Status -->
            <div id="queueStatus" class="hidden">
                <h3>🔍 Creating game room...</h3>
                <p>Please wait...</p>
            </div>
            
            <div id="roomStatus" class="hidden">
                <div class="room-creator">
                    <h3>✅ Room Created!</h3>
                    <p>Share this ID with a friend:</p>
                    <h2 id="roomId">---</h2>
                    <p>Waiting for opponent...</p>
                </div>
            </div>
            
            <div id="foundOpponent" class="hidden">
                <h3>🎮 Opponent Found!</h3>
                <p>Starting game in <span id="countdown">3</span></p>
                <div class="room-creator">
                    <p>Playing against: <span id="roomCreator">Opponent</span></p>
                </div>
            </div>
            
            <!-- Control Buttons -->
            <div class="control-buttons" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="cancelMatchmaking()" id="cancelBtn" class="hidden">
                    ❌ Cancel
                </button>
                <button class="btn btn-secondary" onclick="exitToMenu()">
                    🏠 Exit to Menu
                </button>
            </div>
        </div>
    </div>

    <!-- Game Screen -->
    <div id="gameScreen">
        <div class="header">
            <h1>🚢 ONLINE BATTLE</h1>
            <div class="player-turn" id="turnIndicator">Setting up game...</div>
        </div>

        <div class="game-container">
            <!-- Player Info -->
            <div class="player-info">
                <div class="player-info-item">
                    <h3>You</h3>
                    <p id="playerName">Player 1</p>
                </div>
                <div class="player-info-item">
                    <h3>VS</h3>
                    <p style="color: #e74c3c;">ONLINE</p>
                </div>
                <div class="player-info-item">
                    <h3>Opponent</h3>
                    <p id="opponentName">Waiting...</p>
                </div>
            </div>

            <!-- Game Grids -->
            <div class="grids-container">
                <div class="grid-wrapper">
                    <h3>Your Fleet</h3>
                    <div class="grid" id="playerGrid"></div>
                </div>
                <div class="grid-wrapper">
                    <h3>Attack Enemy</h3>
                    <div class="grid" id="attackGrid"></div>
                </div>
            </div>

            <!-- Controls -->
            <div class="controls">
                <h3>Game Controls</h3>
                <div class="control-buttons">
                    <button class="btn btn-secondary" onclick="surrenderGame()">
                        🏳️ Surrender
                    </button>
                    <button class="btn btn-secondary" onclick="exitGame()">
                        🚪 Exit Game
                    </button>
                </div>
            </div>

            <!-- Ship Status -->
            <div class="ship-status" id="shipStatus">
                <div class="ship-status-item">🚢 Carrier (0/5)</div>
                <div class="ship-status-item">🚢 Battleship (0/4)</div>
                <div class="ship-status-item">🚢 Cruiser (0/3)</div>
                <div class="ship-status-item">🚢 Submarine (0/3)</div>
                <div class="ship-status-item">🚢 Destroyer (0/2)</div>
            </div>

            <!-- Simple Chat -->
            <div class="chat-container">
                <h3>💬 Quick Chat</h3>
                <div class="chat-messages" id="chatMessages">
                    <div class="message"><strong>System:</strong> Welcome to Battleship!</div>
                </div>
                <div class="chat-input">
                    <input type="text" id="chatInput" placeholder="Type a message..." 
                           onkeypress="if(event.key === 'Enter') sendChatMessage()">
                    <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Game Over Overlay -->
    <div id="gameOverOverlay" class="game-over-overlay">
        <div class="game-over-content">
            <h1 id="gameOverTitle" style="font-size: 2.5rem; margin-bottom: 15px; color: #2ecc71;">VICTORY!</h1>
            <p id="gameOverMessage" style="font-size: 1.3rem; margin-bottom: 25px;">Thanks for playing!</p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button id="rematchBtn" style="
                    padding: 12px 25px;
                    font-size: 1.1rem;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Play Again</button>
                <button id="menuBtn" style="
                    padding: 12px 25px;
                    font-size: 1.1rem;
                    background: #95a5a6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Main Menu</button>
            </div>
        </div>
    </div>

    <!-- Backend Logic -->
    <script src="backend.js"></script>
    
    <script>
        // Frontend functions
        function startQuickMatch() {
            onlineBackend.startMatchmaking();
            document.getElementById('findBtn').classList.add('hidden');
            document.getElementById('cancelBtn').classList.remove('hidden');
            document.getElementById('queueStatus').classList.remove('hidden');
            document.getElementById('quickMatch').classList.add('hidden');
        }
        
        function cancelMatchmaking() {
            onlineBackend.cancelMatchmaking();
            document.getElementById('findBtn').classList.remove('hidden');
            document.getElementById('cancelBtn').classList.add('hidden');
            document.getElementById('queueStatus').classList.add('hidden');
            document.getElementById('roomStatus').classList.add('hidden');
            document.getElementById('foundOpponent').classList.add('hidden');
            document.getElementById('quickMatch').classList.remove('hidden');
        }
        
        function exitToMenu() {
            if (confirm('Return to main menu?')) {
                onlineBackend.cleanup();
                window.location.href = '../index.html';
            }
        }
        
        function surrenderGame() {
            if (confirm('Are you sure you want to surrender?')) {
                onlineBackend.surrenderGame();
            }
        }
        
        function exitGame() {
            if (confirm('Exit this game?')) {
                onlineBackend.leaveGame();
            }
        }
        
        function sendChatMessage() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (message) {
                onlineBackend.sendChatMessage(message);
                input.value = '';
            }
        }
        
        // Handle Enter key in chat
        document.getElementById('chatInput')?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        
        // Game over overlay handlers
        document.getElementById('rematchBtn').onclick = function() {
            document.getElementById('gameOverOverlay').style.display = 'none';
            onlineBackend.rematch();
        };
        
        document.getElementById('menuBtn').onclick = function() {
            window.location.href = '../index.html';
        };
        
        // Custom game over display
        window.showGameOver = function(message, isWin) {
            const overlay = document.getElementById('gameOverOverlay');
            const title = document.getElementById('gameOverTitle');
            const messageEl = document.getElementById('gameOverMessage');
            
            title.textContent = isWin ? '🎉 VICTORY! 🎉' : '💀 DEFEAT! 💀';
            title.style.color = isWin ? '#2ecc71' : '#e74c3c';
            messageEl.textContent = message;
            
            overlay.style.display = 'flex';
        };
        
        // Initialize when page loads
        window.onload = function() {
            onlineBackend.initialize();
        };
    </script>
</body>
</html>
