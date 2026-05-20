import * as THREE from 'three';
import { addToScene, worldPointAtScreen, renderer } from './scene.js';

function centerOfViewport() {
  const r = renderer.domElement.getBoundingClientRect();
  return worldPointAtScreen(r.left + r.width / 2, r.top + r.height / 2);
}

const PRIMITIVE_MAT = () => new THREE.MeshStandardMaterial({
  color: 0x9aa5bd, roughness: 0.65, metalness: 0.05,
});

export function addCube() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), PRIMITIVE_MAT());
  m.userData.kind = 'primitive:cube';
  return addToScene(m, { name: 'Cube', idPrefix: 'cube', position: centerOfViewport().setY(0.5) });
}

export function addSphere() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24), PRIMITIVE_MAT());
  m.userData.kind = 'primitive:sphere';
  return addToScene(m, { name: 'Sphere', idPrefix: 'sphere', position: centerOfViewport().setY(0.6) });
}

export function addPlane() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a4256, roughness: 0.9, metalness: 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.kind = 'primitive:plane';
  return addToScene(m, { name: 'Plane', idPrefix: 'plane', position: centerOfViewport().setY(0) });
}

export function addPointLight() {
  const group = new THREE.Group();
  group.userData.kind = 'light:point';
  const light = new THREE.PointLight(0xffe6b0, 8, 12, 2);
  light.castShadow = true;
  group.add(light);
  const helper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0 })
  );
  helper.userData.isHelper = true;
  group.add(helper);
  return addToScene(group, { name: 'PointLight', idPrefix: 'light', position: centerOfViewport().add(new THREE.Vector3(0, 2, 0)) });
}
