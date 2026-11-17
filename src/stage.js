// Snackio — 3D scéna s prodejním automatem (three.js).
// Zdrojový soubor. Po úpravě spusťte `npm run build`, který vytvoří
// public/assets/js/stage.min.js (ten se načítá na webu).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const NIGHT = 0x07130e;
const LIME = 0xd7f574;
const AMBER = 0xffb454;

// Rozměry automatu v metrech.
const W = 1.1, H = 1.95, D = 0.8;
const FRONT = D / 2;
const WIN = { x0: -0.5, x1: 0.24, y0: 0.6, y1: 1.68 };
const WIN_CX = (WIN.x0 + WIN.x1) / 2;
const ROWS = 5, COLS = 6;
const SHELF_Y0 = 0.62, SHELF_PITCH = 0.212, COL_PITCH = 0.118;
const Z_FRONT = 0.235, Z_REAR = 0.095, Z_EDGE = 0.345;
const TRAY = { x0: -0.42, x1: 0.16, y0: 0.22, y1: 0.44 };

const PALETTE = {
  amber: 0xffb454, coral: 0xff6b57, lime: 0xd7f574, sky: 0x6fd3ff,
  pink: 0xff5fa2, cream: 0xfff3d6, violet: 0x9b7bff, mint: 0x5ee6b0,
  cocoa: 0x6b4634, ink: 0x1b2a33, white: 0xf4f6f2,
};

// Typ místa mění náladu světla i ukázkový sortiment.
export const VENUES = {
  office: {
    label: 'KANCELÁŘ', mood: 0xbcd6ff, moodPower: 1.0,
    mix: { cup: 4, can: 2, bottle: 3, bar: 2, bag: 1, shaker: 0 },
    colors: ['amber', 'sky', 'cocoa', 'mint', 'cream', 'coral'],
  },
  industry: {
    label: 'VÝROBA', mood: 0xff9a3c, moodPower: 1.25,
    mix: { cup: 1, can: 4, bottle: 2, bar: 2, bag: 4, shaker: 0 },
    colors: ['amber', 'coral', 'lime', 'ink', 'cream', 'sky'],
  },
  fitness: {
    label: 'FITNESS', mood: 0xb46bff, moodPower: 1.2,
    mix: { cup: 0, can: 1, bottle: 3, bar: 3, bag: 0, shaker: 5 },
    colors: ['violet', 'pink', 'mint', 'white', 'lime', 'ink'],
  },
  school: {
    label: 'ŠKOLA', mood: 0xffe0a0, moodPower: 1.05,
    mix: { cup: 2, can: 1, bottle: 4, bar: 2, bag: 3, shaker: 0 },
    colors: ['sky', 'lime', 'coral', 'cream', 'amber', 'pink'],
  },
  public: {
    label: 'VEŘEJNÝ PROSTOR', mood: 0x45e0c2, moodPower: 1.15,
    mix: { cup: 1, can: 4, bottle: 4, bar: 2, bag: 2, shaker: 0 },
    colors: ['mint', 'amber', 'coral', 'sky', 'white', 'lime'],
  },
};

const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Deterministický generátor, aby sortiment vypadal při každém načtení stejně.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.28)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, mid);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initStage(canvas, options = {}) {
  const still = !!options.reducedMotion;
  const lowPower = !!options.lowPower;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(NIGHT, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(NIGHT, 0.075);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  // ---------- světla ----------
  scene.add(new THREE.HemisphereLight(0x7fb5a2, 0x050a08, 0.35));

  const mood = new THREE.SpotLight(0xbcd6ff, 60, 14, 0.5, 0.7, 1.6);
  mood.position.set(-3.2, 4.4, 3.4);
  mood.target.position.set(0, 0.9, 0);
  scene.add(mood, mood.target);

  const rim = new THREE.PointLight(LIME, 14, 9, 1.8);
  rim.position.set(2.4, 2.3, -2.2);
  scene.add(rim);

  const fill = new THREE.PointLight(0x2f7d63, 6, 10, 1.6);
  fill.position.set(-2.6, 0.6, 2.2);
  scene.add(fill);

  // ---------- podlaha se zrcadlením ----------
  const farFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: NIGHT, fog: false, toneMapped: false })
  );
  farFloor.rotation.x = -Math.PI / 2;
  farFloor.position.y = -0.004;
  scene.add(farFloor);

  const mirror = new Reflector(new THREE.CircleGeometry(13, 48), {
    clipBias: 0.003,
    textureWidth: lowPower ? 512 : 1024,
    textureHeight: lowPower ? 512 : 1024,
    color: 0x8a938f,
  });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);

  const veilCanvas = document.createElement('canvas');
  veilCanvas.width = veilCanvas.height = 512;
  {
    const g = veilCanvas.getContext('2d');
    g.fillStyle = 'rgb(7,19,14)';
    g.fillRect(0, 0, 512, 512);
    g.clearRect(0, 0, 512, 512);
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(7,19,14,.5)');
    grad.addColorStop(0.16, 'rgba(7,19,14,.68)');
    grad.addColorStop(0.42, 'rgba(7,19,14,.92)');
    grad.addColorStop(0.7, 'rgba(7,19,14,1)');
    grad.addColorStop(1, 'rgba(7,19,14,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  const veilTex = new THREE.CanvasTexture(veilCanvas);
  veilTex.colorSpace = THREE.SRGBColorSpace;
  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(13.05, 48),
    new THREE.MeshBasicMaterial({ map: veilTex, transparent: true, depthWrite: false, fog: false, toneMapped: false })
  );
  veil.rotation.x = -Math.PI / 2;
  veil.position.y = 0.002;
  veil.renderOrder = 1;
  scene.add(veil);

  // ---------- opar a prach ----------
  const softGlow = glowTexture();
  // opar za automatem: nejjasnější ve výšce výlohy, k podlaze a do stran se ztrácí
  const hazeCanvas = document.createElement('canvas');
  hazeCanvas.width = hazeCanvas.height = 256;
  {
    const g = hazeCanvas.getContext('2d');
    g.save();
    g.translate(128, 150);
    g.scale(1.22, 1);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 104);
    grad.addColorStop(0, 'rgba(255,255,255,.95)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.4)');
    grad.addColorStop(0.65, 'rgba(255,255,255,.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(-128, -150, 256, 256);
    g.restore();
  }
  const hazeTex = new THREE.CanvasTexture(hazeCanvas);
  hazeTex.colorSpace = THREE.SRGBColorSpace;
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({
    map: hazeTex, color: 0x2f8f73, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  haze.scale.set(13, 8.6, 1);
  haze.position.set(0.3, 4.32, -3.4);
  haze.renderOrder = 5;
  scene.add(haze);

  const DUST = lowPower ? 110 : 220;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = rng(7);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (dustSeed() - 0.5) * 7;
    dustPos[i * 3 + 1] = dustSeed() * 3.4;
    dustPos[i * 3 + 2] = (dustSeed() - 0.5) * 5 + 0.6;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: softGlow, color: 0xdff2c8, size: 0.022, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);

  // ---------- automat ----------
  const machine = new THREE.Group();
  scene.add(machine);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15402f, metalness: 0.55, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a1712, metalness: 0.6, roughness: 0.5 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xa9b5ae, metalness: 1, roughness: 0.32 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x16241e, roughness: 0.9, emissive: 0xffe4b5, emissiveIntensity: 0.02 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, x, y, z, mat, parent = machine) {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // skříň
  box(W, H - 0.12, 0.04, 0, 0.12 + (H - 0.12) / 2, -FRONT + 0.02, bodyMat);            // záda
  box(0.04, H - 0.12, D, -W / 2 + 0.02, 0.12 + (H - 0.12) / 2, 0, bodyMat);            // levý bok
  box(0.04, H - 0.12, D, W / 2 - 0.02, 0.12 + (H - 0.12) / 2, 0, bodyMat);             // pravý bok
  box(W, 0.04, D, 0, H - 0.02, 0, bodyMat);                                            // strop
  box(W - 0.06, 0.12, D - 0.06, 0, 0.06, 0, darkMat);                                  // sokl
  box(W - 0.08, 0.03, D - 0.08, 0, 0.59, 0, darkMat);                                  // dno výlohy

  // čelo
  const FZ = FRONT - 0.025;
  box(W, 0.25, 0.07, 0, 1.825, FRONT - 0.02, bodyMat);                                 // hlavice s nápisem
  box(0.31, 1.58, 0.05, 0.395, 0.91, FZ, bodyMat);                                     // ovládací sloupek
  box(0.05, 1.12, 0.05, -0.525, 1.14, FZ, bodyMat);                                    // levá lišta výlohy
  box(0.79, 0.03, 0.05, -0.155, 1.695, FZ, bodyMat);                                   // horní lišta výlohy
  box(0.79, 0.1, 0.05, -0.155, 0.17, FZ, bodyMat);                                     // pod výdejem
  box(0.79, 0.16, 0.05, -0.155, 0.52, FZ, bodyMat);                                    // nad výdejem
  box(0.13, 0.22, 0.05, -0.485, 0.33, FZ, bodyMat);                                    // vlevo od výdeje
  box(0.08, 0.22, 0.05, 0.2, 0.33, FZ, bodyMat);                                       // vpravo od výdeje
  box(0.012, 1.58, 0.056, 0.243, 0.91, FZ, steelMat);                                  // ocelová spára

  // vnitřek
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.1), innerMat);
  back.position.set(0, 1.14, -FRONT + 0.05);
  machine.add(back);
  box(0.012, 1.04, 0.012, WIN.x0 + 0.012, 1.14, 0.345, ledMat);
  box(0.012, 1.04, 0.012, WIN.x1 - 0.012, 1.14, 0.345, ledMat);
  box(0.7, 0.012, 0.012, WIN_CX, WIN.y1 - 0.02, 0.345, ledMat);

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x26302b, metalness: 0.8, roughness: 0.45 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa39c, roughness: 0.6, emissive: 0xfff3d6, emissiveIntensity: 0.08 });
  for (let r = 0; r < ROWS; r++) {
    const y = SHELF_Y0 + r * SHELF_PITCH;
    box(0.74, 0.012, 0.5, WIN_CX, y - 0.006, 0.06, shelfMat);
    box(0.74, 0.024, 0.006, WIN_CX, y - 0.004, 0.313, railMat);
  }

  const inLight1 = new THREE.PointLight(0xffe2b8, 0.42, 1.6, 1.6);
  inLight1.position.set(WIN_CX, 1.52, 0.3);
  const inLight2 = new THREE.PointLight(0xffe2b8, 0.42, 1.6, 1.6);
  inLight2.position.set(WIN_CX, 0.9, 0.3);
  machine.add(inLight1, inLight2);

  // sklo výlohy
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.03, metalness: 0.2,
      envMapIntensity: 3, depthWrite: false,
    })
  );
  glass.position.set(WIN_CX, (WIN.y0 + WIN.y1) / 2, FRONT - 0.012);
  glass.renderOrder = 3;
  machine.add(glass);

  // výdejní prostor
  const trayCX = (TRAY.x0 + TRAY.x1) / 2, trayCY = (TRAY.y0 + TRAY.y1) / 2;
  box(TRAY.x1 - TRAY.x0, 0.01, 0.3, trayCX, TRAY.y0 - 0.005, 0.23, darkMat);
  box(TRAY.x1 - TRAY.x0, TRAY.y1 - TRAY.y0, 0.01, trayCX, trayCY, 0.085, darkMat);
  box(0.01, TRAY.y1 - TRAY.y0, 0.3, TRAY.x0, trayCY, 0.23, darkMat);
  box(0.01, TRAY.y1 - TRAY.y0, 0.3, TRAY.x1, trayCY, 0.23, darkMat);
  const trayLedMat = new THREE.MeshBasicMaterial({ color: 0x21301f, toneMapped: false });
  box(TRAY.x1 - TRAY.x0 - 0.04, 0.008, 0.008, trayCX, TRAY.y1 - 0.012, 0.36, trayLedMat);
  const trayLight = new THREE.PointLight(LIME, 0, 0.9, 1.5);
  trayLight.position.set(trayCX, TRAY.y1 - 0.04, 0.3);
  machine.add(trayLight);
  const flap = new THREE.Mesh(
    new THREE.PlaneGeometry(TRAY.x1 - TRAY.x0, TRAY.y1 - TRAY.y0),
    new THREE.MeshStandardMaterial({ color: 0x0c1512, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.3, envMapIntensity: 2.5, depthWrite: false })
  );
  flap.position.set(trayCX, trayCY, FRONT - 0.01);
  flap.renderOrder = 3;
  machine.add(flap);

  // nožičky
  const footGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.03, 16);
  [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]].forEach(([x, z]) => {
    const f = new THREE.Mesh(footGeo, steelMat);
    f.position.set(x, 0.0, z);
    machine.add(f);
  });

  // ---------- plátna: nápis, displej, platební terminál ----------
  function canvasTex(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { c, g: c.getContext('2d'), t };
  }

  const sign = canvasTex(1024, 200);
  function drawSign() {
    const { g, c, t } = sign;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#0b1f17';
    g.fillRect(0, 0, c.width, c.height);
    g.font = "800 118px 'Unbounded', 'Arial Black', sans-serif";
    g.textBaseline = 'middle';
    g.fillStyle = '#d7f574';
    const text = 'snackio';
    const tw = g.measureText(text).width;
    const x = (c.width - tw) / 2 - 16;
    g.fillText(text, x, 108);
    g.beginPath();
    g.arc(x + tw + 30, 62, 20, 0, Math.PI * 2);
    g.fill();
    t.needsUpdate = true;
  }
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.195), new THREE.MeshBasicMaterial({ map: sign.t, toneMapped: false }));
  signMesh.position.set(0, 1.825, FRONT + 0.0165);
  machine.add(signMesh);

  const signGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softGlow, color: LIME, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  signGlow.scale.set(2.3, 0.95, 1);
  signGlow.position.set(0, 1.83, FRONT + 0.1);
  machine.add(signGlow);

  const windowGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softGlow, color: 0xffd9a0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  windowGlow.scale.set(2.1, 2.4, 1);
  windowGlow.position.set(WIN_CX, 1.14, FRONT + 0.12);
  machine.add(windowGlow);

  // světlo rozlité na podlaze před automatem
  const spillCanvas = document.createElement('canvas');
  spillCanvas.width = spillCanvas.height = 256;
  {
    const g = spillCanvas.getContext('2d');
    const grad = g.createRadialGradient(128, 44, 2, 128, 44, 122);
    grad.addColorStop(0, 'rgba(255,224,170,.85)');
    grad.addColorStop(0.45, 'rgba(255,205,140,.26)');
    grad.addColorStop(1, 'rgba(255,205,140,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const spillTex = new THREE.CanvasTexture(spillCanvas);
  spillTex.colorSpace = THREE.SRGBColorSpace;
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.4),
    new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(WIN_CX, 0.004, FRONT + 1.05);
  spill.renderOrder = 2;
  machine.add(spill);

  const display = canvasTex(512, 320);
  const displayState = { line1: 'VYBERTE SI', line2: '', venue: 'KANCELÁŘ' };
  function drawDisplay() {
    const { g, c, t } = display;
    g.fillStyle = '#10261c';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#d7f574';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.font = "700 38px 'Instrument Sans', Arial, sans-serif";
    g.globalAlpha = 0.75;
    g.fillText(displayState.venue, c.width / 2, 58);
    g.globalAlpha = 1;
    if (displayState.line2) {
      g.font = "800 112px 'Unbounded', 'Arial Black', sans-serif";
      g.fillText(displayState.line1, c.width / 2, 158);
      g.font = "700 40px 'Instrument Sans', Arial, sans-serif";
      g.fillText(displayState.line2, c.width / 2, 258);
    } else {
      g.font = "800 60px 'Unbounded', 'Arial Black', sans-serif";
      g.fillText(displayState.line1, c.width / 2, 186);
    }
    t.needsUpdate = true;
  }
  box(0.24, 0.165, 0.02, 0.395, 1.47, FRONT + 0.005, darkMat);
  const displayMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.131), new THREE.MeshBasicMaterial({ map: display.t, toneMapped: false }));
  displayMesh.position.set(0.395, 1.47, FRONT + 0.0165);
  machine.add(displayMesh);

  const keyMat = new THREE.MeshStandardMaterial({ color: 0x1d2a25, metalness: 0.4, roughness: 0.5, emissive: 0xd7f574, emissiveIntensity: 0.05 });
  const keys = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const k = box(0.042, 0.036, 0.014, 0.395 + (c - 1) * 0.058, 1.3 - r * 0.052, FRONT + 0.006, keyMat.clone());
      keys.push(k);
    }
  }

  const pay = canvasTex(256, 320);
  {
    const { g, c, t } = pay;
    g.fillStyle = '#0c1a14';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#d7f574';
    g.lineCap = 'round';
    g.lineWidth = 12;
    for (let i = 0; i < 4; i++) {
      g.globalAlpha = 1 - i * 0.17;
      g.beginPath();
      g.arc(78, 150, 26 + i * 30, -0.7, 0.7);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#d7f574';
    g.font = "700 26px 'Instrument Sans', Arial, sans-serif";
    g.textAlign = 'center';
    g.fillText('KARTOU', c.width / 2, 272);
    t.needsUpdate = true;
  }
  box(0.19, 0.235, 0.03, 0.395, 0.9, FRONT + 0.01, darkMat);
  const payMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), new THREE.MeshBasicMaterial({ map: pay.t, toneMapped: false }));
  payMesh.position.set(0.395, 0.9, FRONT + 0.0265);
  machine.add(payMesh);
  box(0.11, 0.012, 0.012, 0.395, 0.7, FRONT + 0.004, darkMat);                           // štěrbina na mince
  box(0.13, 0.085, 0.012, 0.395, 0.52, FRONT + 0.004, darkMat);                          // vratka mincí
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20), steelMat);
  lock.rotation.x = Math.PI / 2;
  lock.position.set(0.395, 0.32, FRONT + 0.004);
  machine.add(lock);

  // grafika na levém boku
  const side = canvasTex(512, 1024);
  function drawSide() {
    const { g, c, t } = side;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#d7f574';
    g.beginPath();
    g.arc(256, 330, 150, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#15402f';
    g.font = "800 190px 'Unbounded', 'Arial Black', sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('s', 256, 322);
    g.fillStyle = '#d7f574';
    g.font = "600 44px 'Instrument Sans', Arial, sans-serif";
    g.fillText('snack smarter.', 256, 600);
    t.needsUpdate = true;
  }
  const sideMat = new THREE.MeshStandardMaterial({ map: side.t, transparent: true, metalness: 0.3, roughness: 0.5, emissiveMap: side.t, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), sideMat);
  sideL.rotation.y = -Math.PI / 2;
  sideL.position.set(-W / 2 - 0.001, 1.05, 0);
  machine.add(sideL);
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), sideMat);
  sideR.rotation.y = Math.PI / 2;
  sideR.position.set(W / 2 + 0.001, 1.05, 0);
  machine.add(sideR);

  function drawAllText() { drawSign(); drawDisplay(); drawSide(); }
  drawAllText();
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("800 100px 'Unbounded'"),
      document.fonts.load("700 30px 'Instrument Sans'"),
    ]).then(drawAllText).catch(() => {});
  }

  // ---------- zboží ----------
  const geo = {
    can: new THREE.CylinderGeometry(0.031, 0.031, 0.112, 20),
    canTop: new THREE.CylinderGeometry(0.027, 0.031, 0.008, 20),
    bottle: new THREE.CylinderGeometry(0.03, 0.03, 0.118, 20),
    neck: new THREE.CylinderGeometry(0.013, 0.027, 0.036, 16),
    cap: new THREE.CylinderGeometry(0.015, 0.015, 0.016, 16),
    label: new THREE.CylinderGeometry(0.0308, 0.0308, 0.05, 20, 1, true),
    cup: new THREE.CylinderGeometry(0.034, 0.025, 0.1, 20),
    lid: new THREE.CylinderGeometry(0.036, 0.036, 0.01, 20),
    shaker: new THREE.CylinderGeometry(0.033, 0.029, 0.14, 20),
    shakerCap: new THREE.CylinderGeometry(0.034, 0.034, 0.03, 20),
    bag: new THREE.BoxGeometry(0.088, 0.13, 0.03),
    bagBand: new THREE.BoxGeometry(0.089, 0.036, 0.031),
    bar: new THREE.BoxGeometry(0.05, 0.145, 0.018),
    barBand: new THREE.BoxGeometry(0.051, 0.03, 0.019),
  };
  const matCache = new Map();
  function colorMat(name, opts = {}) {
    const key = name + JSON.stringify(opts);
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({
        color: PALETTE[name], roughness: opts.roughness ?? 0.42, metalness: opts.metalness ?? 0.1,
        emissive: PALETTE[name], emissiveIntensity: 0.18,
      }));
    }
    return matCache.get(key);
  }

  function part(g, m, y, parent) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }

  // Každý výrobek je skupina s počátkem na polici (y = 0 je spodek).
  function makeProduct(type, c1, c2) {
    const g = new THREE.Group();
    let height = 0.12;
    if (type === 'can') {
      part(geo.can, colorMat(c1, { metalness: 0.75, roughness: 0.3 }), 0.056, g);
      part(geo.canTop, steelMat, 0.116, g);
      part(geo.label, colorMat(c2, { metalness: 0.3 }), 0.056, g);
      height = 0.12;
    } else if (type === 'bottle') {
      part(geo.bottle, colorMat(c1, { roughness: 0.2 }), 0.059, g);
      part(geo.neck, colorMat(c1, { roughness: 0.2 }), 0.136, g);
      part(geo.cap, colorMat(c2), 0.162, g);
      part(geo.label, colorMat('white'), 0.066, g);
      height = 0.17;
    } else if (type === 'cup') {
      part(geo.cup, colorMat(c1, { roughness: 0.7 }), 0.05, g);
      part(geo.lid, colorMat(c2), 0.105, g);
      height = 0.11;
    } else if (type === 'shaker') {
      part(geo.shaker, colorMat('ink', { roughness: 0.3 }), 0.07, g);
      part(geo.shakerCap, colorMat(c1), 0.155, g);
      part(geo.label, colorMat(c1), 0.07, g);
      height = 0.17;
    } else if (type === 'bag') {
      part(geo.bag, colorMat(c1, { roughness: 0.35, metalness: 0.35 }), 0.065, g);
      part(geo.bagBand, colorMat(c2), 0.075, g);
      g.rotation.x = -0.1;
      height = 0.13;
    } else {
      part(geo.bar, colorMat(c1, { roughness: 0.35, metalness: 0.3 }), 0.0725, g);
      part(geo.barBand, colorMat(c2), 0.085, g);
      g.rotation.x = -0.08;
      height = 0.145;
    }
    g.userData.height = height;
    g.userData.tilt = g.rotation.x;
    return g;
  }

  function slotRecipes(venueKey) {
    const v = VENUES[venueKey];
    const random = rng(venueKey.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 17));
    const pool = [];
    Object.entries(v.mix).forEach(([type, weight]) => { for (let i = 0; i < weight; i++) pool.push(type); });
    const recipes = [];
    for (let r = 0; r < ROWS; r++) {
      // v jedné řadě střídáme nejvýš dva typy, ať regál působí srovnaně
      const tA = pool[Math.floor(random() * pool.length)];
      const tB = pool[Math.floor(random() * pool.length)];
      for (let c = 0; c < COLS; c++) {
        const type = c < COLS / 2 ? tA : tB;
        const c1 = v.colors[Math.floor(random() * v.colors.length)];
        let c2 = v.colors[Math.floor(random() * v.colors.length)];
        if (c2 === c1) c2 = 'white';
        recipes.push({ type, c1, c2 });
      }
    }
    return recipes;
  }

  const slots = [];
  const stock = new THREE.Group();
  machine.add(stock);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      slots.push({
        row: r, col: c,
        x: WIN_CX + (c - (COLS - 1) / 2) * COL_PITCH,
        y: SHELF_Y0 + r * SHELF_PITCH,
        code: 'ABCDE'[ROWS - 1 - r] + (c + 1),
        front: null, rear: null, busy: false, recipe: null,
      });
    }
  }

  function place(slot, product, z) {
    product.position.set(slot.x, slot.y, z);
    product.userData.slot = slot;
    stock.add(product);
    return product;
  }

  let venueKey = 'office';
  function fillSlots(key) {
    const recipes = slotRecipes(key);
    slots.forEach((slot, i) => {
      slot.recipe = recipes[i];
      slot.front = place(slot, makeProduct(recipes[i].type, recipes[i].c1, recipes[i].c2), Z_FRONT);
      slot.rear = place(slot, makeProduct(recipes[i].type, recipes[i].c1, recipes[i].c2), Z_REAR);
    });
  }
  fillSlots(venueKey);

  // ---------- drobné animace ----------
  const tweens = [];
  function tween(dur, update, done, delay = 0) {
    tweens.push({ t: -delay, dur: still ? Math.min(dur, 0.01) : dur, update, done });
  }
  function stepTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = clamp(tw.t / tw.dur, 0, 1);
      tw.update(k);
      if (k >= 1) {
        tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }
  }

  let displayTimer = 0;
  function showOnDisplay(line1, line2, seconds) {
    displayState.line1 = line1;
    displayState.line2 = line2 || '';
    drawDisplay();
    displayTimer = seconds || 0;
  }

  function emit(name, detail) {
    canvas.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  let trayGlow = 0;
  function vend(slot) {
    if (!slot || slot.busy || !slot.front) return false;
    slot.busy = true;
    const item = slot.front;
    const rear = slot.rear;
    slot.front = null;
    showOnDisplay(slot.code, 'DOBROU CHUŤ', 3.2);
    const key = keys[(slot.row * 3 + slot.col) % keys.length];
    key.material.emissiveIntensity = 1.6;
    tween(0.5, (k) => { key.material.emissiveIntensity = lerp(1.6, 0.05, k); });

    const restX = clamp(slot.x, TRAY.x0 + 0.08, TRAY.x1 - 0.08);
    const dropFrom = slot.y;
    const dropTo = TRAY.y0 + 0.004;
    const spin = (slot.col % 2 ? 1 : -1) * (0.5 + (slot.row % 3) * 0.2);

    // 1) vysunutí z police, zadní kus se posune dopředu
    tween(0.42, (k) => {
      const e = easeInOut(k);
      item.position.z = lerp(Z_FRONT, Z_EDGE, e);
      if (rear) rear.position.z = lerp(Z_REAR, Z_FRONT, e);
    }, () => {
      slot.front = rear;
      slot.rear = null;
      // 2) pád do výdeje
      const fallTime = 0.22 + Math.sqrt((dropFrom - dropTo)) * 0.42;
      tween(fallTime, (k) => {
        const e = k * k;
        item.position.y = lerp(dropFrom, dropTo, e);
        item.position.x = lerp(slot.x, restX, e);
        item.position.z = lerp(Z_EDGE, 0.25, k);
        item.rotation.z = spin * e;
        item.rotation.x = item.userData.tilt + 0.5 * e;
      }, () => {
        // 3) dopad: výrobek leží ve výdeji, rozsvítí se
        item.rotation.set(0, 0, Math.PI / 2 * Math.sign(spin));
        item.position.set(restX, dropTo + 0.034, 0.25);
        trayGlow = 1;
        emit('snackio:vend', { code: slot.code });
        tween(0.22, (k) => { item.position.y = dropTo + 0.034 + Math.sin(k * Math.PI) * 0.018; });
        // 4) po chvíli si ho „zákazník“ vezme
        tween(0.45, (k) => {
          const e = easeInOut(k);
          item.position.z = lerp(0.25, 0.6, e);
          item.position.y = lerp(dropTo + 0.034, dropTo + 0.12, e);
          item.scale.setScalar(1 - e);
        }, () => {
          stock.remove(item);
          trayGlow = 0;
          // 5) doplnění zadního kusu
          const fresh = place(slot, makeProduct(slot.recipe.type, slot.recipe.c1, slot.recipe.c2), Z_REAR);
          fresh.scale.setScalar(0.001);
          slot.rear = fresh;
          tween(0.35, (k) => fresh.scale.setScalar(easeOut(k)), () => { slot.busy = false; });
        }, 1.7);
      });
    });
    return true;
  }

  function setVenue(key) {
    if (!VENUES[key] || key === venueKey) return;
    venueKey = key;
    const v = VENUES[key];
    displayState.venue = v.label;
    if (!displayTimer) drawDisplay(); else displayState.venue = v.label;
    moodTarget.set(v.mood);
    moodPowerTarget = v.moodPower;
    const recipes = slotRecipes(key);
    slots.forEach((slot, i) => {
      slot.recipe = recipes[i];
      if (slot.busy) return;
      const olds = [slot.front, slot.rear];
      const delay = (slot.col * 0.035) + (ROWS - 1 - slot.row) * 0.05;
      slot.busy = true;
      tween(0.22, (k) => olds.forEach((o) => o && o.scale.setScalar(Math.max(0.001, 1 - easeInOut(k)))), () => {
        olds.forEach((o) => o && stock.remove(o));
        slot.front = place(slot, makeProduct(recipes[i].type, recipes[i].c1, recipes[i].c2), Z_FRONT);
        slot.rear = place(slot, makeProduct(recipes[i].type, recipes[i].c1, recipes[i].c2), Z_REAR);
        slot.front.scale.setScalar(0.001);
        slot.rear.scale.setScalar(0.001);
        tween(0.3, (k) => { const s = Math.max(0.001, easeOut(k)); slot.front.scale.setScalar(s); slot.rear.scale.setScalar(s); }, () => { slot.busy = false; });
      }, delay);
    });
    showOnDisplay('VYBERTE SI', '', 0);
  }

  const moodTarget = new THREE.Color(VENUES.office.mood);
  let moodPowerTarget = VENUES.office.moodPower;
  const hazeBase = new THREE.Color(0x2f8f73);

  // ---------- kamera: dva záběry, mezi kterými se jede podle scrollu ----------
  const SHOTS = {
    wide: [
      { pos: [-1.55, 1.32, 5.5], look: [-1.02, 1.02, 0], yaw: -0.42 },
      { pos: [1.35, 1.2, 4.55], look: [0.92, 1.1, 0], yaw: 0.3 },
    ],
    tall: [
      { pos: [0, 1.45, 8.6], look: [0, 1.86, 0], yaw: -0.3 },
      { pos: [0, 1.32, 7.5], look: [0, 1.98, 0], yaw: 0.22 },
    ],
  };
  let progress = 0, progressSmooth = 0, intro = still || options.skipIntro ? 1 : 0;
  let pointerX = 0, pointerY = 0, parX = 0, parY = 0;
  let dragYaw = 0, dragVel = 0, dragging = false, lastDragX = 0, idleTime = 0;
  const vPos = new THREE.Vector3(), vLook = new THREE.Vector3();

  function updateCamera(dt, time) {
    progressSmooth = still ? progress : lerp(progressSmooth, progress, 1 - Math.exp(-dt * 5));
    const aspect = camera.aspect;
    const set = aspect < 0.8 ? SHOTS.tall : SHOTS.wide;
    const k = easeInOut(clamp(progressSmooth, 0, 1));
    const a = set[0], b = set[1];
    // mezi úzkým a širokým oknem záběr plynule dorovnáme
    const squeeze = aspect >= 0.8 && aspect < 1.35 ? (1.35 - aspect) / 0.55 : 0;
    vPos.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k));
    vLook.set(lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k));
    vPos.z += squeeze * 2.2;
    // na tabletu na výšku je místa víc, kamera může blíž
    if (aspect < 0.8) vPos.z *= lerp(1, 0.76, clamp((aspect - 0.46) / 0.34, 0, 1));
    // úvodní nájezd kamery po načtení
    if (intro < 1) {
      intro = Math.min(1, intro + dt / 2.8);
      const e = 1 - easeOut(intro);
      vPos.z += e * 1.7;
      vPos.y += e * 0.35;
    }
    vLook.x *= 1 - squeeze * 0.55;
    vPos.x *= 1 - squeeze * 0.4;
    vLook.y += squeeze * 0.25;

    parX = lerp(parX, pointerX, 1 - Math.exp(-dt * 3));
    parY = lerp(parY, pointerY, 1 - Math.exp(-dt * 3));
    const sway = still ? 0 : Math.sin(time * 0.35) * 0.05;
    camera.position.set(vPos.x + parX * 0.32 + sway, vPos.y - parY * 0.14, vPos.z);
    camera.lookAt(vLook);

    if (!dragging) {
      dragYaw += dragVel * dt;
      dragVel *= Math.exp(-dt * 3.2);
      idleTime += dt;
      if (idleTime > 2.2) dragYaw = lerp(dragYaw, 0, 1 - Math.exp(-dt * 1.1));
    }
    dragYaw = clamp(dragYaw, -1.25, 1.25);
    machine.rotation.y = lerp(a.yaw, b.yaw, k) + dragYaw + parX * 0.06;
  }

  // ---------- ovládání ukazatelem ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null, downX = 0, downY = 0, moved = false, pointerInside = false, needPick = false;

  function setNdc(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function pick() {
    raycaster.setFromCamera(ndc, camera);
    const fronts = slots.filter((s) => s.front && !s.busy).map((s) => s.front);
    const hit = raycaster.intersectObjects(fronts, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.slot) o = o.parent;
    return o ? o.userData.slot : null;
  }
  function setHover(slot) {
    if (hovered === slot) return;
    hovered = slot;
    canvas.style.cursor = slot ? 'pointer' : (dragging ? 'grabbing' : 'grab');
  }

  canvas.addEventListener('pointermove', (ev) => {
    pointerInside = true;
    setNdc(ev);
    if (dragging) {
      const dx = ev.clientX - lastDragX;
      lastDragX = ev.clientX;
      if (Math.abs(ev.clientX - downX) + Math.abs(ev.clientY - downY) > 6) moved = true;
      dragYaw += dx * 0.006;
      dragVel = dx * 0.35;
      idleTime = 0;
    } else {
      needPick = true;
    }
  });
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true; moved = false;
    downX = lastDragX = ev.clientX; downY = ev.clientY;
    dragVel = 0; idleTime = 0;
    setNdc(ev);
    if (ev.pointerType === 'mouse') canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  function release(ev) {
    if (!dragging) return;
    dragging = false;
    if (!moved && ev.type === 'pointerup') {
      setNdc(ev);
      const slot = pick();
      if (slot) vend(slot);
    }
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { pointerInside = false; setHover(null); });
  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    pointerX = (ev.clientX / window.innerWidth) * 2 - 1;
    pointerY = (ev.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  canvas.style.cursor = 'grab';

  // ---------- smyčka ----------
  let width = 0, height = 0, visible = true, raf = 0, last = performance.now(), time = 0, firstFrame = true;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const hoverLift = new Map();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    resize();

    stepTweens(dt);
    if (displayTimer > 0) {
      displayTimer -= dt;
      if (displayTimer <= 0) { displayTimer = 0; showOnDisplay('VYBERTE SI', '', 0); }
    }

    updateCamera(dt, time);

    if (needPick && pointerInside && !dragging) { setHover(pick()); needPick = false; }
    slots.forEach((s) => {
      if (!s.front || s.busy) return;
      const target = s === hovered ? 1 : 0;
      const cur = hoverLift.get(s) || 0;
      const next = lerp(cur, target, 1 - Math.exp(-dt * 14));
      hoverLift.set(s, next);
      s.front.position.y = s.y + next * 0.012;
      s.front.position.z = Z_FRONT + next * 0.03;
    });

    mood.color.lerp(moodTarget, 1 - Math.exp(-dt * 3));
    mood.intensity = lerp(mood.intensity, 60 * moodPowerTarget, 1 - Math.exp(-dt * 3));
    haze.material.color.copy(hazeBase).lerp(mood.color, 0.45);

    const glowNow = lerp(trayLight.intensity, trayGlow * 1.6, 1 - Math.exp(-dt * 8));
    trayLight.intensity = glowNow;
    trayLedMat.color.setRGB(0.13 + glowNow * 0.5, 0.19 + glowNow * 0.55, 0.12 + glowNow * 0.2);

    if (!still) {
      const p = dustGeo.attributes.position;
      for (let i = 0; i < DUST; i++) {
        let y = p.getY(i) + dt * (0.018 + (i % 5) * 0.004);
        if (y > 3.4) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.01);
      }
      p.needsUpdate = true;
      signGlow.material.opacity = 0.38 + Math.sin(time * 1.7) * 0.03;
    }

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; emit('snackio:ready', {}); }
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => { visible = entries[0].isIntersecting && !document.hidden; }, { threshold: 0.01 })
    : null;
  if (io) io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) visible = false; else if (!io) visible = true; else { io.unobserve(canvas); io.observe(canvas); } });
  canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); cancelAnimationFrame(raf); emit('snackio:lost', {}); });

  resize();
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { progress = clamp(p, 0, 1); },
    setVenue,
    vendRandom() {
      const free = slots.filter((s) => s.front && !s.busy);
      if (free.length) vend(free[Math.floor(Math.random() * free.length)]);
    },
    venues: VENUES,
  };
}
