import { phase, world } from '../config.js';
import { add2, polar, lerp, smooth, clamp, w2v } from '../math.js';
import { state, dom } from '../state.js';
import { activeStarsplinterCycle, raidPosAt } from '../timing.js';
import { getCycleAssignment, getCycleOrientation, splinterLayout, getAdjustedSP2Drop, getCycleSafeDrop, splinterState, getCycleFakeout } from '../splinter-layout.js';

export function updateAIPlayers(t, stackPos, liftY) {
  const dur = t >= phase.reintegrationCast && t <= phase.reintegrationCast + phase.stunDuration;
  const aft = t > phase.reintegrationCast + phase.stunDuration;
  const show = dur || aft;
  const cycle = activeStarsplinterCycle(t);
  const playerSP = cycle ? getCycleAssignment(cycle.index) : -1;
  const orientB = cycle ? getCycleOrientation(cycle.index) : 0;
  const drops = cycle ? splinterLayout(stackPos, orientB) : null;
  // Trigger random wander for a non-SP AI
  if (aft && state.running && t >= state.nextWanderTime) {
    const cands = state.aiPlayers.map((a, i) => i).filter(i => state.aiPlayers[i].spIndex === null && !state.aiWander[i].active);
    if (cands.length) {
      const idx = cands[Math.floor(Math.random() * cands.length)];
      const ang = Math.random() * Math.PI * 2, dist = world.lightRadius * .5 + Math.random() * world.lightRadius * .3;
      Object.assign(state.aiWander[idx], {
        active: true, startTime: t, endTime: t + 0.9 + Math.random() * .6,
        fromPos: { ...state.aiPlayers[idx].currentPos }, target: add2(stackPos, polar(ang, dist))
      });
    }
    state.nextWanderTime = t + 12 + Math.random() * 15;
  }
  state.aiPlayers.forEach((ai, i) => {
    ai.mesh.visible = show; if (!show) return;
    let pos;
    if (ai.spIndex !== null && cycle && ai.spIndex !== playerSP) {
      const eDrop = ai.spIndex === 2 ? getAdjustedSP2Drop(cycle.index, stackPos, drops, orientB) : getCycleSafeDrop(cycle.index, ai.spIndex, stackPos, drops, orientB);
      const st = splinterState(t, cycle.index, ai.spIndex, stackPos, eDrop);
      pos = st ? st.pos : add2(stackPos, ai.baseOffset);
      // Chaotic fakeout: briefly move toward wrong side then self-correct
      if (dom.chaoticCheck.checked && ai.spIndex < 2 && drops) {
        const fo = getCycleFakeout(cycle.index, drops)[ai.spIndex];
        if (fo) {
          const applyI = phase.firstStarsplinter + cycle.index * phase.starsplinterSpacing + ai.spIndex * phase.starsApplyGap;
          if (t >= applyI && t < applyI + fo.dur) {
            const p = smooth(clamp((t - applyI) / fo.dur, 0, 1));
            pos = { x: lerp(stackPos.x, fo.wrongDrop.x, p * .55), y: lerp(stackPos.y, fo.wrongDrop.y, p * .55) };
          }
        }
      }
    } else {
      const wx = Math.sin(t * .85 + ai.wobblePhase) * ai.wobbleAmp, wy = Math.cos(t * .72 + ai.wobblePhase * 1.3) * ai.wobbleAmp;
      // Per-member speed variation during stack movement (±10%)
      const aiStackPos = raidPosAt(t + ai.moveSpeedVar * 7);
      pos = add2(aiStackPos, add2(ai.baseOffset, { x: wx, y: wy }));
      // Random wander override
      const w = state.aiWander[i];
      if (w.active) {
        const el = t - w.startTime, tot = w.endTime - w.startTime, half = tot / 2;
        if (el >= tot) { w.active = false; }
        else if (el < half) { const p = smooth(el / half); pos = { x: lerp(w.fromPos.x, w.target.x, p), y: lerp(w.fromPos.y, w.target.y, p) }; }
        else { const p = smooth((el - half) / half); const ret = add2(aiStackPos, ai.baseOffset); pos = { x: lerp(w.target.x, ret.x, p), y: lerp(w.target.y, ret.y, p) }; }
      }
    }
    ai.currentPos = pos;
    ai.mesh.position.copy(w2v(pos, .325 + (dur ? liftY : 0)));
  });
}
