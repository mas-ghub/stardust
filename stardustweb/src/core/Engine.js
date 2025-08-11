import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Engine {
  constructor({ canvas, uiRoot }) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.buildId = new Date().toISOString().replace(/[:.]/g, '-');
    window.__engineBuildId = this.buildId;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.currentScene = null;
    this._boundLoop = this._loop.bind(this);
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._fixedDelta = 1 / 120; // fixed update for robust physics/input

    this.handleResize();
  }

  start(scene) {
    this.switchScene(scene);
    this._lastTime = performance.now();
    requestAnimationFrame(this._boundLoop);
  }

  switchScene(newScene) {
    if (this.currentScene) {
      this.currentScene.exit?.();
      // cleanup UI
      this.uiRoot.innerHTML = '';
    }
    this.currentScene = newScene;
    this.currentScene.engine = this;
    this.currentScene.enter?.();
    this.handleResize();
  }

  handleResize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    this.currentScene?.onResize?.(width, height, pixelRatio);
  }

  _loop(now) {
    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    // Fixed-step updates for stability
    this._accumulator += dt;
    while (this._accumulator >= this._fixedDelta) {
      this.currentScene?.update?.(this._fixedDelta);
      this._accumulator -= this._fixedDelta;
    }

    this.currentScene?.render?.(this.renderer);
    requestAnimationFrame(this._boundLoop);
  }
}