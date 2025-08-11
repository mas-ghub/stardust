import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.max = 600;
    this.particles = [];

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.sizes = new Float32Array(this.max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);
  }

  burst(position, count, color) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) break;
      const vel = new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random()) * 6, (Math.random() - 0.5) * 7);
      this.particles.push({ pos: position.clone(), vel, life: 0.8 + Math.random() * 0.5, age: 0, color });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.vel.y -= 9.8 * dt * 0.5; // gravity-ish
      p.pos.addScaledVector(p.vel, dt);
      if (p.age >= p.life) this.particles.splice(i, 1);
    }

    const n = this.particles.length;
    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      this.positions[i * 3 + 0] = p.pos.x;
      this.positions[i * 3 + 1] = p.pos.y;
      this.positions[i * 3 + 2] = p.pos.z;
      const t = 1 - p.age / p.life;
      const c = new THREE.Color(p.color).multiplyScalar(0.6 + 0.6 * t);
      this.colors[i * 3 + 0] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
      this.sizes[i] = 0.2 + t * 0.4;
    }
    // Clear rest
    for (let i = n; i < this.max; i++) {
      this.positions[i * 3 + 0] = 9999;
      this.positions[i * 3 + 1] = 9999;
      this.positions[i * 3 + 2] = 9999;
      this.sizes[i] = 0;
      this.colors[i * 3 + 0] = 0;
      this.colors[i * 3 + 1] = 0;
      this.colors[i * 3 + 2] = 0;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
  }
}