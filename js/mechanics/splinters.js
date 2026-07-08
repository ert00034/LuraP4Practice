import { phase, world } from '../config.js';
import { add2, polar, smooth, clamp, w2v, orientCylBetween } from '../math.js';
import { state, dom } from '../state.js';
import { activeStarsplinterCycle } from '../timing.js';
import { getCycleAssignment, getCycleOrientation, splinterLayout, getAdjustedSP2Drop, splinterState, shardAnglesForDrop, getCyclePlayerOrientation } from '../splinter-layout.js';

export function setShardCyl(idx, a, b) {
  orientCylBetween(state.shardInners[idx], w2v(a, .12), w2v(b, .12));
  orientCylBetween(state.shardOuters[idx], w2v(a, .12), w2v(b, .12));
}

export function updateSplinters(t, stackPos) {
  state.shardInners.forEach(c => c.visible = false); state.shardOuters.forEach(c => c.visible = false);
  state.pulseTriangles.forEach(p => p.visible = false);
  state.splinterMeshes.forEach(m => m.visible = false);
  state.targetRing.visible = false;
  const cycle = activeStarsplinterCycle(t); if (!cycle) return;
  const playerSP = getCycleAssignment(cycle.index);
  const orientB = getCycleOrientation(cycle.index);
  const drops = splinterLayout(stackPos, orientB);
  let li = 0;
  for (let i = 0; i < 3; i++) {
    if (i === playerSP) {
      const apply = phase.firstStarsplinter + cycle.index * phase.starsplinterSpacing + i * phase.starsApplyGap;
      const explode = apply + phase.starsExplosionDelay, retEnd = explode + phase.returnDuration;
      // If munched during active splinter, shift time forward to explosion
      const tEff = (state.playerSplinterForceExplodeAt < Infinity && t >= apply && t < explode)
        ? explode + (t - state.playerSplinterForceExplodeAt) : t;
      if (tEff < apply || tEff > retEnd) { li += 6; continue; }
      // Show target ring only if helper enabled
      if (dom.helperCheck.checked && tEff < explode) {
        state.targetRing.visible = true; state.targetRing.position.copy(w2v(drops[i], .03));
      }
      state.splinterMeshes[i].visible = true; state.splinterMeshes[i].position.copy(w2v(state.playerPos, .38));
      if (tEff >= apply && tEff < explode + .36) {
        const angles = shardAnglesForDrop(stackPos, drops[i], getCyclePlayerOrientation(cycle.index));
        for (const angle of angles) {
          const end = add2(state.playerPos, polar(angle, world.shardLength));
          setShardCyl(li, state.playerPos, end);
          if (tEff >= explode && tEff < explode + .36) {
            const p = smooth(clamp((tEff - explode) / .36, 0, 1));
            const tp = add2(state.playerPos, polar(angle, world.shardLength * p));
            state.pulseTriangles[li].visible = true; state.pulseTriangles[li].position.copy(w2v(tp, .12)); state.pulseTriangles[li].rotation.y = Math.PI / 2 - angle;
          }
          li++;
        }
      } else li += 6;
    } else {
      const eDrop = i === 2 ? getAdjustedSP2Drop(cycle.index, stackPos, drops, orientB) : drops[i];
      const st = splinterState(t, cycle.index, i, stackPos, eDrop);
      if (!st) { li += 6; continue; }
      state.splinterMeshes[i].visible = true; state.splinterMeshes[i].position.copy(w2v(st.pos, .34));
      if (st.shardsVisible) {
        for (const angle of st.angles) {
          const end = add2(st.pos, polar(angle, world.shardLength));
          setShardCyl(li, st.pos, end);
          if (st.exploding) {
            const p = smooth(clamp((t - st.explode) / .36, 0, 1));
            const tp = add2(st.pos, polar(angle, world.shardLength * p));
            state.pulseTriangles[li].visible = true; state.pulseTriangles[li].position.copy(w2v(tp, .12)); state.pulseTriangles[li].rotation.y = Math.PI / 2 - angle;
          }
          li++;
        }
      } else li += 6;
    }
  }
}
