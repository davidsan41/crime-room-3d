// =====================================================================
//  ESCAPE ROOM 3D – Complete Game
// =====================================================================

// ============= CONSTANTS =============
const ADMIN_NAME = 'admin-louai';
const PUZZLE_DIGITS = ['7', '3', '9', '1', '4', '8'];
const ROOM_W = 10, ROOM_H = 3.5, ROOM_D = 8;
const PLAYER_HEIGHT = 1.6;
const MOVE_SPEED = 4.0;
const RADIO_TARGET = 1045; // FM 104.5

// ============= GAME STATE =============
const state = {
    playerName: '', roomNumber: '',
    timerStart: null, timerInterval: null, elapsed: 0,
    gameStarted: false, gameEnded: false,
    isAdmin: false, overlayOpen: false,
    lockActivated: false,
    solvedPuzzles: [false, false, false, false, false, false],
    lockDigits: ['_', '_', '_', '_', '_', '_'],
    mirrorsPlaced: [false, false, false],
    mirrorsFound: [false, false, false],
    inventory: [],
    selectedItem: null,
    lightBeamActive: true,
    diamondHit: false,
    // Puzzle states
    paperBurned: false,
    phonePickedUp: false,
    filterPickedUp: false,
    filterApplied: false,
    cupPlaced: false,
    coffeeBrewing: false,
    coffeeRevealed: false,
    sculptureOnX: false,
    lampOn: false,
    radioFound: false,
};

// ============= THREE.JS GLOBALS =============
let scene, camera, renderer, clock;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity, direction;
let raycaster, centerRay;
let interactiveObjects = [];
let isPointerLocked = false;
let isMobile = false;
let joystickData = { active: false, dx: 0, dy: 0 };
let lookData = { active: false, lastX: 0, lastY: 0 };
let euler;
let currentHover = null;

// 3D object references
let lightBeamLine, diamondMesh;
let mirrorBases = [], mirrorMeshes = [];
let paperMesh, lighterMesh, phoneMesh, filterMesh, paintingMesh;
let cupMesh, coffeeMachineMesh, sculptureMesh, deskLampMesh, xMarkMesh;
let radioMesh, doorMesh, lockScreenMesh;
let lightSpotlight;

// Mirror beam segments
let beamSegments = [];

// Audio context for sounds
let audioCtx;

// ============= START GAME =============
function startGame() {
    const name = document.getElementById('playerName').value.trim();
    const room = document.getElementById('roomNumber').value.trim();
    if (!name || !room) return;

    state.playerName = name;
    state.roomNumber = room;

    if (name === ADMIN_NAME) {
        state.isAdmin = true;
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        loadAdminData();
        return;
    }

    document.getElementById('startScreen').classList.add('hidden');
    sendPlayerInfo();
    init3D();
    state.gameStarted = true;
    state.timerStart = Date.now();
    state.timerInterval = setInterval(updateTimer, 100);
    document.getElementById('timerDisplay').classList.remove('hidden');
    document.getElementById('inventoryBar').classList.remove('hidden');
    document.getElementById('lockScreenHUD').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');

    if (isMobile) {
        document.getElementById('mobileControls').classList.remove('hidden');
    }

    updateInventoryUI();
    updateLockUI();
}

// ============= ADMIN =============
async function loadAdminData() {
    try {
        const [rRes, pRes] = await Promise.all([
            fetch('/api/results').then(r => r.json()),
            fetch('/api/pinfo').then(r => r.json()),
        ]);
        const rb = document.getElementById('resultsBody');
        rb.innerHTML = '';
        (rRes.results || []).forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.name}</td><td>${r.room}</td><td>${r.time}</td><td>${r.date || ''}</td>`;
            rb.appendChild(tr);
        });
        const pb = document.getElementById('playersBody');
        pb.innerHTML = '';
        (pRes.players || []).forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.name}</td><td>${p.room}</td><td>${p.device||''}</td><td>${p.platform||''}</td><td>${p.joinTime||''}</td>`;
            pb.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('adminResults').classList.add('hidden');
    document.getElementById('adminPlayers').classList.add('hidden');
    if (tab === 'results') {
        document.getElementById('adminResults').classList.remove('hidden');
        document.querySelectorAll('.admin-tab')[0].classList.add('active');
    } else {
        document.getElementById('adminPlayers').classList.remove('hidden');
        document.querySelectorAll('.admin-tab')[1].classList.add('active');
    }
}

// ============= PLAYER INFO =============
async function sendPlayerInfo() {
    try {
        await fetch('/api/pinfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: state.playerName,
                room: state.roomNumber,
                device: isMobile ? 'mobile' : 'desktop',
                platform: navigator.platform || '',
                language: navigator.language || '',
                screenWidth: screen.width,
                screenHeight: screen.height,
            }),
        });
    } catch (e) { console.error(e); }
}

// ============= TIMER =============
function updateTimer() {
    if (state.gameEnded) return;
    state.elapsed = Date.now() - state.timerStart;
    const s = Math.floor(state.elapsed / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const txt = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    document.getElementById('timerText').textContent = txt;
}

function getTimeString() {
    const s = Math.floor(state.elapsed / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ============= 3D INITIALIZATION =============
function init3D() {
    isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();
    euler = new THREE.Euler(0, 0, 0, 'YXZ');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.FogExp2(0x0a0a12, 0.04);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, PLAYER_HEIGHT, 3);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    raycaster.far = 4;
    centerRay = new THREE.Vector2(0, 0);

    buildRoom();
    buildFurniture();
    buildPuzzleObjects();
    buildRedHerrings();
    setupLights();
    setupControls();

    window.addEventListener('resize', onResize);
    animate();
}

// ============= PROCEDURAL TEXTURES =============
function makeCanvasTex(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    drawFn(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function wallTex() {
    return makeCanvasTex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#2a2535';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 800; i++) {
            ctx.fillStyle = `rgba(${100 + Math.random() * 50},${90 + Math.random() * 40},${110 + Math.random() * 50},0.15)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4);
        }
    });
}

function floorTex() {
    return makeCanvasTex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#1a1510';
        ctx.fillRect(0, 0, w, h);
        const tileSize = 64;
        for (let x = 0; x < w; x += tileSize) {
            for (let y = 0; y < h; y += tileSize) {
                const b = 20 + Math.random() * 15;
                ctx.fillStyle = `rgb(${b + 6},${b + 2},${b})`;
                ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
            }
        }
    });
}

function ceilTex() {
    return makeCanvasTex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#1e1e28';
        ctx.fillRect(0, 0, w, h);
    });
}

function woodTex() {
    return makeCanvasTex(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#3d2b1f';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 30; i++) {
            ctx.strokeStyle = `rgba(60,40,25,0.4)`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * h);
            ctx.lineTo(w, Math.random() * h);
            ctx.stroke();
        }
    });
}

// ============= ROOM GEOMETRY =============
function buildRoom() {
    const wt = wallTex(), ft = floorTex(), ct = ceilTex();
    ft.repeat.set(3, 2);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_W, ROOM_D),
        new THREE.MeshStandardMaterial({ map: ft, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_W, ROOM_D),
        new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = ROOM_H;
    scene.add(ceil);

    const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7 });

    // Back wall (has door)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
    backWall.position.set(0, ROOM_H / 2, -ROOM_D / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Front wall
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat.clone());
    frontWall.position.set(0, ROOM_H / 2, ROOM_D / 2);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    scene.add(frontWall);
    frontWall.userData = { type: 'uvWall' };
    interactiveObjects.push(frontWall);

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat.clone());
    leftWall.position.set(-ROOM_W / 2, ROOM_H / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat.clone());
    rightWall.position.set(ROOM_W / 2, ROOM_H / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Door frame on back wall
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 });
    const doorW = 1.0, doorH = 2.2;
    // Door
    doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, doorH, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.4, metalness: 0.1 })
    );
    doorMesh.position.set(2, doorH / 2, -ROOM_D / 2 + 0.05);
    doorMesh.castShadow = true;
    scene.add(doorMesh);

    // Door frame
    const df1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorH + 0.1, 0.12), doorFrameMat);
    df1.position.set(2 - doorW / 2 - 0.04, doorH / 2, -ROOM_D / 2 + 0.05);
    scene.add(df1);
    const df2 = df1.clone();
    df2.position.x = 2 + doorW / 2 + 0.04;
    scene.add(df2);
    const df3 = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.16, 0.08, 0.12), doorFrameMat);
    df3.position.set(2, doorH + 0.04, -ROOM_D / 2 + 0.05);
    scene.add(df3);

    // Lock screen panel next to door
    lockScreenMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, roughness: 0.3, metalness: 0.5 })
    );
    lockScreenMesh.position.set(2 + doorW / 2 + 0.35, 1.3, -ROOM_D / 2 + 0.06);
    lockScreenMesh.userData = { type: 'lockScreen', promptText: 'شاشة القفل' };
    lockScreenMesh.castShadow = true;
    scene.add(lockScreenMesh);
    interactiveObjects.push(lockScreenMesh);

    // Diamond above door
    const diamondGeo = new THREE.OctahedronGeometry(0.15, 0);
    diamondMesh = new THREE.Mesh(diamondGeo, new THREE.MeshStandardMaterial({
        color: 0x88ccff, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.8
    }));
    diamondMesh.position.set(2, doorH + 0.35, -ROOM_D / 2 + 0.12);
    diamondMesh.rotation.y = Math.PI / 4;
    scene.add(diamondMesh);
}

// ============= FURNITURE =============
function buildFurniture() {
    const wMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 });

    // === Table 1 (center-left) - for paper and lighter ===
    createTable(-2.5, 0, -1, 1.2, 0.75, 0.6, wMat);

    // === Desk with drawers (right side) ===
    createDesk(3.5, 0, 1.5, 1.4, 0.75, 0.7, wMat);

    // === Shelf on left wall ===
    createShelf(-ROOM_W / 2 + 0.15, 1.8, -1.5, 1.0, 0.03, 0.25, wMat);
    createShelf(-ROOM_W / 2 + 0.15, 1.2, -1.5, 1.0, 0.03, 0.25, wMat);

    // === Small table for coffee machine (back-left) ===
    createTable(-3.5, 0, -3, 0.8, 0.8, 0.5, wMat);

    // === Table for radio (front-right) ===
    createTable(3, 0, 3, 0.7, 0.6, 0.5, wMat);

    // === Desk for lamp + sculpture (right wall) ===
    createTable(ROOM_W / 2 - 0.8, 0, -0.5, 0.9, 0.75, 0.55, wMat);

    // === Bookshelf (front-left) ===
    createBookshelf(-ROOM_W / 2 + 0.4, 0, 2.5);
}

function createTable(x, y, z, w, h, d, mat) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
    top.position.set(x, h, z);
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);

    const legGeo = new THREE.BoxGeometry(0.04, h, 0.04);
    const legMat = mat.clone();
    const offsets = [
        [x - w / 2 + 0.04, h / 2, z - d / 2 + 0.04],
        [x + w / 2 - 0.04, h / 2, z - d / 2 + 0.04],
        [x - w / 2 + 0.04, h / 2, z + d / 2 - 0.04],
        [x + w / 2 - 0.04, h / 2, z + d / 2 - 0.04],
    ];
    offsets.forEach(p => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...p);
        leg.castShadow = true;
        scene.add(leg);
    });
}

function createDesk(x, y, z, w, h, d, mat) {
    createTable(x, y, z, w, h, d, mat);
    // Drawer
    const drawer = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.4, 0.12, d * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 })
    );
    drawer.position.set(x + 0.1, h - 0.1, z);
    drawer.userData = { type: 'drawer', promptText: 'درج المكتب', hasLighter: true };
    drawer.castShadow = true;
    scene.add(drawer);
    interactiveObjects.push(drawer);

    // Drawer handle
    const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    handle.position.set(x + 0.1, h - 0.1, z + d * 0.4 + 0.01);
    scene.add(handle);
}

function createShelf(x, y, z, w, h, d, mat) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    shelf.position.set(x + w / 2, y, z);
    shelf.castShadow = true;
    scene.add(shelf);
}

function createBookshelf(x, y, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1c13, roughness: 0.6 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.3), mat);
    frame.position.set(x, 1.0, z);
    frame.castShadow = true;
    scene.add(frame);

    // Books
    const colors = [0x8b1a1a, 0x1a3d8b, 0x1a6b1a, 0x6b5a1a, 0x5a1a6b, 0x1a5a5a];
    for (let i = 0; i < 6; i++) {
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.06 + Math.random() * 0.04, 0.22 + Math.random() * 0.06, 0.2),
            new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.7 })
        );
        book.position.set(x - 0.25 + i * 0.1, 1.55 + (i % 2) * 0.02, z + 0.02);
        book.rotation.z = (Math.random() - 0.5) * 0.1;
        book.castShadow = true;
        scene.add(book);

        // One book hides a mirror (mirror 2)
        if (i === 3) {
            book.userData = { type: 'bookWithMirror', promptText: 'كتاب', mirrorIndex: 1 };
            interactiveObjects.push(book);
        }
    }

    // Lower shelf books
    for (let i = 0; i < 5; i++) {
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.06 + Math.random() * 0.04, 0.2 + Math.random() * 0.05, 0.18),
            new THREE.MeshStandardMaterial({ color: colors[(i + 2) % 6], roughness: 0.7 })
        );
        book.position.set(x - 0.2 + i * 0.1, 0.55, z + 0.02);
        book.castShadow = true;
        scene.add(book);
    }
}

// ============= PUZZLE OBJECTS =============
function buildPuzzleObjects() {
    // === Light source (spotlight on floor for mirror puzzle) ===
    const lightHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })
    );
    lightHousing.position.set(-3, 0.08, -ROOM_D / 2 + 0.5);
    scene.add(lightHousing);

    // Light beam visualization
    buildLightBeam();

    // === Mirror bases (3 positions where mirrors need to be placed) ===
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.4, roughness: 0.4 });
    const basePositions = [
        { x: -3, z: -2, rotY: Math.PI / 4 },
        { x: 0, z: -2.5, rotY: Math.PI / 3 },
        { x: 2, z: -3.2, rotY: Math.PI / 6 },
    ];
    basePositions.forEach((bp, i) => {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 8), baseMat);
        base.position.set(bp.x, 0.03, bp.z);
        base.userData = { type: 'mirrorBase', index: i, promptText: 'قاعدة مرآة', rotY: bp.rotY };
        scene.add(base);
        interactiveObjects.push(base);
        mirrorBases.push(base);
    });

    // === Hidden mirrors (3 mirrors to find) ===
    // Mirror 0: in the desk drawer (found when opening drawer)
    // Mirror 1: behind a book (found when clicking book)
    // Mirror 2: under a shelf item

    // Mirror under shelf
    const hiddenMirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.01, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xaaccee, metalness: 0.9, roughness: 0.1 })
    );
    hiddenMirror.position.set(-ROOM_W / 2 + 0.5, 1.15, -1.3);
    hiddenMirror.userData = { type: 'hiddenMirror', mirrorIndex: 2, promptText: 'مرآة صغيرة' };
    scene.add(hiddenMirror);
    interactiveObjects.push(hiddenMirror);

    // === Puzzle 1: Paper on table ===
    paperMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.9, side: THREE.DoubleSide })
    );
    paperMesh.position.set(-2.5, 0.77, -1);
    paperMesh.rotation.x = -Math.PI / 2;
    paperMesh.userData = { type: 'paper', promptText: 'ورقة بيضاء', pickable: true, invName: 'ورقة', invIcon: '📄' };
    paperMesh.castShadow = true;
    scene.add(paperMesh);
    interactiveObjects.push(paperMesh);

    // === Puzzle 2: Phone on desk ===
    phoneMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.01, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.5 })
    );
    phoneMesh.position.set(3.3, 0.76, 1.5);
    phoneMesh.userData = { type: 'phone', promptText: 'هاتف ذكي', pickable: true, invName: 'هاتف', invIcon: '📱' };
    phoneMesh.castShadow = true;
    scene.add(phoneMesh);
    interactiveObjects.push(phoneMesh);

    // Phone screen glow
    const phoneScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: 0x112244, emissiveIntensity: 0.3 })
    );
    phoneScreen.position.set(3.3, 0.77, 1.5);
    phoneScreen.rotation.x = -Math.PI / 2;
    scene.add(phoneScreen);

    // === Puzzle 3: Abstract painting on wall ===
    const paintingCanvas = document.createElement('canvas');
    paintingCanvas.width = 200;
    paintingCanvas.height = 200;
    const pCtx = paintingCanvas.getContext('2d');
    // Chaotic lines
    pCtx.fillStyle = '#f0e8d0';
    pCtx.fillRect(0, 0, 200, 200);
    for (let i = 0; i < 60; i++) {
        pCtx.strokeStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
        pCtx.lineWidth = 1 + Math.random() * 3;
        pCtx.beginPath();
        pCtx.moveTo(Math.random() * 200, Math.random() * 200);
        pCtx.lineTo(Math.random() * 200, Math.random() * 200);
        pCtx.stroke();
    }
    // Hidden number in RED only (visible with red filter)
    pCtx.fillStyle = '#cc3333';
    pCtx.font = 'bold 80px Arial';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText(PUZZLE_DIGITS[2], 100, 100);

    const paintTex = new THREE.CanvasTexture(paintingCanvas);
    paintingMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.8),
        new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.8 })
    );
    paintingMesh.position.set(-ROOM_W / 2 + 0.02, 1.8, 0.5);
    paintingMesh.rotation.y = Math.PI / 2;
    paintingMesh.userData = { type: 'painting', promptText: 'لوحة تجريدية' };
    scene.add(paintingMesh);
    interactiveObjects.push(paintingMesh);

    // Red filter (hidden near shelf)
    filterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xff2222, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    filterMesh.position.set(-ROOM_W / 2 + 0.5, 1.82, -1.8);
    filterMesh.rotation.x = -Math.PI / 2;
    filterMesh.userData = { type: 'redFilter', promptText: 'ورقة بلاستيكية حمراء', pickable: true, invName: 'فلتر أحمر', invIcon: '🔴' };
    filterMesh.castShadow = true;
    scene.add(filterMesh);
    interactiveObjects.push(filterMesh);

    // === Puzzle 4: Black cup and coffee machine ===
    // Coffee machine
    coffeeMachineMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.35, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.4 })
    );
    coffeeMachineMesh.position.set(-3.5, 0.8 + 0.175, -3);
    coffeeMachineMesh.userData = { type: 'coffeeMachine', promptText: 'آلة صنع قهوة' };
    coffeeMachineMesh.castShadow = true;
    scene.add(coffeeMachineMesh);
    interactiveObjects.push(coffeeMachineMesh);

    // Coffee machine nozzle
    const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 })
    );
    nozzle.position.set(-3.5, 0.8 + 0.02, -3 + 0.05);
    scene.add(nozzle);

    // Black cup
    cupMesh = createCup(-3.2, 0.82, -3);
    cupMesh.userData = { type: 'cup', promptText: 'كوب أسود', pickable: true, invName: 'كوب', invIcon: '☕' };
    interactiveObjects.push(cupMesh);

    // === Puzzle 5: Metal sculpture, desk lamp, X mark ===
    // X mark on desk
    xMarkMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.15),
        new THREE.MeshStandardMaterial({
            color: 0xff0000, transparent: true, opacity: 0.6, side: THREE.DoubleSide
        })
    );
    xMarkMesh.position.set(ROOM_W / 2 - 0.8, 0.77, -0.5);
    xMarkMesh.rotation.x = -Math.PI / 2;
    scene.add(xMarkMesh);

    // Draw X on it
    const xCanvas = document.createElement('canvas');
    xCanvas.width = 64; xCanvas.height = 64;
    const xCtx = xCanvas.getContext('2d');
    xCtx.strokeStyle = '#ff0000';
    xCtx.lineWidth = 4;
    xCtx.beginPath(); xCtx.moveTo(10, 10); xCtx.lineTo(54, 54); xCtx.stroke();
    xCtx.beginPath(); xCtx.moveTo(54, 10); xCtx.lineTo(10, 54); xCtx.stroke();
    xMarkMesh.material.map = new THREE.CanvasTexture(xCanvas);
    xMarkMesh.material.color = new THREE.Color(0xffffff);
    xMarkMesh.material.needsUpdate = true;

    // Metal sculpture
    sculptureMesh = createSculpture(ROOM_W / 2 - 1.5, 0.77, 0.5);
    sculptureMesh.userData = { type: 'sculpture', promptText: 'مجسم معدني', pickable: true, invName: 'مجسم', invIcon: '🗿' };
    interactiveObjects.push(sculptureMesh);

    // Desk lamp
    deskLampMesh = createDeskLamp(ROOM_W / 2 - 0.5, 0.77, -0.8);
    deskLampMesh.userData = { type: 'deskLamp', promptText: 'مصباح مكتب' };
    interactiveObjects.push(deskLampMesh);

    // === Puzzle 6: Classic radio ===
    radioMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x5a3d2b, roughness: 0.5 })
    );
    radioMesh.position.set(3, 0.7, 3);
    radioMesh.userData = { type: 'radio', promptText: 'راديو كلاسيكي' };
    radioMesh.castShadow = true;
    scene.add(radioMesh);
    interactiveObjects.push(radioMesh);

    // Radio speaker grille
    const grille = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 })
    );
    grille.position.set(3, 0.72, 3 + 0.076);
    scene.add(grille);

    // Radio dial
    const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8),
        new THREE.MeshStandardMaterial({ color: 0xccaa00, metalness: 0.7 })
    );
    dial.position.set(3 + 0.1, 0.72, 3 + 0.076);
    dial.rotation.x = Math.PI / 2;
    scene.add(dial);

    // FM hint note (stuck somewhere)
    const hintCanvas = document.createElement('canvas');
    hintCanvas.width = 128; hintCanvas.height = 64;
    const hCtx = hintCanvas.getContext('2d');
    hCtx.fillStyle = '#f5f0c0';
    hCtx.fillRect(0, 0, 128, 64);
    hCtx.fillStyle = '#333';
    hCtx.font = '18px Arial';
    hCtx.textAlign = 'center';
    hCtx.fillText('FM 104.5', 64, 38);

    const hintNote = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.06),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(hintCanvas), roughness: 0.9, side: THREE.DoubleSide })
    );
    hintNote.position.set(ROOM_W / 2 - 0.02, 1.0, 2);
    hintNote.rotation.y = -Math.PI / 2;
    hintNote.userData = { type: 'fmHint', promptText: 'ملاحظة' };
    scene.add(hintNote);
    interactiveObjects.push(hintNote);
}

function createCup(x, y, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
    );
    body.position.y = 0.045;
    group.add(body);

    const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.005, 6, 8, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
    );
    handle.position.set(0.04, 0.045, 0);
    handle.rotation.z = Math.PI / 2;
    group.add(handle);

    group.position.set(x, y, z);
    group.castShadow = true;
    scene.add(group);
    return group;
}

function createSculpture(x, y, z) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });

    // Create a shape that casts a shadow looking like the digit
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.02, 8), mat);
    base.position.y = 0.01;
    group.add(base);

    // Vertical piece
    const v1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), mat);
    v1.position.set(0, 0.085, 0);
    group.add(v1);

    // Angled piece (creates shadow shape)
    const v2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), mat);
    v2.position.set(0.02, 0.12, 0);
    v2.rotation.z = 0.3;
    group.add(v2);

    const v3 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), mat);
    v3.position.set(0.04, 0.08, 0);
    group.add(v3);

    group.position.set(x, y, z);
    group.castShadow = true;
    group.traverse(c => { if (c.isMesh) c.castShadow = true; });
    scene.add(group);
    return group;
}

function createDeskLamp(x, y, z) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.4, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 12), mat);
    base.position.y = 0.01;
    group.add(base);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), mat);
    arm.position.set(0, 0.16, 0);
    arm.rotation.z = -0.3;
    group.add(arm);

    const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.08, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    shade.position.set(-0.08, 0.28, 0);
    shade.rotation.z = Math.PI;
    group.add(shade);

    group.position.set(x, y, z);
    group.castShadow = true;
    scene.add(group);
    return group;
}

// ============= LIGHT BEAM =============
function buildLightBeam() {
    // Simple line from light source toward mirrors
    updateBeamVisualization();
}

function updateBeamVisualization() {
    // Remove old segments
    beamSegments.forEach(s => scene.remove(s));
    beamSegments = [];

    if (!state.lightBeamActive) return;

    const points = [new THREE.Vector3(-3, 0.15, -ROOM_D / 2 + 0.5)];

    // Add mirror reflection points
    const mirrorPositions = [
        new THREE.Vector3(-3, 0.15, -2),
        new THREE.Vector3(0, 0.15, -2.5),
        new THREE.Vector3(2, 0.15, -3.2),
    ];

    let lastPoint = points[0];
    for (let i = 0; i < 3; i++) {
        if (state.mirrorsPlaced[i]) {
            const mp = mirrorPositions[i].clone();
            mp.y = 0.15;
            points.push(mp);
            lastPoint = mp;
        } else {
            // Beam stops here
            const dir = mirrorPositions[i].clone().sub(lastPoint).normalize();
            points.push(lastPoint.clone().add(dir.multiplyScalar(0.5)));
            break;
        }
    }

    // If all mirrors placed, beam goes to diamond
    if (state.mirrorsPlaced[0] && state.mirrorsPlaced[1] && state.mirrorsPlaced[2]) {
        points.push(diamondMesh.position.clone());
    }

    // Create beam line segments
    const beamMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.8 });
    for (let i = 0; i < points.length - 1; i++) {
        const geo = new THREE.BufferGeometry().setFromPoints([points[i], points[i + 1]]);
        const line = new THREE.Line(geo, beamMat);
        scene.add(line);
        beamSegments.push(line);
    }
}

// ============= RED HERRINGS =============
function buildRedHerrings() {
    const items = [
        { geo: new THREE.CylinderGeometry(0.03, 0.025, 0.08, 8), color: 0x888888, pos: [-1, 0.79, -1], name: 'كوب فارغ', icon: '🥤' },
        { geo: new THREE.BoxGeometry(0.02, 0.08, 0.06), color: 0xccaa00, pos: [3.6, 0.78, 1.3], name: 'مفتاح قديم', icon: '🔑' },
        { geo: new THREE.BoxGeometry(0.15, 0.01, 0.2), color: 0x4444aa, pos: [-2.2, 0.77, -0.8], name: 'مجلد فارغ', icon: '📁' },
        { geo: new THREE.BoxGeometry(0.06, 0.08, 0.04), color: 0x228822, pos: [3.8, 0.78, 1.7], name: 'علبة صغيرة', icon: '📦' },
        { geo: new THREE.SphereGeometry(0.03, 8, 8), color: 0xff4444, pos: [-3, 0.85, -2.8], name: 'كرة زجاجية', icon: '🔮' },
        { geo: new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), color: 0x333333, pos: [2, 0.77, -2], name: 'قلم', icon: '✏️' },
    ];

    items.forEach(item => {
        const mesh = new THREE.Mesh(
            item.geo,
            new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.5 })
        );
        mesh.position.set(...item.pos);
        mesh.userData = { type: 'redHerring', promptText: item.name, pickable: true, invName: item.name, invIcon: item.icon };
        mesh.castShadow = true;
        scene.add(mesh);
        interactiveObjects.push(mesh);
    });
}

// ============= LIGHTS =============
function setupLights() {
    const ambient = new THREE.AmbientLight(0x252535, 0.6);
    scene.add(ambient);

    // Main ceiling light
    const ceiling = new THREE.PointLight(0xffddaa, 0.8, 12);
    ceiling.position.set(0, ROOM_H - 0.2, 0);
    ceiling.castShadow = true;
    ceiling.shadow.mapSize.set(1024, 1024);
    scene.add(ceiling);

    // Light bulb mesh
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({ emissive: 0xffddaa, emissiveIntensity: 2 })
    );
    bulb.position.copy(ceiling.position);
    scene.add(bulb);

    // Spotlight for mirror puzzle (white light on floor)
    lightSpotlight = new THREE.SpotLight(0xffffff, 1.5, 8, Math.PI / 8, 0.3);
    lightSpotlight.position.set(-3, 0.5, -ROOM_D / 2 + 0.5);
    lightSpotlight.target.position.set(-3, 0, -2);
    lightSpotlight.castShadow = true;
    scene.add(lightSpotlight);
    scene.add(lightSpotlight.target);

    // Subtle accent lights
    const accent1 = new THREE.PointLight(0x4488ff, 0.3, 5);
    accent1.position.set(-3, 2, -2);
    scene.add(accent1);

    const accent2 = new THREE.PointLight(0xff8844, 0.2, 5);
    accent2.position.set(3, 2, 2);
    scene.add(accent2);
}

// ============= CONTROLS =============
function setupControls() {
    const canvas = renderer.domElement;

    if (!isMobile) {
        // PC: Pointer Lock
        canvas.addEventListener('click', () => {
            if (!state.overlayOpen && state.gameStarted && !state.gameEnded) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPointerLocked) return;
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= e.movementX * 0.002;
            euler.x -= e.movementY * 0.002;
            euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.x));
            camera.quaternion.setFromEuler(euler);
        });

        // AZERTY: Z=forward, S=back, Q=left, D=right
        document.addEventListener('keydown', (e) => {
            if (state.overlayOpen) return;
            switch (e.code) {
                case 'KeyW': case 'KeyZ': moveForward = true; break;
                case 'KeyS': moveBackward = true; break;
                case 'KeyA': case 'KeyQ': moveLeft = true; break;
                case 'KeyD': moveRight = true; break;
                case 'KeyE': case 'Space': tryInteract(); break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'KeyZ': moveForward = false; break;
                case 'KeyS': moveBackward = false; break;
                case 'KeyA': case 'KeyQ': moveLeft = false; break;
                case 'KeyD': moveRight = false; break;
            }
        });

        // Click to interact
        canvas.addEventListener('mousedown', (e) => {
            if (isPointerLocked && e.button === 0) tryInteract();
        });

    } else {
        // Mobile controls
        setupMobileControls();
    }
}

function setupMobileControls() {
    const joystickBase = document.getElementById('joystickBase');
    const joystickKnob = document.getElementById('joystickKnob');
    const joystickZone = document.getElementById('joystickZone');
    const lookZone = document.getElementById('lookZone');
    const interactBtn = document.getElementById('mobileInteractBtn');

    let joystickTouch = null;
    let lookTouch = null;
    const baseRect = () => joystickBase.getBoundingClientRect();
    const maxDist = 40;

    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickTouch = e.changedTouches[0].identifier;
        joystickData.active = true;
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouch) {
                const rect = baseRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                let dx = t.clientX - cx;
                let dy = t.clientY - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxDist) { dx = dx / dist * maxDist; dy = dy / dist * maxDist; }
                joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                joystickData.dx = dx / maxDist;
                joystickData.dy = dy / maxDist;
            }
        }
    }, { passive: false });

    const resetJoystick = () => {
        joystickTouch = null;
        joystickData.active = false;
        joystickData.dx = 0;
        joystickData.dy = 0;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
    };
    joystickZone.addEventListener('touchend', resetJoystick);
    joystickZone.addEventListener('touchcancel', resetJoystick);

    // Look zone
    lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        lookTouch = t.identifier;
        lookData.active = true;
        lookData.lastX = t.clientX;
        lookData.lastY = t.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouch) {
                const dx = t.clientX - lookData.lastX;
                const dy = t.clientY - lookData.lastY;
                lookData.lastX = t.clientX;
                lookData.lastY = t.clientY;

                euler.setFromQuaternion(camera.quaternion);
                euler.y -= dx * 0.004;
                euler.x -= dy * 0.004;
                euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.x));
                camera.quaternion.setFromEuler(euler);
            }
        }
    }, { passive: false });

    lookZone.addEventListener('touchend', () => { lookTouch = null; lookData.active = false; });
    lookZone.addEventListener('touchcancel', () => { lookTouch = null; lookData.active = false; });

    interactBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryInteract(); }, { passive: false });
}

// ============= INTERACTION =============
function tryInteract() {
    if (!currentHover || state.overlayOpen || state.gameEnded) return;
    const obj = currentHover;
    const data = obj.userData;

    switch (data.type) {
        case 'paper':
            if (data.pickable && !hasItem('ورقة')) {
                pickupItem(obj, data);
            }
            break;
        case 'phone':
            if (data.pickable && !hasItem('هاتف')) {
                pickupItem(obj, data);
            }
            break;
        case 'redFilter':
            if (data.pickable && !hasItem('فلتر أحمر')) {
                pickupItem(obj, data);
            }
            break;
        case 'cup':
            if (data.pickable && !hasItem('كوب')) {
                pickupItem(obj, data);
            }
            break;
        case 'sculpture':
            if (data.pickable && !hasItem('مجسم')) {
                pickupItem(obj, data);
            }
            break;
        case 'drawer':
            if (data.hasLighter && !state.mirrorsFound[0]) {
                state.mirrorsFound[0] = true;
                addToInventory('مرآة ١', '🪞');
                addToInventory('ولاعة', '🔥');
                showNotification('وجدت مرآة وولاعة في الدرج!');
                data.hasLighter = false;
            } else if (data.hasLighter) {
                addToInventory('ولاعة', '🔥');
                showNotification('وجدت ولاعة في الدرج!');
                data.hasLighter = false;
            }
            break;
        case 'bookWithMirror':
            if (!state.mirrorsFound[data.mirrorIndex]) {
                state.mirrorsFound[data.mirrorIndex] = true;
                addToInventory('مرآة ٢', '🪞');
                showNotification('وجدت مرآة خلف الكتاب!');
            }
            break;
        case 'hiddenMirror':
            if (!state.mirrorsFound[data.mirrorIndex]) {
                state.mirrorsFound[data.mirrorIndex] = true;
                addToInventory('مرآة ٣', '🪞');
                showNotification('وجدت مرآة صغيرة!');
                obj.visible = false;
            }
            break;
        case 'mirrorBase':
            placeMirrorOnBase(data.index);
            break;
        case 'painting':
            interactPainting();
            break;
        case 'coffeeMachine':
            interactCoffeeMachine();
            break;
        case 'deskLamp':
            interactDeskLamp();
            break;
        case 'radio':
            openRadio();
            break;
        case 'lockScreen':
            openDoorLock();
            break;
        case 'fmHint':
            showNotification('📻 FM 104.5');
            break;
        case 'uvWall':
            if (hasItem('هاتف') && state.selectedItem === 'هاتف') {
                openPhoneCamera();
            }
            break;
        case 'redHerring':
            if (data.pickable) {
                pickupItem(obj, data);
            }
            break;
    }
}

// ============= INVENTORY =============
function hasItem(name) {
    return state.inventory.some(it => it.name === name);
}

function addToInventory(name, icon) {
    if (hasItem(name)) return;
    state.inventory.push({ name, icon });
    updateInventoryUI();
}

function removeFromInventory(name) {
    state.inventory = state.inventory.filter(it => it.name !== name);
    if (state.selectedItem === name) state.selectedItem = null;
    updateInventoryUI();
}

function pickupItem(mesh, data) {
    addToInventory(data.invName, data.invIcon);
    mesh.visible = false;
    // Remove from interactive objects but keep reference
    const idx = interactiveObjects.indexOf(mesh);
    if (idx > -1) interactiveObjects.splice(idx, 1);
    showNotification(`التقطت: ${data.invName}`);
}

function updateInventoryUI() {
    const container = document.getElementById('inventorySlots');
    container.innerHTML = '';
    state.inventory.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'inv-slot' + (state.selectedItem === item.name ? ' selected' : '');
        slot.textContent = item.icon;
        slot.title = item.name;
        slot.onclick = () => {
            state.selectedItem = state.selectedItem === item.name ? null : item.name;
            updateInventoryUI();
            handleItemUse(item.name);
        };
        container.appendChild(slot);
    });
}

function handleItemUse(itemName) {
    if (!state.selectedItem) return;

    // Paper + Lighter = burn paper (Puzzle 1)
    if (state.selectedItem === 'ولاعة' && hasItem('ورقة') && !state.paperBurned) {
        solvePuzzle1();
    } else if (state.selectedItem === 'ورقة' && hasItem('ولاعة') && !state.paperBurned) {
        solvePuzzle1();
    }

    // Phone + UV Wall interaction handled in tryInteract

    // Red filter + painting = reveal number (Puzzle 3)
    if (state.selectedItem === 'فلتر أحمر' && !state.filterApplied) {
        // Will be resolved when clicking painting while holding filter
    }
}

// ============= MIRROR PUZZLE (Step Zero) =============
function placeMirrorOnBase(index) {
    const mirrorNames = ['مرآة ١', 'مرآة ٢', 'مرآة ٣'];
    const selectedMirror = mirrorNames.findIndex(name => state.selectedItem === name);

    if (selectedMirror === -1) {
        // Check if any mirror is selected
        const anyMirror = state.inventory.find(it => it.name.startsWith('مرآة'));
        if (anyMirror) {
            showNotification('اختر مرآة من المخزن أولاً');
        } else {
            showNotification('تحتاج مرآة لوضعها هنا');
        }
        return;
    }

    if (state.mirrorsPlaced[index]) {
        showNotification('المرآة موضوعة بالفعل');
        return;
    }

    state.mirrorsPlaced[index] = true;
    removeFromInventory(mirrorNames[selectedMirror]);

    // Show mirror on base
    const base = mirrorBases[index];
    const mirrorVis = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.12, 0.01),
        new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.9, roughness: 0.1 })
    );
    mirrorVis.position.set(base.position.x, 0.12, base.position.z);
    mirrorVis.rotation.y = base.userData.rotY;
    scene.add(mirrorVis);
    mirrorMeshes.push(mirrorVis);

    showNotification('تم وضع المرآة!');
    updateBeamVisualization();

    // Check if all 3 mirrors placed
    if (state.mirrorsPlaced[0] && state.mirrorsPlaced[1] && state.mirrorsPlaced[2]) {
        activateDiamond();
    }
}

function activateDiamond() {
    state.diamondHit = true;
    state.lockActivated = true;

    // Diamond glows
    diamondMesh.material.emissive = new THREE.Color(0x44aaff);
    diamondMesh.material.emissiveIntensity = 2;

    // Lock screen activates
    lockScreenMesh.material.emissive = new THREE.Color(0x004444);
    lockScreenMesh.material.emissiveIntensity = 0.5;

    updateLockUI();
    playSound(800, 0.3, 'sine');
    setTimeout(() => playSound(1000, 0.3, 'sine'), 200);
    setTimeout(() => playSound(1200, 0.3, 'sine'), 400);
    showNotification('تم تفعيل شاشة القفل!');
}

// ============= PUZZLE 1: Paper + Lighter =============
function solvePuzzle1() {
    if (state.solvedPuzzles[0]) return;
    state.paperBurned = true;
    state.solvedPuzzles[0] = true;
    removeFromInventory('ورقة');
    removeFromInventory('ولاعة');

    // Add burned paper with number to inventory (visual feedback)
    addToInventory('ورقة محروقة', '🔥');

    showNotification(`الورقة تحترق... ظهر الرقم ${PUZZLE_DIGITS[0]}!`);
    playPuzzleSolvedSound();
    fillLockDigit(0, PUZZLE_DIGITS[0]);
}

// ============= PUZZLE 2: Phone Camera UV =============
function openPhoneCamera() {
    if (state.overlayOpen) return;
    state.overlayOpen = true;
    document.getElementById('phoneCameraOverlay').classList.remove('hidden');
    if (isPointerLocked) document.exitPointerLock();

    // Draw UV view on canvas
    const canvas = document.getElementById('phoneCameraCanvas');
    const ctx = canvas.getContext('2d');

    // Dark green tint
    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // UV scan lines
    for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillStyle = `rgba(0,255,0,${0.02 + Math.random() * 0.03})`;
        ctx.fillRect(0, y, canvas.width, 1);
    }

    // Wall texture simulation
    ctx.fillStyle = 'rgba(0,80,0,0.3)';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

    // The hidden UV number
    ctx.fillStyle = 'rgba(0,255,100,0.8)';
    ctx.font = 'bold 160px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00ff44';
    ctx.shadowBlur = 30;
    ctx.fillText(PUZZLE_DIGITS[1], canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;

    // Noise
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(0,${150 + Math.random() * 100},0,${Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }

    // Solve puzzle 2 after viewing
    if (!state.solvedPuzzles[1]) {
        setTimeout(() => {
            state.solvedPuzzles[1] = true;
            showNotification(`كشفت الكاميرا عن الرقم ${PUZZLE_DIGITS[1]}!`);
            playPuzzleSolvedSound();
            fillLockDigit(1, PUZZLE_DIGITS[1]);
        }, 2000);
    }
}

function closePhoneCamera() {
    document.getElementById('phoneCameraOverlay').classList.add('hidden');
    state.overlayOpen = false;
}

// ============= PUZZLE 3: Painting + Red Filter =============
function interactPainting() {
    if (state.selectedItem === 'فلتر أحمر' && !state.solvedPuzzles[2]) {
        state.filterApplied = true;
        state.solvedPuzzles[2] = true;
        removeFromInventory('فلتر أحمر');

        // Change painting to show only red (the number)
        const c = document.createElement('canvas');
        c.width = 200; c.height = 200;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffcccc';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = '#cc0000';
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(PUZZLE_DIGITS[2], 100, 100);
        paintingMesh.material.map = new THREE.CanvasTexture(c);
        paintingMesh.material.needsUpdate = true;

        showNotification(`ظهر الرقم ${PUZZLE_DIGITS[2]} في اللوحة!`);
        playPuzzleSolvedSound();
        fillLockDigit(2, PUZZLE_DIGITS[2]);
    } else if (!hasItem('فلتر أحمر') && !state.solvedPuzzles[2]) {
        showNotification('لوحة بخطوط فوضوية... ربما تحتاج شيئاً لكشف السر');
    }
}

// ============= PUZZLE 4: Thermal Cup =============
function interactCoffeeMachine() {
    if (state.selectedItem === 'كوب' && !state.solvedPuzzles[3]) {
        state.cupPlaced = true;
        removeFromInventory('كوب');

        // Show cup under machine
        cupMesh.position.set(-3.5, 0.82, -3 + 0.12);
        cupMesh.visible = true;

        showNotification('يتم تحضير القهوة...');
        state.coffeeBrewing = true;

        // Animate cup color change
        let progress = 0;
        const brewInterval = setInterval(() => {
            progress += 0.02;
            if (progress >= 1) {
                clearInterval(brewInterval);
                state.coffeeRevealed = true;
                state.solvedPuzzles[3] = true;

                // Cup turns white revealing number
                cupMesh.traverse(child => {
                    if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
                        // Create texture with number
                        const tc = document.createElement('canvas');
                        tc.width = 128; tc.height = 64;
                        const tctx = tc.getContext('2d');
                        tctx.fillStyle = '#ffffff';
                        tctx.fillRect(0, 0, 128, 64);
                        tctx.fillStyle = '#333';
                        tctx.font = 'bold 40px Arial';
                        tctx.textAlign = 'center';
                        tctx.textBaseline = 'middle';
                        tctx.fillText(PUZZLE_DIGITS[3], 64, 32);
                        child.material = new THREE.MeshStandardMaterial({
                            map: new THREE.CanvasTexture(tc),
                            roughness: 0.4
                        });
                    }
                });

                showNotification(`ظهر الرقم ${PUZZLE_DIGITS[3]} على الكوب!`);
                playPuzzleSolvedSound();
                fillLockDigit(3, PUZZLE_DIGITS[3]);
            } else {
                cupMesh.traverse(child => {
                    if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
                        const c = new THREE.Color().lerpColors(
                            new THREE.Color(0x111111),
                            new THREE.Color(0xffffff),
                            progress
                        );
                        child.material.color = c;
                    }
                });
            }
        }, 100);
    } else if (!hasItem('كوب') && !state.cupPlaced) {
        showNotification('تحتاج كوباً لصنع القهوة');
    }
}

// ============= PUZZLE 5: Shadow =============
function interactDeskLamp() {
    if (!state.lampOn) {
        state.lampOn = true;

        // Add spotlight for shadow
        const shadowLight = new THREE.SpotLight(0xffeecc, 2, 5, Math.PI / 6, 0.3);
        shadowLight.position.set(ROOM_W / 2 - 0.5, 1.2, -0.8);
        shadowLight.target.position.set(ROOM_W / 2 - 0.8, 0.5, -0.5);
        shadowLight.castShadow = true;
        shadowLight.shadow.mapSize.set(1024, 1024);
        scene.add(shadowLight);
        scene.add(shadowLight.target);

        // Lamp glow
        const glow = new THREE.PointLight(0xffeecc, 0.5, 3);
        glow.position.set(ROOM_W / 2 - 0.5, 1.05, -0.8);
        scene.add(glow);

        showNotification('تم تشغيل المصباح');

        if (state.sculptureOnX) {
            solvePuzzle5();
        }
    }
}

function solvePuzzle5() {
    if (state.solvedPuzzles[4]) return;
    state.solvedPuzzles[4] = true;

    // Create a shadow number on the wall
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128; shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    sCtx.fillStyle = 'rgba(0,0,0,0)';
    sCtx.clearRect(0, 0, 128, 128);
    sCtx.fillStyle = 'rgba(0,0,0,0.6)';
    sCtx.font = 'bold 80px Arial';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText(PUZZLE_DIGITS[4], 64, 64);

    const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(shadowCanvas),
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    shadowPlane.position.set(ROOM_W / 2 - 0.01, 1.2, -0.5);
    shadowPlane.rotation.y = -Math.PI / 2;
    scene.add(shadowPlane);

    showNotification(`الظل يُشكّل الرقم ${PUZZLE_DIGITS[4]}!`);
    playPuzzleSolvedSound();
    fillLockDigit(4, PUZZLE_DIGITS[4]);
}

// ============= PUZZLE 6: Radio =============
function openRadio() {
    if (state.overlayOpen) return;
    state.overlayOpen = true;
    document.getElementById('radioOverlay').classList.remove('hidden');
    if (isPointerLocked) document.exitPointerLock();
    document.getElementById('radioSlider').value = 880;
    document.getElementById('radioDisplay').textContent = 'FM 88.0';
    document.getElementById('radioMessage').textContent = '';
}

function onRadioTune(val) {
    const freq = (parseInt(val) / 10).toFixed(1);
    document.getElementById('radioDisplay').textContent = `FM ${freq}`;

    const diff = Math.abs(parseInt(val) - RADIO_TARGET);
    const msgEl = document.getElementById('radioMessage');

    if (diff === 0) {
        msgEl.textContent = `📻 إشارة واضحة!`;
        msgEl.style.color = '#0f0';
        if (!state.solvedPuzzles[5]) {
            state.solvedPuzzles[5] = true;
            setTimeout(() => {
                showNotification(`الراديو يعرض الرقم ${PUZZLE_DIGITS[5]}!`);
                playPuzzleSolvedSound();
                fillLockDigit(5, PUZZLE_DIGITS[5]);
            }, 500);
        }
    } else if (diff < 20) {
        msgEl.textContent = '📻 إشارة قريبة...';
        msgEl.style.color = '#ff0';
    } else if (diff < 50) {
        msgEl.textContent = '📻 تشويش...';
        msgEl.style.color = '#f80';
    } else {
        msgEl.textContent = '📻 لا إشارة';
        msgEl.style.color = '#888';
    }
}

// ============= LOCK SYSTEM =============
function fillLockDigit(index, digit) {
    if (!state.lockActivated) {
        // Queue it - will be filled when lock activates
    }
    state.lockDigits[index] = digit;
    updateLockUI();
    playSound(1400, 0.15, 'sine');
}

function updateLockUI() {
    // HUD lock display
    for (let i = 0; i < 6; i++) {
        const slot = document.getElementById(`lockSlot${i}`);
        if (slot) {
            slot.textContent = state.lockDigits[i];
            slot.classList.toggle('filled', state.lockDigits[i] !== '_');
        }
    }

    const statusEl = document.getElementById('lockStatus');
    if (statusEl) {
        if (state.lockActivated) {
            statusEl.textContent = 'مفعّلة';
            statusEl.classList.add('active');
        } else {
            statusEl.textContent = 'غير مفعّلة';
            statusEl.classList.remove('active');
        }
    }
}

function openDoorLock() {
    if (state.overlayOpen) return;
    state.overlayOpen = true;
    document.getElementById('doorLockOverlay').classList.remove('hidden');
    if (isPointerLocked) document.exitPointerLock();

    const bodyEl = document.getElementById('doorLockBody');
    const offEl = document.getElementById('doorLockOff');

    if (state.lockActivated) {
        bodyEl.classList.remove('hidden');
        offEl.classList.add('hidden');
        // Update door lock digits
        for (let i = 0; i < 6; i++) {
            const slot = document.getElementById(`dlSlot${i}`);
            if (slot) {
                slot.textContent = state.lockDigits[i];
                slot.classList.toggle('filled', state.lockDigits[i] !== '_');
            }
        }
    } else {
        bodyEl.classList.add('hidden');
        offEl.classList.remove('hidden');
    }
}

function confirmDoorCode() {
    const allFilled = state.lockDigits.every(d => d !== '_');
    const msgEl = document.getElementById('doorLockMsg');

    if (!allFilled) {
        msgEl.textContent = 'لم تكتمل جميع الأرقام بعد!';
        msgEl.style.color = '#f44';
        return;
    }

    // All puzzles solved - open door!
    msgEl.textContent = 'الرمز صحيح!';
    msgEl.style.color = '#0f0';
    playSound(600, 0.2, 'sine');
    setTimeout(() => playSound(800, 0.2, 'sine'), 150);
    setTimeout(() => playSound(1000, 0.3, 'sine'), 300);

    setTimeout(() => {
        closeOverlay('doorLockOverlay');
        winGame();
    }, 1000);
}

// ============= WIN =============
function winGame() {
    state.gameEnded = true;
    clearInterval(state.timerInterval);

    // Animate door opening
    const doorAnim = setInterval(() => {
        doorMesh.rotation.y += 0.05;
        if (doorMesh.rotation.y >= Math.PI / 2) {
            clearInterval(doorAnim);
        }
    }, 30);

    setTimeout(() => {
        const timeStr = getTimeString();
        document.getElementById('winTime').textContent = timeStr;
        document.getElementById('winPlayer').textContent = state.playerName;
        document.getElementById('winScreen').classList.remove('hidden');

        // Save result
        fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: state.playerName,
                room: state.roomNumber,
                time: timeStr,
                elapsed_ms: state.elapsed,
            }),
        }).catch(console.error);
    }, 1500);
}

// ============= OVERLAY MANAGEMENT =============
function closeOverlay(id) {
    document.getElementById(id).classList.add('hidden');
    state.overlayOpen = false;
}

// ============= NOTIFICATION =============
function showNotification(text) {
    const el = document.getElementById('notification');
    document.getElementById('notifText').textContent = text;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ============= SOUND =============
function playSound(freq, duration, type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

function playPuzzleSolvedSound() {
    playSound(523, 0.15, 'sine');
    setTimeout(() => playSound(659, 0.15, 'sine'), 100);
    setTimeout(() => playSound(784, 0.2, 'sine'), 200);
    setTimeout(() => playSound(1047, 0.3, 'sine'), 300);
}

// ============= ANIMATION LOOP =============
function animate() {
    requestAnimationFrame(animate);
    if (state.gameEnded && !doorMesh) return;

    const delta = Math.min(clock.getDelta(), 0.1);

    // Movement
    if (state.gameStarted && !state.gameEnded && !state.overlayOpen) {
        velocity.x -= velocity.x * 8.0 * delta;
        velocity.z -= velocity.z * 8.0 * delta;

        if (!isMobile) {
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
        } else {
            direction.z = -joystickData.dy;
            direction.x = joystickData.dx;
        }
        direction.normalize();

        if (direction.z !== 0) velocity.z -= direction.z * MOVE_SPEED * delta;
        if (direction.x !== 0) velocity.x += direction.x * MOVE_SPEED * delta;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0; right.normalize();

        const move = new THREE.Vector3();
        move.addScaledVector(forward, velocity.z * delta);
        move.addScaledVector(right, velocity.x * delta);

        const newPos = camera.position.clone().add(move);

        // Collision with walls
        const margin = 0.3;
        newPos.x = Math.max(-ROOM_W / 2 + margin, Math.min(ROOM_W / 2 - margin, newPos.x));
        newPos.z = Math.max(-ROOM_D / 2 + margin, Math.min(ROOM_D / 2 - margin, newPos.z));
        newPos.y = PLAYER_HEIGHT;

        camera.position.copy(newPos);

        // Raycasting for interaction highlight
        raycaster.setFromCamera(centerRay, camera);
        const intersects = raycaster.intersectObjects(interactiveObjects, true);

        let foundInteractive = null;
        for (const hit of intersects) {
            let obj = hit.object;
            while (obj && !obj.userData.type) obj = obj.parent;
            if (obj && obj.userData.type) {
                foundInteractive = obj;
                break;
            }
        }

        const promptEl = document.getElementById('interactPrompt');
        const promptText = document.getElementById('promptText');
        const mobileBtn = document.getElementById('mobileInteractBtn');

        if (foundInteractive && foundInteractive !== currentHover) {
            currentHover = foundInteractive;
            promptText.textContent = foundInteractive.userData.promptText || 'تفاعل';
            promptEl.classList.remove('hidden');
            if (isMobile && mobileBtn) mobileBtn.classList.remove('hidden');
        } else if (!foundInteractive && currentHover) {
            currentHover = null;
            promptEl.classList.add('hidden');
            if (isMobile && mobileBtn) mobileBtn.classList.add('hidden');
        }

        // Drop items near X mark (Puzzle 5)
        if (state.selectedItem === 'مجسم' && !state.sculptureOnX) {
            const dist = camera.position.distanceTo(new THREE.Vector3(ROOM_W / 2 - 0.8, PLAYER_HEIGHT, -0.5));
            if (dist < 1.5) {
                // Auto-place when near X
                const nearX = new THREE.Vector3(ROOM_W / 2 - 0.8, 0.77, -0.5);
                const camDist = camera.position.distanceTo(nearX);
                if (camDist < 2) {
                    // Show hint
                }
            }
        }
    }

    // Diamond rotation
    if (diamondMesh) {
        diamondMesh.rotation.y += delta * 0.5;
        if (state.diamondHit) {
            diamondMesh.material.emissiveIntensity = 1.5 + Math.sin(Date.now() * 0.003) * 0.5;
        }
    }

    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============= CONTROLS INFO =============
document.addEventListener('DOMContentLoaded', () => {
    const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window);
    const info = document.getElementById('controlsInfo');
    if (info) {
        info.textContent = isMob
            ? 'التحكم: عصا افتراضية للحركة + سحب للنظر'
            : 'التحكم: Z/S/Q/D للحركة | الماوس للنظر | نقر للتفاعل';
    }
    isMobile = isMob;

    // Handle item placement via keyboard
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF' && state.selectedItem === 'مجسم' && !state.sculptureOnX) {
            const xPos = new THREE.Vector3(ROOM_W / 2 - 0.8, PLAYER_HEIGHT, -0.5);
            if (camera.position.distanceTo(xPos) < 2.5) {
                state.sculptureOnX = true;
                removeFromInventory('مجسم');

                // Place sculpture on X
                sculptureMesh.position.set(ROOM_W / 2 - 0.8, 0.77, -0.5);
                sculptureMesh.visible = true;

                showNotification('تم وضع المجسم على العلامة!');

                if (state.lampOn) {
                    solvePuzzle5();
                }
            }
        }
    });
});

// Make functions accessible from HTML
window.startGame = startGame;
window.closeOverlay = closeOverlay;
window.closePhoneCamera = closePhoneCamera;
window.onRadioTune = onRadioTune;
window.confirmDoorCode = confirmDoorCode;
window.showAdminTab = showAdminTab;
window.tryInteract = tryInteract;
