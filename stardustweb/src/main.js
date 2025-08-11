import { Engine } from './core/Engine.js';
import { TitleScene } from './scenes/TitleScene.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const engine = new Engine({ canvas, uiRoot });
engine.start(new TitleScene());

// Hot-reload friendly resize
window.addEventListener('resize', () => engine.handleResize());