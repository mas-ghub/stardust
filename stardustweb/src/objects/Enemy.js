import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Enemy {
  constructor(scene, position, level, planetRadius = 13.5) {
    this.object = makeEnemyMesh(level);
    this.object.position.copy(position);
    this.velocity = new THREE.Vector3();
    this.speed = 3.5 + Math.min(level * 0.3, 3);
    this.health = 2 + Math.floor(level * 0.4);
    this.isDead = false;
    this.knockTimer = 0;
    this.planetRadius = planetRadius;

    scene.add(this.object);
  }

  update(dt, targetPos) {
    if (this.isDead) return;

    // steer toward player along the surface
    const normal = this.object.position.clone().normalize();
    const toTarget = targetPos.clone().sub(this.object.position);
    // project onto tangent plane
    const desired = toTarget.addScaledVector(normal, -toTarget.dot(normal));
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

    // Move along sphere surface
    const move = this.velocity.clone().multiplyScalar(dt);
    const distance = move.length();
    if (distance > 0.00001) {
      const moveDir = move.normalize();
      const rotAxis = new THREE.Vector3().crossVectors(normal, moveDir).normalize();
      const angle = distance / this.planetRadius;
      this.object.position.applyAxisAngle(rotAxis, angle).setLength(this.planetRadius);
    }

    // Orient the enemy to hover above the surface: +Y = normal, +Z = velocity dir
    const forward = this.velocity.clone();
    if (forward.lengthSq() < 0.0001) forward.copy(desired);
    if (forward.lengthSq() > 0.0001) {
      const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
      const fwdOrtho = new THREE.Vector3().crossVectors(normal, right).normalize();
      const m = new THREE.Matrix4().makeBasis(right, normal, fwdOrtho);
      this.object.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.2);
      // Debugging orientation
      // console.log('[Enemy] pos=', this.object.position.toArray().map(v=>v.toFixed(3)), 'forward=', fwdOrtho.toArray().map(v=>v.toFixed(3)));
    }

    // (orientation handled above)
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
    const normal = this.object.position.clone().normalize();
    let dir = this.object.position.clone().sub(sourcePos);
    dir.addScaledVector(normal, -dir.dot(normal));
    dir.normalize();
    this.velocity.addScaledVector(dir, force);
    this.knockTimer = 0.2;
  }

  dispose(scene) { scene.remove(this.object); }
}

function makeEnemyMesh(level) {
  const group = new THREE.Group();
  const palette = [0x9a7aff, 0xff7a7a, 0x7aff9a, 0xffe38a];
  const emissivePalette = [0x331166, 0x661122, 0x115533, 0x664411];
  const idx = Math.min(palette.length - 1, Math.floor((level - 1) % palette.length));
  const baseColor = palette[idx];
  const emissiveColor = emissivePalette[idx];
  const ufoBase = new THREE.TorusGeometry(0.7 + Math.min(level * 0.02, 0.2), 0.18, 12, 24);
  const ufoMat = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.8, roughness: 0.35, emissive: emissiveColor, emissiveIntensity: 0.6 });
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