import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Debug } from '../core/Debug.js';

export class Player {
  constructor(scene, projectilePool, audio, planetRadius = 13.5) {
    this.object = makeShipMesh();
    this.planetRadius = planetRadius;
    this.object.position.set(0, this.planetRadius, 0);
    scene.add(this.object);

    this.speed = 10.5;
    this.friction = 8;
    this.velocity = new THREE.Vector3();
    this.fireCooldown = 0;
    this.fireRate = 0.12; // seconds between shots
    this.power = 0; // increases spread and fire rate
    this.invulnerableTimer = 0;
    this.rotationSpeed = 4.2; // rad/s around surface normal
    this.acceleration = 24; // thrust accel
    // Initial forward direction in tangent plane
    this.forward = new THREE.Vector3(0, 0, 1);

    this.projectilePool = projectilePool;
    this.audio = audio;
  }

  update(dt, input, enemies) {
    // Asteroids-style controls: rotate with left/right, thrust forward
    const pos = this.object.position;
    const normal = pos.clone().normalize();
    const turnRight = input.keysDown.has('ArrowRight') || input.keysDown.has('KeyD');
    const turnLeft = input.keysDown.has('ArrowLeft') || input.keysDown.has('KeyA');
    const rotateInput = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);
    if (rotateInput !== 0) {
      const rot = this.rotationSpeed * rotateInput * dt;
      this.forward.applyAxisAngle(normal, rot);
      // Ensure forward is tangent
      this.forward.addScaledVector(normal, -this.forward.dot(normal)).normalize();
      Debug.log('[Player] rotate', rotateInput > 0 ? 'right' : 'left', 'rot=', rot.toFixed(4), 'pos=',
        this.object.position.toArray().map(v=>v.toFixed(3)), 'forward=', this.forward.toArray().map(v=>v.toFixed(3)));
    }

    const thrust = input.keysDown.has('ArrowUp') || input.keysDown.has('KeyW');
    if (thrust) {
      this.velocity.addScaledVector(this.forward, this.acceleration * dt);
      Debug.log('[Player] thrust', 'pos=', this.object.position.toArray().map(v=>v.toFixed(3)), 'vel=', this.velocity.toArray().map(v=>v.toFixed(3)));
    }
    // Apply damping and confine velocity to tangent plane
    const drag = Math.exp(-dt * 1.6);
    this.velocity.multiplyScalar(drag);
    this.velocity.addScaledVector(normal, -this.velocity.dot(normal));

    // Move along surface using a geodesic step (great circle)
    const moveVec = this.velocity.clone().multiplyScalar(dt);
    const distance = moveVec.length();
    if (distance > 0.00001) {
      // Geodesic step: rotate around axis a = r × v (ensures advance along velocity direction)
      const tangentMove = moveVec.addScaledVector(normal, -moveVec.dot(normal));
      const rotAxis = new THREE.Vector3().crossVectors(this.object.position, tangentMove).normalize();
      const angle = distance / this.planetRadius;
      this.object.position.applyAxisAngle(rotAxis, angle).setLength(this.planetRadius);
      // Rotate forward with the same rotation so it follows curvature
      this.forward.applyAxisAngle(rotAxis, angle);
      // Keep forward tangent and renormalize
      const newNormal = this.object.position.clone().normalize();
      this.forward.addScaledVector(newNormal, -this.forward.dot(newNormal)).normalize();
      const r = this.object.position.length().toFixed(3);
      const tangency = this.forward.dot(newNormal).toFixed(3);
      Debug.log('[Player] move step', 'angle=', angle.toFixed(4), 'pos=', this.object.position.toArray().map(v=>v.toFixed(3)), 'r=', r, 'f·n=', tangency, 'forward=', this.forward.toArray().map(v=>v.toFixed(3)));
    }

    // Orient ship so local +Z is forward and +Y is surface normal
    const right = new THREE.Vector3().crossVectors(this.forward, normal).normalize();
    this.forward.copy(new THREE.Vector3().crossVectors(normal, right)).normalize();
    const basis = new THREE.Matrix4();
    basis.makeBasis(right, normal, this.forward);
    this.object.quaternion.setFromRotationMatrix(basis);

    // Fire
    this.fireCooldown -= dt;
    const shoot = input.keysDown.has('Space') || input.keysDown.has('KeyJ');
    if (shoot && this.fireCooldown <= 0) {
      const spread = this.power >= 2 ? 3 : (this.power >= 1 ? 2 : 1);
      const baseDir = this.forward.clone();
      const dirs = [];
      if (spread === 1) dirs.push(baseDir);
      if (spread === 2) dirs.push(baseDir.clone().applyAxisAngle(normal, 0.06), baseDir.clone().applyAxisAngle(normal, -0.06));
      if (spread === 3) dirs.push(baseDir, baseDir.clone().applyAxisAngle(normal, 0.1), baseDir.clone().applyAxisAngle(normal, -0.1));
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
  const bodyGeo = new THREE.ConeGeometry(0.35, 1.2, 24);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9ad7ff, metalness: 0.6, roughness: 0.3, emissive: 0x1b3a7a, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const wingGeo = new THREE.BoxGeometry(0.9, 0.06, 0.26);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xff8ab0, metalness: 0.5, roughness: 0.4, emissive: 0x331122, emissiveIntensity: 0.4 });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, -0.1, 0);
  group.add(wings);

  const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 20);
  const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x88b4ff, metalness: 0.7, roughness: 0.2, emissive: 0x224488, emissiveIntensity: 0.8 });
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
  thruster.position.set(0, 0, -0.55);
  group.add(thruster);

  // Color accents
  const trimGeo = new THREE.TorusGeometry(0.36, 0.03, 10, 24);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x52ffd2, metalness: 0.7, roughness: 0.2, emissive: 0x155544, emissiveIntensity: 0.5 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.rotation.x = Math.PI / 2;
  trim.position.z = 0.2;
  group.add(trim);

  group.scale.setScalar(1.2);
  return group;
}