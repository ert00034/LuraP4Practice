import { phase, world, splinterSides, splinterProfiles } from './config.js';
import { norm2, add2, sub2, mul2, len2, rotate2, angleOf, lerp, smooth, clamp } from './math.js';
import { state } from './state.js';

export function getCycleAssignment(i) {
  if (state.selectedRole !== 'dps') return -1;
  if (!(i in state.cycleAssignments)) state.cycleAssignments[i] = Math.floor(Math.random() * 3);
  return state.cycleAssignments[i];
}
export function getCycleOrientation(i) {
  if (!(i in state.cycleOrientations)) state.cycleOrientations[i] = Math.random() < .5 ? 1 : 0;
  return state.cycleOrientations[i];
}
export function getCyclePlayerOrientation(i) {
  if (!(i in state.cyclePlayerOrientations)) state.cyclePlayerOrientations[i] = Math.random() < .5 ? 1 : 0;
  return state.cyclePlayerOrientations[i];
}
// SP2 bot sometimes hesitates ~1s before moving out (50% chance per cycle)
export function getCycleSP2Delay(i) {
  if (!(i in state.cycleDelays)) state.cycleDelays[i] = 0.7 + Math.random() * .6;
  return state.cycleDelays[i];
}
// Per-cycle fakeout: AI SP0/SP1 has 20% chance to move wrong way briefly then correct
export function getCycleFakeout(ci, drops) {
  if (ci in state.cycleFakeouts) return state.cycleFakeouts[ci];
  const f = {};
  [0, 1].forEach(si => {
    if (Math.random() < 0.2) {
      f[si] = { wrongDrop: drops[1 - si], dur: 0.4 + Math.random() * .35 };
    }
  });
  state.cycleFakeouts[ci] = f; return f;
}
// Find a safe drop position where no shard ray hits the stack
export function findSafeDrop(defaultDrop, stackPos, orientB, safeR = 18) {
  const check = pos => { const angs = shardAnglesForDrop(stackPos, pos, orientB); for (const a of angs) if (shardHitsPos(pos, a, stackPos, safeR)) return false; return true; };
  if (check(defaultDrop)) return defaultDrop;
  const rv = norm2(stackPos), tv = { x: -rv.y, y: rv.x };
  for (let off = 8; off <= 64; off += 8) for (const s of [1, -1]) { const c = add2(defaultDrop, mul2(tv, off * s)); if (check(c)) return c; }
  return defaultDrop;
}
export function getCycleSafeDrop(ci, si, stackPos, drops, orientB) {
  const key = `${ci}-${si}`;
  if (!(key in state.cycleSafeDrops)) state.cycleSafeDrops[key] = findSafeDrop(drops[si], stackPos, orientB);
  return state.cycleSafeDrops[key];
}
// SP2 bot checks SP0's shards and picks a safe alternative drop once per cycle
export function getAdjustedSP2Drop(cycleIdx, stackPos, drops, orientB) {
  if (cycleIdx in state.cycleAdjustedDrops) return state.cycleAdjustedDrops[cycleIdx];
  const sp0drop = drops[0], sp0angles = shardAnglesForDrop(stackPos, sp0drop, orientB);
  const hitR = 18;
  function safe(pos) { for (const ang of sp0angles) { if (shardHitsPos(sp0drop, ang, pos, hitR)) return false; } return true; }
  const maxR = world.lightRadius - 4, r = norm2(stackPos), tan = { x: -r.y, y: r.x };
  function clampL(p) { const rel = sub2(p, stackPos), d = len2(rel); return d > maxR ? add2(stackPos, mul2(norm2(rel), maxR)) : p; }
  const def = drops[2]; let chosen = def;
  if (!safe(def)) {
    // Try radial/tangential shifts of increasing magnitude; commit to first safe spot
    const shifts = [[-15, 0], [15, 0], [0, 12], [0, -12], [-15, 12], [15, 12], [-20, 0], [0, 20], [-15, -12], [15, -12]];
    for (const [dr, dt] of shifts) {
      const c = clampL(add2(def, add2(mul2(r, dr), mul2(tan, dt))));
      if (safe(c)) { chosen = c; break; }
    }
  }
  state.cycleAdjustedDrops[cycleIdx] = chosen; return chosen;
}

// ── Splinter layout ────────────────────────────────────────────────────────
export function splinterLayout(stackPos, orientB) {
  const r = norm2(stackPos);
  return splinterSides.map((side, i) => {
    const t = { x: -r.y * side, y: r.x * side }, p = splinterProfiles[i];
    let d = add2(stackPos, add2(mul2(t, p.tangential), mul2(r, p.radial)));
    if (orientB) { const rel = sub2(d, stackPos); d = add2(stackPos, rotate2(rel, 28 * Math.PI / 180 * side)); }
    const rel = sub2(d, stackPos), dist = len2(rel), maxR = world.lightRadius - 4;
    if (dist > maxR) d = add2(stackPos, mul2(norm2(rel), maxR));
    return d;
  });
}
export function shardAnglesForDrop(stackPos, drop, orientB) {
  const da = angleOf(sub2(stackPos, drop)), ex = orientB ? Math.PI / 4 : Math.PI / 6;
  // orientA: one ray points directly toward the stack (da+0); orientB: rotated 45°
  return Array.from({ length: 6 }, (_, i) => da + ex + i * Math.PI / 3);
}
export function splinterState(t, ci, si, stackPos, drop) {
  const apply = phase.firstStarsplinter + ci * phase.starsplinterSpacing + si * phase.starsApplyGap;
  const explode = apply + phase.starsExplosionDelay, retEnd = explode + phase.returnDuration;
  if (t < apply || t > retEnd) return null;
  let pos = stackPos, sv = false, ex = false;
  if (t < apply + phase.moveOutDuration) {
    const p = smooth((t - apply) / phase.moveOutDuration);
    pos = { x: lerp(stackPos.x, drop.x, p), y: lerp(stackPos.y, drop.y, p) }; sv = p >= .68;
  } else if (t < explode) { pos = drop; sv = true; }
  else { ex = t < explode + .36; sv = ex; const p = smooth((t - explode) / phase.returnDuration); pos = { x: lerp(drop.x, stackPos.x, p), y: lerp(drop.y, stackPos.y, p) }; }
  return { pos, drop, explode, exploding: ex, shardsVisible: sv, angles: shardAnglesForDrop(stackPos, drop, getCycleOrientation(ci)) };
}

// ── Collision helpers ─────────────────────────────────────────────────────
export function shardHitsPos(drop, angle, target, hitR = 5) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }, rel = sub2(target, drop);
  const along = rel.x * dir.x + rel.y * dir.y;
  if (along < 0 || along > world.shardLength) return false;
  return len2(sub2(target, add2(drop, mul2(dir, along)))) < hitR;
}
