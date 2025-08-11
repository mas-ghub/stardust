import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class ProjectilePool {
  constructor(scene, audio, planetRadius = 14) {
    this.scene = scene;
    this.audio = audio;
    this.planetRadius = planetRadius;
    this.pool = [];
    this.active = [];

    const geo = new THREE.CapsuleGeometry(0.08, 0.7, 6, 16);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xbff9ff,
      emissive: 0x77ffff,
      emissiveIntensity: 1.4,
      metalness: 0.3,
      roughness: 0.2,
      transmission: 0.2,
      thickness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2
    });
    this.prototype = { geo, mat };
  }

  fire(origin, direction) {
    const mesh = this._getMesh();
    mesh.position.copy(origin).addScaledVector(direction, 0.8);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.clone().normalize());
    mesh.userData = { vel: direction.clone().multiplyScalar(22), ttl: 1.6 };
    this.scene.add(mesh);
    this.active.push(mesh);
  }

  update(dt, enemies, onHit) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.ttl -= dt;

      // Despawn if far from the planet
      if (p.position.length() > this.planetRadius + 6) p.userData.ttl = -1;

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
            // Remove enemy object from scene when it dies
            e.dispose(this.scene);
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