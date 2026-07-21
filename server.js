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
  res.json({ status: 'ok', players: players.size });
});

const players = new Map(); // id -> {id,name,x,y,z,ry,hp,weapon}
const MONSTER_SPAWN = { x: 0, y: 1.6, z: -10 };
const monster = {
  x: MONSTER_SPAWN.x, y: MONSTER_SPAWN.y, z: MONSTER_SPAWN.z,
  hp: 300, maxHp: 300, alive: true, respawnAt: 0,
  target: null, lastAttack: 0,
};

const SPAWN_POINTS = [
  { x: 0, y: 1.6, z: 0 },
  { x: 3, y: 1.6, z: 2 },
  { x: -3, y: 1.6, z: 2 },
  { x: 0, y: 1.6, z: 5 },
];

function randomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

io.on('connection', (socket) => {
  const spawn = randomSpawn();
  players.set(socket.id, {
    id: socket.id,
    name: 'Player',
    x: spawn.x, y: spawn.y, z: spawn.z,
    ry: 0, hp: 100, maxHp: 100, weapon: 'pistol',
    alive: true,
  });

  socket.on('input', (state) => {
    const p = players.get(socket.id);
    if (!p || !p.alive) return;
    if (typeof state?.x === 'number') p.x = state.x;
    if (typeof state?.y === 'number') p.y = state.y;
    if (typeof state?.z === 'number') p.z = state.z;
    if (typeof state?.ry === 'number') p.ry = state.ry;
    if (typeof state?.weapon === 'string') p.weapon = state.weapon;
  });

  socket.on('shoot', ({ weapon, origin, dir }) => {
    const p = players.get(socket.id);
    if (!p || !p.alive) return;
    if (!Array.isArray(origin) || !Array.isArray(dir)) return;

    io.emit('shotFired', { playerId: socket.id, weapon, origin, dir });

    if (!monster.alive) return;

    // distance from monster center to the ray
    const ox = origin[0], oy = origin[1], oz = origin[2];
    const dx = dir[0], dy = dir[1], dz = dir[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ndx = dx / len, ndy = dy / len, ndz = dz / len;

    const mx = monster.x - ox, my = monster.y - oy, mz = monster.z - oz;
    const t = mx * ndx + my * ndy + mz * ndz;
    if (t < 0 || t > 60) return;

    const closestX = ox + ndx * t, closestY = oy + ndy * t, closestZ = oz + ndz * t;
    const dist = Math.hypot(monster.x - closestX, monster.y - closestY, monster.z - closestZ);

    const MONSTER_RADIUS = 1.6;
    if (dist <= MONSTER_RADIUS) {
      const damage = weapon === 'bow' ? 18 : 8;
      monster.hp = Math.max(0, monster.hp - damage);
      io.emit('monsterHit', { hp: monster.hp, by: socket.id });
      if (monster.hp <= 0) {
        monster.alive = false;
        monster.respawnAt = Date.now() + 6000;
        io.emit('monsterDied', {});
      }
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
  });
});

// server tick: monster AI + broadcast state
const TICK_MS = 50;
setInterval(() => {
  const now = Date.now();

  if (!monster.alive && now >= monster.respawnAt) {
    monster.hp = monster.maxHp;
    monster.x = MONSTER_SPAWN.x;
    monster.y = MONSTER_SPAWN.y;
    monster.z = MONSTER_SPAWN.z;
    monster.alive = true;
    io.emit('monsterRespawned', { x: monster.x, y: monster.y, z: monster.z, hp: monster.hp });
  }

  if (monster.alive) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - monster.x, p.z - monster.z);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }
    if (nearest) {
      const speed = 1.6 * (TICK_MS / 1000);
      const dx = nearest.x - monster.x, dz = nearest.z - monster.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 1.8) {
        monster.x += (dx / d) * speed;
        monster.z += (dz / d) * speed;
      } else if (now - monster.lastAttack > 1200) {
        monster.lastAttack = now;
        nearest.hp = Math.max(0, nearest.hp - 12);
        io.to(nearest.id).emit('youWereHit', { hp: nearest.hp });
        io.emit('playerHpChanged', { id: nearest.id, hp: nearest.hp });
        if (nearest.hp <= 0) {
          nearest.alive = false;
          io.to(nearest.id).emit('youDied', {});
          setTimeout(() => {
            const respawn = randomSpawn();
            nearest.x = respawn.x; nearest.y = respawn.y; nearest.z = respawn.z;
            nearest.hp = nearest.maxHp; nearest.alive = true;
            io.to(nearest.id).emit('youRespawned', { x: nearest.x, y: nearest.y, z: nearest.z, hp: nearest.hp });
          }, 3000);
        }
      }
    }
  }

  io.emit('state', {
    players: Array.from(players.values()),
    monster: { x: monster.x, y: monster.y, z: monster.z, hp: monster.hp, maxHp: monster.maxHp, alive: monster.alive },
  });
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`Stickmen Survival server listening on port ${PORT}`);
});
