import * as THREE from 'three';

// ---------- basic setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11141c);
scene.fog = new THREE.Fog(0x11141c, 20, 90);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
const sun = new THREE.DirectionalLight(0xffeecc, 1.1);
sun.position.set(20, 40, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- map: rooftops connected by planks ----------
const platforms = [
  { x: 0, z: 0, w: 10, d: 10, y: 0, color: 0x555b66 },     // spawn roof
  { x: 0, z: 13, w: 8, d: 8, y: 1, color: 0x555b66 },      // north roof
  { x: 0, z: 7, w: 1.5, d: 4, y: 0.5, color: 0x3d4148 },   // plank -> north
  { x: 12, z: 5, w: 6, d: 6, y: 2, color: 0x555b66 },      // east roof
  { x: 7, z: 2.5, w: 4, d: 1.5, y: 1, color: 0x3d4148 },   // plank -> east
  { x: -12, z: 5, w: 6, d: 6, y: 1.5, color: 0x555b66 },   // west roof
  { x: -7, z: 2.5, w: 4, d: 1.5, y: 0.75, color: 0x3d4148 }, // plank -> west
  { x: 0, z: -15, w: 14, d: 14, y: 0, color: 0x4a2f2f },   // monster arena
  { x: 0, z: -7, w: 1.5, d: 4, y: 0, color: 0x3d4148 },    // plank -> arena
];

const platformMeshes = [];
for (const p of platforms) {
  const geo = new THREE.BoxGeometry(p.w, 0.6, p.d);
  const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.x, p.y - 0.3, p.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
  platformMeshes.push(mesh);
}

function groundHeightAt(x, z) {
  let best = -Infinity;
  for (const p of platforms) {
    if (x >= p.x - p.w / 2 && x <= p.x + p.w / 2 && z >= p.z - p.d / 2 && z <= p.z + p.d / 2) {
      if (p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? null : best;
}

// ---------- rounded gingerbread-outline character ----------
function makeStickman(color = 0x111111) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), mat);
  head.position.y = 1.58;
  g.add(head);

  // rounded capsule torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 6, 12), mat);
  torso.position.y = 1.05;
  g.add(torso);

  // arms hang slightly away from the body, like the reference sketch
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.55, 4, 8);
  const armL = new THREE.Mesh(armGeo, mat);
  armL.position.set(-0.44, 1.05, 0);
  armL.rotation.z = 0.22;
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, mat);
  armR.position.set(0.44, 1.05, 0);
  armR.rotation.z = -0.22;
  g.add(armR);

  // legs spread apart slightly, rounded feet
  const legGeo = new THREE.CapsuleGeometry(0.13, 0.55, 4, 8);
  const legL = new THREE.Mesh(legGeo, mat);
  legL.position.set(-0.17, 0.32, 0);
  legL.rotation.z = 0.1;
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, mat);
  legR.position.set(0.17, 0.32, 0);
  legR.rotation.z = -0.1;
  g.add(legR);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ---------- monster (medium-size) ----------
function makeMonster() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.7, emissive: 0x220000 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 20), mat);
  body.position.y = 1.4;
  body.scale.set(1, 1.3, 1);
  g.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffcc00, emissiveIntensity: 2 });
  for (const sx of [-0.4, 0.4]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
    eye.position.set(sx, 1.9, 0.85);
    g.add(eye);
  }
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), mat);
    spike.position.set(0, 2.1, -0.3 + i * 0.15);
    spike.position.x = -0.4 + i * 0.2;
    spike.rotation.x = -0.3;
    g.add(spike);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const monsterMesh = makeMonster();
scene.add(monsterMesh);
let monsterAlive = true;

// ---------- local player state ----------
const SPAWN = { x: 0, y: 1.6, z: 0 };
const player = {
  x: SPAWN.x, y: SPAWN.y, z: SPAWN.z,
  vy: 0, yaw: 0, pitch: 0,
  onGround: true, hp: 100, alive: true,
  weapon: 'pistol',
  thirdPerson: false,
};
const selfMesh = makeStickman(0x1a3a6b);
selfMesh.visible = false; // shown only in third person
scene.add(selfMesh);

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Digit1') setWeapon('pistol');
  if (e.code === 'Digit2') setWeapon('bow');
  if (e.code === 'KeyV') toggleView();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function setWeapon(w) {
  player.weapon = w;
  document.getElementById('weapon-label').textContent = w === 'pistol' ? '🔫 Laser Pistol' : '🪠 Plunger Bow';
  document.getElementById('btn-weapon-pistol')?.classList.toggle('active', w === 'pistol');
  document.getElementById('btn-weapon-bow')?.classList.toggle('active', w === 'bow');
}

function toggleView() {
  player.thirdPerson = !player.thirdPerson;
  selfMesh.visible = player.thirdPerson;
}

// ---------- touch device detection ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');

// ---------- start / pointer lock (desktop) ----------
const blocker = document.getElementById('blocker');
let started = false;
blocker.addEventListener('click', () => {
  started = true;
  if (isTouch) {
    blocker.style.display = 'none';
  } else {
    renderer.domElement.requestPointerLock();
  }
});
document.addEventListener('pointerlockchange', () => {
  if (isTouch) return;
  blocker.style.display = document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
});

// ---------- shooting ----------
let lastShot = 0;
document.addEventListener('mousedown', (e) => {
  if (isTouch) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  if (e.button !== 0) return;
  shoot();
});

const tracerGroup = new THREE.Group();
scene.add(tracerGroup);

function shoot() {
  const now = performance.now();
  const cooldown = player.weapon === 'pistol' ? 260 : 650;
  if (now - lastShot < cooldown || !player.alive) return;
  lastShot = now;

  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  socket.emit('shoot', {
    weapon: player.weapon,
    origin: [origin.x, origin.y, origin.z],
    dir: [dir.x, dir.y, dir.z],
  });

  drawTracer(origin, dir, player.weapon);
}

function drawTracer(origin, dir, weapon) {
  const end = origin.clone().add(dir.clone().multiplyScalar(40));
  const color = weapon === 'pistol' ? 0xff2222 : 0x8b5a2b;
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true });
  const line = new THREE.Line(geo, mat);
  tracerGroup.add(line);
  const start = performance.now();
  const fade = () => {
    const t = (performance.now() - start) / 150;
    if (t >= 1) { tracerGroup.remove(line); return; }
    mat.opacity = 1 - t;
    requestAnimationFrame(fade);
  };
  fade();
}

function otherShotTracer({ origin, dir }) {
  drawTracer(new THREE.Vector3(...origin), new THREE.Vector3(...dir), 'other');
}

// ---------- touch controls ----------
const touchMove = { x: 0, z: 0 };
let touchJump = false;

if (isTouch) {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickStick = document.getElementById('joystick-stick');
  const lookZone = document.getElementById('look-zone');
  const btnJump = document.getElementById('btn-jump');
  const btnShoot = document.getElementById('btn-shoot');
  const btnWeaponPistol = document.getElementById('btn-weapon-pistol');
  const btnWeaponBow = document.getElementById('btn-weapon-bow');
  const btnView = document.getElementById('btn-view');

  const JOY_RADIUS = 55;
  let joystickId = null;
  let joystickOrigin = { x: 0, y: 0 };
  let lookId = null;
  let lookLast = { x: 0, y: 0 };

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickId !== null) return;
    const t = e.changedTouches[0];
    joystickId = t.identifier;
    const rect = joystickZone.getBoundingClientRect();
    joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickId) {
        let dx = t.clientX - joystickOrigin.x;
        let dy = t.clientY - joystickOrigin.y;
        const mag = Math.hypot(dx, dy);
        if (mag > JOY_RADIUS) { dx = (dx / mag) * JOY_RADIUS; dy = (dy / mag) * JOY_RADIUS; }
        joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
        touchMove.x = dx / JOY_RADIUS;
        touchMove.z = dy / JOY_RADIUS;
      } else if (t.identifier === lookId) {
        const dx = t.clientX - lookLast.x;
        const dy = t.clientY - lookLast.y;
        player.yaw -= dx * 0.004;
        player.pitch -= dy * 0.004;
        player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickId) {
        joystickId = null;
        touchMove.x = 0; touchMove.z = 0;
        joystickStick.style.transform = 'translate(0px, 0px)';
      } else if (t.identifier === lookId) {
        lookId = null;
      }
    }
  }
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  lookZone.addEventListener('touchstart', (e) => {
    if (!started) return;
    const t = e.changedTouches[0];
    if (lookId !== null) return;
    lookId = t.identifier;
    lookLast = { x: t.clientX, y: t.clientY };
  }, { passive: false });

  btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); touchJump = true; }, { passive: false });
  btnJump.addEventListener('touchend', (e) => { e.preventDefault(); touchJump = false; });

  btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); }, { passive: false });

  btnWeaponPistol.addEventListener('touchstart', (e) => { e.preventDefault(); setWeapon('pistol'); }, { passive: false });
  btnWeaponBow.addEventListener('touchstart', (e) => { e.preventDefault(); setWeapon('bow'); }, { passive: false });
  btnView.addEventListener('touchstart', (e) => { e.preventDefault(); toggleView(); }, { passive: false });
}

// ---------- networking ----------
const socket = io();
const otherPlayers = new Map(); // id -> { mesh, target:{x,y,z,ry} }

socket.on('state', (data) => {
  const seen = new Set();
  for (const p of data.players) {
    if (p.id === socket.id) continue;
    seen.add(p.id);
    let entry = otherPlayers.get(p.id);
    if (!entry) {
      const mesh = makeStickman(0x2b2b2b);
      scene.add(mesh);
      entry = { mesh, target: { x: p.x, y: p.y, z: p.z, ry: p.ry } };
      otherPlayers.set(p.id, entry);
    }
    entry.target.x = p.x; entry.target.y = p.y; entry.target.z = p.z; entry.target.ry = p.ry;
  }
  for (const [id, entry] of otherPlayers) {
    if (!seen.has(id)) { scene.remove(entry.mesh); otherPlayers.delete(id); }
  }

  monsterMesh.position.set(data.monster.x, data.monster.y - 1.6, data.monster.z);
  document.getElementById('monster-bar-fg').style.width = (100 * data.monster.hp / data.monster.maxHp) + '%';
  if (data.monster.alive !== monsterAlive) {
    monsterAlive = data.monster.alive;
    monsterMesh.visible = monsterAlive;
  }
});

socket.on('shotFired', (d) => { if (d.playerId !== socket.id) otherShotTracer(d); });

socket.on('monsterHit', () => {});
socket.on('monsterDied', () => { monsterMesh.visible = false; });
socket.on('monsterRespawned', () => { monsterMesh.visible = true; });

socket.on('youWereHit', ({ hp }) => updateHp(hp));
socket.on('playerHpChanged', ({ id, hp }) => { /* other players' hp not shown for now */ });
socket.on('youDied', () => {
  player.alive = false;
  document.getElementById('death-msg').style.display = 'block';
});
socket.on('youRespawned', ({ x, y, z, hp }) => {
  player.x = x; player.y = y; player.z = z; player.vy = 0; player.alive = true;
  updateHp(hp);
  document.getElementById('death-msg').style.display = 'none';
});

function updateHp(hp) {
  player.hp = hp;
  document.getElementById('hp-text').textContent = hp;
  document.getElementById('hp-bar-fg').style.width = hp + '%';
}

// ---------- movement / collision ----------
const GRAVITY = -20;
const SPEED = 5.5;
const JUMP_V = 7.2;

function updateMovement(dt) {
  if (!player.alive) return;

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).negate();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let moveX = 0, moveZ = 0;
  if (keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
  if (keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
  if (keys['KeyA']) { moveX -= right.x; moveZ -= right.z; }
  if (keys['KeyD']) { moveX += right.x; moveZ += right.z; }

  if (touchMove.x !== 0 || touchMove.z !== 0) {
    moveX += forward.x * -touchMove.z + right.x * touchMove.x;
    moveZ += forward.z * -touchMove.z + right.z * touchMove.x;
  }

  const len = Math.hypot(moveX, moveZ);
  if (len > 0) { moveX /= len; moveZ /= len; }

  player.x += moveX * SPEED * dt;
  player.z += moveZ * SPEED * dt;

  const ground = groundHeightAt(player.x, player.z);
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  if (ground !== null && player.y <= ground + 1.6) {
    player.y = ground + 1.6;
    player.vy = 0;
    player.onGround = true;
    if (keys['Space'] || touchJump) { player.vy = JUMP_V; player.onGround = false; }
  } else {
    player.onGround = false;
  }

  if (player.y < -25) {
    player.x = SPAWN.x; player.y = SPAWN.y; player.z = SPAWN.z; player.vy = 0;
  }
}

let lastNetSend = 0;
function sendNetworkState(now) {
  if (now - lastNetSend < 60) return;
  lastNetSend = now;
  socket.emit('input', { x: player.x, y: player.y, z: player.z, ry: player.yaw, weapon: player.weapon });
}

// ---------- render loop ----------
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  updateMovement(dt);

  selfMesh.position.set(player.x, player.y - 1.6, player.z);
  selfMesh.rotation.y = player.yaw;

  if (player.thirdPerson) {
    const back = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(4.5);
    camera.position.set(player.x + back.x, player.y + 1.6, player.z + back.z);
    camera.lookAt(player.x, player.y, player.z);
  } else {
    camera.position.set(player.x, player.y, player.z);
    const dir = new THREE.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch)
    );
    camera.lookAt(camera.position.clone().add(dir));
  }

  for (const entry of otherPlayers.values()) {
    entry.mesh.position.set(entry.target.x, entry.target.y - 1.6, entry.target.z);
    entry.mesh.rotation.y = entry.target.ry;
  }

  sendNetworkState(now);
  renderer.render(scene, camera);
}
animate();
