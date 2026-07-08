import { phase, world, splinterSides, chaoticSPLines, DEATH_REACTIONS } from '../config.js';
import { norm2, sub2, len2 } from '../math.js';
import { state, dom } from '../state.js';
import { activeStarsplinterCycle, currentHeaven } from '../timing.js';
import { getCycleAssignment, getCycleOrientation, splinterLayout, getAdjustedSP2Drop, getCyclePlayerOrientation, shardAnglesForDrop, shardHitsPos } from '../splinter-layout.js';
import { showMessage } from '../messages.js';

export function checkExplosions(t, stackPos) {
  const cycle = activeStarsplinterCycle(t); if (!cycle) return;
  const playerSP = getCycleAssignment(cycle.index), orientB = getCycleOrientation(cycle.index);
  const drops = splinterLayout(stackPos, orientB);
  for (let si = 0; si < 3; si++) {
    const apply = phase.firstStarsplinter + cycle.index * phase.starsplinterSpacing + si * phase.starsApplyGap;
    const explode = apply + phase.starsExplosionDelay, key = `${cycle.index}-${si}`;
    const tEff = (state.playerSplinterForceExplodeAt < Infinity && si === playerSP && t >= apply && t < explode) ? explode : t;
    if (tEff >= explode && tEff < explode + .12 && !state.checkedExplosions.has(key)) {
      state.checkedExplosions.add(key);
      // Use actual explosion position: playerPos for human, adjusted drop for AI
      const exOrigin = si === playerSP ? state.playerPos : (si === 2 ? getAdjustedSP2Drop(cycle.index, stackPos, drops, orientB) : drops[si]);
      if (si === playerSP) {
        const angles = shardAnglesForDrop(stackPos, drops[si], getCyclePlayerOrientation(cycle.index));
        let count = 0;
        for (const ai of state.aiPlayers) { if (!ai.mesh.visible) continue; for (const ang of angles) { if (shardHitsPos(state.playerPos, ang, ai.currentPos)) { count++; break; } } }
        if (count > 0) {
          const pen = count * 10; state.score -= pen; state.penalties.sliceOthers = (state.penalties.sliceOthers || 0) + pen;
          showMessage(`YOU SLICED ${count} PLAYER${count > 1 ? 'S' : ''}! −${pen}`, 'bad');
        }
        const radial = norm2(stackPos), tangent = { x: -radial.y, y: radial.x };
        const lateral = (state.playerPos.x - stackPos.x) * tangent.x + (state.playerPos.y - stackPos.y) * tangent.y;
        const expectedSign = splinterSides[playerSP];
        if (Math.abs(lateral) > 20 && lateral * expectedSign < 0) {
          state.score -= 15; state.penalties.wrongSide += 15;
          const dirs = ['LEFT', 'RIGHT', 'LEFT'];
          showMessage(`WRONG SIDE — should be ${dirs[playerSP]}! −15`, 'bad', 3);
        }
      } else {
        const angles = shardAnglesForDrop(stackPos, exOrigin, orientB);
        for (const ang of angles) {
          if (shardHitsPos(exOrigin, ang, state.playerPos)) {
            state.score -= 10; state.penalties.sliced = (state.penalties.sliced || 0) + 10;
            showMessage('YOU GOT SLICED! −10', 'danger'); break;
          }
        }
        if (dom.chaoticCheck.checked) {
          let killedAny = false;
          state.aiPlayers.forEach((ai, idx) => {
            if (state.deadAI.has(idx) || !ai.mesh.visible) return;
            for (const ang of angles) { if (shardHitsPos(exOrigin, ang, ai.currentPos, 13)) { state.deadAI.add(idx); ai.mesh.visible = false; killedAny = true; break; } }
          });
          if (killedAny && state.time - state.lastDeathMsgTime > 2) {
            dom.deathMsgEl.textContent = DEATH_REACTIONS[Math.floor(Math.random() * DEATH_REACTIONS.length)];
            dom.deathMsgEl.classList.add("show");
            state.deathMsgExpiry = state.time + 2.2; state.lastDeathMsgTime = state.time;
          }
        }
      }
    }
  }
}

export function checkOnYouSP(t, stackPos) {
  const cycle = activeStarsplinterCycle(t); if (!cycle) return;
  const playerSP = getCycleAssignment(cycle.index);
  if (playerSP === -1) return;
  const apply = phase.firstStarsplinter + cycle.index * phase.starsplinterSpacing + playerSP * phase.starsApplyGap;
  const key = `onyou-${cycle.index}`;
  if (t >= apply && t < apply + .15 && !state.checkedExplosions.has(key)) {
    state.checkedExplosions.add(key);
    if (dom.chaoticCheck.checked) {
      const line = chaoticSPLines[Math.floor(Math.random() * chaoticSPLines.length)];
      showMessage(line, 'bad', 1.0);
    } else {
      const dirs = ['⬅ LEFT', 'RIGHT ➡', '⬅ LEFT'];
      showMessage(`STARSPLINTER — ${dirs[playerSP]}`, 'alert', 3.5);
      state.spFlashExpiry = t + 0.65;
    }
  }
}

export function checkZap(t) {
  const h = currentHeaven(t); if (!h || t < h.laserStart) return;
  const key = `laser-${h.index}`; if (state.checkedLasers.has(key)) return;
  if (t > h.end) { state.checkedLasers.add(key); return; }
  if (len2(sub2(state.playerPos, state.beamTip2d)) < 32) {
    state.score -= 100; state.penalties.zapped = (state.penalties.zapped || 0) + 100;
    showMessage('YOU GOT ZAPPED! −100', 'danger'); state.checkedLasers.add(key);
  }
}

export function checkMunch(t, stackPos) {
  if (state.selectedRole === 'tank') return;
  if (t - state.lastMunchTime < 3) return;
  if (len2(sub2(state.playerPos, stackPos)) < 18) return; // safe inside stack circle
  for (const a of state.adds) {
    if (a.wave || t < a.soakedUntil) continue;
    if (len2(sub2(state.playerPos, a.pos)) < 14) {
      state.score -= 5; state.penalties.munched = (state.penalties.munched || 0) + 5;
      showMessage('YOU GOT MUNCHED! −5', 'danger', 2.5); state.lastMunchTime = t;
      // Force active starsplinter to explode immediately
      const sc = activeStarsplinterCycle(t);
      if (sc) {
        const pSP = getCycleAssignment(sc.index); if (pSP === -1) return;
        const ap = phase.firstStarsplinter + sc.index * phase.starsplinterSpacing + pSP * phase.starsApplyGap;
        if (t >= ap && t < ap + phase.starsExplosionDelay) state.playerSplinterForceExplodeAt = t;
      }
      return;
    }
  }
}

export function checkMidnight(t, stackPos) {
  if (t < phase.reintegrationCast + phase.stunDuration) return;
  if (t - state.lastMidnightTime < 3) return;
  if (len2(sub2(state.playerPos, stackPos)) > world.lightRadius) {
    state.score -= 100; state.penalties.midnight = (state.penalties.midnight || 0) + 100;
    showMessage('MIDNIGHT FALLS! −100', 'danger', 2.5); state.lastMidnightTime = t;
  }
}
