import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { InputManager } from '../core/Input.js';
import { Player } from '../objects/Player.js';
import { Enemy } from '../objects/Enemy.js';
import { ProjectilePool } from '../objects/Projectile.js';
import { Pickup } from '../objects/Pickup.js';
import { ParticleSystem } from '../objects/Particles.js';
import { Debug } from '../core/Debug.js';

export class GameScene {
  constructor(audio) {
    this.audio = audio;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030710);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.camera.position.set(0, 18, 24);
    this.camera.lookAt(0, 0, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0b1224, 0.5);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(26, 36, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 5;
    dir.shadow.camera.far = 100;
    dir.shadow.camera.left = -40;
    dir.shadow.camera.right = 40;
    dir.shadow.camera.top = 40;
    dir.shadow.camera.bottom = -40;
    this.scene.add(dir);

    // Planet
    this.planetRadius = 13.5;
    this.surfaceRadius = this.planetRadius + 0.4;
    const planetGeo = new THREE.SphereGeometry(this.planetRadius, 192, 192);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x0b1d3a, metalness: 0.25, roughness: 0.9, emissive: 0x06122b, emissiveIntensity: 0.35 });
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    this.planet.receiveShadow = true;
    this.scene.add(this.planet);
    // Load a texture dynamically after scene is set
    new THREE.TextureLoader().load('https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1200&q=60', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      this.planet.material.map = tex;
      this.planet.material.bumpMap = tex;
      this.planet.material.bumpScale = 0.8;
      this.planet.material.needsUpdate = true;
    });
    const ambient = new THREE.AmbientLight(0x223344, 0.35);
    this.scene.add(ambient);

    // Star dome
    const stars = makeStars(1600, 120, true);
    this.scene.add(stars);

    // Systems
    this.input = new InputManager(this.engine?.canvas || document.getElementById('game-canvas'));
    this.projectiles = new ProjectilePool(this.scene, this.audio, this.surfaceRadius);
    this.particles = new ParticleSystem(this.scene);

    // Entities
    this.player = new Player(this.scene, this.projectiles, this.audio, this.surfaceRadius);
    this.enemies = [];
    this.pickups = [];

    // Game state
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.spawnCooldown = 0;

    this._spawnWave(this.level);
  }

  enter() {
    this._setupUI();
    Debug.init(this.engine.uiRoot);
  }

  _setupUI() {
    const ui = this.engine.uiRoot;
    // Clear only previous HUD elements, not the entire UI root
    ui.querySelectorAll('.hud, #level-banner').forEach(el => el.remove());
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="pill">Lives: <span id="lives">${this.lives}</span></div>
      <div class="pill score-anim" id="score-pill">Score: <span id="score">${this.score}</span></div>
      <div class="pill">Level: <span id="level">${this.level}</span></div>
    `;
    ui.appendChild(hud);

    const banner = document.createElement('div');
    banner.className = 'level-banner';
    banner.id = 'level-banner';
    banner.textContent = `LEVEL ${this.level}`;
    ui.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 40);
    setTimeout(() => banner.classList.remove('show'), 1500);

    this._scoreEl = hud.querySelector('#score');
    this._scorePill = hud.querySelector('#score-pill');
    this._livesEl = hud.querySelector('#lives');
    this._levelEl = hud.querySelector('#level');
  }

  _spawnWave(n) {
    const count = Math.max(1, 4 + n * 2);
    for (let i = 0; i < count; i++) {
      // Random point on the sphere not too close to the player
      let pos;
      for (;;) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u; // around Y
        const phi = Math.acos(2 * v - 1); // from +Y
        pos = new THREE.Vector3(
          this.surfaceRadius * Math.sin(phi) * Math.cos(theta),
          this.surfaceRadius * Math.cos(phi),
          this.surfaceRadius * Math.sin(phi) * Math.sin(theta)
        );
        if (i === 0) {
          // First enemy: in front of player for visibility
          const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.object.quaternion).normalize();
          pos = this.player.object.position.clone().addScaledVector(fwd, this.surfaceRadius * 0.3).setLength(this.surfaceRadius);
          break;
        }
        if (pos.distanceToSquared(this.player.object.position) > 25) break;
      }
      const enemy = new Enemy(this.scene, pos, n, this.surfaceRadius);
      this.enemies.push(enemy);
    }
  }

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    window.__engineCamera = this.camera;
    // Player input and update
    this.player.update(dt, this.input, this.enemies);

    // Projectiles
    this.projectiles.update(dt, this.enemies, (hitPos) => {
      this.particles.burst(hitPos, 26, 0xa6ffea);
      this.audio.playExplosion();
      // Chance to drop pickup
      if (Math.random() < 0.18) {
        const p = new Pickup(this.scene, hitPos.clone());
        this.pickups.push(p);
      }
      this._addScore(100);
    });

    // Visual trails
    // Projectile smoke trails
    for (const p of this.projectiles.active) {
      this.particles.trail(p.position, 0x88b4ff);
    }
    // Ship thruster trail (behind the player)
    {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.object.quaternion).normalize();
      const thrusterPos = this.player.object.position.clone().addScaledVector(forward, -0.7);
      this.particles.trail(thrusterPos, 0xffa040);
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.player.object.position);
      if (e.isDead) {
        e.dispose(this.scene);
        this.enemies.splice(i, 1);
      }
    }

    // Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt);
      if (p.object.position.distanceToSquared(this.player.object.position) < 0.8) {
        this.audio.playPickup();
        p.dispose(this.scene);
        this.pickups.splice(i, 1);
        this._addScore(250);
        this.player.empower();
      }
    }

    // Collisions: enemy with player
    for (const e of this.enemies) {
      if (e.object.position.distanceToSquared(this.player.object.position) < 1.4) {
        this._damagePlayer();
        // knock enemy
        e.knockback(this.player.object.position, 6);
      }
    }

    // Level progression
    if (this.enemies.length === 0) {
      // Clear leftover pickups so they don't block progression
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        this.pickups[i].dispose(this.scene);
      }
      this.pickups.length = 0;
      this.level++;
      this._levelEl.textContent = String(this.level);
      const banner = document.getElementById('level-banner');
      banner.textContent = `LEVEL ${this.level}`;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 1400);
      this._spawnWave(this.level);
      // Slight heal every level
      if (this.lives < 5) this._setLives(this.lives + 1);
    }

    // Camera subtle follow
    const target = this.player.object.position.clone();
    const normal = target.clone().normalize();
    // Camera rig constrained to local tangent frame (no flips). Follow at fixed offset in tangent frame.
    const tangentForward = this.player.forward.clone().normalize();
    const tangentRight = new THREE.Vector3().crossVectors(tangentForward, normal).normalize();
    // Offset: back along forward, up along normal, slight right bias to see side
    const camDesired = target.clone()
      .addScaledVector(normal, 7.0)
      .addScaledVector(tangentForward, -10.0)
      .addScaledVector(tangentRight, 1.2);
    this.camera.position.lerp(camDesired, 1 - Math.pow(0.0001, dt));
    this.camera.up.copy(normal);
    this.camera.lookAt(target);

    // Particles
    this.particles.update(dt);
    // Background shooting stars
    const bg = this.scene.children.find(o => o.userData && o.userData.update);
    bg?.userData.update?.(dt);
  }

  _addScore(amount) {
    this.score += amount;
    this._scoreEl.textContent = String(this.score);
    this._scorePill.classList.remove('bump');
    void this._scorePill.offsetWidth; // reflow to retrigger animation
    this._scorePill.classList.add('bump');
  }

  _setLives(val) {
    this.lives = Math.max(0, val);
    this._livesEl.textContent = String(this.lives);
  }

  _damagePlayer() {
    if (this.player.invulnerableTimer > 0) return;
    this.audio.playHit();
    this._setLives(this.lives - 1);
    this.player.hit();
    if (this.lives <= 0) {
      this._gameOver();
    }
  }

  _gameOver() {
    this.input.destroy();
    this.audio.stopMusic();
    const ui = this.engine.uiRoot;
    const center = document.createElement('div');
    center.className = 'center-overlay';
    center.innerHTML = `
      <div class="panel">
        <h1>Game Over</h1>
        <p>Your score: ${this.score}</p>
        <div class="btn-row">
          <button class="button" id="retry-btn">Retry</button>
          <button class="button" id="menu-btn">Menu</button>
        </div>
      </div>`;
    ui.appendChild(center);

    center.querySelector('#retry-btn').addEventListener('click', () => {
      this.engine.switchScene(new GameScene(this.audio));
    });
    center.querySelector('#menu-btn').addEventListener('click', () => {
      // Reload title without music running
      import('./TitleScene.js').then(({ TitleScene }) => {
        this.engine.switchScene(new TitleScene());
      });
    });
  }

  render(renderer) { renderer.render(this.scene, this.camera); }

  exit() {
    this.input.destroy();
    if (window.__engineCamera === this.camera) delete window.__engineCamera;
    // best-effort cleanup
  }
}

function makeStars(count, radius, useRoundSprites = false) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.7 + Math.random() * 0.3);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    pos[i * 3 + 0] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let mat;
  if (useRoundSprites) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(200,230,255,0.9)');
    grd.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    mat = new THREE.PointsMaterial({ size: 0.06, sizeAttenuation: true, transparent: true, depthWrite: false, map: tex, color: 0x9ad7ff });
  } else {
    mat = new THREE.PointsMaterial({ color: 0x9ad7ff, size: 0.05, sizeAttenuation: true });
  }
  const pts = new THREE.Points(geo, mat);
  // Shooting stars
  const trailCount = 12;
  const trails = new THREE.Group();
  for (let i = 0; i < trailCount; i++) {
    const p1 = new THREE.Vector3((Math.random()-0.5)*radius*2, (Math.random()-0.5)*radius*2, (Math.random()-0.5)*radius*2);
    const p2 = p1.clone().add(new THREE.Vector3(Math.random()*-20-10, Math.random()*-6-2, Math.random()*-20-10));
    const trailGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const trailMat = new THREE.LineBasicMaterial({ color: 0xa6ffea, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(trailGeo, trailMat);
    trails.add(line);
  }
  const group = new THREE.Group();
  group.add(pts);
  group.add(trails);
  // animate shooting stars slowly in update loop (hooked from scene update)
  group.userData.update = (dt) => {
    for (const line of trails.children) {
      line.position.x -= dt * 2.5;
      line.position.y -= dt * 0.8;
      line.position.z -= dt * 2.5;
      if (line.position.length() > radius*2) line.position.set(0,0,0);
    }
  };
  return group;
}