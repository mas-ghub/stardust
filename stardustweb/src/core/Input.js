export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keysDown = new Set();
    this.mouse = { x: 0, y: 0, isDown: false };

    this._keyDown = (e) => {
      this.keysDown.add(e.code);
      // UI debug logging disabled in Input; Player will log into Debug panel
    };
    this._keyUp = (e) => {
      this.keysDown.delete(e.code);
      // UI debug logging disabled in Input; Player will log into Debug panel
    };
    this._pointerMove = (e) => {
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    this._pointerDown = () => { this.mouse.isDown = true; };
    this._pointerUp = () => { this.mouse.isDown = false; };

    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);
    this.domElement.addEventListener('pointermove', this._pointerMove);
    this.domElement.addEventListener('pointerdown', this._pointerDown);
    window.addEventListener('pointerup', this._pointerUp);
  }

  destroy() {
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    this.domElement.removeEventListener('pointermove', this._pointerMove);
    this.domElement.removeEventListener('pointerdown', this._pointerDown);
    window.removeEventListener('pointerup', this._pointerUp);
  }

  getAxis() {
    const up = this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp');
    const down = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown');
    const left = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft');
    const right = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight');
    const x = (right ? 1 : 0) - (left ? 1 : 0);
    const y = (up ? 1 : 0) - (down ? 1 : 0);
    return { x, y };
  }
}