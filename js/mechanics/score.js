import { phase, world } from '../config.js';
import { sub2, len2 } from '../math.js';
import { state, dom } from '../state.js';
import { currentHeaven, activeStarsplinterCycle } from '../timing.js';
import { showMessage } from '../messages.js';

export function updateScore(t, dt, stackPos) {
  if (t < phase.reintegrationCast + phase.stunDuration) return;
  if (!state.running) return;
  const heaven = currentHeaven(t);
  if (state.selectedRole === 'light') {
    const lightCoversRaid = len2(sub2(state.playerPos, stackPos)) <= world.lightRadius;
    if (lightCoversRaid) {
      const base = state.chaoticOn ? 1.15 : (state.helperOn ? .5 : 1);
      const gain = base * dt * Number(dom.speedInput.value);
      state.score += gain; state.safeAccum += gain;
    }
    // 1/s penalty when any AI is outside the light zone
    let anyOutside = false;
    for (const ai of state.aiPlayers) { if (len2(sub2(ai.currentPos, state.playerPos)) > world.lightRadius) { anyOutside = true; break; } }
    if (anyOutside) state.score -= 1.0 * dt;
    // -5 score if player moves while any splinter is still in-flight
    const sc = activeStarsplinterCycle(t);
    const lastRetEnd = sc ? sc.start + 2 * phase.starsApplyGap + phase.starsExplosionDelay + phase.returnDuration : 0;
    if (sc && t >= sc.start && t < lastRetEnd && (state.keys['w'] || state.keys['s'] || state.keys['a'] || state.keys['d']) && t > state.lightMovePenaltyExpiry) {
      state.score -= 5; state.lightMovePenaltyExpiry = t + 3;
      showMessage('DO NOT MOVE — STARSPLINTERS ACTIVE! −5', 'danger', 2);
    }
    return;
  }
  const scoreRadius = heaven ? world.lightRadius : 12;
  const inLight = len2(sub2(state.playerPos, stackPos)) <= scoreRadius;
  if (inLight) {
    const base = state.chaoticOn ? 1.15 : (state.helperOn ? .5 : 1);
    const gain = base * dt * Number(dom.speedInput.value);
    state.score += gain; state.safeAccum += gain;
  }
}

export function gradeScore(s) {
  if (s >= 70) return { g: 'A+', cls: 'gAp', desc: 'Flawless' };
  if (s >= 55) return { g: 'A', cls: 'gA', desc: 'Excellent' };
  if (s >= 40) return { g: 'B', cls: 'gB', desc: 'Good' };
  if (s >= 25) return { g: 'C', cls: 'gC', desc: 'Adequate' };
  if (s >= 10) return { g: 'D', cls: 'gD', desc: 'Rough' };
  if (s >= 0) return { g: 'F', cls: 'gF', desc: 'Failed' };
  return { g: 'F-', cls: 'gFm', desc: 'Catastrophic' };
}

export function showScoreboard() {
  const rounded = Math.round(state.score);
  const gr = gradeScore(rounded);
  const modeLabels = { easy: '⭐ EASY MODE', normal: 'NORMAL', chaotic: '🔥 CHAOTIC PHASE 4 ATTEMPT' };
  const roleSuffix = { light: ' · LIGHT HOLDER', tank: ' · ADD TANK', dps: '' };
  const smodeEl = document.getElementById("smode");
  smodeEl.textContent = (modeLabels[state.selectedMode] || 'NORMAL') + (roleSuffix[state.selectedRole] || '');
  smodeEl.style.color = state.selectedMode === 'chaotic' ? '#ff9f1c' : state.selectedMode === 'easy' ? '#a8e563' : 'var(--muted)';
  document.getElementById("sgrade").textContent = gr.g;
  document.getElementById("sgrade").className = `score-grade ${gr.cls}`;
  document.getElementById("sfinal").textContent = `${rounded} pts — ${gr.desc}`;
  document.getElementById("sr-safe").textContent = `+${Math.round(state.safeAccum)}`;
  document.getElementById("sr-slice").textContent = `−${state.penalties.sliceOthers || 0}`;
  document.getElementById("sr-sliced").textContent = `−${state.penalties.sliced || 0}`;
  document.getElementById("sr-munch").textContent = `−${state.penalties.munched || 0}`;
  document.getElementById("sr-midnight").textContent = `−${state.penalties.midnight || 0}`;
  document.getElementById("sr-zap").textContent = `−${state.penalties.zapped || 0}`;
  document.getElementById("sr-wrongside").textContent = `−${state.penalties.wrongSide || 0}`;
  document.getElementById("sr-nodef").textContent = `−${state.penalties.noDefensive || 0}`;
  document.getElementById("sr-noeab").textContent = `−${state.penalties.noEabClear || 0}`;
  dom.scoreboardEl.classList.add("show"); state.scoreboardShown = true;
}
