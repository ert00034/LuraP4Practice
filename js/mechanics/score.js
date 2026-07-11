import { phase, phase3, world } from '../config.js';
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

// Grades are fractions of the maximum accruable safe time for the phase.
// P4's window is 78s (90 minus cast+stun), which reproduces the original
// absolute thresholds (70/55/40/25/10) exactly.
export function gradeScore(s) {
  const maxSafe = state.selectedPhase === 'p3'
    ? phase3.duration - phase3.introCast
    : phase.duration - phase.reintegrationCast - phase.stunDuration;
  const f = s / maxSafe;
  if (f >= .897) return { g: 'A+', cls: 'gAp', desc: 'Flawless' };
  if (f >= .705) return { g: 'A', cls: 'gA', desc: 'Excellent' };
  if (f >= .512) return { g: 'B', cls: 'gB', desc: 'Good' };
  if (f >= .320) return { g: 'C', cls: 'gC', desc: 'Adequate' };
  if (f >= .128) return { g: 'D', cls: 'gD', desc: 'Rough' };
  if (s >= 0) return { g: 'F', cls: 'gF', desc: 'Failed' };
  return { g: 'F-', cls: 'gFm', desc: 'Catastrophic' };
}

// Scoreboard breakdown rows per phase: [penaltyKey, label]. The first row is
// always the positive safe-time accumulator.
const BREAKDOWN_ROWS = {
  p4: [
    ['sliceOthers', 'Players sliced (−10 each)'],
    ['sliced', 'Got sliced (−10 each)'],
    ['munched', 'Got munched (−5 each)'],
    ['leftLight', 'Left the light zone (−100 each)'],
    ['zapped', 'Got zapped (−100 each)'],
    ['wrongSide', 'Wrong side on Starsplinter (−15 each)'],
    ['noDefensive', 'Soaked without defensive (−5 each)'],
    ['noEabClear', 'Adds hit raid — no EAB (−75 each)'],
    ['addsHnH', 'Adds hit raid in Heaven &amp; Hell (−15 each)'],
  ],
  p3: [], // filled in by the Phase 3 module registration below
};
const SAFE_LABELS = { p4: 'Time safe in light circle', p3: 'Time alive & in position' };
export function registerBreakdown(phaseKey, rows, safeLabel) {
  BREAKDOWN_ROWS[phaseKey] = rows; SAFE_LABELS[phaseKey] = safeLabel;
}

export function showScoreboard() {
  const rounded = Math.round(state.score);
  const gr = gradeScore(rounded);
  const p3 = state.selectedPhase === 'p3';
  const chaoticLabel = p3 ? '🔥 CHAOTIC PHASE 3 ATTEMPT' : '🔥 CHAOTIC PHASE 4 ATTEMPT';
  const modeLabels = { easy: '⭐ EASY MODE', normal: 'NORMAL', chaotic: chaoticLabel };
  const roleSuffix = p3 ? {} : { light: ' · LIGHT HOLDER', tank: ' · ADD TANK', dps: '' };
  const smodeEl = document.getElementById("smode");
  smodeEl.textContent = (modeLabels[state.selectedMode] || 'NORMAL') + (roleSuffix[state.selectedRole] || '');
  smodeEl.style.color = state.selectedMode === 'chaotic' ? '#ff9f1c' : state.selectedMode === 'easy' ? '#a8e563' : 'var(--muted)';
  document.getElementById("sgrade").textContent = gr.g;
  document.getElementById("sgrade").className = `score-grade ${gr.cls}`;
  document.getElementById("sfinal").textContent = `${rounded} pts — ${gr.desc}`;
  const rows = [`<div class="score-row"><span>${SAFE_LABELS[state.selectedPhase]}</span><span class="val pos">+${Math.round(state.safeAccum)}</span></div>`];
  for (const [key, label] of BREAKDOWN_ROWS[state.selectedPhase])
    rows.push(`<div class="score-row"><span>${label}</span><span class="val neg">−${state.penalties[key] || 0}</span></div>`);
  document.getElementById("score-breakdown").innerHTML = rows.join('');
  dom.scoreboardEl.classList.add("show"); state.scoreboardShown = true;
}
