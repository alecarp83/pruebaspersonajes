import * as THREE from "three";
import { RoundedBoxGeometry } from
  "three/addons/geometries/RoundedBoxGeometry.js";

// Modelos originales construidos con geometría.
// Las clases son categorías visuales del catálogo, no estadísticas del juego.

const DATA = [
  {
    id: "mini-pekka",
    name: "Mini Pekka",
    type: "Guerrero",
    color: "#64dcff",
    description: "Armadura compacta, mirada eléctrica y una espada enorme.",
    build: () => makePekka(true)
  },
  {
    id: "golem",
    name: "Golem de elixir",
    type: "Tanque",
    color: "#df77ff",
    description: "Una montaña de elixir con puños de otro tamaño.",
    build: makeGolem
  },
  {
    id: "valquiria",
    name: "Valquiria",
    type: "Guerrero",
    color: "#ffaf6c",
    description: "Cabello de fuego y un hacha de doble filo.",
    build: makeValkyrie
  },
  {
    id: "caballero",
    name: "Caballero",
    type: "Guerrero",
    color: "#ffd779",
    description: "Acero, una sonrisa y el bigote más reconocible.",
    build: makeKnight
  },
  {
    id: "duende",
    name: "Duende",
    type: "Ágil",
    color: "#b0ed67",
    description: "Orejas puntiagudas, pasos rápidos y mirada traviesa.",
    build: makeGoblin
  },
  {
    id: "pekka",
    name: "Pekka",
    type: "Tanque",
    color: "#e490ff",
    description: "Cuernos de energía y una imponente armadura.",
    build: () => makePekka(false)
  },
  {
    id: "mega",
    name: "Mega Caballero",
    type: "Tanque",
    color: "#91a4ff",
    description: "Acero oscuro y dos puños que no pasan desapercibidos.",
    build: makeMega
  },
  {
    id: "berserker",
    name: "Berserker",
    type: "Ágil",
    color: "#ff947c",
    description: "Dos hachas, coletas naranjas y energía desbordante.",
    build: makeBerserker
  }
];

const canvas = document.querySelector("#world");
const catalog = document.querySelector("#catalog");
const errorBox = document.querySelector("#error");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const views = [];

let renderer;
let animate = !reduceMotion.matches;
let activeFilter = "Todos";
let searchTerm = "";
let lastTime = 0;
let elapsed = 0;

// Materiales compartidos.
const materials = new Map();

function mat(color, metalness = 0, roughness = 0.6, glow = 0) {
  const key = `${color}/${metalness}/${roughness}/${glow}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive: glow ? color : 0x000000,
      emissiveIntensity: glow
    }));
  }
  return materials.get(key);
}

const M = {
  steel: mat("#526579", 0.7, 0.34),
  lightSteel: mat("#9db6ca", 0.75, 0.29),
  darkSteel: mat("#252e42", 0.65, 0.4),
  black: mat("#101725", 0.2, 0.6),
  blue: mat("#326fc2", 0.15, 0.5),
  leather: mat("#644339"),
  brown: mat("#49352e"),
  gold: mat("#ffc85e", 0.65, 0.3),
  skin: mat("#f7b184"),
  orange: mat("#f76b25", 0.05, 0.55),
  blonde: mat("#ffca57", 0.05, 0.5),
  white: mat("#fff6df"),
  pupil: mat("#15151e"),
  cyan: mat("#64e6ff", 0.3, 0.23, 1.5),
  pink: mat("#f47aff", 0.35, 0.23, 1.3),
  green: mat("#82c747", 0, 0.65),
  greenDark: mat("#426d2f"),
  purple: mat("#b833df", 0.22, 0.25),
  purpleLight: mat("#d752f1", 0.12, 0.22),
  cloth: mat("#8c7055")
};

function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function box(parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = 0.04) {
  const radius = Math.min(bevel, w / 3, h / 3, d / 3);
  return mesh(
    parent,
    new RoundedBoxGeometry(w, h, d, 2, radius),
    material, x, y, z
  );
}

function sphere(parent, radius, material, x, y, z, scale = [1, 1, 1]) {
  const m = mesh(
    parent,
    new THREE.SphereGeometry(radius, 16, 12),
    material, x, y, z
  );
  m.scale.set(...scale);
  return m;
}

function cylinder(parent, top, bottom, height, material, x, y, z, sides = 12) {
  return mesh(
    parent,
    new THREE.CylinderGeometry(top, bottom, height, sides),
    material, x, y, z
  );
}

// Pieza cónica orientada desde A hacia B.
function spike(parent, a, b, radius, material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);

  const m = mesh(
    parent,
    new THREE.ConeGeometry(radius, direction.length(), 6),
    material
  );

  m.position.copy(start.add(end).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return m;
}

// Cuerno curvado con radio decreciente.
function horn(parent, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(...p))
  );
  const segments = 16;
  const sides = 8;
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const r = Math.max(0.004, radius * Math.pow(1 - t, 0.75));

    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const v = center.clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * r)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * r);
      positions.push(v.x, v.y, v.z);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + (j + 1) % sides;
      const c = a + sides;
      const d = b + sides;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(parent, geo, material);
}

// Polígono extruido para hojas de armas y orejas.
function extrude(parent, points, depth, material, x = 0, y = 0, z = 0) {
  const shape = new THREE.Shape();
  points.forEach(([px, py], i) => {
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  });
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
    steps: 1
  });
  geo.translate(0, 0, -depth / 2);

  return mesh(parent, geo, material, x, y, z);
}

function sword(parent, length = 1.35, width = 0.24) {
  cylinder(parent, 0.065, 0.065, 0.4, M.leather, 0, 0, 0);
  box(parent, width * 2.4, 0.12, 0.18, M.darkSteel, 0, 0.23, 0);
  sphere(parent, 0.085, M.gold, 0, -0.24, 0);

  extrude(parent, [
    [-width / 2, 0.29],
    [width / 2, 0.29],
    [width / 2, length],
    [0, length + 0.25],
    [-width / 2, length]
  ], 0.08, M.lightSteel);

  box(parent, 0.025, length - 0.22, 0.012,
    M.steel, 0, (length + 0.29) / 2, 0.055, 0.004);
}

function axe(parent, double = false, size = 1) {
  const g = group(parent);
  g.scale.setScalar(size);

  cylinder(g, 0.065, 0.065, 1.3, M.leather, 0, 0.28, 0);
  cylinder(g, 0.09, 0.09, 0.16, M.steel, 0, -0.37, 0);
  box(g, 0.22, 0.33, 0.22, M.steel, 0, 0.77, 0);

  const blade = [
    [0.06, 0.91], [0.44, 1.11], [0.66, 0.95],
    [0.63, 0.5], [0.38, 0.43], [0.12, 0.61]
  ];

  extrude(g, blade, 0.15, M.lightSteel);
  if (double) {
    extrude(g, blade.map(([x, y]) => [-x, y]).reverse(), 0.15, M.lightSteel);
  }

  return g;
}

function belt(root, width, y, depth, material = M.leather) {
  box(root, width, 0.2, depth, material, 0, y, 0);
  box(root, 0.31, 0.27, 0.08, M.gold, 0, y, depth / 2 + 0.03);
  box(root, 0.15, 0.13, 0.09, material, 0, y, depth / 2 + 0.075);
}

function rivets(parent, width, y, z, material = M.lightSteel) {
  for (const x of [-width / 2, 0, width / 2]) {
    sphere(parent, 0.035, material, x, y, z, [1, 1, 0.55]);
  }
}

function chainmail(root, width, y, z, rows = 3) {
  for (let row = 0; row < rows; row++) {
    const count = Math.floor(width / 0.16);
    for (let i = 0; i < count; i++) {
      sphere(
        root, 0.088, M.lightSteel,
        (i - (count - 1) / 2) * 0.16 + (row % 2 ? 0.035 : 0),
        y - row * 0.13,
        z,
        [1, 1, 0.3]
      );
    }
  }
}

function face(head, { green = false, angry = false, smile = true } = {}) {
  for (const side of [-1, 1]) {
    box(head, 0.22, 0.16, 0.055, M.white, side * 0.22, 0.06, 0.405);
    box(head, 0.085, 0.12, 0.065, M.pupil, side * 0.2, 0.045, 0.44);

    const eyebrow = box(
      head, 0.29, 0.07, 0.075,
      green ? M.greenDark : M.brown,
      side * 0.22, 0.2, 0.43
    );
    eyebrow.rotation.z = side * (angry ? 0.23 : -0.09);
  }

  box(head, 0.15, 0.14, 0.15,
    green ? M.green : M.skin, 0, -0.055, 0.47);

  if (smile) {
    box(head, 0.39, 0.13, 0.045, M.brown, 0, -0.23, 0.416);
    box(head, 0.3, 0.05, 0.05, M.white, 0, -0.19, 0.443);
  }
}

// Anatomía de bloques compartida por los personajes humanos.
function humanoid({
  skin = M.skin,
  shirt = M.blue,
  pants = M.brown,
  boots = M.darkSteel,
  width = 0.95
} = {}) {
  const root = new THREE.Group();

  for (const side of [-1, 1]) {
    box(root, 0.36, 0.64, 0.41, pants, side * 0.25, 0.57, 0);
    box(root, 0.42, 0.26, 0.63, boots, side * 0.25, 0.18, 0.1);
  }

  box(root, width, 0.91, 0.58, shirt, 0, 1.28, 0, 0.07);
  cylinder(root, 0.17, 0.18, 0.24, skin, 0, 1.87, 0);

  const head = group(root, 0, 2.23, 0);
  box(head, 0.84, 0.8, 0.76, skin, 0, 0, 0, 0.1);

  const hands = [];
  for (const side of [-1, 1]) {
    const arm = group(root, side * (width / 2 + 0.19), 1.61, 0);
    arm.rotation.z = side * 0.13;
    box(arm, 0.33, 0.55, 0.37, skin, 0, -0.21, 0);
    box(arm, 0.36, 0.25, 0.41, M.leather, 0, -0.53, 0);
    const hand = group(arm, 0, -0.72, 0.035);
    box(hand, 0.34, 0.31, 0.35, skin);
    hands.push(hand);
  }

  return { root, head, hands };
}

function makeKnight() {
  const { root, head, hands } = humanoid({
    shirt: M.steel,
    pants: M.darkSteel
  });

  face(head);
  box(head, 0.91, 0.28, 0.83, M.steel, 0, 0.35, -0.015);
  box(head, 0.96, 0.09, 0.87, M.lightSteel, 0, 0.23, 0);
  box(head, 0.13, 0.21, 0.87, M.lightSteel, 0, 0.49, -0.01);
  rivets(head, 0.64, 0.25, 0.45);

  for (const side of [-1, 1]) {
    const moustache = box(
      head, 0.29, 0.13, 0.13, M.blonde,
      side * 0.15, -0.13, 0.49
    );
    moustache.rotation.z = side * 0.17;
    box(root, 0.46, 0.23, 0.65, M.lightSteel, side * 0.58, 1.68, 0);
  }

  chainmail(root, 0.87, 0.86, 0.32);
  belt(root, 1.02, 1.08, 0.65, M.blue);

  const strap = box(root, 0.16, 0.9, 0.09, M.leather, 0.18, 1.43, 0.35);
  strap.rotation.z = -0.45;

  const weapon = group(hands[0], 0, 0.05, 0.09);
  weapon.rotation.z = -0.2;
  sword(weapon, 1.36, 0.23);

  return root;
}

function makeValkyrie() {
  const { root, head, hands } = humanoid({
    shirt: M.skin,
    pants: M.skin,
    boots: M.blue,
    width: 0.85
  });

  face(head, { angry: true, smile: false });
  box(root, 0.91, 0.34, 0.65, M.blue, 0, 1.57, 0);
  box(root, 1.02, 0.42, 0.68, M.blue, 0, 0.92, 0);
  belt(root, 0.92, 1.14, 0.62, M.blue);

  for (const side of [-1, 1]) {
    box(root, 0.39, 0.42, 0.48, M.blue, side * 0.25, 0.45, 0.02);
    box(root, 0.41, 0.12, 0.5, M.lightSteel, side * 0.25, 0.66, 0.02);
    box(head, 0.21, 0.74, 0.8, M.orange, side * 0.43, -0.03, -0.06);
    const tip = box(head, 0.33, 0.2, 0.68, M.orange, side * 0.47, -0.36, -0.07);
    tip.rotation.z = side * 0.35;
  }

  box(head, 0.9, 0.25, 0.83, M.orange, 0, 0.39, -0.03);
  box(head, 0.8, 0.72, 0.18, M.orange, 0, 0, -0.39);
  const fringe = box(head, 0.56, 0.25, 0.23, M.orange, -0.15, 0.3, 0.39);
  fringe.rotation.z = 0.2;

  const weapon = group(hands[0], -0.1, 0.17, 0.19);
  weapon.rotation.z = -0.2;
  axe(weapon, true, 0.93);

  return root;
}

function makeBerserker() {
  const { root, head, hands } = humanoid({
    shirt: M.cloth,
    pants: M.skin,
    boots: M.skin,
    width: 0.9
  });

  face(head, { angry: true });
  box(root, 1.07, 0.4, 0.67, M.cloth, 0, 0.92, 0);
  belt(root, 0.98, 1.14, 0.65);

  box(head, 0.86, 0.15, 0.81, M.orange, 0, 0.4, -0.02);
  box(head, 0.78, 0.65, 0.19, M.orange, 0, 0.02, -0.36);

  for (const side of [-1, 1]) {
    cylinder(head, 0.13, 0.13, 0.22, M.leather, side * 0.46, 0.37, 0);
    const pigtail = box(
      head, 0.56, 0.57, 0.63, M.orange,
      side * 0.65, 0.53, -0.06, 0.1
    );
    pigtail.rotation.z = -side * 0.18;

    box(head, 0.31, 0.12, 0.1, M.orange, side * 0.22, 0.21, 0.46);
    for (let i = 0; i < 3; i++) {
      box(head, 0.035, 0.32, 0.02,
        mat("#ff8c42"), side * 0.65 + (i - 1) * 0.12, 0.55, 0.27);
    }
  }

  hands.forEach((hand, i) => {
    const weapon = group(hand, i === 0 ? -0.06 : 0.06, 0.12, 0.13);
    weapon.rotation.z = i === 0 ? -0.22 : 0.22;
    axe(weapon, false, 0.74);
  });

  root.scale.setScalar(0.94);
  return root;
}

function makeGoblin() {
  const { root, head, hands } = humanoid({
    skin: M.green,
    shirt: M.green,
    pants: M.brown,
    boots: M.leather,
    width: 0.74
  });

  face(head, { green: true });

  // Nariz alargada y orejas en forma de cuña.
  spike(head, [0, -0.03, 0.43], [0, -0.1, 0.81], 0.16, M.green);

  for (const side of [-1, 1]) {
    const ear = [
      [side * 0.36, 0.2],
      [side * 0.99, 0.4],
      [side * 0.67, -0.04],
      [side * 0.36, -0.13]
    ];
    extrude(head, ear, 0.15, M.green, 0, 0, -0.015);
    extrude(head, [
      [side * 0.48, 0.17],
      [side * 0.84, 0.31],
      [side * 0.62, 0.02]
    ], 0.025, mat("#c3c16b"), 0, 0, 0.08);

    box(root, 0.12, 0.86, 0.07,
      mat("#a94f36"), side * 0.25, 1.34, 0.32);
    box(root, 0.15, 0.12, 0.08, M.gold, side * 0.25, 1.04, 0.36);
  }

  belt(root, 0.81, 0.93, 0.62);
  const dagger = group(hands[1], 0, 0.05, 0.15);
  dagger.rotation.z = -0.48;
  sword(dagger, 0.64, 0.24);

  root.scale.set(0.87, 0.91, 0.87);
  return root;
}

function makePekka(mini) {
  const root = new THREE.Group();
  const armor = mini ? M.darkSteel : M.steel;
  const glow = mini ? M.cyan : M.pink;
  const width = mini ? 1.04 : 1.29;

  for (const side of [-1, 1]) {
    box(root, 0.43, 0.58, 0.47, M.darkSteel, side * 0.31, 0.55, 0);
    box(root, 0.48, 0.31, 0.68, armor, side * 0.31, 0.2, 0.12);
    box(root, 0.49, 0.15, 0.51, M.lightSteel, side * 0.31, 0.59, 0.05);
  }

  box(root, width, 0.97, 0.77, armor, 0, 1.28, 0, 0.1);
  box(root, width * 0.91, 0.42, 0.83, armor, 0, 0.91, 0.015);
  box(root, width + 0.07, 0.12, 0.83, M.black, 0, 1.02, 0);
  box(root, width * 0.77, 0.43, 0.09, M.lightSteel, 0, 1.55, 0.41);

  if (!mini) {
    box(root, 0.13, 0.73, 0.06, M.darkSteel, 0, 1.32, 0.46);
    for (const side of [-1, 1]) {
      sphere(root, 0.1, M.lightSteel, side * 0.38, 1.19, 0.45, [1, 1, 0.45]);
    }
  }

  const head = group(root, 0, 2.12, 0);
  box(head, 0.91, 0.83, 0.8, armor, 0, 0, 0, 0.13);
  box(head, 0.73, 0.45, 0.07, M.black, 0, -0.02, 0.411);

  if (mini) {
    box(head, 0.48, 0.27, 0.075, glow, 0, 0.055, 0.46, 0.07);
    box(head, 0.76, 0.2, 0.17, armor, 0, -0.29, 0.43);
    box(head, 0.75, 0.1, 0.14, M.lightSteel, 0, 0.26, 0.42);
  } else {
    for (const side of [-1, 1]) {
      const eye = box(head, 0.25, 0.12, 0.07, glow,
        side * 0.22, 0.035, 0.47);
      eye.rotation.z = side * 0.22;
      const brow = box(head, 0.36, 0.1, 0.13, armor,
        side * 0.23, 0.16, 0.47);
      brow.rotation.z = side * 0.2;
    }
    box(head, 0.15, 0.49, 0.16, M.lightSteel, 0, -0.17, 0.47);
    box(head, 0.72, 0.14, 0.12, armor, 0, -0.35, 0.43);
  }

  for (const side of [-1, 1]) {
    const reach = mini ? 0.83 : 1.24;
    horn(head, [
      [side * 0.44, 0.13, 0],
      [side * 0.68, 0.19, 0],
      [side * reach, mini ? 0.38 : 0.5, -0.02],
      [side * (reach + 0.06), mini ? 0.66 : 0.88, 0]
    ], mini ? 0.16 : 0.2, glow);

    const arm = group(root, side * (width / 2 + 0.16), 1.62, 0);
    arm.rotation.z = side * 0.17;

    box(arm, mini ? 0.44 : 0.6, 0.34, 0.75, armor, 0, 0, 0);
    box(arm, 0.32, 0.5, 0.4, M.black, 0, -0.36, 0);
    box(arm, 0.43, 0.38, 0.48, armor, 0, -0.66, 0.03);
    box(arm, 0.34, 0.24, 0.36, M.darkSteel, 0, -0.9, 0.05);
    rivets(arm, 0.27, -0.61, 0.28);

    if (!mini) {
      spike(arm, [0.05 * side, 0.12, 0],
        [0.3 * side, 0.62, -0.03], 0.17, glow);
      spike(arm, [0.18 * side, -0.58, 0.03],
        [0.46 * side, -0.39, 0.03], 0.11, glow);
    }

    if (side === -1) {
      const weapon = group(arm, -0.03, -0.8, 0.3);
      weapon.rotation.z = -0.1;
      sword(weapon, mini ? 1.45 : 1.75, mini ? 0.27 : 0.34);
    }
  }

  if (mini) root.scale.setScalar(0.9);
  return root;
}

function makeMega() {
  const root = new THREE.Group();

  for (const side of [-1, 1]) {
    box(root, 0.45, 0.66, 0.51, M.darkSteel, side * 0.35, 0.55, 0);
    box(root, 0.54, 0.28, 0.77, M.steel, side * 0.35, 0.19, 0.15);
    box(root, 0.55, 0.12, 0.74, M.lightSteel, side * 0.35, 0.12, 0.17);
  }

  box(root, 1.39, 1.12, 0.88, M.darkSteel, 0, 1.4, 0, 0.12);
  box(root, 1.49, 0.44, 0.97, M.steel, 0, 1.78, 0, 0.09);
  chainmail(root, 1.2, 1.04, 0.48, 3);
  belt(root, 1.44, 1.19, 0.99, M.blue);

  const head = group(root, 0, 2.28, 0.02);
  box(head, 0.89, 0.83, 0.81, M.darkSteel, 0, 0, 0, 0.09);
  box(head, 0.71, 0.26, 0.1, M.skin, 0, 0.1, 0.42);

  for (const side of [-1, 1]) {
    box(head, 0.17, 0.08, 0.04, M.white, side * 0.19, 0.12, 0.49);
    box(head, 0.06, 0.08, 0.04, M.pupil, side * 0.17, 0.12, 0.52);
  }

  box(head, 0.99, 0.16, 0.93, M.steel, 0, 0.3, 0);
  rivets(head, 0.69, 0.29, 0.49);
  box(head, 0.97, 0.42, 0.17, M.steel, 0, -0.22, 0.47);

  for (let i = -2; i <= 2; i++) {
    box(head, 0.065, 0.26, 0.025, M.black, i * 0.16, -0.23, 0.565);
  }

  cylinder(head, 0.1, 0.13, 0.18, M.lightSteel, 0, 0.49, 0);
  horn(head, [
    [0, 0.53, 0], [0, 0.86, 0],
    [-0.16, 1.02, 0], [-0.26, 0.88, 0.01]
  ], 0.13, M.blue);

  for (const side of [-1, 1]) {
    const arm = group(root, side * 0.92, 1.62, 0);
    arm.rotation.z = side * 0.23;
    box(arm, 0.54, 0.3, 0.7, M.steel, 0, 0, 0);
    box(arm, 0.43, 0.63, 0.5, M.skin, 0, -0.35, 0);
    cylinder(arm, 0.3, 0.3, 0.2, M.lightSteel, 0, -0.6, 0);

    const fist = group(arm, 0, -0.88, 0.15);
    box(fist, 0.81, 0.78, 0.85, M.darkSteel, 0, 0, 0, 0.16);

    spike(fist, [0, 0.36, 0], [0, 0.68, 0], 0.17, M.lightSteel);
    spike(fist, [side * 0.36, 0, 0],
      [side * 0.68, 0, 0], 0.17, M.lightSteel);
    spike(fist, [0, 0, 0.39], [0, 0, 0.73], 0.19, M.lightSteel);
  }

  return root;
}

function makeGolem() {
  const root = new THREE.Group();

  for (const side of [-1, 1]) {
    box(root, 0.58, 0.6, 0.63, M.purple, side * 0.41, 0.48, 0, 0.16);
    box(root, 0.65, 0.3, 0.86, M.purple, side * 0.42, 0.16, 0.18, 0.1);
    for (let i = 0; i < 3; i++) {
      box(root, 0.14, 0.13, 0.17, M.purpleLight,
        side * 0.42 + (i - 1) * 0.17, 0.12, 0.6);
    }
  }

  box(root, 1.55, 1.43, 1.02, M.purple, 0, 1.28, 0, 0.24);
  box(root, 1.74, 0.6, 0.95, M.purpleLight, 0, 1.72, 0, 0.17);
  box(root, 1.12, 0.69, 0.18, M.purple, 0, 1.02, 0.49, 0.08);

  const head = group(root, 0, 2.27, 0.02);
  box(head, 0.98, 0.83, 0.85, M.purple, 0, 0, 0, 0.13);

  for (const side of [-1, 1]) {
    const eye = box(head, 0.25, 0.13, 0.06,
      M.pink, side * 0.24, 0.05, 0.45);
    eye.rotation.z = side * 0.12;
    box(head, 0.31, 0.11, 0.12,
      M.purpleLight, side * 0.24, 0.18, 0.46);
  }

  box(head, 0.55, 0.15, 0.07, mat("#511064"), 0, -0.24, 0.45);
  box(head, 0.69, 0.18, 0.17, M.purpleLight, 0, -0.36, 0.43);

  horn(head, [
    [-0.22, 0.35, 0],
    [0.02, 0.51, 0],
    [0.39, 0.53, -0.07]
  ], 0.2, M.purpleLight);

  for (const side of [-1, 1]) {
    const arm = group(root, side * 1.02, 1.72, 0);
    arm.rotation.z = side * 0.16;

    box(arm, 0.66, 0.91, 0.74, M.purple, 0, -0.31, 0, 0.18);
    box(arm, 0.76, 0.32, 0.83, M.blue, 0, -0.62, 0, 0.06);
    box(arm, 0.71, 0.61, 0.79, M.purple, 0, -1.03, 0.07, 0.17);

    for (const x of [-0.23, 0.23]) {
      spike(arm, [x, -0.62, 0.4],
        [x, -0.62, 0.61], 0.14, M.lightSteel);
    }

    for (let i = 0; i < 3; i++) {
      box(arm, 0.16, 0.28, 0.22, M.purpleLight,
        (i - 1) * 0.2, -1.29, 0.26, 0.06);
    }

    box(arm, 0.21, 0.35, 0.29, M.purpleLight,
      -side * 0.33, -0.97, 0.3, 0.07);
  }

  // Gotas y relieves del elixir.
  for (const [x, y, z] of [
    [-0.57, 1.79, 0.46],
    [0.45, 1.53, 0.53],
    [-0.27, 1.25, 0.57]
  ]) {
    box(root, 0.12, 0.29, 0.08, M.purpleLight, x, y, z, 0.035);
  }

  return root;
}

// Sombra de contacto suave sin modelos ni texturas externas.
function makeShadowTexture() {
  const c
