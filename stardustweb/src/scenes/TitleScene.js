import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GameScene } from './GameScene.js';
import { AudioManager } from '../core/Audio.js';

export class TitleScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 2.6, 5);
    this.camera.lookAt(0, 0, 0);

    // simple background planet
    const planetGeo = new THREE.SphereGeometry(1.6, 48, 48);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x0a2a5a, metalness: 0.2, roughness: 0.9, emissive: 0x081830, emissiveIntensity: 0.3 });
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    this.scene.add(this.planet);

    // star field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xa6ffea, size: 0.04, sizeAttenuation: true });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0b1224, 0.6);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(3, 5, 2);
    this.scene.add(dir);

    this.audio = new AudioManager();
  }

  enter() {
    const ui = this.engine.uiRoot;
    ui.innerHTML = '';

    const center = document.createElement('div');
    center.className = 'center-overlay';
    center.innerHTML = `
      <div class="panel">
        <h1>Stardust Neo</h1>
        <p>An arcade space shooter for the browser.</p>
        <p>WASD / Arrow keys to move. Mouse to aim. Click to fire.</p>
        <div class="btn-row">
          <button class="button" id="start-btn">Play</button>
        </div>
      </div>`;
    ui.appendChild(center);

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Audio initialized';
    ui.appendChild(toast);

    const startBtn = center.querySelector('#start-btn');
    startBtn.addEventListener('click', () => {
      this.audio.initOnGesture();
      this.audio.startMusic();
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1000);
      this.engine.switchScene(new GameScene(this.audio));
    }, { once: true });
  }

  onResize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  update(dt) {
    this.planet.rotation.y += dt * 0.2;
    this.stars.rotation.y += dt * 0.03;
  }

  render(renderer) { renderer.render(this.scene, this.camera); }
  exit() { /* nothing to cleanup besides UI cleared by engine */ }
}