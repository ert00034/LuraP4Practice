import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase, world, scale } from '../config.js';
import { polar, w2v, orientCylBetween, clamp, smooth, norm2 } from '../math.js';
import { state, dom } from '../state.js';
import { currentHeaven, raidAngleAt, activeStarsplinterCycle, coneActive, markerArrivalTime } from '../timing.js';
import { offTankPos } from './adds.js';

// ── Heaven beam ───────────────────────────────────────────────────────────
export function updateBeam(t) {
  const h = currentHeaven(t), active = Boolean(h && t >= h.laserStart);
  if (!active) {
    state.beamCyl.visible = state.beamGlowCyl.visible = false;
    state.beamPulses.forEach(r => r.visible = false);
    state.laserFlashMat.opacity = 0; return;
  }
  const angle = raidAngleAt(t) - phase.raidDirection * 40 * Math.PI / 180;
  state.beamTip2d = polar(angle, world.stackDistance);
  // Beam from top of boss sphere to floor at tip
  const bossTop = new THREE.Vector3(0, world.bossRadius * scale * 2, 0);
  const tipFloor = w2v(state.beamTip2d, 0);
  orientCylBetween(state.beamCyl, bossTop, tipFloor);
  orientCylBetween(state.beamGlowCyl, bossTop, tipFloor);
  state.beamCyl.visible = state.beamGlowCyl.visible = true;
  // Pulse rings at tip
  const pulse = ((t - h.laserStart) % .8) / .8;
  state.beamPulses.forEach((r, i) => {
    r.visible = true; const rp = (pulse + i / 3) % 1;
    r.position.copy(w2v(state.beamTip2d, .08)); r.scale.setScalar(.55 + rp * 2.2); r.material.opacity = .72 * (1 - rp);
  });
  // Flash room red once per second
  const flashPhase = ((t - h.laserStart) % 1.0);
  state.laserFlashMat.opacity = flashPhase < .1 ? smooth(flashPhase / .1) * .22 : flashPhase < .22 ? smooth(1 - (flashPhase - .1) / .12) * .22 : 0;
}

// ── OT cone ───────────────────────────────────────────────────────────────
export function applyConeWave(mesh, progress) {
  // Scale along forward axis (X) to animate wave sweeping out
  const p = clamp(progress, 0, 1);
  mesh.scale.set(p, 1, 1);
  mesh.material.opacity = 0.55 * (1 - p * 0.6);
}
export function updateOTCone(t, stackPos) {
  if (state.selectedRole === 'tank') {
    const eabActive = state.eabConePos && t < state.eabConeExpiry && t > phase.reintegrationCast + phase.stunDuration;
    state.otConeMesh.visible = !!eabActive;
    if (eabActive) {
      const p = (t - (state.eabConeExpiry - 0.5)) / 0.5;
      state.otConeMesh.position.copy(w2v(state.eabConePos, 0));
      const fwd = new THREE.Vector3(state.eabConeDir.x, 0, state.eabConeDir.y).normalize();
      state.otConeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd);
      applyConeWave(state.otConeMesh, p);
    }
    return;
  }
  const active = coneActive(t) && t > phase.reintegrationCast + phase.stunDuration;
  state.otConeMesh.visible = active; if (!active) { state.otConeMesh.scale.set(1, 1, 1); return; }
  const c = activeStarsplinterCycle(t);
  const coneStart = c ? c.start + phase.tankConeDelay : t;
  const p = (t - coneStart) / phase.tankConeDuration;
  const otp = offTankPos(stackPos), n = norm2(otp);
  state.otConeMesh.position.copy(w2v(otp, 0));
  const to = new THREE.Vector3(-n.x, 0, -n.y).normalize();
  state.otConeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), to);
  applyConeWave(state.otConeMesh, p);
}

// ── World markers ─────────────────────────────────────────────────────────
export function updateWorldMarkers(t) {
  if (!dom.markersCheck.checked) { state.worldMarkers.forEach(m => { m.mesh.visible = m.ring.visible = false; }); return; }
  const stunEnd = phase.reintegrationCast + phase.stunDuration;
  state.worldMarkers.forEach((m, i) => {
    const arr = markerArrivalTime(i), f0 = arr - .5, f1 = arr + 1.8;
    if (t >= f1 || (i === 0 && t > stunEnd)) { m.mesh.visible = m.ring.visible = false; return; }
    m.mesh.visible = m.ring.visible = true;
    const alpha = t >= f0 ? 1 - smooth((t - f0) / (f1 - f0)) : 1;
    m.mat.opacity = .5 * alpha; m.ringMat.opacity = .85 * alpha;
    const isNext = i > 0 && t < markerArrivalTime(i) - 1 && (i === 1 ? true : t >= markerArrivalTime(i - 1));
    m.mat.emissiveIntensity = isNext ? .35 + .2 * Math.sin(t * 5) : .35;
  });
}

// ── Stun ─────────────────────────────────────────────────────────────────
export function updateStun(t) {
  const s = phase.reintegrationCast, e = s + phase.stunDuration, active = t >= s && t <= e;
  state.stunField.visible = active; if (!active) return;
  // Calm, steady blue field with a slow breathing glow. (Previously a ~3.4Hz
  // full-screen red/blue strobe — a photosensitive-seizure hazard.)
  const pulse = .5 + .5 * Math.sin((t - s) * Math.PI * 0.5);
  state.stunFieldMat.color.setHex(0x5cc8ff); state.stunFieldMat.opacity = .11 + pulse * .05;
}
