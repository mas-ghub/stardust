export class Debug {
  static _el = null;
  static _logEl = null;
  static _buffer = [];
  static _max = 200;

  static init(uiRoot) {
    if (this._el) return;
    const panel = document.createElement('div');
    panel.className = 'debug-panel';
    const buildId = (window.__engineBuildId || 'dev');
    panel.innerHTML = `
      <div class="debug-header">
        <span>Debug · ${buildId}</span>
        <div class="debug-buttons">
          <button id="dbg-copy" class="button">Copy</button>
          <button id="dbg-clear" class="button">Clear</button>
          <button id="dbg-hide" class="button">Hide</button>
        </div>
      </div>
      <pre id="dbg-log" class="debug-log"></pre>
    `;
    uiRoot.appendChild(panel);
    this._el = panel;
    this._logEl = panel.querySelector('#dbg-log');
    panel.querySelector('#dbg-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this._buffer.join('\n'));
      } catch (e) {
        // ignore
      }
    });
    panel.querySelector('#dbg-clear').addEventListener('click', () => {
      this._buffer.length = 0;
      this._render();
    });
    panel.querySelector('#dbg-hide').addEventListener('click', () => {
      panel.style.display = 'none';
      setTimeout(() => { panel.style.display = ''; }, 1000);
    });
  }

  static log(...args) {
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    this._buffer.push(line);
    if (this._buffer.length > this._max) this._buffer.splice(0, this._buffer.length - this._max);
    this._render();
  }

  static _render() {
    if (!this._logEl) return;
    this._logEl.textContent = this._buffer.join('\n');
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }
}

