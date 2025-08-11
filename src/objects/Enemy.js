import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Enemy {
  constructor(scene, position, level) {
    this.object = makeEnemyMesh();
    this.object.position.copy(position);
    this.velocity = new THREE.Vector3();
    this.speed = 3.5 + Math.min(level * 0.3, 3);
    this.health = 2 + Math.floor(level * 0.4);
    this.isDead = false;
    this.knockTimer = 0;

    scene.add(this.object);
  }

  update(dt, targetPos) {
    if (this.isDead) return;

    // steer toward player
    const desired = targetPos.clone().sub(this.object.position).setY(0);
    const dist = desired.length();
    if (dist > 0.0001) desired.normalize().multiplyScalar(this.speed);
    // wobble
    desired.x += Math.sin(performance.now() * 0.002 + this.object.position.z) * 0.6;
    desired.z += Math.cos(performance.now() * 0.0018 + this.object.position.x) * 0.6;

    if (this.knockTimer > 0) {
      this.knockTimer -= dt;
    } else {
      this.velocity.lerp(desired, 1 - Math.pow(0.0001, dt * 4));
    }

    this.object.position.addScaledVector(this.velocity, dt);

    // face movement
    const forward = this.velocity.clone().setY(0);
    if (forward.lengthSq() > 0.001) this.object.lookAt(this.object.position.clone().add(forward));
  }

  applyDamage(dmg) {
    if (this.isDead) return false;
    this.health -= dmg;
    if (this.health <= 0) {
      this.isDead = true;
    }
    return this.isDead;
  }

  knockback(sourcePos, force) {
    const dir = this.object.position.clone().sub(sourcePos).setY(0).normalize();
    this.velocity.addScaledVector(dir, force);
    this.knockTimer = 0.2;
  }

  dispose(scene) { scene.remove(this.object); }
}

function makeEnemyMesh() {
  const group = new THREE.Group();
  const ufoBase = new THREE.TorusGeometry(0.7, 0.18, 12, 24);
  const ufoMat = new THREE.MeshStandardMaterial({ color: 0x9a7aff, metalness: 0.8, roughness: 0.35, emissive: 0x331166, emissiveIntensity: 0.6 });
  const base = new THREE.Mesh(ufoBase, ufoMat);
  base.rotation.x = Math.PI / 2;
  group.add(base);

  const dome = new THREE.SphereGeometry(0.38, 16, 16);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xa6ffea, metalness: 0.1, roughness: 0.9, emissive: 0x113344, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
  const bubble = new THREE.Mesh(dome, domeMat);
  bubble.position.y = 0.3;
  group.add(bubble);

  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}