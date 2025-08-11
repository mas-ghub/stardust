import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Pickup {
  constructor(scene, position) {
    this.object = makePickupMesh();
    this.object.position.copy(position);
    this.time = 0;
    scene.add(this.object);
  }

  update(dt) {
    this.time += dt;
    this.object.rotation.y += dt * 1.8;
    this.object.position.y = Math.sin(this.time * 3) * 0.25 + 0.2;
  }

  dispose(scene) { scene.remove(this.object); }
}

function makePickupMesh() {
  const geo = new THREE.OctahedronGeometry(0.35, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe38a, metalness: 0.3, roughness: 0.4, emissive: 0xffcc55, emissiveIntensity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}