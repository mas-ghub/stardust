export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._musicInterval = null;
  }

  initOnGesture() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  }

  _bleep({ type = 'square', freq = 440, attack = 0.005, decay = 0.12, gain = 0.4, detune = 0 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detune) osc.detune.setValueAtTime(detune, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.connect(env).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + attack + decay + 0.02);
  }

  playLaser() {
    this._bleep({ type: 'square', freq: 720, attack: 0.004, decay: 0.09, gain: 0.35, detune: 20 });
  }
  playExplosion() {
    // noise burst + low sine
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // noise
    const bufferSize = 0.2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.7, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    noise.connect(nEnv).connect(this.sfxGain);
    noise.start(now);

    // low thump
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(env).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }
  playPickup() {
    this._bleep({ type: 'triangle', freq: 880, attack: 0.004, decay: 0.2, gain: 0.3 });
  }
  playHit() {
    this._bleep({ type: 'sawtooth', freq: 300, attack: 0.002, decay: 0.1, gain: 0.25 });
  }

  startMusic() {
    if (!this.ctx) return;
    if (this._musicInterval) return;
    // Simple arpeggio loop
    const notes = [261.63, 329.63, 392.0, 523.25];
    let step = 0;
    const tick = () => {
      const freq = notes[step % notes.length];
      step++;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.15, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(env).connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.25);
    };
    this._musicInterval = setInterval(tick, 280);
  }

  stopMusic() {
    if (this._musicInterval) {
      clearInterval(this._musicInterval);
      this._musicInterval = null;
    }
  }
}