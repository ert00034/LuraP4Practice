import { phase, world } from './config.js';
import { polar, clamp, normalizeAngle, smooth } from './math.js';

export function raidAngleAt(t) {
  let a = -Math.PI / 2;
  const moveDelay = 1.0; // raid holds still for 1s after Heaven cast starts
  for (let i = 0; i < 3; i++) {
    const ht = phase.firstHeaven + i * phase.heavenSpacing; if (t <= ht) break;
    const dur = phase.heavenRampDuration + phase.heavenLaserDuration;
    a += phase.raidDirection * phase.raidAdvanceDegrees * Math.PI / 180 * clamp((t - ht - moveDelay) / (dur - moveDelay), 0, 1);
    if (t >= ht + dur) a = -Math.PI / 2 + phase.raidDirection * (i + 1) * phase.raidAdvanceDegrees * Math.PI / 180;
  }
  return a;
}
export function raidPosAt(t) { return polar(raidAngleAt(t), world.stackDistance); }
export function currentHeaven(t) {
  for (let i = 0; i < 3; i++) {
    const s = phase.firstHeaven + i * phase.heavenSpacing, ls = s + phase.heavenRampDuration, e = ls + phase.heavenLaserDuration;
    if (t >= s && t <= e) return { index: i, start: s, laserStart: ls, end: e };
  }
  return null;
}
export function heavenCountdownAt(t) {
  for (let i = 0; i < 3; i++) { const s = phase.firstHeaven + i * phase.heavenSpacing; if (t >= s - 3 && t < s) return { index: i, start: s, remaining: s - t }; }
  return null;
}
export function activeStarsplinterCycle(t) {
  for (let c = 0; c < 4; c++) { const s = phase.firstStarsplinter + c * phase.starsplinterSpacing; if (t >= s - 1.2 && t <= s + 9) return { index: c, start: s, end: s + 9 }; }
  return null;
}
export function directedRaidDelta(f, t) { return normalizeAngle((t - f) * phase.raidDirection); }
export function stunLiftAt(t) {
  const s = phase.reintegrationCast, e = s + phase.stunDuration; if (t < s || t > e) return 0;
  const dt = t - s, p = dt <= 5.5 ? smooth(dt / 5.5) : 1 - smooth((dt - 5.5) / 1.5); return p * 5.8;
}
export function coneActive(t) {
  const c = activeStarsplinterCycle(t); if (!c) return false;
  const s = c.start + phase.tankConeDelay, e = s + phase.tankConeDuration; return t >= s && t <= e;
}
export function markerArrivalTime(i) {
  if (i === 0) return phase.firstHeaven;
  return phase.firstHeaven + (i - 1) * phase.heavenSpacing + phase.heavenRampDuration + phase.heavenLaserDuration;
}
