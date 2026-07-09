import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase, world, scale, MARKER_COLORS } from './config.js';
import { w2v, polar, makeRing, makeCyl, len2, clamp } from './math.js';
import { state, dom } from './state.js';

// WoW-style raid marker billboard: canvas texture with a glowing symbol
function makeMarkerSprite(i, colHex) {
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
  const ctx = cvs.getContext('2d');
  const col = '#' + colHex.toString(16).padStart(6, '0');
  ctx.translate(64, 64);
  ctx.beginPath();
  if (i === 0) {          // star
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 40 : 17, a = -Math.PI / 2 + k * Math.PI / 5;
      ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (i === 1) {   // circle
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
  } else if (i === 2) {   // diamond
    ctx.moveTo(0, -42); ctx.lineTo(28, 0); ctx.lineTo(0, 42); ctx.lineTo(-28, 0); ctx.closePath();
  } else {                // triangle
    ctx.moveTo(0, -36); ctx.lineTo(34, 28); ctx.lineTo(-34, 28); ctx.closePath();
  }
  ctx.shadowColor = col; ctx.shadowBlur = 26; ctx.fillStyle = col;
  ctx.fill(); ctx.fill(); // double fill intensifies the glow
  ctx.shadowBlur = 0; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.stroke();
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.4, 1.4, 1);
  return spr;
}

// Reposition markers along the raid path; the tank stands slightly in front
// of the raid, so its markers sit at offTankDistance instead of stackDistance.
export function setMarkerPositions(dist) {
  state.worldMarkers.forEach(m => {
    const pos = polar(m.angle, dist);
    m.beamOut.position.copy(w2v(pos, 1.3));
    m.beamIn.position.copy(w2v(pos, 1.3));
    m.sprite.position.copy(w2v(pos, 2.9));
    m.ring.position.copy(w2v(pos, .03));
  });
}

export function initScene() {
  // ── Three.js ─────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  scene.fog = new THREE.Fog(0x02030a, 18, 50);
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  dom.mount.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0x9bbdff, 0x120816, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6); keyLight.position.set(8, 14, 7); scene.add(keyLight);

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.keyLight = keyLight;

  // ── World markers — WoW-style: floating billboard symbol + light beam ────
  const markerAngles = [0, 1, 2, 3].map(i => -Math.PI / 2 + phase.raidDirection * i * phase.raidAdvanceDegrees * Math.PI / 180);
  const worldMarkers = markerAngles.map((angle, i) => {
    const col = MARKER_COLORS[i];
    const beamOut = new THREE.Mesh(new THREE.CylinderGeometry(.62, .82, 2.6, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const beamIn = new THREE.Mesh(new THREE.CylinderGeometry(.3, .44, 2.6, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const sprite = makeMarkerSprite(i, col);
    const ring = makeRing(16, col, .85, .055);
    [beamOut, beamIn, sprite, ring].forEach(o => scene.add(o));
    return { angle, beamOut, beamIn, sprite, ring, ringMat: ring.material };
  });
  state.worldMarkers = worldMarkers;
  setMarkerPositions(world.stackDistance);

  // ── Floor / room ──────────────────────────────────────────────────────────
  const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(world.roomRadius * scale, world.roomRadius * scale, .05, 160),
    new THREE.MeshStandardMaterial({ color: 0x05060d, roughness: .92, metalness: .02 }));
  floorMesh.position.y = -.04; scene.add(floorMesh);
  scene.add(makeRing(world.roomRadius, 0xffffff, .08, .022));
  const floorLineMat = new THREE.LineBasicMaterial({ color: 0x85d8ff, transparent: true, opacity: .18 });
  for (let r = 55; r <= world.roomRadius - 30; r += 38) { const rg = makeRing(r, 0x85d8ff, .14, .010); rg.position.y = .025; scene.add(rg); }
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([w2v(polar(a, 42), .035), w2v(polar(a, world.roomRadius - 10), .035)]), floorLineMat));
  }
  state.floorMesh = floorMesh;

  // ── Boss ──────────────────────────────────────────────────────────────────
  const boss = new THREE.Mesh(new THREE.SphereGeometry(world.bossRadius * scale, 32, 18),
    new THREE.MeshStandardMaterial({ color: 0x6f42c1, emissive: 0x2c104f, roughness: .4 }));
  boss.position.set(0, world.bossRadius * scale, 0); scene.add(boss);
  state.boss = boss;

  // ── Light zone ────────────────────────────────────────────────────────────
  const lightRing = makeRing(world.lightRadius, 0x55ccff, 1.0, .10); scene.add(lightRing);
  const lightRingGlow = makeRing(world.lightRadius, 0x88ddff, .28, .22); scene.add(lightRingGlow);
  const stackGlow = makeRing(7, 0xff9900, .85, .048); scene.add(stackGlow);
  // Warm disc: red inner fading to yellow — two layered discs
  const lightDiscRed = new THREE.Mesh(new THREE.CircleGeometry(world.lightRadius * scale * .55, 64),
    new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: .32, depthWrite: false }));
  lightDiscRed.renderOrder = 2; lightDiscRed.rotation.x = -Math.PI / 2; lightDiscRed.visible = false; scene.add(lightDiscRed);
  const lightDisc = new THREE.Mesh(new THREE.CircleGeometry(world.lightRadius * scale, 64),
    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: .26, depthWrite: false }));
  lightDisc.renderOrder = 1; lightDisc.rotation.x = -Math.PI / 2; lightDisc.visible = false; scene.add(lightDisc);
  state.lightRing = lightRing;
  state.lightRingGlow = lightRingGlow;
  state.stackGlow = stackGlow;
  state.lightDiscRed = lightDiscRed;
  state.lightDisc = lightDisc;

  // ── OT cylinder + cone ────────────────────────────────────────────────────
  const otCyl = makeCyl(0xffd45a, 0x553600, .21, .21, .72); scene.add(otCyl);
  const otConeMesh = (() => {
    const ha = Math.PI / 4, n = 24, r = world.coneLength * scale, pts = [];
    for (let i = 0; i < n; i++) {
      const a1 = -ha + i * (2 * ha / n), a2 = -ha + (i + 1) * (2 * ha / n);
      pts.push(0, .04, 0, Math.cos(a1) * r, .04, Math.sin(a1) * r, Math.cos(a2) * r, .04, Math.sin(a2) * r);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: .32, side: THREE.DoubleSide }));
    m.visible = false; scene.add(m); return m;
  })();
  state.otCyl = otCyl;
  state.otConeMesh = otConeMesh;

  // ── 17 AI cylinders ───────────────────────────────────────────────────────
  const aiPlayers = [];
  {
    const offsets = [];
    [[2, 6], [4, 7], [7, 4]].forEach(([r, n], ri) => {
      for (let j = 0; j < n; j++) { const a = j * (2 * Math.PI / n) + ri * .55; offsets.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    });
    for (let i = 0; i < 17; i++) {
      const isSP = i < 3, col = isSP ? 0x5599ff : 0x4466bb, emis = isSP ? 0x102244 : 0x0a1122;
      const h = .5 + Math.random() * .3; // slight per-player height variation
      const mesh = makeCyl(col, emis, .18, .18, h); scene.add(mesh);
      aiPlayers.push({
        mesh, baseY: h / 2 + .005, spIndex: isSP ? i : null, baseOffset: offsets[i] || { x: 0, y: 0 },
        wobblePhase: i * .91, wobbleAmp: 0.7, currentPos: { x: 0, y: -world.stackDistance },
        moveSpeedVar: (Math.random() * 2 - 1) * 0.1
      });
    }
  }
  state.aiPlayers = aiPlayers;

  // ── Player — 3D arrow pointing along facing direction ────────────────────
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, .48);      // tip (forward)
  arrowShape.lineTo(.3, -.3);     // right back corner
  arrowShape.lineTo(0, -.14);     // tail notch
  arrowShape.lineTo(-.3, -.3);    // left back corner
  arrowShape.closePath();
  const arrowGeom = new THREE.ExtrudeGeometry(arrowShape, { depth: .2, bevelEnabled: true, bevelThickness: .04, bevelSize: .03, bevelSegments: 2 });
  arrowGeom.rotateX(Math.PI / 2);   // lay flat: shape +Y (forward) → +Z
  arrowGeom.translate(0, .14, 0);   // center the extruded thickness
  const playerArrow = new THREE.Mesh(arrowGeom,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x999999, roughness: .6, metalness: .1 }));
  const playerRing = makeRing(11, 0xffffff, .82, .042);
  scene.add(playerArrow); scene.add(playerRing);
  const targetRing = makeRing(18, 0x85d8ff, .8, .055); targetRing.visible = false; scene.add(targetRing);
  state.playerArrow = playerArrow;
  state.playerRing = playerRing;
  state.targetRing = targetRing;

  // ── Immunity ──────────────────────────────────────────────────────────────
  const immuneMesh = new THREE.Mesh(new THREE.SphereGeometry(.28, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xaad372, emissive: 0x203a0c })); scene.add(immuneMesh);
  state.immuneMesh = immuneMesh;

  // ── Stun field ────────────────────────────────────────────────────────────
  const stunFieldMat = new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: .12 });
  const stunField = new THREE.Mesh(new THREE.CylinderGeometry(world.roomRadius * scale + .04, world.roomRadius * scale + .04, .035, 160), stunFieldMat);
  stunField.position.y = .01; stunField.visible = false; scene.add(stunField);
  state.stunFieldMat = stunFieldMat;
  state.stunField = stunField;

  // ── Laser flash overlay ───────────────────────────────────────────────────
  const laserFlashMat = new THREE.MeshBasicMaterial({ color: 0xff1010, transparent: true, opacity: 0 });
  const laserFlash = new THREE.Mesh(new THREE.CylinderGeometry(world.roomRadius * scale + .2, world.roomRadius * scale + .2, .04, 80), laserFlashMat);
  laserFlash.position.y = .012; scene.add(laserFlash);
  state.laserFlashMat = laserFlashMat;
  state.laserFlash = laserFlash;

  // ── Heaven beam (very thick) ──────────────────────────────────────────────
  const beamCyl = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a43, transparent: true, opacity: .96 }));
  beamCyl.visible = false; scene.add(beamCyl);
  const beamGlowCyl = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0x69d6ff, transparent: true, opacity: .3 }));
  beamGlowCyl.visible = false; scene.add(beamGlowCyl);
  const beamPulses = [0, 1, 2].map(() => { const r = makeRing(12, 0x69d6ff, .8, .035); r.visible = false; scene.add(r); return r; });
  state.beamCyl = beamCyl;
  state.beamGlowCyl = beamGlowCyl;
  state.beamPulses = beamPulses;

  // ── Shard cylinders ───────────────────────────────────────────────────────
  // Shard: tapered — thick at player end (radiusBottom/-Y), needle tip at far end (radiusTop/+Y)
  // Two layers: bright cyan inner + dark blue outer glow
  const shardInnerMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: .97, depthWrite: false });
  const shardOuterMat = new THREE.MeshBasicMaterial({ color: 0x1033cc, transparent: true, opacity: .52, depthWrite: false });
  const shardInners = Array.from({ length: 18 }, () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.008, .11, 1, 7), shardInnerMat);
    m.visible = false; m.renderOrder = 2; scene.add(m); return m;
  });
  const shardOuters = Array.from({ length: 18 }, () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.028, .20, 1, 7), shardOuterMat);
    m.visible = false; m.renderOrder = 1; scene.add(m); return m;
  });
  state.shardInnerMat = shardInnerMat;
  state.shardOuterMat = shardOuterMat;
  state.shardInners = shardInners;
  state.shardOuters = shardOuters;

  // ── Pulse triangles ───────────────────────────────────────────────────────
  const triGeom = new THREE.BufferGeometry();
  triGeom.setAttribute("position", new THREE.Float32BufferAttribute([0, .04, .48, -.22, .04, -.25, .22, .04, -.25], 3));
  triGeom.computeVertexNormals();
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xff2a43, side: THREE.DoubleSide });
  const pulseTriangles = Array.from({ length: 18 }, () => { const t = new THREE.Mesh(triGeom, pulseMat); t.visible = false; scene.add(t); return t; });
  state.pulseTriangles = pulseTriangles;

  // ── Splinter markers ──────────────────────────────────────────────────────
  const splinterMeshes = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.28, 18, 12),
      new THREE.MeshStandardMaterial({ color: 0xff5f86, emissive: 0x4f0619, roughness: .35 }));
    scene.add(m); return m;
  });
  state.splinterMeshes = splinterMeshes;

  // ── Add materials ─────────────────────────────────────────────────────────
  state.mPurp = new THREE.MeshStandardMaterial({ color: 0x9b69d7, emissive: 0x211039, roughness: .45 });
  state.mPink = new THREE.MeshStandardMaterial({ color: 0xff5f86, emissive: 0x3d0614, roughness: .45 });
  state.mWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x777777, roughness: .25 });
}

// ── Camera — WoW-style orbit around the player ───────────────────────────
export function camForward() { return { x: Math.sin(state.camYaw), y: Math.cos(state.camYaw) }; }

export function updateCamera(liftY) {
  const dist = Number(dom.camDistInput.value);
  const ref = len2(state.playerPos) < 1 ? { x: 0, y: -world.stackDistance } : state.playerPos;
  const fwd = camForward();
  const horiz = dist * Math.cos(state.camPitch);
  const target = w2v(ref, 1.15 + liftY);
  // Rigid follow — WoW's camera tracks mouse and player movement with no smoothing
  state.camera.position.set(
    target.x - fwd.x * horiz,
    1.15 + liftY * .35 + dist * Math.sin(state.camPitch),
    target.z - fwd.y * horiz);
  state.camera.lookAt(target.x, target.y, target.z);
}

// ── Mouse camera controls ─────────────────────────────────────────────────
// Left-drag: orbit camera only. Right-drag: orbit camera AND turn the player.
// Scroll: zoom (drives the camera distance slider).
export function initCameraControls() {
  const el = state.renderer.domElement;
  let dragButton = -1, lastX = 0, lastY = 0;
  el.addEventListener("contextmenu", e => e.preventDefault());
  el.addEventListener("mousedown", e => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    dragButton = e.button; lastX = e.clientX; lastY = e.clientY;
    if (dragButton === 2) state.playerFacingDir = camForward();
  });
  window.addEventListener("mousemove", e => {
    if (dragButton < 0) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    state.camYaw -= dx * 0.006;
    state.camPitch = clamp(state.camPitch + dy * 0.005, 0.12, 1.5);
    if (dragButton === 2) state.playerFacingDir = camForward();
  });
  window.addEventListener("mouseup", e => { if (e.button === dragButton) dragButton = -1; });
  window.addEventListener("blur", () => { dragButton = -1; });
  el.addEventListener("wheel", e => {
    e.preventDefault();
    const s = dom.camDistInput;
    s.value = String(clamp(Number(s.value) + Math.sign(e.deltaY) * 1.2, Number(s.min), Number(s.max)));
  }, { passive: false });
}
