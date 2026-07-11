import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase3, world, scale } from '../config.js';
import { add2, sub2, mul2, len2, norm2, polar, w2v, clamp } from '../math.js';
import { state, dom } from '../state.js';
import { updateCamera, bossHeadScreen } from '../scene.js';
import { movePlayerFromKeys, RAID_MOVE_SPEED } from './player.js';
import { registerBreakdown } from './score.js';
import { setNextEventLabels } from '../ui.js';
import { showMessage } from '../messages.js';
import {
  activeRequiemGame, nextRequiemIn, activeWave, nextConstellationIn, CONSTELLATION_WAVES, requiemGameTimes
} from './p3-timing.js';
import { initRequiemMeshes, hideRequiemMeshes, setSpotMarksVisible, updateRequiem, playerRequiemDuty } from './p3-requiem.js';
import { initConstellationMeshes, hideConstellationMeshes, updateConstellation, computeAIDodges } from './p3-constellation.js';

export const phase3Duration = phase3.duration;

registerBreakdown('p3', [
  ['dissOrder', 'Touched out of order — Dissonance (−50 each)'],
  ['dissTimeout', 'Ran out the melody — Dissonance (−50 each)'],
  ['breach', 'Crossed the rift — Dimension Breach (−75 each)'],
  ['starImpact', 'Hit by a dark star impact (−15 each)'],
  ['starBeam', 'Clipped by a constellation beam (−15 each)'],
  ['resonanceClip', "Clipped by another pair's Resonance (−5 each)"],
], 'Time alive & in position');

// ── Severance meshes — the rift down the middle + two dimension tints ──────
let severance = null;
function initSeveranceMeshes() {
  if (severance) return;
  const R = world.roomRadius * scale, sv = phase3.severance;
  // Half-disc floor tints. CircleGeometry theta θ maps (after the -90° floor
  // tilt) to game x ∝ cosθ: θ∈[90°,270°] is cosθ≤0 = the WEST half.
  const westTint = new THREE.Mesh(new THREE.CircleGeometry(R, 64, Math.PI / 2, Math.PI),
    new THREE.MeshBasicMaterial({ color: sv.westColor, transparent: true, opacity: .13, depthWrite: false }));
  const eastTint = new THREE.Mesh(new THREE.CircleGeometry(R, 64, -Math.PI / 2, Math.PI),
    new THREE.MeshBasicMaterial({ color: sv.eastColor, transparent: true, opacity: .13, depthWrite: false }));
  [westTint, eastTint].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.y = .015; });
  // Bright rift line on the floor + a translucent energy curtain standing at x=0.
  const line = new THREE.Mesh(new THREE.BoxGeometry(.08, .02, 2 * R),
    new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: .55 }));
  line.position.y = .022;
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, sv.wallHeight),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .14, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  curtain.rotation.y = Math.PI / 2; curtain.position.set(0, sv.wallHeight / 2, 0);
  const meshes = [westTint, eastTint, line, curtain];
  meshes.forEach(m => { m.visible = false; state.scene.add(m); });
  severance = { meshes, curtain, base: meshes.map(m => m.material.opacity) };
}
function setSeveranceVisible(v) { if (severance) severance.meshes.forEach(m => m.visible = v); }
function updateSeverance(t) {
  if (!severance) return;
  setSeveranceVisible(true);
  const fade = clamp(t / phase3.introCast, 0, 1); // the rift forms during the opener
  severance.meshes.forEach((m, i) => m.material.opacity = severance.base[i] * fade);
  severance.curtain.material.opacity = severance.base[3] * fade * (.75 + .25 * Math.sin(t * 3));
}

// ── Init / reset ──────────────────────────────────────────────────────────
// state.p3 must exist before the first frame even if no reset ran yet
// (first start after page load goes straight to startMode).
let built = false;
export function initP3Scene() {
  if (!built) {
    built = true;
    initRequiemMeshes();
    initConstellationMeshes();
    initSeveranceMeshes();
    // Severance formation: the first `westAI` raiders share the player's WEST
    // dimension (they run the rune game); the rest ghost through the EAST
    // dimension. Each half spreads across its own semicircle, kept clear of
    // the rift at x=0.
    const westN = phase3.severance.westAI, total = state.aiPlayers.length, eastN = total - westN;
    let wi = 0, ei = 0;
    state.p3Formation = state.aiPlayers.map((_, i) => {
      const west = i < westN, dim = west ? 0 : 1;
      const n = west ? westN : eastN, li = west ? wi++ : ei++;
      const a0 = west ? 105 : -75, a1 = west ? 255 : 75; // degrees, margin off the rift
      const angle = (a0 + (li + 0.5) * (a1 - a0) / n) * Math.PI / 180 + (Math.random() - .5) * .05;
      return { dim, angle, radius: phase3.spreadRadius + (Math.random() - .5) * 14, speed: RAID_MOVE_SPEED * (0.92 + Math.random() * 0.16) };
    });
  }
  setSpotMarksVisible(true);
  setNextEventLabels('Requiem', 'Constellation');
  document.getElementById('cast-label').textContent = 'SEVERANCE';
  // Player starts in their WEST dimension; east raiders ghost (semi-transparent).
  state.playerPos = { x: -60, y: -125 };
  state.playerFacingDir = { x: 0, y: 1 };
  state.aiPlayers.forEach((ai, i) => {
    const f = state.p3Formation[i];
    ai.currentPos = polar(f.angle, f.radius);
    ai.mesh.material.transparent = f.dim === 1;
    ai.mesh.material.opacity = f.dim === 1 ? 0.4 : 1;
  });
}

export function resetP3() {
  state.p3 = {
    games: {}, waves: {}, checked: new Set(), pops: [],
    dodges: null, dodgeWave: null, melodyBuilt: -1,
    lastBreach: -99, sunderShown: false,
  };
  hideRequiemMeshes();
  hideConstellationMeshes();
  setSeveranceVisible(false);
  // Undo the east-dimension ghosting so raiders render solid again in P4.
  if (state.aiPlayers) state.aiPlayers.forEach(ai => { ai.mesh.material.transparent = false; ai.mesh.material.opacity = 1; });
  dom.raidNoteEl.style.display = '';
  document.getElementById('cast-label').textContent = 'REINTEGRATION';
}

// P4 leftovers that default to visible or persist across a phase switch.
function hideP4Meshes() {
  state.stackGlow.visible = state.lightRing.visible = state.lightRingGlow.visible = false;
  state.lightDisc.visible = state.lightDiscRed.visible = false;
  state.otCyl.visible = state.otConeMesh.visible = false;
  state.immuneMesh.visible = false;
  state.beamCyl.visible = state.beamGlowCyl.visible = false;
  state.beamPulses.forEach(r => r.visible = false);
  state.splinterMeshes.forEach(m => m.visible = false);
  state.shardInners.forEach(m => m.visible = false);
  state.shardOuters.forEach(m => m.visible = false);
  state.pulseTriangles.forEach(m => m.visible = false);
  state.stunField.visible = false;
  state.laserFlashMat.opacity = 0;
  state.worldMarkers.forEach(m => { m.sprite.visible = m.ring.visible = m.beamIn.visible = m.beamOut.visible = false; });
}

// ── AI raiders ────────────────────────────────────────────────────────────
// Seek-based movement: requiem duties override dodges override formation.
function updateAI(t, simDt, requiem) {
  const destinations = state.p3Formation.map(f => polar(f.angle, f.radius));
  const dodges = computeAIDodges(t, state.aiPlayers.map(a => a.currentPos), requiem.busy, destinations) || {};
  state.aiPlayers.forEach((ai, i) => {
    ai.mesh.visible = !state.deadAI.has(i);
    if (!ai.mesh.visible) return;
    const f = state.p3Formation[i];
    let target = requiem.targets[i] || dodges[i];
    if (!target) {
      const wob = { x: Math.sin(t * .85 + ai.wobblePhase) * ai.wobbleAmp, y: Math.cos(t * .72 + ai.wobblePhase * 1.3) * ai.wobbleAmp };
      target = add2(polar(f.angle, f.radius), wob);
    }
    const d = sub2(target, ai.currentPos), dist = len2(d);
    // Marked raiders hustle to their rune spots so even the farthest walk
    // settles before the chain starts at marks+5.5.
    const step = f.speed * (requiem.targets[i] ? 1.35 : 1) * simDt;
    ai.currentPos = dist <= step ? { ...target } : add2(ai.currentPos, mul2(d, step / dist));
    ai.mesh.position.copy(w2v(ai.currentPos, ai.baseY));
  });
}

// ── HUD ───────────────────────────────────────────────────────────────────
function fmtSecs(x) { return x == null ? '—' : `${x.toFixed(1)}s`; }
function updateHudP3(t) {
  let label = 'Holding';
  if (t < phase3.introCast) label = 'Severance';
  else {
    const gt = activeRequiemGame(t);
    const w = activeWave(t);
    if (w && t >= w.telegraphStart) label = 'Dark Constellation';
    if (gt && t >= gt.cast && t <= gt.deadline + 1) label = "Death's Requiem";
  }
  dom.clockEl.textContent = `${t.toFixed(1)}s`; dom.stateEl.textContent = label;
  let game = 0;
  for (let g = 0; g < 3; g++) if (t >= requiemGameTimes(g).cast) game = g;
  dom.cycleEl.textContent = `${game + 1} / 3`;
  dom.scorePillEl.textContent = Math.round(state.score);
  // Next-event countdowns
  const gt = activeRequiemGame(t);
  const requiemActive = gt && t >= gt.cast && t <= gt.deadline;
  dom.neAEl.textContent = requiemActive ? 'NOW' : fmtSecs(nextRequiemIn(t));
  dom.neAEl.classList.toggle('imminent', !requiemActive && (nextRequiemIn(t) ?? 99) <= 5);
  const w = activeWave(t);
  const waveActive = w && t <= w.lastFlash;
  dom.neBEl.textContent = waveActive ? 'NOW' : fmtSecs(nextConstellationIn(t));
  dom.neBEl.classList.toggle('imminent', !waveActive && (nextConstellationIn(t) ?? 99) <= 4);
}

// Boss cast bar: Requiem cast (singing) and standalone Constellation casts.
function updateBossCastBarP3(t) {
  let label = null, fill = 0, casting = true;
  const gt = activeRequiemGame(t);
  if (gt && t >= gt.cast && t < gt.marks) {
    label = "Death's Requiem"; fill = (t - gt.cast) / phase3.requiemCast;
  } else {
    for (const w of CONSTELLATION_WAVES) {
      if (w.cast !== null && t >= w.cast && t < w.impact) {
        label = 'Dark Constellation'; fill = (t - w.cast) / phase3.standaloneCast; break;
      }
    }
  }
  if (label === null) { dom.bossCastbarEl.classList.remove('show'); return; }
  dom.bcbLabelEl.textContent = label;
  dom.bcbFillEl.className = 'bcb-fill ' + (casting ? 'casting' : 'channeling');
  dom.bcbFillEl.style.width = `${clamp(fill, 0, 1) * 100}%`;
  dom.bossCastbarEl.classList.add('show');
  // Anchor above the boss head (same clamping as the P4 bar).
  const p = bossHeadScreen();
  const mx = innerWidth * 0.05, my = innerHeight * 0.05, barH = 46;
  dom.bossCastbarEl.style.left = `${clamp(p.x, mx, innerWidth - mx)}px`;
  dom.bossCastbarEl.style.top = `${clamp(p.behind ? my : p.y - barH, my, innerHeight - my - barH)}px`;
}

// Severance opener on the player cast bar.
function updateIntroCastBar(t) {
  const active = t < phase3.introCast;
  dom.castbarEl.classList.toggle('show', active);
  if (active) dom.castfillEl.style.width = `${(t / phase3.introCast * 100).toFixed(1)}%`;
}

// ── Scoring ───────────────────────────────────────────────────────────────
function updateScoreP3(t, simDt) {
  if (t < phase3.introCast || !state.running) return;
  const duty = playerRequiemDuty(t);
  let inPosition;
  if (duty) inPosition = len2(sub2(state.playerPos, duty.spot)) <= 22;
  else inPosition = Math.abs(len2(state.playerPos) - phase3.spreadRadius) <= phase3.spreadBand;
  if (inPosition) {
    const base = state.chaoticOn ? 1.15 : (state.helperOn ? .5 : 1);
    state.score += base * simDt; state.safeAccum += base * simDt;
  }
}

// ── Frame ─────────────────────────────────────────────────────────────────
export function updateP3Frame(dt, simDt) {
  // The phase is selected on the menu before initP3Scene runs (startMode);
  // until then there is nothing to update — the menu overlay covers the scene.
  if (!state.p3Formation) return;
  const t = state.time;
  hideP4Meshes();
  updateSeverance(t);

  if (state.running) movePlayerFromKeys(simDt);
  // Keep the player inside the room.
  const pr = len2(state.playerPos);
  if (pr > world.roomRadius - 6) state.playerPos = mul2(norm2(state.playerPos), world.roomRadius - 6);
  // Severance: the rift at x=0 is a solid, lethal wall. Clamp the player into
  // their WEST dimension and penalise any attempt to breach it.
  const sv = phase3.severance;
  if (state.playerPos.x > -sv.clampMargin) {
    if (state.running && t >= phase3.introCast && t - state.p3.lastBreach > sv.breachThrottle) {
      state.score -= sv.breachPenalty;
      state.penalties.breach = (state.penalties.breach || 0) + sv.breachPenalty;
      showMessage('DIMENSION BREACH! −' + sv.breachPenalty, 'danger', 2.5);
      state.p3.lastBreach = t;
    }
    state.playerPos.x = -sv.clampMargin;
  }
  // One-shot callout the moment the rift finishes forming.
  if (!state.p3.sunderShown && t >= phase3.introCast) {
    state.p3.sunderShown = true;
    showMessage('THE RAID IS SUNDERED — HOLD THE WEST SIDE', 'alert', 3);
  }

  const requiem = updateRequiem(t);
  updateConstellation(t);
  updateAI(t, simDt, requiem);

  // Player meshes
  state.playerArrow.visible = state.playerRing.visible = true;
  state.playerArrow.position.copy(w2v(state.playerPos, .34));
  state.playerArrow.rotation.y = Math.atan2(state.playerFacingDir.x, state.playerFacingDir.y);
  state.playerRing.position.copy(w2v(state.playerPos, .04));

  // Easy-mode helper: ring on your rune spot while you have a duty.
  const duty = playerRequiemDuty(t);
  state.targetRing.visible = Boolean(state.helperOn && duty);
  if (state.targetRing.visible) state.targetRing.position.copy(w2v(duty.spot, .03));

  updateCamera(0);
  updateIntroCastBar(t);
  updateBossCastBarP3(t);
  updateHudP3(t);
  updateScoreP3(t, simDt);
}

resetP3();
