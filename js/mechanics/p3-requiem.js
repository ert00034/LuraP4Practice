import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { phase3, P3_RUNES, P3_CHAOS_MELODY_LINES, DEATH_REACTIONS } from '../config.js';
import { add2, sub2, mul2, len2, norm2, w2v, makeRing, clamp, smooth } from '../math.js';
import { state, dom } from '../state.js';
import { showMessage } from '../messages.js';
import { activeRequiemGame, runeSpotPos } from './p3-timing.js';

function noteTime() { return state.chaoticOn ? phase3.melodyNoteTime * 0.65 : phase3.melodyNoteTime; }

// ── Meshes ────────────────────────────────────────────────────────────────
// Fixed per-symbol spot markers (ring + floating glyph), rune sprites above
// marked heads, a white "live partner" ring, and resonance pop rings.
let spotMarks = null, runeSprites = null, partnerRing = null, popRings = null;

function makeGlyphSprite(glyph, colHex, size = 1.1) {
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
  const ctx = cvs.getContext('2d');
  const col = '#' + colHex.toString(16).padStart(6, '0');
  ctx.font = 'bold 86px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = col; ctx.shadowBlur = 26; ctx.fillStyle = col;
  ctx.fillText(glyph, 64, 68); ctx.fillText(glyph, 64, 68);
  ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.strokeText(glyph, 64, 68);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, depthWrite: false }));
  spr.scale.set(size, size, 1);
  return spr;
}

export function initRequiemMeshes() {
  if (spotMarks) return;
  spotMarks = P3_RUNES.map((r, i) => {
    const pos = runeSpotPos(i);
    const ring = makeRing(8, r.color, .8, .05);
    ring.position.copy(w2v(pos, .03));
    const glyph = makeGlyphSprite(r.glyph, r.color, .95);
    glyph.position.copy(w2v(pos, 1.5));
    [ring, glyph].forEach(o => { o.visible = false; state.scene.add(o); });
    return { ring, glyph, pos };
  });
  // Two sprites per symbol (a pair may show both members in easy mode).
  runeSprites = P3_RUNES.map(r => [0, 1].map(() => {
    const s = makeGlyphSprite(r.glyph, r.color, .8);
    s.visible = false; state.scene.add(s); return s;
  }));
  partnerRing = makeRing(11, 0xffffff, .9, .05);
  partnerRing.visible = false; state.scene.add(partnerRing);
  popRings = [0, 1, 2].map(() => {
    const ring = makeRing(phase3.resonanceRadius, 0xffffff, .8, .07);
    ring.visible = false; state.scene.add(ring); return ring;
  });
}
export function setSpotMarksVisible(v) { if (spotMarks) spotMarks.forEach(m => { m.ring.visible = m.glyph.visible = v; }); }
export function hideRequiemMeshes() {
  if (!spotMarks) return;
  setSpotMarksVisible(false);
  runeSprites.forEach(pair => pair.forEach(s => s.visible = false));
  partnerRing.visible = false;
  popRings.forEach(r => r.visible = false);
  dom.melodyEl.classList.remove('show');
  dom.yourRuneEl.classList.remove('show');
}

// ── Game data (lazy per game index) ───────────────────────────────────────
function shuffled(n) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function getGame(g) {
  if (g in state.p3.games) return state.p3.games[g];
  const melody = shuffled(phase3.runeCount);
  const playerIdx = Math.floor(Math.random() * phase3.runeCount); // player's position in the melody
  // Rune-game partners come from the player's own dimension (west) so the
  // chain never forces the player across the rift. Falls back to the other
  // side only if chaotic deaths thin the west ranks below the 9 needed.
  const need = phase3.runeCount * 2 - 1;
  const aliveIn = dim => state.aiPlayers.map((_, i) => i)
    .filter(i => !state.deadAI.has(i) && state.p3Formation[i].dim === dim)
    .sort(() => Math.random() - .5);
  const picks = [...aliveIn(0), ...aliveIn(1)].slice(0, need);
  let pi = 0;
  const pairs = melody.map((symbol, idx) => {
    const isPlayer = idx === playerIdx;
    const ai = isPlayer ? [picks[pi++]] : [picks[pi++], picks[pi++]];
    return {
      symbol, isPlayer, ai,
      reactAt: 0.35 + Math.random() * 0.5,
      stagger: ai.map(() => 0.15 + Math.random() * 0.45),
    };
  });
  const game = {
    melody, playerIdx, pairs,
    popped: melody.map(() => false), popTime: melody.map(() => 0),
    converging: melody.map(() => false),
    dissonantAt: null, raidFault: false, doneAt: null,
    yourTurnShown: false, confusionAt: null, chaosEarlyPopAt: null,
  };
  if (state.chaoticOn) {
    if (Math.random() < 0.5) game.confusionAt = 1.0 + Math.random() * 2.5;   // after marks
    if (Math.random() < 0.10) game.chaosEarlyPopAt = phase3.chainStart + Math.random() * 2.5;
  }
  state.p3.games[g] = game;
  return game;
}

// Stand positions: AI-AI pairs flank their spot tangentially; the player's
// partner waits just outside the spot (outside collide range) so the player
// initiates the touch.
function standPos(spot, pair, member) {
  const out = norm2(spot), tan = { x: -out.y, y: out.x };
  if (pair.isPlayer) return add2(spot, mul2(out, phase3.partnerStandOff));
  return add2(spot, mul2(tan, member === 0 ? -8 : 8));
}

function dissonance(game, t, kind) {
  game.dissonantAt = t; game.doneAt = t;
  if (kind === 'raid') {
    showMessage('THE RAID FUMBLED THE MELODY — DISSONANCE!', 'danger', 3);
    game.raidFault = true;
  } else if (kind === 'timeout') {
    state.score -= 50; state.penalties.dissTimeout = (state.penalties.dissTimeout || 0) + 50;
    showMessage('MELODY EXPIRED — DISSONANCE! −50', 'danger', 3);
  } else {
    state.score -= 50; state.penalties.dissOrder = (state.penalties.dissOrder || 0) + 50;
    showMessage(kind === 'early' ? 'TOO EARLY — DISSONANCE! −50' : 'WRONG PLAYER — DISSONANCE! −50', 'danger', 3);
  }
  if (state.chaoticOn) {
    // Dissonance kills a couple of marked raiders for flavour.
    const marked = game.pairs.flatMap(p => p.ai).filter(i => !state.deadAI.has(i));
    marked.sort(() => Math.random() - .5).slice(0, 2).forEach(i => { state.deadAI.add(i); state.aiPlayers[i].mesh.visible = false; });
    dom.deathMsgEl.textContent = DEATH_REACTIONS[Math.floor(Math.random() * DEATH_REACTIONS.length)];
    dom.deathMsgEl.classList.add('show');
    state.deathMsgExpiry = t + 2.2; state.lastDeathMsgTime = t;
  }
}

function pop(game, t, idx, midpoint) {
  game.popped[idx] = true; game.popTime[idx] = t;
  state.p3.pops.push({ t, pos: midpoint, color: P3_RUNES[game.melody[idx]].color });
  if (state.p3.pops.length > 3) state.p3.pops.shift();
  // Resonance splash: clips the player if they crowd someone else's pop.
  if (!game.pairs[idx].isPlayer && len2(sub2(state.playerPos, midpoint)) < phase3.resonanceRadius) {
    state.score -= 5; state.penalties.resonanceClip = (state.penalties.resonanceClip || 0) + 5;
    showMessage("CLIPPED BY RESONANCE! −5", 'bad', 2);
  }
  if (game.popped.every(Boolean)) {
    game.doneAt = t;
    showMessage('REQUIEM CLEARED!', 'alert', 2.2);
  }
}

// ── Melody / rune HUD (HTML) ──────────────────────────────────────────────
function cssCol(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
function updateMelodyUI(game, gt, t) {
  const since = t - gt.marks;
  const revealDone = phase3.runeCount * noteTime();
  const visible = since >= 0 && !game.dissonantAt &&
    (state.helperOn ? t <= gt.end - 2 : since <= revealDone + phase3.melodyLinger);
  dom.melodyEl.classList.toggle('show', visible);
  if (state.p3.melodyBuilt !== gt.index) {
    state.p3.melodyBuilt = gt.index;
    dom.melodyNotesEl.innerHTML = game.melody.map((s, i) =>
      `<div class="melody-note" id="mn-${i}"><span class="mn-glyph" style="color:${cssCol(P3_RUNES[s].color)}">${P3_RUNES[s].glyph}</span><span class="mn-idx">${i + 1}</span></div>`).join('');
  }
  if (visible) game.melody.forEach((s, i) => {
    const el = document.getElementById(`mn-${i}`);
    el.classList.toggle('lit', since >= i * noteTime() + 0.15);
    el.classList.toggle('done', Boolean(game.popped[i]));
  });
  // Private-aura pill: your own rune, visible for the whole game.
  const pillOn = since >= game.playerIdx * noteTime() + 0.15 && t <= gt.end - 2
    && !game.dissonantAt && !game.doneAt && !game.popped[game.playerIdx];
  dom.yourRuneEl.classList.toggle('show', pillOn);
  if (pillOn) {
    const r = P3_RUNES[game.melody[game.playerIdx]];
    dom.yrGlyphEl.textContent = r.glyph; dom.yrGlyphEl.style.color = cssCol(r.color);
    const ord = ['1ST', '2ND', '3RD', '4TH', '5TH'][game.playerIdx];
    dom.yrSpotEl.textContent = `${r.label} SPOT` + (state.helperOn ? ` · ${ord} IN ORDER` : '');
  }
}

// ── Per-frame update ──────────────────────────────────────────────────────
// Returns AI target overrides for p3.js: { targets: {aiIdx: {x,y}}, busy: Set }
export function updateRequiem(t) {
  const targets = {}, busy = new Set();
  runeSprites.forEach(pair => pair.forEach(s => s.visible = false));
  partnerRing.visible = false;
  updatePopRings(t);

  const gt = activeRequiemGame(t);
  if (!gt) {
    dom.melodyEl.classList.remove('show'); dom.yourRuneEl.classList.remove('show');
    return { targets, busy };
  }
  const game = getGame(gt.index);
  const marks = gt.marks;
  if (t < marks) return { targets, busy }; // boss still singing (cast bar)

  updateMelodyUI(game, gt, t);

  const over = game.dissonantAt !== null || game.doneAt !== null;
  const ended = over && t > (game.doneAt ?? game.dissonantAt) + 0.4;

  // Chaotic one-shots
  if (state.chaoticOn && !over) {
    if (game.confusionAt !== null && t - marks >= game.confusionAt) {
      game.confusionAt = null;
      showMessage(P3_CHAOS_MELODY_LINES[Math.floor(Math.random() * P3_CHAOS_MELODY_LINES.length)], 'bad', 1.6);
    }
    if (game.chaosEarlyPopAt !== null && t - marks >= game.chaosEarlyPopAt) {
      game.chaosEarlyPopAt = null;
      const victim = game.pairs.findIndex((p, i) => !p.isPlayer && !game.popped[i] && i > game.popped.findIndex(x => !x));
      if (victim > 0) dissonance(game, t, 'raid');
    }
  }

  // Timeout — no player penalty when the raid caused the stall (chaotic).
  if (!over && t >= gt.deadline && !game.popped.every(Boolean)) dissonance(game, t, game.raidFault ? 'raid' : 'timeout');

  const next = game.popped.findIndex(p => !p);
  const chainT = marks + phase3.chainStart;

  game.pairs.forEach((pair, idx) => {
    if (game.popped[idx] || over) return; // popped/aborted pairs drift back to formation
    const spot = runeSpotPos(pair.symbol);
    pair.ai.forEach((aiIdx, m) => {
      if (state.deadAI.has(aiIdx)) return;
      if (t < marks + pair.stagger[m]) return; // hasn't reacted to their mark yet
      busy.add(aiIdx);
      let tp = standPos(spot, pair, m);
      // AI-AI pair converge on their turn (pair 1 waits out the first set).
      // Convergence latches only once both members have settled at their
      // stands, so a straggler can never pop mid-room.
      if (!pair.isPlayer && idx === next) {
        const turnStart = idx === 0 ? chainT : game.popTime[idx - 1];
        if (!game.converging[idx] && t >= turnStart + pair.reactAt) {
          const bothSettled = pair.ai.every((ai2, m2) => !state.deadAI.has(ai2)
            && len2(sub2(state.aiPlayers[ai2].currentPos, standPos(spot, pair, m2))) < 6);
          if (bothSettled) game.converging[idx] = true;
        }
        if (game.converging[idx]) tp = state.aiPlayers[pair.ai[1 - m]].currentPos;
      }
      targets[aiIdx] = tp;
    });
  });

  // Sprites above heads: player always sees their own rune; easy mode shows everyone's.
  if (!over) {
    game.pairs.forEach((pair, idx) => {
      if (game.popped[idx]) return;
      const sprites = runeSprites[pair.symbol];
      if (pair.isPlayer) {
        sprites[0].visible = true; sprites[0].position.copy(w2v(state.playerPos, 1.6));
        if (state.helperOn && !state.deadAI.has(pair.ai[0])) {
          sprites[1].visible = true; sprites[1].position.copy(w2v(state.aiPlayers[pair.ai[0]].currentPos, 1.35));
        }
      } else if (state.helperOn) {
        pair.ai.forEach((aiIdx, m) => {
          if (state.deadAI.has(aiIdx)) return;
          sprites[m].visible = true; sprites[m].position.copy(w2v(state.aiPlayers[aiIdx].currentPos, 1.35));
        });
      }
    });
  }

  // Player collisions & turn handling
  if (!over && t >= marks + 0.8) {
    const playerPair = game.pairs[game.playerIdx];
    const partnerIdx = playerPair.ai[0];
    const partnerPos = state.aiPlayers[partnerIdx].currentPos;
    // The player's turn respects the same chain gate as AI pairs: pair 1 only
    // goes after the first constellation set ("everyone is initially spread
    // so nobody instantly pops marks as they appear").
    const playerTurnStart = game.playerIdx === 0 ? chainT : game.popTime[game.playerIdx - 1];
    const isPlayerTurn = next === game.playerIdx && t >= playerTurnStart;

    if (isPlayerTurn && !game.yourTurnShown) {
      game.yourTurnShown = true;
      showMessage('YOUR TURN — TOUCH YOUR PARTNER', 'alert', 2.5);
      state.spFlashExpiry = t + 0.55;
    }
    if (isPlayerTurn && !state.deadAI.has(partnerIdx)) {
      partnerRing.visible = true; partnerRing.position.copy(w2v(partnerPos, .04));
      partnerRing.material.opacity = .5 + .4 * Math.sin(t * 6);
    }
    // Touching your partner: pops on your turn, Dissonance if too early.
    // Only counts once the partner has settled at their stand (an AI merely
    // walking past the player must not trigger a collision).
    const partnerSettled = len2(sub2(partnerPos, standPos(runeSpotPos(playerPair.symbol), playerPair, 0))) < 6;
    if (!game.popped[game.playerIdx] && game.dissonantAt === null && game.doneAt === null
      && !state.deadAI.has(partnerIdx) && partnerSettled
      && len2(sub2(state.playerPos, partnerPos)) < phase3.collideRadius) {
      if (isPlayerTurn) pop(game, t, game.playerIdx, mul2(add2(state.playerPos, partnerPos), .5));
      else dissonance(game, t, 'early');
    }
    // Touching any other settled or converging marked player: Dissonance.
    if (game.dissonantAt === null) {
      outer:
      for (let idx = 0; idx < game.pairs.length; idx++) {
        const pair = game.pairs[idx];
        if (pair.isPlayer || game.popped[idx]) continue;
        const turnStart = idx === 0 ? chainT : (idx === next ? game.popTime[idx - 1] : Infinity);
        const converging = idx === next && t >= turnStart + pair.reactAt;
        for (const aiIdx of pair.ai) {
          if (state.deadAI.has(aiIdx)) continue;
          const p = state.aiPlayers[aiIdx].currentPos;
          const settled = len2(sub2(p, standPos(runeSpotPos(pair.symbol), pair, pair.ai.indexOf(aiIdx)))) < 6;
          if ((settled || converging) && len2(sub2(state.playerPos, p)) < phase3.collideRadius) {
            dissonance(game, t, 'wrong'); break outer;
          }
        }
      }
    }
    // AI-AI pair pops
    if (game.dissonantAt === null && next >= 0 && !game.pairs[next].isPlayer) {
      const [a, b] = game.pairs[next].ai;
      if (!state.deadAI.has(a) && !state.deadAI.has(b)) {
        const pa = state.aiPlayers[a].currentPos, pb = state.aiPlayers[b].currentPos;
        const turnStart = next === 0 ? chainT : game.popTime[next - 1];
        if (t >= turnStart + game.pairs[next].reactAt && len2(sub2(pa, pb)) < phase3.collideRadius)
          pop(game, t, next, mul2(add2(pa, pb), .5));
      } else {
        // A dead pair member (chaotic) can never pop — treated as raid fault at deadline.
        game.raidFault = true;
      }
    }
  }

  if (ended) { dom.melodyEl.classList.remove('show'); dom.yourRuneEl.classList.remove('show'); }
  return { targets, busy };
}

function updatePopRings(t) {
  popRings.forEach((ring, i) => {
    const p = state.p3.pops[state.p3.pops.length - 1 - i];
    if (!p || t - p.t > .7 || t < p.t) { ring.visible = false; return; }
    const pr = smooth(clamp((t - p.t) / .7, 0, 1));
    ring.visible = true;
    ring.position.copy(w2v(p.pos, .06));
    ring.scale.setScalar(.25 + pr * 1.1);
    ring.material.color.setHex(p.color);
    ring.material.opacity = .85 * (1 - pr);
  });
}

// Player spot info for scoring/helper: where the player should be right now.
export function playerRequiemDuty(t) {
  const gt = activeRequiemGame(t);
  if (!gt || t < gt.marks) return null;
  const game = getGame(gt.index);
  if (game.dissonantAt !== null || game.doneAt !== null) return null;
  if (game.popped[game.playerIdx]) return null;
  return { spot: runeSpotPos(game.melody[game.playerIdx]), gt, game };
}
