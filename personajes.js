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
  },
    
  {
    id: "rey-azul",
    name: "Rey Azul",
    type: "Tanque",
    color: "#5b8def",
    description: "Corona azul, capa real y un puño que ya ganó la partida.",
    build: () => makeRey("blue")
  },
  {
    id: "rey-rojo",
    name: "Rey Rojo",
    type: "Guerrero",
    color: "#e35555",
    description: "Corona roja, capa al viento y grito de guerra.",
    build: () => makeRey("red")
  },
  {
    id: "esbirro",
    name: "Esbirro",
    type: "Ágil",
    color: "#5fd0ff",
    description: "Alas de murciélago, cuernos y puños de sobra.",
    build: makeEsbirro
  },
  {
    id: "espiritu-curacion",
    name: "Espíritu de Curación",
    type: "Ágil",
    color: "#ffe066",
    description: "Bola brillante, lengua fuera y sonrisa contagiosa.",
    build: makeSpiritHeal
  },
  {
    id: "espiritu-hielo",
    name: "Espíritu de Hielo",
    type: "Ágil",
    color: "#7fe3ff",
    description: "Cristales helados, dientes azules y risa gélida.",
    build: makeSpiritIce
  },
  {
    id: "larry-evo",
    name: "Larry Evo",
    type: "Guerrero",
    color: "#b06bff",
    description: "Cráneo elegante, sombrero morado y espada reluciente.",
    build: makeLarryEvo
  },
  {
    id: "guardia",
    name: "Guardia",
    type: "Guerrero",
    color: "#8fa3b8",
    description: "Casco, escudo y lanza. Puro hueso disciplinado.",
    build: makeGuardia
  },
  {
    id: "fenix",
    name: "Fénix",
    type: "Ágil",
    color: "#ff8a3d",
    description: "Plumas de fuego, alas desplegadas y garras listas.",
    build: makeFenix
  },
  {
    id: "firecracker",
    name: "Firecracker",
    type: "Ágil",
    color: "#ff5fa2",
    description: "Cofia rosa, bomba dorada y sonrisa pícara.",
    build: makeFirecracker
  },
  {
    id: "bebe-dragon",
    name: "Bebé Dragón",
    type: "Ágil",
    color: "#8be36b",
    description: "Verde, panzón y con una llamita siempre encendida.",
    build: makeBabyDragon
  },
  {
    id: "barril-esqueletos",
    name: "Barril de Esqueletos",
    type: "Ágil",
    color: "#c9b58c",
    description: "Tres globos, un barril y huesos a punto de saltar.",
    build: makeSkeletonBarrel
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

// ---------------------------------------------------------------------------
// Personajes adicionales
// ---------------------------------------------------------------------------

// Rey (azul o rojo). Reutiliza `humanoid` y añade corona, capa y barba.
function makeRey(variant = "blue") {
  const isBlue = variant === "blue";
  const robe   = isBlue ? M.blue   : mat("#c23a3a");
  const robeIn = isBlue ? mat("#2a4f8f") : mat("#8f2424");
  const trim   = isBlue ? M.lightSteel : M.gold;

  const { root, head, hands } = humanoid({
    shirt: robe,
    pants: mat("#e8e8ee"),
    boots: M.darkSteel,
    width: 1.05
  });

  face(head, { angry: !isBlue, smile: isBlue });

  // Barba poblada
  box(head, 0.74, 0.5, 0.18, M.black, 0, -0.4, 0.32);
  box(head, 0.5, 0.4, 0.14, M.black, 0, -0.55, 0.42);
  // Bigote
  for (const side of [-1, 1]) {
    const m = box(head, 0.34, 0.16, 0.14, M.black,
      side * 0.18, -0.14, 0.47);
    m.rotation.z = side * 0.18;
  }

  // Corona
  const crown = group(head, 0, 0.48, 0);
  cylinder(crown, 0.5, 0.5, 0.22, M.gold, 0, 0, 0, 12);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    box(crown, 0.12, 0.22, 0.12, M.gold,
      Math.sin(a) * 0.42, 0.17, Math.cos(a) * 0.42);
  }
  // Banda de color
  cylinder(crown, 0.51, 0.51, 0.1, robeIn, 0, -0.06, 0, 12);
  // Gema frontal
  box(crown, 0.1, 0.1, 0.06, M.gold, 0, 0.02, 0.53);

  // Capa
  const cape = box(root, 1.15, 1.6, 0.12, robeIn, 0, 1.05, -0.42, 0.06);
  cape.rotation.x = -0.05;

  // Collar dorado
  belt(root, 1.05, 1.5, 0.6, M.gold);
  // Emblema frontal con forma de corona
  extrude(root, [
    [-0.28, 0.32], [0.28, 0.32],
    [0.28, 0.05], [0.16, 0.05],
    [0.16, -0.05], [0, 0.12],
    [-0.16, -0.05], [-0.16, 0.05],
    [-0.28, 0.05]
  ], 0.08, M.gold, 0, 1.15, 0.44);

  // Un puño cerrado (pose de ataque / saludo)
  const fist = group(hands[1], 0, -0.02, 0.05);
  box(fist, 0.42, 0.42, 0.42, M.skin, 0, 0, 0, 0.08);

  root.scale.setScalar(1.05);
  return root;
}

// Esbirro: diablillo azul con alas de murciélago y puños enormes.
function makeEsbirro() {
  const root = new THREE.Group();
  const skin  = mat("#4aa8e8");
  const skinD = mat("#2a6fb0");
  const wing  = mat("#1e3d6b");
  const hornC = mat("#1b4f7a");

  // Piernas cortas
  for (const side of [-1, 1]) {
    box(root, 0.34, 0.5, 0.36, skinD, side * 0.28, 0.5, 0);
    box(root, 0.4, 0.2, 0.5, skin, side * 0.28, 0.18, 0.1);
  }

  // Cuerpo redondeado
  sphere(root, 0.78, skin, 0, 1.35, 0, [1, 0.95, 0.85]);
  box(root, 0.9, 0.5, 0.6, skin, 0, 1.05, 0.05);

  // Cabeza
  const head = group(root, 0, 2.25, 0.05);
  sphere(head, 0.62, skin, 0, 0, 0, [1, 0.95, 0.95]);

  // Cuernos
  for (const side of [-1, 1]) {
    horn(head, [
      [side * 0.22, 0.42, 0],
      [side * 0.32, 0.75, -0.02],
      [side * 0.26, 1.0, -0.05]
    ], 0.13, hornC);
  }

  // Ojos enfadados
  for (const side of [-1, 1]) {
    const eye = box(head, 0.22, 0.14, 0.06, M.white,
      side * 0.22, 0.08, 0.55);
    eye.rotation.z = side * 0.22;
    box(head, 0.09, 0.1, 0.06, M.pupil, side * 0.2, 0.06, 0.6);
  }
  // Boca con colmillos
  box(head, 0.5, 0.14, 0.08, mat("#5a1a1a"), 0, -0.28, 0.55);
  for (let i = -1; i <= 1; i++) {
    box(head, 0.08, 0.12, 0.05, M.white, i * 0.16, -0.24, 0.6);
  }

  // Orejas puntiagudas
  for (const side of [-1, 1]) {
    extrude(head, [
      [side * 0.5, 0.1], [side * 0.95, 0.25],
      [side * 0.55, -0.1]
    ], 0.06, skinD, 0, 0, 0);
  }

  // Brazos con puños desproporcionados
  for (const side of [-1, 1]) {
    const arm = group(root, side * 0.95, 1.55, 0.05);
    arm.rotation.z = side * 0.25;
    box(arm, 0.32, 0.9, 0.34, skin, 0, -0.35, 0);
    // Puño gigante
    const fist = group(arm, 0, -0.95, 0.08);
    box(fist, 0.62, 0.6, 0.7, skinD, 0, 0, 0, 0.14);
    for (let i = -1; i <= 1; i++) {
      box(fist, 0.12, 0.18, 0.12, skin,
        i * 0.18, 0.28, 0.3);
    }
  }

  // Alas de murciélago
  for (const side of [-1, 1]) {
    const w = group(root, side * 0.55, 1.75, -0.45);
    w.rotation.y = side * -0.4;
    extrude(w, [
      [0, 0], [side * 1.1, 0.45],
      [side * 1.35, 0.05], [side * 1.15, -0.2],
      [side * 0.7, -0.05], [side * 0.25, -0.35]
    ], 0.05, wing, 0, 0, 0);
  }

  root.scale.setScalar(0.92);
  return root;
}

// Espíritu de Curación: gota amarilla con lengua fuera y bracitos.
function makeSpiritHeal() {
  const root = new THREE.Group();
  const body = mat("#ffe066", 0, 0.4, 0.6);
  const glow = mat("#fff3a8", 0, 0.3, 1.2);

  // Cuerpo
  sphere(root, 0.85, body, 0, 1.05, 0, [1, 1.05, 1]);
  // Gota superior
  sphere(root, 0.4, body, 0, 1.85, 0, [1, 1.2, 1]);

  // Bracitos
  for (const side of [-1, 1]) {
    const arm = group(root, side * 0.75, 1.15, 0.05);
    arm.rotation.z = side * 0.7;
    box(arm, 0.28, 0.6, 0.3, body, 0, -0.25, 0);
  }

  // Ojos grandes
  for (const side of [-1, 1]) {
    sphere(root, 0.2, M.white, side * 0.28, 1.25, 0.72, [1, 1, 0.5]);
    sphere(root, 0.1, M.pupil, side * 0.28, 1.22, 0.86, [1, 1, 0.6]);
  }

  // Boca abierta + lengua
  sphere(root, 0.32, mat("#5a1a1a"), 0, 0.85, 0.7, [1.1, 0.8, 0.4]);
  sphere(root, 0.22, mat("#e35555"), 0, 0.72, 0.85, [1, 0.8, 0.7]);

  // Halo brillante
  const halo = mesh(
    root,
    new THREE.TorusGeometry(1.0, 0.05, 8, 32),
    glow, 0, 1.05, 0
  );
  halo.rotation.x = Math.PI / 2;

  return root;
}

// Espíritu de Hielo: bola blanca con picos de cristal azul.
function makeSpiritIce() {
  const root = new THREE.Group();
  const body  = mat("#f4f9ff", 0.1, 0.35);
  const ice   = mat("#7fe3ff", 0.25, 0.15, 0.9);
  const iceD  = mat("#3aa8e0", 0.3, 0.2, 0.6);

  // Cuerpo
  sphere(root, 0.85, body, 0, 1.15, 0, [1, 1, 1]);

  // Picos de hielo alrededor
  const spikes = [
    [0, 2.05, 0, 0, 0.35, 0],
    [0.75, 1.9, 0, 0.35, 0.3, 0],
    [-0.75, 1.9, 0, -0.35, 0.3, 0],
    [0, 1.7, -0.85, 0, 0.3, -0.35],
    [0.6, 1.1, 0.6, 0.25, 0.25, 0.25],
    [-0.6, 1.1, 0.6, -0.25, 0.25, 0.25]
  ];
  for (const [x, y, z, dx, dy, dz] of spikes) {
    spike(root, [x, y, z], [x + dx, y + dy * 2, z + dz], 0.18, ice);
  }

  // Ojos redondos
  for (const side of [-1, 1]) {
    sphere(root, 0.18, ice, side * 0.28, 1.35, 0.78, [1, 1, 0.5]);
    sphere(root, 0.08, iceD, side * 0.28, 1.33, 0.9, [1, 1, 0.6]);
  }

  // Boca grande con dientes
  sphere(root, 0.34, mat("#1a3a6b"), 0, 0.85, 0.72, [1.15, 0.8, 0.4]);
  for (let i = -1; i <= 1; i++) {
    box(root, 0.12, 0.16, 0.06, ice, i * 0.2, 0.98, 0.9);
    box(root, 0.12, 0.16, 0.06, ice, i * 0.2, 0.72, 0.9);
  }

  // Bracitos de hielo
  for (const side of [-1, 1]) {
    const arm = group(root, side * 0.8, 1.15, 0.05);
    arm.rotation.z = side * 0.8;
    extrude(arm, [
      [0, 0], [side * 0.55, 0.15],
      [side * 0.6, -0.1], [side * 0.1, -0.22]
    ], 0.12, ice, 0, 0, 0);
  }

  return root;
}

// Larry Evo: esqueleto con sombrero ruso morado y espada.
function makeLarryEvo() {
  const { root, head, hands } = humanoid({
    skin: mat("#e8e4d8", 0.05, 0.7),
    shirt: mat("#3a2a55"),
    pants: mat("#2a1d3f"),
    boots: M.darkSteel,
    width: 0.8
  });

  // Cráneo: cubre la cara con formas geométricas
  box(head, 0.86, 0.8, 0.78, mat("#efeadd", 0.05, 0.6), 0, 0, 0, 0.12);
  // Cuencas moradas brillantes
  for (const side of [-1, 1]) {
    box(head, 0.24, 0.22, 0.08, mat("#7a2ff0", 0.3, 0.2, 1.4),
      side * 0.2, 0.05, 0.4);
  }
  // Nariz triangular
  spike(head, [0, -0.08, 0.42], [0, -0.22, 0.42], 0.1, M.black);
  // Dientes
  for (let i = -2; i <= 2; i++) {
    box(head, 0.1, 0.14, 0.06, mat("#efeadd"),
      i * 0.12, -0.32, 0.4);
  }
  // Mandíbula
  box(head, 0.7, 0.18, 0.16, mat("#efeadd"), 0, -0.42, 0.4);

  // Sombrero ruso morado (ushanka)
  box(head, 1.0, 0.5, 0.95, mat("#4a2f8a"), 0, 0.5, -0.02, 0.16);
  box(head, 0.75, 0.2, 0.85, mat("#e8e4d8"), 0, 0.72, -0.02, 0.1);
  for (const side of [-1, 1]) {
    box(head, 0.2, 0.6, 0.5, mat("#4a2f8a"), side * 0.45, 0.25, 0);
  }
  // Estrella frontal
  box(head, 0.16, 0.16, 0.05, M.gold, 0, 0.5, 0.5);

  // Cinturón y correa
  belt(root, 0.9, 0.95, 0.6, M.leather);
  const strap = box(root, 0.16, 1.0, 0.08, M.leather, 0.2, 1.35, 0.32);
  strap.rotation.z = -0.4;

  // Espada dorada
  const weapon = group(hands[0], 0, 0.05, 0.1);
  weapon.rotation.z = -0.25;
  sword(weapon, 1.25, 0.22);

  root.scale.set(0.94, 1.0, 0.94);
  return root;
}

// Guardia: esqueleto con casco, escudo y lanza.
function makeGuardia() {
  const { root, head, hands } = humanoid({
    skin: mat("#e8e4d8", 0.05, 0.7),
    shirt: mat("#4a5568"),
    pants: mat("#2f3847"),
    boots: M.leather,
    width: 0.82
  });

  // Cráneo
  box(head, 0.82, 0.78, 0.76, mat("#efeadd", 0.05, 0.6), 0, 0, 0, 0.12);
  for (const side of [-1, 1]) {
    box(head, 0.2, 0.2, 0.08, M.black, side * 0.19, 0.05, 0.4);
  }
  spike(head, [0, -0.06, 0.42], [0, -0.2, 0.42], 0.09, M.black);
  for (let i = -2; i <= 2; i++) {
    box(head, 0.1, 0.12, 0.06, mat("#efeadd"), i * 0.12, -0.3, 0.4);
  }

  // Casco de caballero con pluma azul
  box(head, 1.0, 0.42, 0.94, M.steel, 0, 0.42, -0.02, 0.14);
  box(head, 0.95, 0.7, 0.2, M.steel, 0, 0.05, -0.4);
  box(head, 0.95, 0.7, 0.2, M.steel, 0, 0.05, 0.4);
  box(head, 0.2, 0.9, 0.94, M.steel, 0, 0.05, 0);
  box(head, 0.3, 0.1, 0.9, M.lightSteel, 0, 0.68, -0.02);
  // Pluma
  extrude(head, [
    [-0.15, 0], [0.15, 0], [0.1, 0.55], [-0.2, 0.4]
  ], 0.06, M.blue, 0, 0.7, -0.1);

  // Escudo (brazo izquierdo)
  const shield = group(hands[0], -0.1, -0.15, 0.2);
  box(shield, 0.9, 1.1, 0.12, M.steel, 0, 0, 0, 0.08);
  box(shield, 0.6, 0.75, 0.14, mat("#7a4a2a"), 0, 0, 0.08);
  box(shield, 0.2, 0.2, 0.1, M.lightSteel, 0, 0.0, 0.16);
  box(shield, 0.3, 0.6, 0.14, M.lightSteel, 0, 0, 0);

  // Lanza (brazo derecho)
  const spear = group(hands[1], 0, 0.15, 0.1);
  spear.rotation.z = -0.15;
  cylinder(spear, 0.05, 0.05, 1.9, mat("#7a4a2a"), 0, 0.7, 0);
  spike(spear, [0, 1.65, 0], [0, 2.15, 0], 0.11, M.lightSteel);
  cylinder(spear, 0.08, 0.08, 0.16, M.gold, 0, 1.55, 0);

  root.scale.set(0.94, 1.02, 0.94);
  return root;
}

// Fénix: pájaro de fuego con alas desplegadas.
function makeFenix() {
  const root = new THREE.Group();
  const body  = mat("#ff6a3d", 0.05, 0.5);
  const flame = mat("#ffb347", 0.05, 0.4, 0.6);
  const flameD= mat("#ff3d6a", 0.05, 0.5, 0.4);
  const beak  = mat("#3a2a2a", 0.4, 0.4);

  // Cuerpo
  sphere(root, 0.7, body, 0, 1.35, 0, [1, 1.15, 0.85]);

  // Cabeza
  const head = group(root, 0, 2.25, 0.05);
  sphere(head, 0.45, body, 0, 0, 0, [1, 0.95, 0.95]);

  // Pico
  spike(head, [0, -0.02, 0.4], [0, -0.12, 0.85], 0.15, beak);
  // Cresta de fuego
  for (let i = -1; i <= 1; i++) {
    extrude(head, [
      [i * 0.2, 0.35], [i * 0.3, 0.85], [i * 0.05, 0.5]
    ], 0.06, flame, 0, 0, 0.1);
  }
  // Ojos
  for (const side of [-1, 1]) {
    sphere(head, 0.12, M.white, side * 0.2, 0.08, 0.4, [1, 1, 0.5]);
    sphere(head, 0.06, M.pupil, side * 0.2, 0.06, 0.48, [1, 1, 0.6]);
  }
  // Pico inferior abierto
  spike(head, [0, -0.25, 0.4], [0, -0.35, 0.75], 0.1, beak);

  // Cola de fuego (abanico hacia atrás)
  for (let i = -2; i <= 2; i++) {
    extrude(root, [
      [i * 0.18, 0.4], [i * 0.28, -0.9], [i * 0.05, -0.3]
    ], 0.08, i === 0 ? flame : flameD,
      0, 1.0, -0.5);
  }

  // Alas desplegadas
  for (const side of [-1, 1]) {
    const wing = group(root, side * 0.55, 1.65, -0.1);
    wing.rotation.z = side * 0.25;
    // Plumas por capas
    for (let layer = 0; layer < 3; layer++) {
      const y = layer * 0.18;
      const len = 1.35 - layer * 0.15;
      extrude(wing, [
        [0, 0], [side * len, 0.5 + y],
        [side * (len + 0.15), 0.2 + y],
        [side * (len - 0.1), -0.15 + y]
      ], 0.06, layer === 0 ? flame : body, 0, y * 0.2, 0);
    }
    // Puntas doradas
    for (let i = 0; i < 3; i++) {
      extrude(wing, [
        [side * (1.0 + i * 0.15), 0.4],
        [side * (1.25 + i * 0.15), 0.55],
        [side * (1.05 + i * 0.15), 0.2]
      ], 0.05, flame, 0, 0, 0);
    }
  }

  // Garras
  for (const side of [-1, 1]) {
    const leg = group(root, side * 0.28, 0.55, 0);
    cylinder(leg, 0.08, 0.08, 0.35, beak, 0, 0, 0);
    for (let i = -1; i <= 1; i++) {
      spike(leg, [i * 0.1, -0.15, 0.05],
        [i * 0.18, -0.35, 0.35], 0.06, beak);
    }
  }

  root.scale.setScalar(0.95);
  return root;
}

// Firecracker: chica con cofia rosa, bomba dorada y sonrisa pícara.
function makeFirecracker() {
  const { root, head, hands } = humanoid({
    shirt: M.blue,
    pants: M.blue,
    boots: mat("#4a2f8a"),
    width: 0.82
  });

  face(head, { smile: true });
  // Cofia rosa
  box(head, 0.98, 0.3, 0.9, mat("#ff5fa2"), 0, 0.42, -0.02, 0.14);
  box(head, 0.6, 0.18, 0.85, mat("#ff7ab8"), 0, 0.55, -0.02, 0.1);
  // Mechones rosas laterales
  for (const side of [-1, 1]) {
    box(head, 0.2, 0.55, 0.7, mat("#ff5fa2"),
      side * 0.5, -0.05, -0.05, 0.1);
  }
  // Cejas rosas
  for (const side of [-1, 1]) {
    const b = box(head, 0.28, 0.07, 0.07, mat("#ff5fa2"),
      side * 0.22, 0.22, 0.42);
    b.rotation.z = side * -0.1;
  }

  // Cinturón morado
  belt(root, 0.9, 1.1, 0.6, mat("#4a2f8a"));

  // Hombreras moradas
  for (const side of [-1, 1]) {
    box(root, 0.42, 0.22, 0.6, mat("#4a2f8a"),
      side * 0.52, 1.65, 0, 0.08);
  }

  // Rodilleras y botas moradas
  for (const side of [-1, 1]) {
    box(root, 0.42, 0.16, 0.5, mat("#4a2f8a"),
      side * 0.25, 0.72, 0.05);
  }

  // Bomba dorada sobre el hombro (brazo derecho)
  const bomb = group(hands[1], 0, -0.2, 0.3);
  bomb.rotation.z = 0.4;
  sphere(bomb, 0.42, mat("#f0b429", 0.6, 0.3), 0, 0, 0, [1, 1, 1]);
  cylinder(bomb, 0.1, 0.12, 0.16, M.darkSteel, 0, 0.45, 0);
  // Franjas
  for (let i = 0; i < 3; i++) {
    const ring = mesh(
      bomb,
      new THREE.TorusGeometry(0.42 - i * 0.02, 0.05, 8, 20),
      mat("#7a2ff0"), 0, -0.05 + i * 0.15, 0
    );
    ring.rotation.x = Math.PI / 2;
  }
  // Mecha
  cylinder(bomb, 0.03, 0.03, 0.25, M.leather, 0.05, 0.6, 0);
  sphere(bomb, 0.08, mat("#ff8a3d", 0, 0.4, 1.2), 0.08, 0.78, 0);

  root.scale.set(0.96, 1.0, 0.96);
  return root;
}

// Bebé Dragón: verde, panzón, con llamita en la boca.
function makeBabyDragon() {
  const root = new THREE.Group();
  const body = mat("#8be36b", 0.05, 0.55);
  const bodyD= mat("#5fbf47", 0.05, 0.6);
  const belly= mat("#d8f2a8", 0.05, 0.6);
  const hornC= mat("#4aa8e8", 0.2, 0.3);
  const wing = mat("#5ac8e0", 0.1, 0.4, 0.3);
  const fire = mat("#ffb347", 0, 0.3, 1.6);

  // Piernas
  for (const side of [-1, 1]) {
    box(root, 0.4, 0.5, 0.45, bodyD, side * 0.33, 0.5, 0);
    box(root, 0.45, 0.22, 0.6, bodyD, side * 0.33, 0.18, 0.12);
  }

  // Panza y cuerpo
  sphere(root, 0.9, body, 0, 1.35, 0, [1, 1.05, 0.9]);
  sphere(root, 0.65, belly, 0, 1.25, 0.35, [1, 1, 0.6]);

  // Cola
  const tail = group(root, 0, 0.9, -0.8);
  tail.rotation.x = 0.5;
  cylinder(tail, 0.18, 0.28, 1.1, body, 0, 0.4, 0);
  sphere(tail, 0.2, bodyD, 0, 0.95, 0);

  // Cabeza
  const head = group(root, 0, 2.3, 0.15);
  sphere(head, 0.62, body, 0, 0, 0, [1, 0.95, 1]);

  // Cuernos
  for (const side of [-1, 1]) {
    horn(head, [
      [side * 0.22, 0.5, 0], [side * 0.35, 0.85, -0.05],
      [side * 0.3, 1.05, -0.05]
    ], 0.13, hornC);
  }

  // Ojos grandes
  for (const side of [-1, 1]) {
    sphere(head, 0.16, M.white, side * 0.24, 0.1, 0.5, [1, 1, 0.5]);
    sphere(head, 0.09, mat("#5a3a1a"), side * 0.24, 0.1, 0.6, [1, 1, 0.6]);
  }
  // Fosas nasales
  for (const side of [-1, 1]) {
    sphere(head, 0.05, bodyD, side * 0.1, -0.1, 0.6);
  }

  // Boca abierta con fuego
  sphere(head, 0.3, mat("#5a1a1a"), 0, -0.32, 0.42, [1.1, 0.7, 0.4]);
  for (let i = -1; i <= 1; i++) {
    box(head, 0.1, 0.14, 0.06, M.white, i * 0.16, -0.2, 0.65);
    box(head, 0.1, 0.14, 0.06, M.white, i * 0.16, -0.42, 0.65);
  }
  // Llama
  sphere(head, 0.22, fire, 0, -0.4, 0.75, [1, 0.8, 1.2]);
  sphere(head, 0.14, mat("#ffd166", 0, 0.3, 2), 0, -0.35, 0.9, [1, 1, 1.2]);

  // Brazos
  for (const side of [-1, 1]) {
    const arm = group(root, side * 0.9, 1.6, 0.1);
    arm.rotation.z = side * 0.4;
    box(arm, 0.28, 0.6, 0.3, body, 0, -0.25, 0);
    box(arm, 0.34, 0.28, 0.36, bodyD, 0, -0.6, 0.05, 0.08);
  }

  // Alas
  for (const side of [-1, 1]) {
    const w = group(root, side * 0.5, 1.7, -0.4);
    w.rotation.y = side * -0.5;
    w.rotation.z = side * 0.2;
    extrude(w, [
      [0, 0], [side * 1.1, 0.35],
      [side * 1.3, -0.05], [side * 0.9, -0.25],
      [side * 0.4, -0.05]
    ], 0.06, wing, 0, 0, 0);
  }

  root.scale.setScalar(0.95);
  return root;
}

// Barril de Esqueletos: barril con globos azules y calavera.
function makeSkeletonBarrel() {
  const root = new THREE.Group();

  // Barril
  const barrel = group(root, 0, 0.95, 0);
  cylinder(barrel, 0.85, 0.85, 1.4, mat("#7a4a2a"), 0, 0, 0, 16);
  // Aros metálicos
  for (let i = -1; i <= 1; i++) {
    const ring = mesh(
      barrel,
      new THREE.TorusGeometry(0.87, 0.06, 8, 24),
      M.darkSteel, 0, i * 0.45, 0
    );
    ring.rotation.x = Math.PI / 2;
  }
  // Duelas (líneas verticales)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(barrel, 0.05, 1.35, 0.05, mat("#5a3520"),
      Math.sin(a) * 0.84, 0, Math.cos(a) * 0.84);
  }
  // Púas metálicas
  for (const [x, y] of [[-0.75, 0.3], [0.75, 0.3], [-0.75, -0.3], [0.75, -0.3]]) {
    spike(barrel, [x, y, 0], [x * 1.3, y, 0], 0.11, M.lightSteel);
  }
  // Calavera frontal
  box(barrel, 0.6, 0.55, 0.06, mat("#efeadd"), 0, 0.05, 0.86);
  for (const side of [-1, 1]) {
    box(barrel, 0.18, 0.18, 0.06, M.black, side * 0.14, 0.13, 0.9);
  }
  spike(barrel, [0, -0.05, 0.88], [0, -0.18, 0.88], 0.07, M.black);
  for (let i = -2; i <= 2; i++) {
    box(barrel, 0.08, 0.1, 0.05, mat("#efeadd"), i * 0.1, -0.24, 0.88);
  }

  // Cuerda superior
  cylinder(root, 0.04, 0.04, 0.6, M.leather, 0, 1.95, 0);

  // Globos azules
  const balloonPos = [
    [0, 2.85, 0],
    [-0.55, 2.7, 0.1],
    [0.55, 2.7, 0.1]
  ];
  for (const [x, y, z] of balloonPos) {
    sphere(root, 0.55, mat("#3aa8e8", 0, 0.3), x, y, z, [1, 1.1, 1]);
    // Nudo
    cylinder(root, 0.06, 0.04, 0.1, mat("#3aa8e8"), x, y - 0.65, z);
    // Cuerda hasta el barril
    cylinder(root, 0.015, 0.015, 1.0, M.leather, x * 0.7, y - 1.15, z * 0.5);
  }

  return root;
}

// Sombra de contacto suave sin modelos ni texturas externas.
function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.55, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const shadowTexture = makeShadowTexture();

// ---------------------------------------------------------------------------
// Vista 3D por tarjeta
// ---------------------------------------------------------------------------

function createView(character) {
  const viewport = document.createElement("div");
  viewport.className = "viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute(
    "aria-label",
    `Modelo 3D de ${character.name}. Arrastra para girar.`
  );

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 2.1, 5.6);
  camera.lookAt(0, 1.15, 0);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2f45, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.5, 6, 4.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(character.color, 0.9);
  fill.position.set(-4, 2.5, -3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0, 3, -5);
  scene.add(rim);

  // Modelo
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model = null;
  try {
    model = character.build();
    pivot.add(model);
  } catch (err) {
    console.error(`Error al construir ${character.id}:`, err);
  }

  // Sombra de contacto
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.9
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  scene.add(shadow);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power"
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.appendChild(renderer.domElement);

  const view = {
    character,
    viewport,
    scene,
    camera,
    renderer,
    pivot,
    baseRotation: 0,
    rotation: 0,
    velocity: 0,
    zoom: 1,
    targetZoom: 1,
    dragging: false,
    lastX: 0,
    visible: true,
    resize() {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    }
  };

  // Arrastre para girar
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    view.dragging = true;
    view.lastX = e.clientX;
    view.velocity = 0;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!view.dragging) return;
    const dx = e.clientX - view.lastX;
    view.lastX = e.clientX;
    const delta = dx * 0.01;
    view.rotation += delta;
    view.velocity = delta;
  });

  const endDrag = (e) => {
    if (!view.dragging) return;
    view.dragging = false;
    viewport.classList.remove("dragging");
    if (viewport.hasPointerCapture?.(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
  };

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") endDrag(e);
  });

  // Rueda para acercar
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      view.targetZoom = THREE.MathUtils.clamp(
        view.targetZoom - e.deltaY * 0.0012,
        0.6,
        1.6
      );
    },
    { passive: false }
  );

  view.resize();
  view.render();

  return view;
}

// ---------------------------------------------------------------------------
// Construcción del catálogo
// ---------------------------------------------------------------------------

function buildCard(character, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.setProperty("--accent", character.color);
  card.dataset.id = character.id;
  card.dataset.type = character.type;
  card.dataset.name = character.name.toLowerCase();

  // Cabecera flotante
  const top = document.createElement("div");
  top.className = "card-top";

  const num = document.createElement("span");
  num.className = "card-number";
  num.textContent = String(index + 1).padStart(2, "0");

  const tag = document.createElement("span");
  tag.className = "class-tag";
  tag.textContent = character.type;

  top.append(num, tag);
  card.appendChild(top);

  // Info inferior
  const info = document.createElement("div");
  info.className = "card-info";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";

  const h3 = document.createElement("h3");
  h3.textContent = character.name;

  const square = document.createElement("span");
  square.className = "accent-square";

  titleRow.append(h3, square);

  const desc = document.createElement("p");
  desc.className = "card-description";
  desc.textContent = character.description;

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const label = document.createElement("span");
  label.className = "model-label";
  label.textContent = "MODELO 3D";

  const controls = document.createElement("div");
  controls.className = "model-controls";

  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.textContent = "+";
  zoomIn.setAttribute("aria-label", `Acercar ${character.name}`);

  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.textContent = "−";
  zoomOut.setAttribute("aria-label", `Alejar ${character.name}`);

  controls.append(zoomIn, zoomOut);
  bottom.append(label, controls);

  info.append(titleRow, desc, bottom);
  card.appendChild(info);

  // Vista 3D
  const view = createView(character);
  card.insertBefore(view.viewport, info);

  zoomIn.addEventListener("click", () => {
    view.targetZoom = THREE.MathUtils.clamp(view.targetZoom - 0.2, 0.6, 1.6);
  });
  zoomOut.addEventListener("click", () => {
    view.targetZoom = THREE.MathUtils.clamp(view.targetZoom + 0.2, 0.6, 1.6);
  });

  views.push(view);
  return card;
}

function renderCatalog() {
  catalog.innerHTML = "";

  const term = searchTerm.trim().toLowerCase();
  const filtered = DATA.filter((c) => {
    const matchesFilter =
      activeFilter === "Todos" || c.type === activeFilter;
    const matchesSearch =
      !term ||
      c.name.toLowerCase().includes(term) ||
      c.type.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  // Las vistas antiguas ya no se usan: liberamos sus renderers.
  while (views.length) {
    const v = views.pop();
    v.renderer.dispose();
    v.renderer.forceContextLoss?.();
  }

  filtered.forEach((character, i) => {
    catalog.appendChild(buildCard(character, i));
  });

  empty.hidden = filtered.length !== 0;

  // Recalcular tamaño tras insertar en el DOM.
  requestAnimationFrame(() => {
    views.forEach((v) => {
      v.resize();
      v.render();
    });
  });
}

// ---------------------------------------------------------------------------
// Filtros, búsqueda y animación
// ---------------------------------------------------------------------------

const searchInput = document.querySelector("#search");
const empty = document.querySelector("#empty");
const animationButton = document.querySelector("#animation");
const animationLabel = document.querySelector("#animation-label");

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderCatalog();
});

// Atajo de teclado: "/" enfoca el buscador
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    document.activeElement !== searchInput &&
    !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)
  ) {
    e.preventDefault();
    searchInput.focus();
  }
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    activeFilter = button.dataset.filter;
    renderCatalog();
  });
});

function syncAnimationButton() {
  animationButton.setAttribute("aria-pressed", String(animate));
  animationLabel.textContent = animate
    ? "Animación activa"
    : "Animación pausada";
}

animationButton.addEventListener("click", () => {
  animate = !animate;
  syncAnimationButton();
});

reduceMotion.addEventListener("change", (e) => {
  animate = !e.matches;
  syncAnimationButton();
});

// ---------------------------------------------------------------------------
// Inicialización y loop
// ---------------------------------------------------------------------------

function initRenderer() {
  try {
    const test = document.createElement("canvas");
    const gl =
      test.getContext("webgl2") || test.getContext("webgl");
    if (!gl) throw new Error("WebGL no disponible");
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent =
      "Tu navegador no soporta WebGL, por lo que no podemos mostrar los modelos 3D.";
    console.error(err);
    return false;
  }
  return true;
}

let lastLoop = performance.now();
let fpsSkipped = 0;

function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min((now - lastLoop) / 1000, 0.05);
  lastLoop = now;

  // Throttle a ~30fps para no quemar la GPU con 8 vistas.
  fpsSkipped = (fpsSkipped + 1) % 2;
  if (fpsSkipped !== 0) return;

  elapsed += dt;

  for (const view of views) {
    if (!view.visible) continue;

    // Zoom suave
    view.zoom += (view.targetZoom - view.zoom) * 0.15;

    // Inercia del arrastre
    if (!view.dragging) {
      view.rotation += view.velocity;
      view.velocity *= 0.94;
      if (Math.abs(view.velocity) < 0.0004) view.velocity = 0;
      if (animate) {
        view.rotation += dt * 0.35;
      }
    }

    view.pivot.rotation.y = view.rotation;

    // Flotación sutil
    const bob = animate
      ? Math.sin(elapsed * 1.4 + view.rotation) * 0.03
      : 0;
    view.pivot.position.y = bob;

    view.camera.position.set(0, 2.1, 5.6 * view.zoom);
    view.camera.lookAt(0, 1.15, 0);

    view.render();
  }
}

// Solo renderizar las vistas visibles
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const view = views.find((v) => v.viewport === entry.target);
      if (view) view.visible = entry.isIntersecting;
    }
  },
  { rootMargin: "100px" }
);

function observeViews() {
  views.forEach((v) => io.observe(v.viewport));
}

// Resize global con debounce
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    views.forEach((v) => {
      v.resize();
      v.render();
    });
  }, 120);
});

// Arranque
if (initRenderer()) {
  renderCatalog();
  observeViews();
  syncAnimationButton();
  requestAnimationFrame(loop);
}
