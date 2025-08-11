import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class ProjectilePool {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.pool = [];
    this.active = [];

    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa6ffea, emissive: 0x88ffee, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.4 });
    this.prototype = { geo, mat };
  }

  fire(origin, direction) {
    const mesh = this._getMesh();
    mesh.position.copy(origin).addScaledVector(direction, 0.8);
    // orient along direction in XZ plane
    const yaw = Math.atan2(direction.x, direction.z);
    mesh.rotation.set(0, yaw, 0);
    mesh.userData = { vel: direction.clone().setY(0).normalize().multiplyScalar(22), ttl: 1.6 };
    this.scene.add(mesh);
    this.active.push(mesh);
  }

  update(dt, enemies, onHit) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.ttl -= dt;

      // hit arena bounds
      if (p.position.length() > 15) p.userData.ttl = -1;

      // collisions
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.isDead) continue;
        const distSq = e.object.position.distanceToSquared(p.position);
        if (distSq < 0.9) {
          const died = e.applyDamage(1);
          p.userData.ttl = -1;
          onHit?.(e.object.position.clone());
          if (died) {
            enemies.splice(j, 1);
          }
          break;
        }
      }

      if (p.userData.ttl <= 0) {
        this._recycle(i);
      }
    }
  }

  _getMesh() {
    const mesh = this.pool.pop() || new THREE.Mesh(this.prototype.geo, this.prototype.mat.clone());
    mesh.castShadow = true;
    return mesh;
  }

  _recycle(index) {
    const [mesh] = this.active.splice(index, 1);
    if (!mesh) return;
    this.scene.remove(mesh);
    this.pool.push(mesh);
  }
}