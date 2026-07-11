import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase3, world, scale } from '../config.js';
import { polar, sub2, add2, mul2, len2, w2v, makeRing, clamp, smooth, orientCylBetween } from '../math.js';
import { state } from '../state.js';
import { showMessage } from '../messages.js';
import { CONSTELLATION_WAVES, activeWave, runeSpotPos } from './p3-timing.js';

// ── Meshes (built once) ───────────────────────────────────────────────────
let stars = null, beams = null;
export function initConstellationMeshes() {
  if (stars) return;
  stars = Array.from({ length: phase3.starCount }, () => {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a1050, emissive: 0x8833ff, emissiveIntensity: .9, roughness: .3 }));
    const ring = makeRing(phase3.starImpactRadius, 0xff3366, .75, .05);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(phase3.starImpactRadius * scale, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: .18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    [orb, ring, disc].forEach(o => { o.visible = false; state.scene.add(o); });
    return { orb, ring, disc };
  });
  beams = Array.from({ length: phase3.starCount + 2 }, () => {
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: .9, depthWrite: false }));
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0x5511aa, transparent: true, opacity: .35, depthWrite: false }));
    inner.renderOrder = 2; outer.renderOrder = 1;
    [inner, outer].forEach(o => { o.visible = false; state.scene.add(o); });
    return { inner, outer };
  });
}
export function hideConstellationMeshes() {
  if (!stars) return;
  stars.forEach(s => { s.orb.visible = s.ring.visible = s.disc.visible = false; });
  beams.forEach(b => { b.inner.visible = b.outer.visible = false; });
}

// ── Wave layout generation (lazy, cached per wave key) ───────────────────
function generateWave(w) {
  const pts = [];
  let guard = 0;
  while (pts.length < phase3.starCount && guard++ < 400) {
    const a = Math.random() * Math.PI * 2;
    const r = phase3.starMinR + Math.random() * (phase3.starMaxR - phase3.starMinR);
    const p = polar(a, r);
    if (pts.some(q => len2(sub2(p, q)) < phase3.starMinSep)) continue;
    // Sets during a Requiem game land away from the rune spots (mirrors the
    // "spawn further from Light Siphons" hotfix) so the chain stays playable.
    if (w.duringGame) {
      let nearSpot = false;
      for (let i = 0; i < phase3.runeCount; i++)
        if (len2(sub2(p, runeSpotPos(i))) < phase3.starImpactRadius + 14) { nearSpot = true; break; }
      if (nearSpot) continue;
    }
    pts.push(p);
  }
  // Each star connects to its closest neighbour; deduped.
  const edgeSet = new Set(), edges = [];
  pts.forEach((p, i) => {
    let best = -1, bd = Infinity;
    pts.forEach((q, j) => { if (j !== i) { const d = len2(sub2(p, q)); if (d < bd) { bd = d; best = j; } } });
    const key = i < best ? `${i}-${best}` : `${best}-${i}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([i, best]); }
  });
  return { stars: pts, edges };
}
export function getWaveLayout(w) {
  if (!(w.key in state.p3.waves)) state.p3.waves[w.key] = generateWave(w);
  return state.p3.waves[w.key];
}

function segDist(p, a, b) {
  const ab = sub2(b, a), ap = sub2(p, a);
  const L2 = ab.x * ab.x + ab.y * ab.y || 1;
  const s = clamp((ap.x * ab.x + ap.y * ab.y) / L2, 0, 1);
  return len2(sub2(p, add2(a, mul2(ab, s))));
}

// Beam "flash" envelope: beams blink in and out; damage lands at each peak.
function flashIntensity(t, w) {
  let v = 0;
  for (let k = 0; k < phase3.beamFlashes; k++) {
    const peak = w.beamStart + k * phase3.beamFlashPeriod;
    v = Math.max(v, Math.exp(-((t - peak) * (t - peak)) / .045));
  }
  return v;
}

// ── Per-frame update: visuals + player damage checks ─────────────────────
export function updateConstellation(t) {
  const w = activeWave(t);
  if (!w) { hideConstellationMeshes(); return; }
  const lay = getWaveLayout(w);
  const falling = t < w.impact;
  const fadeP = t > w.lastFlash ? smooth((t - w.lastFlash) / phase3.starFade) : 0;
  stars.forEach((s, i) => {
    const p = lay.stars[i];
    if (!p) { s.orb.visible = s.ring.visible = s.disc.visible = false; return; }
    s.ring.visible = s.disc.visible = true;
    s.orb.visible = true;
    if (falling) {
      const fp = clamp((t - w.telegraphStart) / phase3.starFallTime, 0, 1);
      s.orb.position.copy(w2v(p, .25 + (1 - fp * fp) * 8.5)); // accelerating fall
      s.ring.material.opacity = .25 + fp * .55;
      s.disc.material.opacity = .06 + fp * .16;
      s.ring.position.copy(w2v(p, .03)); s.disc.position.copy(w2v(p, .028));
    } else {
      const since = t - w.impact;
      s.orb.position.copy(w2v(p, .25));
      const impactFlash = since < .35 ? (1 - since / .35) : 0;
      s.ring.material.opacity = (.55 + impactFlash * .45) * (1 - fadeP);
      s.disc.material.opacity = (.14 + impactFlash * .3) * (1 - fadeP);
      s.orb.material.emissiveIntensity = .9 + impactFlash * 2.2;
      s.ring.position.copy(w2v(p, .03)); s.disc.position.copy(w2v(p, .028));
      s.orb.scale.setScalar(1 - fadeP * .8);
    }
  });
  // Beams: faint pre-lines once stars have landed, deadly bright at flashes.
  beams.forEach((b, i) => {
    const e = lay.edges[i];
    if (!e || falling) { b.inner.visible = b.outer.visible = false; return; }
    const a3 = w2v(lay.stars[e[0]], .16), b3 = w2v(lay.stars[e[1]], .16);
    orientCylBetween(b.inner, a3, b3); orientCylBetween(b.outer, a3, b3);
    const pre = clamp((t - w.impact) / phase3.beamDelay, 0, 1);
    const fl = t >= w.beamStart - .1 ? flashIntensity(t, w) : 0;
    b.inner.material.opacity = (pre * .1 + fl * .9) * (1 - fadeP);
    b.outer.material.opacity = (pre * .06 + fl * .4) * (1 - fadeP);
  });
  hideExtra(lay);

  // Damage checks (player only — AI dodge on their own).
  const ck = state.p3.checked;
  if (!falling && t < w.impact + .2 && !ck.has(`${w.key}-impact`)) {
    ck.add(`${w.key}-impact`);
    for (const p of lay.stars) {
      if (len2(sub2(state.playerPos, p)) < phase3.starImpactRadius) {
        state.score -= 15; state.penalties.starImpact = (state.penalties.starImpact || 0) + 15;
        showMessage('HIT BY A DARK STAR! −15', 'danger', 2.5);
        break;
      }
    }
  }
  for (let k = 0; k < phase3.beamFlashes; k++) {
    const peak = w.beamStart + k * phase3.beamFlashPeriod, key = `${w.key}-f${k}`;
    if (Math.abs(t - peak) < .14 && !ck.has(key)) {
      ck.add(key);
      for (const e of lay.edges) {
        if (segDist(state.playerPos, lay.stars[e[0]], lay.stars[e[1]]) < phase3.beamHalfWidth) {
          state.score -= 15; state.penalties.starBeam = (state.penalties.starBeam || 0) + 15;
          showMessage('CLIPPED BY A STARBEAM! −15', 'danger', 2.5);
          break;
        }
      }
    }
  }
}
function hideExtra(lay) {
  for (let i = lay.stars.length; i < stars.length; i++)
    stars[i].orb.visible = stars[i].ring.visible = stars[i].disc.visible = false;
  for (let i = lay.edges.length; i < beams.length; i++)
    beams[i].inner.visible = beams[i].outer.visible = false;
}

// ── AI dodge targets ──────────────────────────────────────────────────────
// While a wave is live, any non-busy AI whose current position OR intended
// destination (formation slot) is in danger (star impact or the predictable
// nearest-neighbour beams) picks a nearby safe offset. Re-scanned every
// frame so AI freed from a rune pair mid-wave still dodge; assigned offsets
// stay stable to avoid jitter. Returns a map aiIdx -> {x,y} or null.
export function computeAIDodges(t, aiPositions, busy, destinations) {
  const w = activeWave(t);
  if (!w) { state.p3.dodges = null; state.p3.dodgeWave = null; return null; }
  const lay = getWaveLayout(w);
  const dangerous = p => {
    for (const s of lay.stars) if (len2(sub2(p, s)) < phase3.starImpactRadius + 7) return true;
    for (const e of lay.edges) if (segDist(p, lay.stars[e[0]], lay.stars[e[1]]) < phase3.beamHalfWidth + 5) return true;
    return false;
  };
  const dodges = state.p3.dodgeWave === w.key ? state.p3.dodges : {};
  aiPositions.forEach((p, i) => {
    if (busy.has(i) || dodges[i]) return;
    if (!dangerous(p) && !dangerous(destinations[i])) return;
    const rv = len2(p) > 1 ? mul2(p, 1 / len2(p)) : { x: 0, y: 1 };
    const tv = { x: -rv.y, y: rv.x };
    outer:
    for (let off = 18; off <= 60; off += 12) {
      for (const dir of [tv, mul2(tv, -1), rv, mul2(rv, -1)]) {
        const c = add2(p, mul2(dir, off));
        if (len2(c) < world.roomRadius - 12 && len2(c) > world.bossRadius + 10 && !dangerous(c)) {
          dodges[i] = c; break outer;
        }
      }
    }
  });
  state.p3.dodges = dodges; state.p3.dodgeWave = w.key;
  return dodges;
}
