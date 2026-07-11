import { phase3 } from '../config.js';

// ── Death's Requiem game times ────────────────────────────────────────────
// Game g: boss cast at `cast`, Dark Runes applied at `marks`, all pairs must
// have collided by `deadline` (which is also when the second constellation
// set lands), everyone is back in formation by `end`.
export function requiemGameTimes(g) {
  const cast = phase3.firstRequiem + g * phase3.requiemSpacing;
  const marks = cast + phase3.requiemCast;
  return {
    index: g, cast, marks,
    deadline: marks + phase3.requiemDeadline,
    end: marks + phase3.requiemDeadline + 4,
  };
}
export function activeRequiemGame(t) {
  for (let g = 0; g < 3; g++) {
    const gt = requiemGameTimes(g);
    if (t >= gt.cast && t <= gt.end) return gt;
  }
  return null;
}
export function nextRequiemIn(t) {
  for (let g = 0; g < 3; g++) {
    const c = phase3.firstRequiem + g * phase3.requiemSpacing;
    if (t < c) return c - t;
  }
  return null;
}

// ── Dark Constellation wave schedule ──────────────────────────────────────
// Two kinds: sets interleaved with each Requiem game (impact at fixed offsets
// after marks — no boss cast, they are part of the ongoing channel) and
// standalone boss-cast waves between games. By construction the schedule
// never overlaps: each wave fully resolves before the next telegraph starts.
export const CONSTELLATION_WAVES = (() => {
  const waves = [];
  for (let g = 0; g < 3; g++) {
    const { marks } = requiemGameTimes(g);
    phase3.gameSetOffsets.forEach((off, si) =>
      waves.push({ key: `g${g}s${si}`, impact: marks + off, cast: null, duringGame: true }));
  }
  phase3.standaloneWaves.forEach((c, i) =>
    waves.push({ key: `w${i}`, impact: c + phase3.standaloneCast, cast: c, duringGame: false }));
  waves.sort((a, b) => a.impact - b.impact);
  return waves.map(w => {
    const beamStart = w.impact + phase3.beamDelay;
    const lastFlash = beamStart + (phase3.beamFlashes - 1) * phase3.beamFlashPeriod;
    return { ...w, telegraphStart: w.impact - phase3.starFallTime, beamStart, lastFlash, end: lastFlash + phase3.starFade };
  });
})();
export function activeWave(t) {
  for (const w of CONSTELLATION_WAVES) if (t >= w.telegraphStart && t <= w.end) return w;
  return null;
}
export function nextConstellationIn(t) {
  for (const w of CONSTELLATION_WAVES) if (t < w.impact) return w.impact - t;
  return null;
}

// ── Rune spot layout ──────────────────────────────────────────────────────
// Five fixed per-symbol spots on an arc in the player's WEST dimension (the
// raid's pre-placed markers); spot i belongs to symbol i for the whole pull.
export function runeSpotPos(i) {
  const startDeg = phase3.spotArcCenter - phase3.spotArcSpan / 2;
  const a = (startDeg + i * (phase3.spotArcSpan / (phase3.runeCount - 1))) * Math.PI / 180;
  return { x: Math.cos(a) * phase3.spotArcRadius, y: Math.sin(a) * phase3.spotArcRadius };
}
