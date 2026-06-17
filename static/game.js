// ================================================================
// ESCAPE ROOM 3D - Complete Game Engine
// ================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ================================================================
// GAME STATE
// ================================================================
const STATE = {
  playerName: '',
  roomName: '',
  timerStart: null,
  timerInterval: null,
  elapsed: 0,
  gameStarted: false,
  gameWon: false,
  overlayOpen: false,
  isMobile: false,
  isPointerLocked: false,

  // Inventory
  inventory: [],

  // Zone 1
  hasPhone: false,
  phoneActive: false,
  zone1Solved: false,
  numpadInput: '',

  // Zone 2
  zone2Solved: false,
  alphaInput: '',

  // Zone 3
  valveActivated: false,
  waterLevel: 0,
  waterRising: false,
  keyFloated: false,
  hasKey: false,
  zone3Solved: false,
};

const ZONE1_CODE = '8492';
const ZONE2_CODE = 'N7X2';

// ================================================================
// THREE.JS GLOBALS
// ================================================================
let scene, camera, renderer, clock, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Raycaster
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
let interactiveObjects = [];
let currentTarget = null;

// Phone camera system (Zone 1)
let phoneCamera, phoneRenderTarget;

// Water system (Zone 3)
let waterMesh, goldenKeyMesh, valveMesh;

// Prison bars references
let bars1Group, bars2Group;

// Final door
let finalDoorMesh;

// Joystick data
const joystickData = { active: false, dx: 0, dy: 0 };
const lookData = { active: false, lastX: 0, lastY: 0 };

// Texture loader
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// ================================================================
// DOM REFERENCES
// ================================================================
const DOM = {};
function cacheDom() {
  const ids = [
    'gameCanvas', 'crosshair', 'crosshairActive', 'interactPrompt', 'promptText',
    'timerDisplay', 'timerText', 'inventoryBar', 'inventorySlots',
    'mobileControls', 'joystickBase', 'joystickKnob', 'joystickZone', 'lookZone',
    'mobileInteractBtn', 'startScreen', 'enterBtn', 'playerName', 'roomName', 'controlsInfo',
    'phoneOverlay', 'phoneCanvas', 'phoneCloseBtn',
    'numpadOverlay', 'numpadDisplay', 'numpadCloseBtn', 'numpadMessage',
    'alphaOverlay', 'alphaDisplay', 'alphaCloseBtn', 'alphaMessage',
    'winScreen', 'finalTime', 'restartBtn',
    'loseScreen', 'loseRestartBtn',
    'loadingScreen', 'loadingFill', 'loadingText',
  ];
  ids.forEach(id => DOM[id] = document.getElementById(id));
}

// ================================================================
// ASSET LOADING
// ================================================================
const MODELS = {};
const TEXTURES = {};
let loadedCount = 0;
const totalAssets = 16; // 13 models + 3 textures

function updateLoadProgress() {
  loadedCount++;
  const pct = Math.round((loadedCount / totalAssets) * 100);
  if (DOM.loadingFill) DOM.loadingFill.style.width = pct + '%';
}

function loadTexture(name, url) {
  return new Promise(resolve => {
    textureLoader.load(url, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      TEXTURES[name] = tex;
      updateLoadProgress();
      resolve(tex);
    }, undefined, () => {
      updateLoadProgress();
      resolve(null);
    });
  });
}

function loadModel(name, url) {
  return new Promise(resolve => {
    gltfLoader.load(url, gltf => {
      MODELS[name] = gltf.scene;
      updateLoadProgress();
      resolve(gltf.scene);
    }, undefined, () => {
      updateLoadProgress();
      resolve(null);
    });
  });
}

async function loadAllAssets() {
  const promises = [
    loadTexture('concrete_diff', '/static/textures/concrete_diff.jpg'),
    loadTexture('concrete_nor', '/static/textures/concrete_nor.jpg'),
    loadTexture('concrete_rough', '/static/textures/concrete_rough.jpg'),
    loadModel('prison_bed', '/static/models/prison_bed.glb'),
    loadModel('shelf', '/static/models/shelf.glb'),
    loadModel('smartphone', '/static/models/smartphone.glb'),
    loadModel('prison_bars', '/static/models/prison_bars.glb'),
    loadModel('desk', '/static/models/desk.glb'),
    loadModel('whiteboard', '/static/models/whiteboard.glb'),
    loadModel('notebook', '/static/models/notebook.glb'),
    loadModel('valve', '/static/models/valve.glb'),
    loadModel('glass_tube', '/static/models/glass_tube.glb'),
    loadModel('golden_key', '/static/models/golden_key.glb'),
    loadModel('metal_door', '/static/models/metal_door.glb'),
    loadModel('poster', '/static/models/poster.glb'),
    loadModel('chair', '/static/models/chair.glb'),
  ];
  await Promise.all(promises);
}

// ================================================================
// NAYA ALPHABET - Canvas Texture Generation (Zone 2)
// ================================================================
function drawNayaSymbol(ctx, type, lines, x, y, size) {
  ctx.save();
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(139,0,0,0.5)';
  ctx.shadowBlur = 3;

  const half = size / 2;

  if (type === 'triangle') {
    // Inverted triangle = J-R
    ctx.beginPath();
    ctx.moveTo(x, y + half);
    ctx.lineTo(x - half, y - half);
    ctx.lineTo(x + half, y - half);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'square') {
    // Square = S-Z
    ctx.beginPath();
    ctx.rect(x - half, y - half, size, size);
    ctx.stroke();
  } else if (type === 'diamond') {
    // Diamond = 0-9
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);
    ctx.closePath();
    ctx.stroke();
  }

  // Draw internal lines
  const lineSpacing = size / (lines + 1);
  for (let i = 1; i <= lines; i++) {
    const ly = y - half + i * lineSpacing;
    const margin = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - half + margin + 4, ly);
    ctx.lineTo(x + half - margin - 4, ly);
    ctx.stroke();
  }
  ctx.restore();
}

function createNotebookTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Aged paper background
  ctx.fillStyle = '#f0e0c0';
  ctx.fillRect(0, 0, 512, 512);

  // Add noise/grain
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(${100 + Math.random() * 60},${80 + Math.random() * 40},${50 + Math.random() * 30},${Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Title
  ctx.fillStyle = '#3a2a1a';
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.fillText('مفتاح الشفرة', 256, 50);

  // Line underneath
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 60);
  ctx.lineTo(390, 60);
  ctx.stroke();

  // Example 1: Inverted triangle with 1 line = J
  drawNayaSymbol(ctx, 'triangle', 1, 120, 140, 60);
  ctx.fillStyle = '#3a2a1a';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('= J', 180, 148);

  // Example 2: Square with 2 lines = T
  drawNayaSymbol(ctx, 'square', 2, 120, 250, 60);
  ctx.fillText('= T', 180, 258);

  // Example 3: Diamond with 5 lines = 5
  drawNayaSymbol(ctx, 'diamond', 5, 120, 360, 60);
  ctx.fillText('= 5', 180, 368);

  // Instructions
  ctx.fillStyle = '#5a3a2a';
  ctx.font = '16px serif';
  ctx.textAlign = 'center';
  ctx.fillText('▽ مقلوب = J-R    □ = S-Z    ◇ = 0-9', 256, 460);
  ctx.fillText('عدد الخطوط = موقع الرمز', 256, 485);

  return new THREE.CanvasTexture(canvas);
}

function createWhiteboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Whiteboard background
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, 1024, 512);

  // Slight smudges
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(200,200,210,${Math.random() * 0.1})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 512, 5 + Math.random() * 20, 2 + Math.random() * 8);
  }

  // Title "الشفرة" scrawled on top
  ctx.fillStyle = '#333';
  ctx.font = 'bold 30px serif';
  ctx.textAlign = 'center';
  ctx.fillText('حل الشفرة', 512, 60);

  // 4 large symbols:
  // 1) Inverted triangle with 5 lines → N (J=1, K=2, L=3, M=4, N=5)
  drawNayaSymbol(ctx, 'triangle', 5, 150, 240, 120);

  // 2) Diamond with 7 lines → 7 (0=0+0 lines, so 7 lines = 7)
  drawNayaSymbol(ctx, 'diamond', 7, 370, 240, 120);

  // 3) Square with 6 lines → X (S=1, T=2, U=3, V=4, W=5, X=6)
  drawNayaSymbol(ctx, 'square', 6, 590, 240, 120);

  // 4) Diamond with 2 lines → 2
  drawNayaSymbol(ctx, 'diamond', 2, 810, 240, 120);

  // Question marks
  ctx.fillStyle = '#cc0000';
  ctx.font = 'bold 40px serif';
  ctx.fillText('?', 150, 400);
  ctx.fillText('?', 370, 400);
  ctx.fillText('?', 590, 400);
  ctx.fillText('?', 810, 400);

  return new THREE.CanvasTexture(canvas);
}

// ================================================================
// GREEN/UV NOISE SHADER for phone screen
// ================================================================
const PhoneShaderMaterial = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main(){
      vec4 color = texture2D(tDiffuse, vUv);
      float noise = rand(vUv + time * 0.1) * 0.15;
      // Green/UV tint
      color.r = color.r * 0.3 + noise * 0.5;
      color.g = color.g * 1.2 + 0.15 + noise;
      color.b = color.b * 0.6 + 0.08 + noise * 0.3;
      // Scanlines
      float scanline = sin(vUv.y * 300.0 + time * 5.0) * 0.04;
      color.rgb += scanline;
      color.a = 1.0;
      gl_FragColor = color;
    }
  `,
};

// ================================================================
// SCENE SETUP
// ================================================================
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.FogExp2(0x0a0a12, 0.015);

  clock = new THREE.Clock();

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: DOM.gameCanvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  // Camera
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 2);
  camera.layers.enable(0);
  // Main camera only sees layer 0 (not layer 1 where hidden code is)

  // Controls
  if (!STATE.isMobile) {
    controls = new PointerLockControls(camera, document.body);
  }

  // Phone camera for Zone 1 (sees layer 0 AND layer 1)
  phoneCamera = new THREE.PerspectiveCamera(60, 320 / 480, 0.1, 50);
  phoneCamera.layers.enable(0);
  phoneCamera.layers.enable(1);

  phoneRenderTarget = new THREE.WebGLRenderTarget(320, 480);

  // Minimal ambient light
  const ambient = new THREE.AmbientLight(0x334455, 0.8);
  scene.add(ambient);

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ================================================================
// LEVEL BUILDER
// ================================================================
function buildLevel() {
  const concreteMat = new THREE.MeshStandardMaterial({
    map: TEXTURES.concrete_diff || null,
    normalMap: TEXTURES.concrete_nor || null,
    roughnessMap: TEXTURES.concrete_rough || null,
    roughness: 0.9,
    metalness: 0.05,
    color: 0x555555,
  });

  if (TEXTURES.concrete_diff) {
    TEXTURES.concrete_diff.repeat.set(4, 4);
    if (TEXTURES.concrete_nor) TEXTURES.concrete_nor.repeat.set(4, 4);
    if (TEXTURES.concrete_rough) TEXTURES.concrete_rough.repeat.set(4, 4);
  }

  const corridorLength = 45;
  const corridorWidth = 4;
  const corridorHeight = 3.5;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(corridorWidth, corridorLength);
  const floor = new THREE.Mesh(floorGeo, concreteMat.clone());
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -corridorLength / 2 + 2);
  floor.receiveShadow = true;
  if (floor.material.map) {
    floor.material.map = floor.material.map.clone();
    floor.material.map.repeat.set(2, 12);
    floor.material.map.needsUpdate = true;
  }
  scene.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(floorGeo, concreteMat.clone());
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, corridorHeight, -corridorLength / 2 + 2);
  if (ceiling.material.map) {
    ceiling.material.map = ceiling.material.map.clone();
    ceiling.material.map.repeat.set(2, 12);
    ceiling.material.map.needsUpdate = true;
  }
  scene.add(ceiling);

  // Walls
  const wallGeo = new THREE.PlaneGeometry(corridorLength, corridorHeight);
  const wallMatClone = concreteMat.clone();
  if (wallMatClone.map) {
    wallMatClone.map = wallMatClone.map.clone();
    wallMatClone.map.repeat.set(12, 2);
    wallMatClone.map.needsUpdate = true;
  }

  // Left wall
  const leftWall = new THREE.Mesh(wallGeo, wallMatClone.clone());
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-corridorWidth / 2, corridorHeight / 2, -corridorLength / 2 + 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(wallGeo, wallMatClone.clone());
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(corridorWidth / 2, corridorHeight / 2, -corridorLength / 2 + 2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Back wall (start)
  const backWallGeo = new THREE.PlaneGeometry(corridorWidth, corridorHeight);
  const backWall = new THREE.Mesh(backWallGeo, concreteMat.clone());
  backWall.position.set(0, corridorHeight / 2, 2.5);
  backWall.rotation.y = Math.PI;
  scene.add(backWall);

  // End wall
  const endWall = new THREE.Mesh(backWallGeo, concreteMat.clone());
  endWall.position.set(0, corridorHeight / 2, -corridorLength + 2.5);
  scene.add(endWall);

  // Build zones
  buildZone1();
  buildZone2();
  buildZone3();
  buildLighting();
}

// ================================================================
// ZONE 1: Prison Cell (z = 2 to -12)
// ================================================================
function buildZone1() {
  const zoneStart = 0;

  // Prison bed
  if (MODELS.prison_bed) {
    const bed = MODELS.prison_bed.clone();
    bed.position.set(-1.2, 0, zoneStart - 3);
    bed.castShadow = true;
    scene.add(bed);
  }

  // Shelf
  if (MODELS.shelf) {
    const shelf = MODELS.shelf.clone();
    shelf.position.set(1.5, 0.8, zoneStart - 2);
    shelf.rotation.y = -Math.PI / 2;
    shelf.castShadow = true;
    scene.add(shelf);
  }

  // Smartphone on floor (pickable)
  if (MODELS.smartphone) {
    const phone = MODELS.smartphone.clone();
    phone.position.set(0.5, 0.02, zoneStart - 5);
    phone.rotation.y = Math.PI * 0.3;
    phone.userData = { type: 'phone', prompt: 'التقط الهاتف' };
    phone.castShadow = true;
    scene.add(phone);
    makeInteractive(phone);
  }

  // Poster on wall
  if (MODELS.poster) {
    const poster = MODELS.poster.clone();
    poster.position.set(-1.95, 1.5, zoneStart - 6);
    poster.rotation.y = Math.PI / 2;

    // Apply grunge poster texture
    const posterTex = createPosterTexture();
    poster.traverse(child => {
      if (child.isMesh && child.name === 'poster_surface') {
        child.material = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.9 });
      }
    });
    scene.add(poster);
  }

  // Hidden code "8492" on wall above poster (layer 1 only - invisible to main camera)
  const codeGroup = new THREE.Group();
  const codeMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff44,
    emissiveIntensity: 0.5,
    roughness: 0.8,
  });

  const codeText = '8492';
  const charWidth = 0.2;
  const startX = -((codeText.length - 1) * charWidth) / 2;

  codeText.split('').forEach((ch, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 100px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const charGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const charMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      emissive: 0x00ff44,
      emissiveIntensity: 0.8,
    });
    const charMesh = new THREE.Mesh(charGeo, charMat);
    charMesh.position.set(startX + i * charWidth, 0, 0);
    charMesh.layers.set(1); // Only visible on layer 1
    codeGroup.add(charMesh);
  });

  codeGroup.position.set(-1.94, 2.3, -6);
  codeGroup.rotation.y = Math.PI / 2;
  scene.add(codeGroup);

  // Prison bars 1 (barrier between zone 1 and zone 2)
  if (MODELS.prison_bars) {
    bars1Group = MODELS.prison_bars.clone();
    bars1Group.position.set(0, 0, -12);
    bars1Group.userData = { type: 'bars1_lock', prompt: 'افتح القفل الرقمي' };
    scene.add(bars1Group);
    makeInteractive(bars1Group);
  }
}

// ================================================================
// ZONE 2: Cipher Room (z = -12 to -27)
// ================================================================
function buildZone2() {
  const zoneStart = -15;

  // Desk
  if (MODELS.desk) {
    const desk = MODELS.desk.clone();
    desk.position.set(-0.5, 0, zoneStart - 3);
    desk.castShadow = true;
    scene.add(desk);
  }

  // Chair
  if (MODELS.chair) {
    const chair = MODELS.chair.clone();
    chair.position.set(-0.5, 0, zoneStart - 2);
    chair.rotation.y = Math.PI;
    chair.castShadow = true;
    scene.add(chair);
  }

  // Notebook on desk (with Naya alphabet hints)
  if (MODELS.notebook) {
    const notebook = MODELS.notebook.clone();
    notebook.position.set(-0.3, 0.78, zoneStart - 3.2);
    notebook.userData = { type: 'notebook', prompt: 'اقرأ الدفتر' };
    notebook.castShadow = true;

    const notebookTex = createNotebookTexture();
    notebook.traverse(child => {
      if (child.isMesh && child.name === 'top_page') {
        child.material = new THREE.MeshStandardMaterial({ map: notebookTex, roughness: 0.9 });
      }
    });

    scene.add(notebook);
    makeInteractive(notebook);
  }

  // Whiteboard on wall with cipher code
  if (MODELS.whiteboard) {
    const wb = MODELS.whiteboard.clone();
    wb.position.set(1.95, 1.5, zoneStart - 5);
    wb.rotation.y = -Math.PI / 2;
    wb.userData = { type: 'whiteboard', prompt: 'ادرس السبورة' };
    wb.castShadow = true;

    const wbTex = createWhiteboardTexture();
    wb.traverse(child => {
      if (child.isMesh && child.name === 'board_surface') {
        child.material = new THREE.MeshStandardMaterial({ map: wbTex, roughness: 0.2 });
      }
    });

    scene.add(wb);
    makeInteractive(wb);
  }

  // Prison bars 2 (barrier between zone 2 and zone 3)
  if (MODELS.prison_bars) {
    bars2Group = MODELS.prison_bars.clone();
    bars2Group.position.set(0, 0, -27);
    bars2Group.userData = { type: 'bars2_lock', prompt: 'افتح القفل الأبجدي' };
    scene.add(bars2Group);
    makeInteractive(bars2Group);
  }
}

// ================================================================
// ZONE 3: Water Escape (z = -27 to -43)
// ================================================================
function buildZone3() {
  const zoneStart = -30;

  // Glass tube with key inside
  if (MODELS.glass_tube) {
    const tube = MODELS.glass_tube.clone();
    tube.position.set(1.0, 0, zoneStart - 5);
    tube.castShadow = true;
    scene.add(tube);
  }

  // Golden key inside tube (starts at bottom)
  if (MODELS.golden_key) {
    goldenKeyMesh = MODELS.golden_key.clone();
    goldenKeyMesh.position.set(1.0, 0.15, zoneStart - 5);
    goldenKeyMesh.scale.set(2, 2, 2);
    goldenKeyMesh.userData = { type: 'golden_key', prompt: 'التقط المفتاح' };
    goldenKeyMesh.castShadow = true;
    scene.add(goldenKeyMesh);
    // Not interactive until floated to top
  }

  // Water inside tube (starts invisible, grows)
  const waterGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.01, 16);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2288cc,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.1,
  });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(1.0, 0.1, zoneStart - 5);
  waterMesh.visible = false;
  scene.add(waterMesh);

  // Valve on wall
  if (MODELS.valve) {
    valveMesh = MODELS.valve.clone();
    valveMesh.position.set(-1.8, 1.2, zoneStart - 6);
    valveMesh.rotation.y = Math.PI / 2;
    valveMesh.userData = { type: 'valve', prompt: 'أدر صمام المياه' };
    valveMesh.castShadow = true;
    scene.add(valveMesh);
    makeInteractive(valveMesh);
  }

  // Final metal door
  if (MODELS.metal_door) {
    finalDoorMesh = MODELS.metal_door.clone();
    finalDoorMesh.position.set(0, 0, -42.5);
    finalDoorMesh.userData = { type: 'final_door', prompt: 'استخدم المفتاح لفتح الباب' };
    finalDoorMesh.castShadow = true;
    scene.add(finalDoorMesh);
    makeInteractive(finalDoorMesh);
  }
}

// ================================================================
// POSTER TEXTURE
// ================================================================
function createPosterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark grunge background
  ctx.fillStyle = '#2a2218';
  ctx.fillRect(0, 0, 512, 512);

  // Random grunge marks
  for (let i = 0; i < 1000; i++) {
    ctx.fillStyle = `rgba(${Math.random() * 100},${Math.random() * 80},${Math.random() * 60},${Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 8, Math.random() * 8);
  }

  // Scrawled text / symbols
  ctx.fillStyle = '#884422';
  ctx.font = 'bold 40px serif';
  ctx.textAlign = 'center';
  ctx.fillText('لا مخرج', 256, 180);

  ctx.font = '24px serif';
  ctx.fillStyle = '#663311';
  ctx.fillText('ابحث عن الحقيقة المخفية', 256, 260);

  // Abstract symbols
  ctx.strokeStyle = '#553322';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(100 + Math.random() * 300, 300 + Math.random() * 150, 10 + Math.random() * 30, 0, Math.PI * 2);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

// ================================================================
// LIGHTING
// ================================================================
function buildLighting() {
  // Zone 1 lights - bright warm
  const z1Light = new THREE.PointLight(0xffcc88, 4, 20, 1);
  z1Light.position.set(0, 3, -2);
  z1Light.castShadow = true;
  z1Light.shadow.mapSize.set(512, 512);
  scene.add(z1Light);

  const z1Light2 = new THREE.PointLight(0xffcc88, 3, 18, 1);
  z1Light2.position.set(0, 3, -8);
  scene.add(z1Light2);

  const z1Spot = new THREE.SpotLight(0xddeeff, 5, 20, Math.PI / 4, 0.3, 0.5);
  z1Spot.position.set(0, 3.4, -5);
  z1Spot.target.position.set(0, 0, -5);
  z1Spot.castShadow = true;
  scene.add(z1Spot);
  scene.add(z1Spot.target);

  // Zone 2 lights - bright
  const z2Light = new THREE.PointLight(0xffcc88, 4, 20, 1);
  z2Light.position.set(0, 3, -16);
  z2Light.castShadow = true;
  scene.add(z2Light);

  const z2Light2 = new THREE.PointLight(0xffcc88, 3, 18, 1);
  z2Light2.position.set(0, 3, -22);
  scene.add(z2Light2);

  const z2Spot = new THREE.SpotLight(0xddeeff, 5, 20, Math.PI / 4, 0.3, 0.5);
  z2Spot.position.set(0, 3.4, -19);
  z2Spot.target.position.set(0, 0, -19);
  z2Spot.castShadow = true;
  scene.add(z2Spot);
  scene.add(z2Spot.target);

  // Zone 3 lights - bright
  const z3Light = new THREE.PointLight(0xffcc88, 4, 20, 1);
  z3Light.position.set(0, 3, -32);
  z3Light.castShadow = true;
  scene.add(z3Light);

  const z3Light2 = new THREE.PointLight(0xffcc88, 3, 18, 1);
  z3Light2.position.set(0, 3, -38);
  scene.add(z3Light2);

  const z3Spot = new THREE.SpotLight(0x88ccff, 5, 20, Math.PI / 4, 0.3, 0.5);
  z3Spot.position.set(0, 3.4, -35);
  z3Spot.target.position.set(0, 0, -37);
  z3Spot.castShadow = true;
  scene.add(z3Spot);
  scene.add(z3Spot.target);

  // Exit door spotlight
  const exitSpot = new THREE.SpotLight(0xff6600, 4, 12, Math.PI / 5, 0.4, 0.5);
  exitSpot.position.set(0, 3.4, -41);
  exitSpot.target.position.set(0, 1, -42.5);
  exitSpot.castShadow = true;
  scene.add(exitSpot);
  scene.add(exitSpot.target);

  // Additional corridor fill lights
  for (let z = 0; z >= -42; z -= 7) {
    const fill = new THREE.PointLight(0xaabbcc, 1.5, 10, 1);
    fill.position.set(0, 3.2, z);
    scene.add(fill);
  }
}

// ================================================================
// INTERACTION SYSTEM
// ================================================================
function makeInteractive(obj) {
  obj.traverse(child => {
    if (child.isMesh) {
      child.userData = { ...obj.userData };
    }
  });
  interactiveObjects.push(obj);
}

function checkRaycast() {
  if (STATE.overlayOpen || STATE.gameWon) return;

  raycaster.setFromCamera(screenCenter, camera);
  const allMeshes = [];
  interactiveObjects.forEach(obj => {
    obj.traverse(child => {
      if (child.isMesh) allMeshes.push(child);
    });
  });

  const hits = raycaster.intersectObjects(allMeshes, false);
  const validHit = hits.find(h => h.distance < 4 && h.object.userData.type);

  if (validHit) {
    currentTarget = validHit.object;
    showInteractPrompt(currentTarget.userData.prompt || 'تفاعل');
  } else {
    currentTarget = null;
    hideInteractPrompt();
  }
}

function showInteractPrompt(text) {
  DOM.crosshair?.classList.add('hidden');
  DOM.crosshairActive?.classList.remove('hidden');
  DOM.interactPrompt?.classList.remove('hidden');
  if (DOM.promptText) DOM.promptText.textContent = text;
  if (STATE.isMobile) DOM.mobileInteractBtn?.classList.remove('hidden');
}

function hideInteractPrompt() {
  DOM.crosshair?.classList.remove('hidden');
  DOM.crosshairActive?.classList.add('hidden');
  DOM.interactPrompt?.classList.add('hidden');
  if (STATE.isMobile) DOM.mobileInteractBtn?.classList.add('hidden');
}

function interact() {
  if (!currentTarget || STATE.overlayOpen || STATE.gameWon) return;
  const type = currentTarget.userData.type;

  switch (type) {
    case 'phone':
      pickUpPhone();
      break;
    case 'bars1_lock':
      if (!STATE.zone1Solved) openNumpad();
      break;
    case 'notebook':
      // Just viewing - the texture is on the model
      break;
    case 'whiteboard':
      // Just viewing - the texture is on the model
      break;
    case 'bars2_lock':
      if (!STATE.zone2Solved) openAlphaKeyboard();
      break;
    case 'valve':
      activateValve();
      break;
    case 'golden_key':
      pickUpKey();
      break;
    case 'final_door':
      tryOpenDoor();
      break;
  }
}

// ================================================================
// ZONE 1 LOGIC: Phone Camera Puzzle
// ================================================================
function pickUpPhone() {
  if (STATE.hasPhone) return;
  STATE.hasPhone = true;
  STATE.inventory.push({ id: 'phone', icon: '📱', name: 'هاتف ذكي' });
  updateInventoryUI();

  // Remove phone from scene
  const phoneObj = interactiveObjects.find(o => o.userData.type === 'phone');
  if (phoneObj) {
    scene.remove(phoneObj);
    interactiveObjects = interactiveObjects.filter(o => o !== phoneObj);
  }

  hideInteractPrompt();
}

function togglePhone() {
  if (!STATE.hasPhone || STATE.overlayOpen || STATE.gameWon) return;
  if (STATE.phoneActive) {
    closePhone();
  } else {
    openPhone();
  }
}

function openPhone() {
  STATE.phoneActive = true;
  STATE.overlayOpen = true;
  DOM.phoneOverlay?.classList.remove('hidden');

  if (!STATE.isMobile && controls) {
    controls.unlock();
  }
}

function closePhone() {
  STATE.phoneActive = false;
  STATE.overlayOpen = false;
  DOM.phoneOverlay?.classList.add('hidden');

  if (!STATE.isMobile && controls) {
    controls.lock();
  }
}

function renderPhoneView() {
  if (!STATE.phoneActive) return;

  // Position phone camera at player's position, looking same direction
  phoneCamera.position.copy(camera.position);
  phoneCamera.quaternion.copy(camera.quaternion);

  // Render to target
  renderer.setRenderTarget(phoneRenderTarget);
  renderer.render(scene, phoneCamera);
  renderer.setRenderTarget(null);

  // Draw to phone canvas with UV/green filter
  const phoneCanvas = DOM.phoneCanvas;
  if (!phoneCanvas) return;
  const ctx = phoneCanvas.getContext('2d');

  // Read pixels from render target
  const width = phoneRenderTarget.width;
  const height = phoneRenderTarget.height;
  const pixelBuffer = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(phoneRenderTarget, 0, 0, width, height, pixelBuffer);

  const imageData = ctx.createImageData(width, height);

  const time = clock.getElapsedTime();
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    const y = Math.floor((i / 4) / width);
    const noise = (Math.random() - 0.5) * 30;
    const scanline = Math.sin(y * 0.05 + time * 5) * 8;

    // Flip vertically (WebGL vs Canvas coordinate systems)
    const srcRow = height - 1 - Math.floor((i / 4) / width);
    const srcCol = (i / 4) % width;
    const srcIdx = (srcRow * width + srcCol) * 4;

    imageData.data[i] = pixelBuffer[srcIdx] * 0.3 + noise * 0.5 + scanline;
    imageData.data[i + 1] = pixelBuffer[srcIdx + 1] * 1.2 + 30 + noise + scanline;
    imageData.data[i + 2] = pixelBuffer[srcIdx + 2] * 0.6 + 15 + noise * 0.3 + scanline;
    imageData.data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Add overlay text
  ctx.fillStyle = 'rgba(0,255,100,0.6)';
  ctx.font = '12px monospace';
  ctx.fillText('UV-CAM v2.1', 10, 20);
  ctx.fillText(`T: ${time.toFixed(1)}s`, 10, 36);
}

// ================================================================
// NUMPAD (Zone 1 Lock)
// ================================================================
function openNumpad() {
  STATE.overlayOpen = true;
  STATE.numpadInput = '';
  updateNumpadDisplay();
  DOM.numpadOverlay?.classList.remove('hidden');
  if (DOM.numpadMessage) {
    DOM.numpadMessage.textContent = '';
    DOM.numpadMessage.className = 'overlay-msg';
  }
  if (!STATE.isMobile && controls) controls.unlock();
}

function closeNumpad() {
  STATE.overlayOpen = false;
  DOM.numpadOverlay?.classList.add('hidden');
  if (!STATE.isMobile && controls) controls.lock();
}

function numpadKeyPress(key) {
  if (key === 'clear') {
    STATE.numpadInput = '';
  } else if (key === 'enter') {
    checkZone1Code();
    return;
  } else if (STATE.numpadInput.length < 4) {
    STATE.numpadInput += key;
  }
  updateNumpadDisplay();
}

function updateNumpadDisplay() {
  if (!DOM.numpadDisplay) return;
  const display = STATE.numpadInput.padEnd(4, '-');
  DOM.numpadDisplay.textContent = display;
}

function checkZone1Code() {
  if (STATE.numpadInput === ZONE1_CODE) {
    STATE.zone1Solved = true;
    if (DOM.numpadMessage) {
      DOM.numpadMessage.textContent = 'تم فتح القفل!';
      DOM.numpadMessage.className = 'overlay-msg success';
    }
    // Open bars animation
    if (bars1Group) {
      animateBarsOpen(bars1Group);
      interactiveObjects = interactiveObjects.filter(o => o !== bars1Group);
    }
    setTimeout(closeNumpad, 1200);
  } else {
    if (DOM.numpadMessage) {
      DOM.numpadMessage.textContent = 'رمز خاطئ!';
      DOM.numpadMessage.className = 'overlay-msg error';
    }
    STATE.numpadInput = '';
    updateNumpadDisplay();
  }
}

// ================================================================
// ALPHA KEYBOARD (Zone 2 Lock)
// ================================================================
function openAlphaKeyboard() {
  STATE.overlayOpen = true;
  STATE.alphaInput = '';
  updateAlphaDisplay();
  DOM.alphaOverlay?.classList.remove('hidden');
  if (DOM.alphaMessage) {
    DOM.alphaMessage.textContent = '';
    DOM.alphaMessage.className = 'overlay-msg';
  }
  if (!STATE.isMobile && controls) controls.unlock();
}

function closeAlphaKeyboard() {
  STATE.overlayOpen = false;
  DOM.alphaOverlay?.classList.add('hidden');
  if (!STATE.isMobile && controls) controls.lock();
}

function alphaKeyPress(key) {
  if (key === 'clear') {
    STATE.alphaInput = '';
  } else if (key === 'enter') {
    checkZone2Code();
    return;
  } else if (STATE.alphaInput.length < 4) {
    STATE.alphaInput += key;
  }
  updateAlphaDisplay();
}

function updateAlphaDisplay() {
  if (!DOM.alphaDisplay) return;
  const display = STATE.alphaInput.padEnd(4, '-');
  DOM.alphaDisplay.textContent = display;
}

function checkZone2Code() {
  if (STATE.alphaInput === ZONE2_CODE) {
    STATE.zone2Solved = true;
    if (DOM.alphaMessage) {
      DOM.alphaMessage.textContent = 'تم فتح القفل!';
      DOM.alphaMessage.className = 'overlay-msg success';
    }
    if (bars2Group) {
      animateBarsOpen(bars2Group);
      interactiveObjects = interactiveObjects.filter(o => o !== bars2Group);
    }
    setTimeout(closeAlphaKeyboard, 1200);
  } else {
    if (DOM.alphaMessage) {
      DOM.alphaMessage.textContent = 'رمز خاطئ!';
      DOM.alphaMessage.className = 'overlay-msg error';
    }
    STATE.alphaInput = '';
    updateAlphaDisplay();
  }
}

// ================================================================
// ZONE 3 LOGIC: Water & Key
// ================================================================
function activateValve() {
  if (STATE.valveActivated || !STATE.zone2Solved) return;
  STATE.valveActivated = true;
  STATE.waterRising = true;
  waterMesh.visible = true;

  // Animate valve rotation
  if (valveMesh) {
    const wheel = valveMesh.getObjectByName('valve_wheel');
    if (wheel) {
      const rotAnim = () => {
        if (!STATE.waterRising) return;
        wheel.rotation.z += 0.05;
        requestAnimationFrame(rotAnim);
      };
      rotAnim();
    }
  }

  // Remove valve from interactive after use
  interactiveObjects = interactiveObjects.filter(o => o !== valveMesh);
  hideInteractPrompt();
}

function updateWater(delta) {
  if (!STATE.waterRising) return;

  STATE.waterLevel = Math.min(STATE.waterLevel + delta * 0.15, 1);
  const waterHeight = STATE.waterLevel * 1.4;

  // Update water mesh
  waterMesh.scale.set(1, waterHeight * 100, 1);
  waterMesh.position.y = 0.1 + waterHeight / 2;

  // Float the key up
  if (goldenKeyMesh) {
    goldenKeyMesh.position.y = 0.15 + waterHeight;
    goldenKeyMesh.rotation.y += delta * 0.5;
  }

  if (STATE.waterLevel >= 1) {
    STATE.waterRising = false;
    STATE.keyFloated = true;
    // Make key interactive now
    if (goldenKeyMesh) {
      makeInteractive(goldenKeyMesh);
    }
  }
}

function pickUpKey() {
  if (!STATE.keyFloated || STATE.hasKey) return;
  STATE.hasKey = true;
  STATE.inventory.push({ id: 'key', icon: '🔑', name: 'مفتاح ذهبي' });
  updateInventoryUI();

  if (goldenKeyMesh) {
    scene.remove(goldenKeyMesh);
    interactiveObjects = interactiveObjects.filter(o => o !== goldenKeyMesh);
  }
  hideInteractPrompt();
}

function tryOpenDoor() {
  if (!STATE.hasKey) {
    // Show message that key is needed
    return;
  }

  STATE.zone3Solved = true;
  STATE.gameWon = true;
  stopTimer();

  // Animate door opening
  if (finalDoorMesh) {
    animateDoorOpen(finalDoorMesh);
  }

  // Show win screen after delay
  setTimeout(showWinScreen, 2000);
}

// ================================================================
// ANIMATIONS
// ================================================================
function animateBarsOpen(barsGroup) {
  const startY = barsGroup.position.y;
  const targetY = startY - 3.5;
  const duration = 1500;
  const startTime = Date.now();

  function anim() {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    barsGroup.position.y = startY + (targetY - startY) * eased;
    if (progress < 1) requestAnimationFrame(anim);
  }
  anim();
}

function animateDoorOpen(doorGroup) {
  const startRot = doorGroup.rotation.y;
  const targetRot = startRot - Math.PI / 2;
  const duration = 1500;
  const startTime = Date.now();

  function anim() {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    doorGroup.rotation.y = startRot + (targetRot - startRot) * eased;
    if (progress < 1) requestAnimationFrame(anim);
  }
  anim();
}

// ================================================================
// TIMER
// ================================================================
const TOTAL_TIME_MS = 10 * 60 * 1000; // 10 minutes

function startTimer() {
  STATE.timerStart = Date.now();
  STATE.elapsed = 0;
  DOM.timerDisplay?.classList.remove('hidden');
  STATE.timerInterval = setInterval(updateTimer, 100);
}

function updateTimer() {
  if (!STATE.timerStart || STATE.gameWon) return;
  STATE.elapsed = Date.now() - STATE.timerStart;
  const remaining = Math.max(0, TOTAL_TIME_MS - STATE.elapsed);
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  if (DOM.timerText) DOM.timerText.textContent = `${min}:${sec}`;

  // Change color when low time
  if (DOM.timerDisplay) {
    if (totalSec <= 60) {
      DOM.timerDisplay.style.color = '#ff2222';
      DOM.timerDisplay.style.borderColor = 'rgba(255,0,0,0.4)';
    } else if (totalSec <= 180) {
      DOM.timerDisplay.style.color = '#ffaa00';
      DOM.timerDisplay.style.borderColor = 'rgba(255,170,0,0.3)';
    }
  }

  // Time's up!
  if (remaining <= 0) {
    showLoseScreen();
  }
}

function stopTimer() {
  if (STATE.timerInterval) clearInterval(STATE.timerInterval);
}

function getFormattedTime() {
  const totalSec = Math.floor(STATE.elapsed / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function getRemainingTime() {
  const remaining = Math.max(0, TOTAL_TIME_MS - STATE.elapsed);
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function showLoseScreen() {
  STATE.gameWon = true; // reuse flag to stop game loop
  stopTimer();
  DOM.loseScreen?.classList.remove('hidden');
  if (!STATE.isMobile && controls) controls.unlock();
}

// ================================================================
// INVENTORY UI
// ================================================================
function updateInventoryUI() {
  DOM.inventoryBar?.classList.remove('hidden');
  if (!DOM.inventorySlots) return;
  DOM.inventorySlots.innerHTML = '';
  STATE.inventory.forEach(item => {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot active';
    slot.textContent = item.icon;
    slot.title = item.name;
    // Click to use item
    slot.addEventListener('click', () => useItem(item));
    DOM.inventorySlots.appendChild(slot);
  });
}

function useItem(item) {
  if (item.id === 'phone') {
    togglePhone();
  }
}

// ================================================================
// WIN SCREEN
// ================================================================
function showWinScreen() {
  DOM.winScreen?.classList.remove('hidden');
  if (DOM.finalTime) DOM.finalTime.textContent = getFormattedTime();

  // Send result to server
  const name = STATE.playerName || 'مجهول';
  fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      room: STATE.roomName || 'غرفة الهروب',
      time: getFormattedTime(),
      elapsed_ms: STATE.elapsed,
    }),
  }).catch(() => {});
}

// ================================================================
// CONTROLS
// ================================================================
function setupControls() {
  STATE.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);

  if (STATE.isMobile) {
    setupMobileControls();
    if (DOM.controlsInfo) DOM.controlsInfo.textContent = 'تحكم الجوال: عصا التحكم للحركة + سحب الشاشة للنظر | 10 دقائق للهروب!';
  } else {
    setupDesktopControls();
    if (DOM.controlsInfo) DOM.controlsInfo.textContent = 'التحكم: Z/S/Q/D للحركة | الفأرة للنظر | E أو انقر للتفاعل | F للهاتف | 10 دقائق للهروب!';
  }
}

function setupDesktopControls() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('click', onDesktopClick);
}

function onKeyDown(e) {
  if (STATE.overlayOpen) return;
  // French AZERTY: physical key positions
  // e.code = physical key, e.key = character produced
  // On French AZERTY laptops: Z=forward, S=back, Q=left, D=right
  // e.code 'KeyW' is physical W position (which is Z on AZERTY)
  // e.code 'KeyA' is physical A position (which is Q on AZERTY)
  // We support both e.code and e.key for maximum compatibility
  const key = e.key.toLowerCase();
  const code = e.code;

  // Forward: Z key (AZERTY) or W key (QWERTY)
  if (key === 'z' || key === 'w' || code === 'KeyW' || code === 'KeyZ') { moveForward = true; return; }
  // Backward: S key
  if (key === 's' || code === 'KeyS') { moveBackward = true; return; }
  // Left: Q key (AZERTY) or A key (QWERTY)
  if (key === 'q' || key === 'a' || code === 'KeyQ' || code === 'KeyA') { moveLeft = true; return; }
  // Right: D key
  if (key === 'd' || code === 'KeyD') { moveRight = true; return; }
  // Interact: E key
  if (key === 'e' || code === 'KeyE') { interact(); return; }
  // Phone: F key
  if ((key === 'f' || code === 'KeyF') && STATE.hasPhone) { togglePhone(); return; }
}

function onKeyUp(e) {
  const key = e.key.toLowerCase();
  const code = e.code;

  if (key === 'z' || key === 'w' || code === 'KeyW' || code === 'KeyZ') { moveForward = false; return; }
  if (key === 's' || code === 'KeyS') { moveBackward = false; return; }
  if (key === 'q' || key === 'a' || code === 'KeyQ' || code === 'KeyA') { moveLeft = false; return; }
  if (key === 'd' || code === 'KeyD') { moveRight = false; return; }
}

function onDesktopClick() {
  if (STATE.overlayOpen || !STATE.gameStarted) return;
  if (controls && !controls.isLocked) {
    controls.lock();
    return;
  }
  interact();
}

function setupMobileControls() {
  DOM.mobileControls?.classList.remove('hidden');

  // Joystick - larger touch area, smoother response
  const joystickZone = DOM.joystickZone;
  const knob = DOM.joystickKnob;
  const base = DOM.joystickBase;

  if (joystickZone && knob && base) {
    let jCenter = { x: 0, y: 0 };
    let jTouchId = null;

    joystickZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      jTouchId = touch.identifier;
      const rect = base.getBoundingClientRect();
      jCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joystickData.active = true;
    }, { passive: false });

    joystickZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== jTouchId) continue;
        let dx = touch.clientX - jCenter.x;
        let dy = touch.clientY - jCenter.y;
        const maxR = 45;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        // Smooth deadzone: ignore very small movements
        const norm = dist / maxR;
        const deadzone = 0.1;
        const adjusted = norm < deadzone ? 0 : (norm - deadzone) / (1 - deadzone);
        joystickData.dx = dist > 0 ? (dx / dist) * adjusted : 0;
        joystickData.dy = dist > 0 ? (dy / dist) * adjusted : 0;
      }
    }, { passive: false });

    const endJoystick = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== jTouchId) continue;
        joystickData.active = false;
        joystickData.dx = 0;
        joystickData.dy = 0;
        knob.style.transform = 'translate(0,0)';
        jTouchId = null;
      }
    };
    joystickZone.addEventListener('touchend', endJoystick, { passive: false });
    joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });
  }

  // Look zone - full right side, smooth camera with sensitivity
  const lookZone = DOM.lookZone;
  if (lookZone) {
    let lookTouchId = null;
    const lookSensitivity = 0.004;

    lookZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      lookTouchId = touch.identifier;
      lookData.active = true;
      lookData.lastX = touch.clientX;
      lookData.lastY = touch.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== lookTouchId) continue;
        const dx = touch.clientX - lookData.lastX;
        const dy = touch.clientY - lookData.lastY;
        lookData.lastX = touch.clientX;
        lookData.lastY = touch.clientY;

        euler.setFromQuaternion(camera.quaternion);
        euler.y -= dx * lookSensitivity;
        euler.x -= dy * lookSensitivity;
        euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
    }, { passive: false });

    const endLook = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== lookTouchId) continue;
        lookData.active = false;
        lookTouchId = null;
      }
    };
    lookZone.addEventListener('touchend', endLook, { passive: false });
    lookZone.addEventListener('touchcancel', endLook, { passive: false });
  }

  // Mobile interact button
  DOM.mobileInteractBtn?.addEventListener('click', e => {
    e.stopPropagation();
    interact();
  });
}

// ================================================================
// MOVEMENT
// ================================================================
function updateMovement(delta) {
  if (STATE.overlayOpen || STATE.gameWon || !STATE.gameStarted) return;

  const speed = 4.0;
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  if (STATE.isMobile) {
    // Mobile joystick movement
    if (joystickData.active) {
      direction.z = joystickData.dy;
      direction.x = joystickData.dx;
    } else {
      direction.z = 0;
      direction.x = 0;
    }
    velocity.z -= direction.z * speed * delta * 50;
    velocity.x += direction.x * speed * delta * 50;
  } else {
    // Desktop AZERTY movement
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta * 50;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta * 50;
  }

  // Apply movement relative to camera direction
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const moveVec = new THREE.Vector3();
  if (STATE.isMobile) {
    moveVec.addScaledVector(forward, -velocity.z * delta);
    moveVec.addScaledVector(right, velocity.x * delta);
  } else {
    moveVec.addScaledVector(forward, velocity.z * delta);
    moveVec.addScaledVector(right, -velocity.x * delta);
  }

  const newPos = camera.position.clone().add(moveVec);

  // Simple collision bounds
  const margin = 0.3;
  newPos.x = Math.max(-2 + margin, Math.min(2 - margin, newPos.x));
  newPos.z = Math.max(-42.5 + margin, Math.min(2, newPos.z));

  // Zone barriers (can't pass if not solved)
  if (!STATE.zone1Solved && newPos.z < -11.5) newPos.z = -11.5;
  if (!STATE.zone2Solved && newPos.z < -26.5) newPos.z = -26.5;

  camera.position.x = newPos.x;
  camera.position.z = newPos.z;
  camera.position.y = 1.6; // Eye height
}

// ================================================================
// GAME LOOP
// ================================================================
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const delta = Math.min(clock.getDelta(), 0.1);

  if (STATE.gameStarted && !STATE.gameWon) {
    updateMovement(delta);
    checkRaycast();
    updateWater(delta);

    if (STATE.phoneActive) {
      renderPhoneView();
    }
  }

  renderer.render(scene, camera);
}

// ================================================================
// UI EVENT HANDLERS
// ================================================================
function setupUIEvents() {
  // Start button
  DOM.enterBtn?.addEventListener('click', startGame);

  // Numpad keys
  document.querySelectorAll('.numpad-key').forEach(btn => {
    btn.addEventListener('click', () => numpadKeyPress(btn.dataset.key));
  });

  // Numpad close
  DOM.numpadCloseBtn?.addEventListener('click', closeNumpad);

  // Alpha keyboard keys
  document.querySelectorAll('.alpha-key').forEach(btn => {
    btn.addEventListener('click', () => alphaKeyPress(btn.dataset.key));
  });

  // Alpha close
  DOM.alphaCloseBtn?.addEventListener('click', closeAlphaKeyboard);

  // Phone close
  DOM.phoneCloseBtn?.addEventListener('click', closePhone);

  // Restart button
  DOM.restartBtn?.addEventListener('click', () => location.reload());
  DOM.loseRestartBtn?.addEventListener('click', () => location.reload());
}

// ================================================================
// GAME START
// ================================================================
function startGame() {
  STATE.playerName = DOM.playerName?.value || 'مجهول';
  STATE.roomName = DOM.roomName?.value || 'غرفة الهروب';
  STATE.gameStarted = true;

  DOM.startScreen?.classList.remove('active');
  DOM.startScreen?.classList.add('hidden');
  DOM.crosshair?.classList.remove('hidden');

  startTimer();

  if (!STATE.isMobile && controls) {
    controls.lock();
  }

  // Send player info
  const isMob = STATE.isMobile;
  fetch('/api/pinfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: STATE.playerName,
      room: STATE.roomName,
      device: isMob ? 'mobile' : 'desktop',
      platform: navigator.platform || '',
      language: navigator.language || '',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    }),
  }).catch(() => {});
}

// ================================================================
// INITIALIZATION
// ================================================================
async function init() {
  cacheDom();
  setupControls();

  // Load assets
  DOM.loadingScreen?.classList.add('active');
  await loadAllAssets();

  // Init 3D
  initScene();
  buildLevel();

  // Hide loading, show start
  DOM.loadingScreen?.classList.remove('active');
  DOM.loadingScreen?.classList.add('hidden');

  // Setup UI
  setupUIEvents();

  // Start game loop
  gameLoop();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
