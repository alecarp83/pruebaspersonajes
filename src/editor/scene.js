// Escena three.js del editor: render, luces, cámara, controles y vistas.
// El render es "bajo demanda": solo se dibuja cuando algo cambió (invalidate), para no gastar GPU/batería en reposo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $ } from './util.js';

export const view = $('#view'), tag = $('#tag');
// Sin preserveDrawingBuffer: la captura PNG renderiza y llama a toBlob en la misma tarea.
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(devicePixelRatio); view.appendChild(renderer.domElement);
export const scene = new THREE.Scene(); scene.background = new THREE.Color(0x20242b);
// Iluminación de estudio: reflejos de ambiente + luz principal con sombras + contraluz
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .7;
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 12 }); key.shadow.bias = -.0004; scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-3, 3, -3); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .35 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.001; floor.receiveShadow = true; scene.add(floor);
export const grid = new THREE.GridHelper(6, 60, 0x666c78, 0x3a3f48); scene.add(grid);
export const camera = new THREE.PerspectiveCamera(45, 1, .05, 100);
export const orbit = new OrbitControls(camera, renderer.domElement);
export const tc = new TransformControls(camera, renderer.domElement); tc.setSpace('local'); scene.add(tc.getHelper());

let dirty = true;
export const invalidate = () => { dirty = true; };
orbit.addEventListener('change', invalidate); tc.addEventListener('change', invalidate);
// Todo cambio nace de una interacción del usuario: se marca para redibujar en el siguiente fotograma.
for (const ev of ['input', 'change', 'click', 'keydown', 'drop', 'dragover', 'dragleave', 'pointerup']) addEventListener(ev, invalidate, true);

function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); invalidate(); }
new ResizeObserver(resize).observe(view);
renderer.setAnimationLoop(() => { orbit.update(); if (dirty) { dirty = false; renderer.render(scene, camera); } });

// h = altura del personaje (m)
export function setView(v, h) {
  const d = Math.max(3, h * 2.2);
  const p = { persp: [d * .6, h * .7, d * .8], front: [0, h / 2, d], side: [d, h / 2, 0], top: [0, d, .001] }[v];
  camera.position.set(...p); orbit.target.set(0, h / 2, 0); orbit.update(); invalidate();
}

// El modo "Crear mapa" necesita retocar la luz principal (sombras de un mapa grande) y ocultar el suelo y la cuadrícula del personaje.
export { key as sun, floor };
