import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Player {
  constructor(scene, projectilePool, audio) {
    this.object = makeShipMesh();
    this.object.position.set(0, 0, 8);
    scene.add(this.object);

    this.speed = 10.5;
    this.accelRate = 24; // units per second^2 equivalent
    this.drag = 6; // damping when no input
    this.maxTurnRate = Math.PI * 3.5; // radians per second
    this.velocity = new THREE.Vector3();
    this.fireCooldown = 0;
    this.fireRate = 0.12; // seconds between shots
    this.power = 0; // increases spread and fire rate
    this.invulnerableTimer = 0;

    this.projectilePool = projectilePool;
    this.audio = audio;
  }

  update(dt, input, enemies, camera) {
    // Movement with acceleration and drag for steadier feel
    const axis = input.getAxis();
    const desiredVelocity = new THREE.Vector3(axis.x, 0, -axis.y).multiplyScalar(this.speed);
    const velocityDelta = desiredVelocity.clone().sub(this.velocity);
    const accelFactor = Math.min(1, this.accelRate * dt);
    this.velocity.addScaledVector(velocityDelta, accelFactor);
    if (desiredVelocity.lengthSq() < 0.0001) {
      this.velocity.multiplyScalar(Math.max(0, 1 - this.drag * dt));
    }

    this.object.position.addScaledVector(this.velocity, dt);
    // Confine to arena
    const r = 13;
    const pos = this.object.position;
    if (pos.length() > r) pos.setLength(r);

    // Aim toward mouse projected onto XZ plane with stable yaw-limited rotation
    const mouseNdc = input.mouse; // -1..1
    if (camera) {
      const ray = new THREE.Ray();
      const dir = new THREE.Vector3(mouseNdc.x, mouseNdc.y, 1)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      ray.origin.copy(camera.position);
      ray.direction.copy(dir);
      const denom = ray.direction.y;
      if (Math.abs(denom) > 1e-5) {
        const t = -ray.origin.y / denom; // intersect y=0 plane
        if (isFinite(t) && t > 0) {
          const hit = ray.origin.clone().addScaledVector(ray.direction, t);
          const forward = hit.sub(this.object.position).setY(0);
          if (forward.lengthSq() > 1e-5) {
            const targetYaw = Math.atan2(forward.x, forward.z);
            const currentYaw = this.object.rotation.y;
            let diff = targetYaw - currentYaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxStep = this.maxTurnRate * dt;
            const step = Math.max(-maxStep, Math.min(maxStep, diff));
            this.object.rotation.y = currentYaw + step;
          }
        }
      }
    }

    // Fire
    this.fireCooldown -= dt;
    if (input.mouse.isDown && this.fireCooldown <= 0) {
      const spread = this.power >= 2 ? 3 : (this.power >= 1 ? 2 : 1);
      const baseDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion).normalize();
      const dirs = [];
      if (spread === 1) dirs.push(baseDir);
      if (spread === 2) dirs.push(baseDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), 0.06), baseDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -0.06));
      if (spread === 3) dirs.push(baseDir, baseDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), 0.1), baseDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -0.1));
      for (const d of dirs) this.projectilePool.fire(this.object.position, d);
      this.audio.playLaser();
      this.fireCooldown = Math.max(0.05, this.fireRate - this.power * 0.02);
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      const t = (Math.sin(performance.now() * 0.02) * 0.5 + 0.5) * 0.7 + 0.3;
      this.object.traverse(o => { if (o.material) o.material.emissiveIntensity = t; });
    } else {
      this.object.traverse(o => { if (o.material) o.material.emissiveIntensity = 0.7; });
    }
  }

  hit() {
    this.invulnerableTimer = 1.2;
  }

  empower() {
    this.power = Math.min(3, this.power + 1);
  }
}

function makeShipMesh() {
  const group = new THREE.Group();
  const bodyGeo = new THREE.ConeGeometry(0.35, 1.2, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9ad7ff, metalness: 0.6, roughness: 0.3, emissive: 0x1b3a7a, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const wingGeo = new THREE.BoxGeometry(0.9, 0.06, 0.26);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xa6ffea, metalness: 0.5, roughness: 0.4, emissive: 0x113355, emissiveIntensity: 0.5 });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, -0.1, 0);
  group.add(wings);

  const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10);
  const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x88b4ff, metalness: 0.7, roughness: 0.2, emissive: 0x224488, emissiveIntensity: 0.8 });
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
  thruster.position.set(0, 0, -0.55);
  group.add(thruster);

  group.scale.setScalar(1.2);
  return group;
}