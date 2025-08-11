import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Player {
  constructor(scene, projectilePool, audio) {
    this.object = makeShipMesh();
    this.object.position.set(0, 0, 0);
    scene.add(this.object);

    // Fixed-center control parameters
    this.maxTurnRate = Math.PI * 3.5; // radians per second
    this.turnSpeed = Math.PI * 2.8; // input turn speed
    this.thrustAccel = 12; // units per second^2 along tangent
    this.thrustDrag = 2.5; // deceleration when not thrusting
    this.maxThrust = 10; // max linear speed on sphere

    this.yaw = 0;
    this.thrustSpeed = 0;

    this.fireCooldown = 0;
    this.fireRate = 0.12; // seconds between shots
    this.power = 0; // increases spread and fire rate
    this.invulnerableTimer = 0;

    this.projectilePool = projectilePool;
    this.audio = audio;
  }

  update(dt, input, enemies, camera) {
    // Fixed-center controls: left/right rotate yaw, up arrow thrust forward
    const axis = input.getAxis();
    // yaw
    const turn = (axis.x) * this.turnSpeed * dt; // ArrowLeft/Right or A/D
    this.yaw += turn;
    // clamp yaw to [-pi, pi] for stability
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    this.object.rotation.set(0, this.yaw, 0);

    // thrust
    const isThrusting = (input.keysDown.has('ArrowUp') || input.keysDown.has('KeyW'));
    if (isThrusting) {
      this.thrustSpeed = Math.min(this.maxThrust, this.thrustSpeed + this.thrustAccel * dt);
    } else {
      this.thrustSpeed = Math.max(0, this.thrustSpeed - this.thrustDrag * dt);
    }

    // Fire
    this.fireCooldown -= dt;
    if (input.mouse.isDown && this.fireCooldown <= 0) {
      const forward = this.getForwardXZ();
      const spread = this.power >= 2 ? 3 : (this.power >= 1 ? 2 : 1);
      const dirs = [];
      if (spread === 1) dirs.push(forward);
      if (spread === 2) dirs.push(forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), 0.06), forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -0.06));
      if (spread === 3) dirs.push(forward, forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), 0.1), forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -0.1));
      const muzzle = new THREE.Vector3(0, 0, 0.8).applyEuler(new THREE.Euler(0, this.yaw, 0)).add(this.object.position);
      for (const d of dirs) this.projectilePool.fire(muzzle, d);
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

  getForwardXZ() {
    return new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, this.yaw, 0)).normalize();
  }

  getThrustVelocityOnSphere(radius) {
    // Tangential velocity vector on sphere at the player location
    const forward = this.getForwardXZ();
    return forward.clone().multiplyScalar(this.thrustSpeed);
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