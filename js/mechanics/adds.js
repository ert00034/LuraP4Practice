import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase, world } from '../config.js';
import { polar, angleOf, add2, sub2, mul2, len2, norm2, rotate2, angularDelta, clamp, smooth, lerp, w2v, rand } from '../math.js';
import { state } from '../state.js';
import { currentHeaven, raidAngleAt, directedRaidDelta, activeStarsplinterCycle, coneActive } from '../timing.js';
import { showMessage } from '../messages.js';

export function offTankPos(sp) { return polar(angleOf(sp), world.offTankDistance); }

export function addThreatensRaidPath(a, heaven, t) {
  if (!heaven) return false;
  const pl = phase.raidAdvanceDegrees * Math.PI / 180, sa = -Math.PI / 2 + phase.raidDirection * heaven.index * pl, ea = sa + phase.raidDirection * pl;
  const addA = angleOf(a.pos), ahead = directedRaidDelta(raidAngleAt(t), addA), rem = Math.max(0, directedRaidDelta(raidAngleAt(t), ea));
  const pp = directedRaidDelta(sa, addA), r = len2(a.pos), ttr = (world.stackDistance - r) / Math.max(1, a.speed);
  return ahead >= 0 && ahead <= rem + 10 * Math.PI / 180 && pp >= -0.001 && pp <= pl + 0.001 && r < world.stackDistance + 28 && ttr > -.7 && ttr < (heaven.end - t) + 2.0;
}

export function immunityPos(t, sp) {
  const h = currentHeaven(t), home = add2(sp, mul2(norm2(sp), -28)); if (!h) return home;
  const threat = state.adds.filter(a => addThreatensRaidPath(a, h, t)).sort((a, b) => Math.abs(world.stackDistance - len2(a.pos)) - Math.abs(world.stackDistance - len2(b.pos)))[0];
  const rad = norm2(sp), fs = h.index === 1 ? -1 : 1, fb = add2(home, mul2({ x: -rad.y * fs, y: rad.x * fs }, 48));
  const intercept = threat ? add2(threat.pos, mul2(threat.dir, 20)) : fb;
  const mp = smooth(clamp((t - h.start) / 2.2, 0, 1)), rp = smooth(clamp((t - (h.end - 1.4)) / 1.4, 0, 1));
  const active = { x: lerp(home.x, intercept.x, mp), y: lerp(home.y, intercept.y, mp) };
  return { x: lerp(active.x, home.x, rp), y: lerp(active.y, home.y, rp) };
}

export function soakAdd(a, t, soaker) {
  if (t - a.lastSoakedAt < 1.2) return;
  // 10% chance to nudge direction on first soak
  if (t >= a.soakedUntil && Math.random() < 0.1) {
    const away = norm2(sub2(a.pos, soaker));
    a.dir = norm2(rotate2(a.dir, clamp(angularDelta(angleOf(a.dir), angleOf(away)), -Math.PI / 4, Math.PI / 4)));
  }
  a.soakedUntil = t + 1.2; a.lastSoakedAt = t;
}

export function spawnAdd(t, wave, fixedAngle) {
  const a = fixedAngle !== undefined ? fixedAngle : rand() * Math.PI * 2;
  const s = polar(a, world.bossRadius + 8);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wave ? .95 : .80, wave ? .22 : .18, wave ? .60 : .50), wave ? state.mPink : state.mPurp);
  state.scene.add(mesh);
  state.adds.push({
    id: state.nextAddId++, pos: s, dir: { x: Math.cos(a), y: Math.sin(a) },
    speed: (wave ? phase.shaWaveSpeed : phase.shaSpeed) * (0.82 + rand() * .36),
    wave, wobble: rand() * Math.PI * 2, soakedUntil: 0, lastSoakedAt: -999, mesh
  });
}

export function updateAdds(t, dt, sp, otp, ip) {
  if (t < phase.reintegrationCast + phase.stunDuration) return;
  const cycle = activeStarsplinterCycle(t);
  if (cycle && t >= cycle.start && !state.waveSpawned.has(cycle.index)) { for (let i = 0; i < 36; i++) spawnAdd(t, true, i * (Math.PI / 18)); state.waveSpawned.add(cycle.index); }
  if (t - state.lastAddTime >= phase.shaBaseInterval) { spawnAdd(t, false); state.lastAddTime = t; }
  for (const a of state.adds) {
    a.pos = add2(a.pos, mul2(a.dir, a.speed * dt));
    if (state.selectedRole === 'tank') {
      if (len2(sub2(a.pos, state.playerPos)) < 22) {
        if (t - a.lastSoakedAt >= 1.2 && t > state.defExpiry) {
          state.score -= 5; state.penalties.noDefensive = (state.penalties.noDefensive || 0) + 5;
          showMessage('NO DEFENSIVE! −5', 'bad', 2);
        }
        soakAdd(a, t, state.playerPos);
      }
    } else if (len2(sub2(a.pos, otp)) < 22) soakAdd(a, t, otp);
    if (currentHeaven(t) && len2(sub2(a.pos, ip)) < 20) soakAdd(a, t, ip);
    // Direction only changes via soakAdd
    a.mesh.material = t < a.soakedUntil ? state.mWhite : (a.wave ? state.mPink : state.mPurp);
    a.mesh.position.copy(w2v(a.pos, a.wave ? .09 : .08));
    a.mesh.rotation.y = -Math.atan2(a.dir.y, a.dir.x);
  }
  state.adds = state.adds.filter(a => { const keep = len2(a.pos) < world.roomRadius + 40 && len2(sub2(a.pos, sp)) > 7; if (!keep) state.scene.remove(a.mesh); return keep; });
}

// ── Cone kills ────────────────────────────────────────────────────────────
export function fireConekills(t, conePos, coneFwd) {
  const otp = conePos, fwd = coneFwd;
  state.adds = state.adds.filter(a => {
    const rel = sub2(a.pos, otp);
    const along = rel.x * fwd.x + rel.y * fwd.y;
    if (along < 0 || along > world.coneLength) return true;
    const side = Math.abs(rel.x * (-fwd.y) + rel.y * fwd.x);
    if (side > along * Math.tan(Math.PI / 4) + 12) return true;
    a.mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    state.dyingAdds.push({ pos: { ...a.pos }, startT: t, mesh: a.mesh });
    return false;
  });
}
export function updateConeKills(t, stackPos) {
  if (state.selectedRole === 'tank') {
    if (!state.eabConePos || t >= state.eabConeExpiry || t <= phase.reintegrationCast + phase.stunDuration) return;
    if (!state.eabConeFired) { state.eabConeFired = true; fireConekills(t, state.eabConePos, state.eabConeDir); }
  } else {
    if (!coneActive(t)) return;
    const c = activeStarsplinterCycle(t); if (!c) return;
    const key = `cone-${c.index}`;
    if (state.firedConeKills.has(key)) return;
    state.firedConeKills.add(key);
    fireConekills(t, offTankPos(stackPos), norm2(mul2(stackPos, -1)));
  }
}

export function updateDyingAdds(t) {
  for (let i = state.dyingAdds.length - 1; i >= 0; i--) {
    const d = state.dyingAdds[i], p = clamp((t - d.startT) / .35, 0, 1);
    if (p >= 1) { state.scene.remove(d.mesh); state.dyingAdds.splice(i, 1); continue; }
    d.mesh.position.copy(w2v(d.pos, .42 + p * .9));
    d.mesh.material.opacity = 1 - p;
    d.mesh.scale.setScalar(1 + p * 2.5);
  }
}
