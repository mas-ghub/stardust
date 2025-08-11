import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { InputManager } from '../core/Input.js';
import { Player } from '../objects/Player.js';
import { Enemy } from '../objects/Enemy.js';
import { ProjectilePool } from '../objects/Projectile.js';
import { Pickup } from '../objects/Pickup.js';
import { ParticleSystem } from '../objects/Particles.js';

export class GameScene {
  constructor(audio) {
    this.audio = audio;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
    this.camera.position.set(0, 12, 28);
    this.camera.lookAt(0, this.planetRadius || 12, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0b1224, 0.8);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(12, 18, 20);
    dir.castShadow = false;
    this.scene.add(dir);

    // World and planet
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.planetRadius = 12;
    const planetGeo = new THREE.SphereGeometry(this.planetRadius, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x0b1d3a, metalness: 0.15, roughness: 0.85, emissive: 0x06122b, emissiveIntensity: 0.35 });
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    this.planet.receiveShadow = true;
    this.world.add(this.planet);

    // Star dome
    const stars = makeStars(1200, 80);
    this.scene.add(stars);

    // Systems
    this.input = new InputManager(this.engine?.canvas || document.getElementById('game-canvas'));
    this.projectiles = new ProjectilePool(this.world, this.audio);
    this.particles = new ParticleSystem(this.world);

    // Entities
    this.player = new Player(this.scene, this.projectiles, this.audio);
    this.player.object.position.set(0, this.planetRadius + 0.5, 0);
    this.enemies = [];
    this.pickups = [];

    // Game state
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.spawnCooldown = 0;

    this._setupUI();
    this._spawnWave(this.level);
  }

  _setupUI() {
    const ui = this.engine.uiRoot;
    ui.innerHTML = '';
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
    const count = 4 + n * 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 10 + Math.random() * 2.5;
      const pos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const enemy = new Enemy(this.scene, pos, n);
      this.enemies.push(enemy);
    }
  }

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    // Fixed-screen player: rotate world around origin based on player yaw and thrust
    // Player update handles yaw and thrust inputs, and exposes its yaw and thrust state
    this.player.update(dt, this.input, this.enemies, this.camera);

    // Rotate world to simulate travel over the planet when thrusting
    const thrustVel = this.player.getThrustVelocityOnSphere?.(this.planetRadius) || new THREE.Vector3();
    if (thrustVel.lengthSq() > 0) {
      // Move enemies/pickups/projectiles by rotating the world around axis perpendicular to forward
      const angular = thrustVel.length() / this.planetRadius; // radians/sec
      // Axis is perpendicular to forward and radial up (Y+ in local at player point). Here approximated around XZ plane.
      const forward = this.player.getForwardXZ();
      const up = new THREE.Vector3(0, 1, 0);
      const axis = new THREE.Vector3().crossVectors(forward, up).normalize();
      this.world.rotateOnAxis(axis, -angular * dt);
    }

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
    if (this.enemies.length === 0 && this.pickups.length === 0) {
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

    // Static main camera framing the center; slight parallax on world rotation is enough
    this.camera.position.lerp(new THREE.Vector3(0, 12, 28), 1 - Math.pow(0.0001, dt));
    this.camera.lookAt(0, this.planetRadius, 0);

    // Particles
    this.particles.update(dt);
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

function makeStars(count, radius) {
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
  const mat = new THREE.PointsMaterial({ color: 0x9ad7ff, size: 0.05, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}