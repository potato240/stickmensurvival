const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: playerCount() });
});

const players = new Map();

function playerCount() {
  return players.size;
}

function broadcastPlayers() {
  io.emit('players', Array.from(players.values()));
}

io.on('connection', (socket) => {
  players.set(socket.id, {
    id: socket.id,
    x: Math.random() * 800,
    y: Math.random() * 600,
  });
  broadcastPlayers();

  socket.on('move', (pos) => {
    const player = players.get(socket.id);
    if (!player) return;
    if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
      player.x = pos.x;
      player.y = pos.y;
      broadcastPlayers();
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    broadcastPlayers();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Stickmen Survival server listening on port ${PORT}`);
});
