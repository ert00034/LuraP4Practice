import {
  phase, GUILD_FIXED, STUN_HINTS, CHAOTIC_CORNERS, WCGOALS, GUILD_NAMES, GUILD_RESPONSES,
  DISCORD_NAMES, DISCORD_MSGS, LUA_ERRORS, OFFLINE_RESPONSES, CHAOS_MOVE_CALLS, EASTER_EGGS
} from './config.js';
import { clamp } from './math.js';
import { state, dom } from './state.js';
import { heavenCountdownAt, currentHeaven, activeStarsplinterCycle } from './timing.js';

// ── Guild chat helpers ────────────────────────────────────────────────────
export function guildResp(name, fallback) { return GUILD_FIXED[name] || fallback; }
export function addGuildChatMsg(name, text, type = 'resp') {
  const d = document.createElement('div'); d.className = 'gc-msg';
  d.innerHTML = `<span class="gc-name">${name}</span>: <span class="gc-resp">${text}</span>`;
  dom.gcMsgsEl.appendChild(d);
}
export function buildEasterEggSchedule() {
  state.easterEggSchedule = [];
  const count = 1 + Math.floor(Math.random() * 2);
  const picks = [...EASTER_EGGS].sort(() => Math.random() - .5).slice(0, count);
  const base = [15 + Math.random() * 25, 50 + Math.random() * 25];
  picks.forEach((egg, i) => state.easterEggSchedule.push({ t: base[i], egg, fired: false }));
}

// ── Stun hints ────────────────────────────────────────────────────────────
// Role instructions live on the pre-play guide screen; the stun phase only
// shows the chaotic-mode flavor lines.
export function buildStunHints() {
  const lines = dom.chaoticCheck.checked ? STUN_HINTS.chaotic : [];
  const el = document.getElementById('stun-hints');
  el.innerHTML = lines.map(l => `<div class="hint-line">${l}</div>`).join('');
}
export function updateStunHints(t) {
  const s = phase.reintegrationCast, e = s + phase.stunDuration;
  // North hint: fade in t=0..0.5, hold, fade out t=2.5..3.0
  if (dom.reintHintEl) {
    let op = 0;
    if (t >= 0 && t <= e) {
      if (t < 0.5) op = t / 0.5;
      else if (t < 2.5) op = 1;
      else if (t < 3.0) op = 1 - (t - 2.5) / 0.5;
      else op = 0;
    }
    dom.reintHintEl.style.opacity = String(op);
  }
  const lines = document.querySelectorAll('#stun-hints .hint-line');
  if (!lines.length) return;
  const active = t >= 2.5 && t <= e;
  const fadeOutStart = e - 1.5;
  lines.forEach((line, i) => {
    if (!active) { line.style.opacity = '0'; return; }
    const fadeInAt = 2.5 + i * 1.0;
    if (t < fadeInAt) { line.style.opacity = '0'; return; }
    if (t >= fadeOutStart) {
      const p = Math.min(1, (t - fadeOutStart) / 0.4);
      line.style.opacity = String(1 - p);
    } else {
      const p = Math.min(1, (t - fadeInAt) / 0.35);
      line.style.opacity = String(p);
    }
  });
}

// ── Boss cast bar (Heaven & Hell) ─────────────────────────────────────────
export function updateBossCastBar(t) {
  const h = currentHeaven(t);
  if (!h) {
    // Show countdown to next Heaven and Hell
    let nextStart = Infinity;
    for (let i = 0; i < 3; i++) { const s = phase.firstHeaven + i * phase.heavenSpacing; if (s > t) { nextStart = s; break; } }
    if (nextStart === Infinity) { dom.bossCastbarEl.classList.remove("show"); return; }
    const remaining = Math.max(0, nextStart - t);
    dom.bcbLabelEl.textContent = `Heaven & Hell — ${remaining.toFixed(1)}s`;
    dom.bcbFillEl.className = "bcb-fill casting";
    dom.bcbFillEl.style.width = `${clamp(1 - remaining / phase.heavenSpacing, 0, 1) * 100}%`;
    dom.bossCastbarEl.classList.add("show"); return;
  }
  const casting = t < h.laserStart;
  const fill = casting ? (t - h.start) / phase.heavenRampDuration : 1 - (t - h.laserStart) / phase.heavenLaserDuration;
  dom.bcbLabelEl.textContent = casting ? "Heaven and Hell" : "Channeling";
  dom.bcbFillEl.className = "bcb-fill " + (casting ? "casting" : "channeling");
  dom.bcbFillEl.style.width = `${clamp(fill, 0, 1) * 100}%`;
  dom.bossCastbarEl.classList.add("show");
}

// ── Cast bar ─────────────────────────────────────────────────────────────
export function updateCastBar(t) {
  const active = t < phase.reintegrationCast;
  dom.castbarEl.classList.toggle("show", active);
  if (active) dom.castfillEl.style.width = `${(t / phase.reintegrationCast * 100).toFixed(1)}%`;
}

// ── HUD / Raid call ───────────────────────────────────────────────────────
export function updateRaidCall(t) {
  const countdown = heavenCountdownAt(t);
  const heaven = currentHeaven(t);
  const chaotic = dom.chaoticCheck.checked;
  if (chaotic) {
    // SP bar hidden in chaos
    dom.raidcallEl.classList.remove("show");
    // Movement call: flip MOVE/WAIT during countdown, GO GO GO during ramp
    if (countdown) {
      if (t >= state.nextChaosMoveFlip) {
        state.chaosMoveText = CHAOS_MOVE_CALLS[Math.floor(Math.random() * CHAOS_MOVE_CALLS.length)];
        state.nextChaosMoveFlip = t + 0.32 + Math.random() * 0.48;
      }
      dom.movecallEl.querySelector('.movelabel').textContent = state.chaosMoveText;
      dom.movecountdownEl.textContent = '';
      dom.movecallEl.classList.add("show");
    } else if (heaven && t < heaven.laserStart) {
      dom.movecallEl.querySelector('.movelabel').textContent = 'MOVE GO GO GO';
      dom.movecountdownEl.textContent = '⚡⚡';
      dom.movecallEl.classList.add("show");
    } else {
      dom.movecallEl.classList.remove("show");
    }
  } else {
    dom.movecallEl.classList.toggle("show", Boolean(countdown));
    if (countdown) {
      dom.movecallEl.querySelector('.movelabel').textContent = 'MOVE IN';
      dom.movecountdownEl.textContent = Math.max(1, Math.ceil(countdown.remaining));
    }
    const cycle = activeStarsplinterCycle(t);
    if (cycle && t >= cycle.start - 1.5) {
      dom.raidcallEl.classList.add("show");
      dom.spSlotEls.forEach((el, i) => {
        const apply = phase.firstStarsplinter + cycle.index * phase.starsplinterSpacing + i * phase.starsApplyGap;
        const retEnd = apply + phase.starsExplosionDelay + phase.returnDuration;
        el.classList.toggle("stepping", t >= apply && t <= retEnd);
      });
    } else dom.raidcallEl.classList.remove("show");
  }
  if (state.time > state.messageExpiry) dom.messageEl.className = '';
}

export function updateHud(t) {
  const stars = activeStarsplinterCycle(t), heaven = currentHeaven(t);
  let label = "Holding";
  if (t <= phase.reintegrationCast) label = "Reintegration";
  else if (t <= phase.reintegrationCast + phase.stunDuration) label = "Stunned";
  else if (stars && t >= stars.start && t <= stars.end) label = "Starsplinters";
  else if (heaven) label = "Heaven and Hell";
  dom.clockEl.textContent = `${t.toFixed(1)}s`; dom.stateEl.textContent = label;
  dom.cycleEl.textContent = `${Math.min(4, Math.max(1, stars ? stars.index + 1 : Math.floor((t - phase.firstStarsplinter) / phase.starsplinterSpacing) + 1))} / 4`;
  dom.scorePillEl.textContent = Math.round(state.score);
}

// ── Defensive UI helper ──────────────────────────────────────────────────
export function updateDefUI() {
  const pips = document.getElementById('def-pips');
  pips.innerHTML = '';
  for (let i = 0; i < 3; i++) { const d = document.createElement('div'); d.className = 'def-pip' + (i >= state.defCharges ? ' spent' : ''); pips.appendChild(d); }
}

// ── Chaotic mode overlays ─────────────────────────────────────────────────
export function updateChaoticOverlays() {
  const time = state.time;
  if (dom.chaoticCheck.checked && state.running) {
    // World cup
    if (time >= state.nextWorldCupTime) {
      const c = CHAOTIC_CORNERS[Math.floor(Math.random() * 4)];
      Object.assign(dom.worldCupEl.style, { top: c.top, left: c.left, right: c.right, bottom: c.bottom });
      dom.worldCupEl.textContent = WCGOALS[Math.floor(Math.random() * WCGOALS.length)];
      dom.worldCupEl.classList.add("show");
      state.worldCupExpiry = time + 3; state.nextWorldCupTime = time + 12 + Math.random() * 14;
    }
    if (time > state.worldCupExpiry) dom.worldCupEl.classList.remove("show");
    // Guild drama
    if (time >= state.nextGuildDrama && !state.gcDramaActive) {
      const leaver = GUILD_NAMES[Math.floor(Math.random() * GUILD_NAMES.length)];
      const others = [...GUILD_NAMES].filter(n => n !== leaver).sort(() => Math.random() - .5);
      const resps = [...GUILD_RESPONSES].sort(() => Math.random() - .5);
      const count = 4 + Math.floor(Math.random() * 5);
      state.gcQueue = [{ name: leaver, text: 'has left the guild.', type: 'leave', delay: 0, added: false }];
      for (let i = 0; i < count; i++) state.gcQueue.push({ name: others[i], text: guildResp(others[i], resps[i % resps.length]), type: 'resp', delay: (i + 1) * .65 + Math.random() * .4, added: false });
      state.gcDramaStart = time; state.gcDramaActive = true; dom.gcMsgsEl.innerHTML = ''; dom.guildChatEl.classList.add("show");
      state.nextGuildDrama = time + 20 + Math.random() * 18;
    }
    if (state.gcDramaActive) {
      const el = time - state.gcDramaStart;
      state.gcQueue.forEach(m => {
        if (!m.added && el >= m.delay) {
          m.added = true;
          const d = document.createElement('div'); d.className = 'gc-msg';
          d.innerHTML = m.type === 'leave'
            ? `<span class="gc-name">${m.name}</span> <span class="gc-leave">${m.text}</span>`
            : m.type === 'offline'
              ? `<span class="gc-name">${m.name}</span> <span style="color:#7a8ab0">${m.text}</span>`
              : `<span class="gc-name">${m.name}</span>: <span class="gc-resp">${m.text}</span>`;
          dom.gcMsgsEl.appendChild(d);
        }
      });
      const last = state.gcQueue[state.gcQueue.length - 1];
      if (last.added && time - state.gcDramaStart > last.delay + 5) { dom.guildChatEl.classList.remove("show"); state.gcDramaActive = false; }
    }
    // Discord notifications
    if (time >= state.nextDcTime) {
      dom.dcSenderEl.textContent = DISCORD_NAMES[Math.floor(Math.random() * DISCORD_NAMES.length)];
      dom.dcTextEl.textContent = DISCORD_MSGS[Math.floor(Math.random() * DISCORD_MSGS.length)];
      dom.discordEl.classList.add("show");
      state.dcExpiry = time + 5; state.nextDcTime = time + 18 + Math.random() * 20;
    }
    if (time > state.dcExpiry) dom.discordEl.classList.remove("show");
    // LUA error popup
    if (time >= state.nextLuaErrorTime && !state.luaErrorShowing) {
      dom.luaErrorBodyEl.textContent = LUA_ERRORS[Math.floor(Math.random() * LUA_ERRORS.length)];
      dom.luaErrorEl.classList.add("show"); state.luaErrorShowing = true;
      state.nextLuaErrorTime = time + 25 + Math.random() * 22;
    }
    // Gone offline guild event
    if (time >= state.nextOfflineTime && !state.gcDramaActive) {
      const name = GUILD_NAMES[Math.floor(Math.random() * GUILD_NAMES.length)];
      const resps = [...OFFLINE_RESPONSES].sort(() => Math.random() - .5).slice(0, 1 + Math.floor(Math.random() * 2));
      const others = [...GUILD_NAMES].filter(n => n !== name).sort(() => Math.random() - .5);
      state.gcQueue = [{ name, text: 'has gone offline.', type: 'offline', delay: 0, added: false }];
      resps.forEach((r, i) => state.gcQueue.push({ name: others[i], text: guildResp(others[i], r), type: 'resp', delay: (i + 1) * .9 + Math.random() * .4, added: false }));
      state.gcDramaStart = time; state.gcDramaActive = true; dom.gcMsgsEl.innerHTML = ''; dom.guildChatEl.classList.add("show");
      state.nextOfflineTime = time + 28 + Math.random() * 22;
    }
    // Death message hide
    if (time > state.deathMsgExpiry) dom.deathMsgEl.classList.remove("show");
    // Easter egg lines
    for (const s of state.easterEggSchedule) {
      if (!s.fired && time >= s.t) {
        s.fired = true;
        addGuildChatMsg(s.egg.name, s.egg.text);
        if (s.egg.reply) state.pendingGcReplies.push({ fireAt: time + 1.2 + Math.random() * .8, name: s.egg.reply.name, text: s.egg.reply.text });
        state.gcEggExpiry = time + 7; dom.guildChatEl.classList.add("show");
      }
    }
    for (let i = state.pendingGcReplies.length - 1; i >= 0; i--) {
      const r = state.pendingGcReplies[i];
      if (time >= r.fireAt) { addGuildChatMsg(r.name, r.text); state.gcEggExpiry = time + 6; state.pendingGcReplies.splice(i, 1); }
    }
    if (!state.gcDramaActive && time > state.gcEggExpiry) dom.guildChatEl.classList.remove("show");
  } else {
    dom.worldCupEl.classList.remove("show");
    dom.guildChatEl.classList.remove("show");
    dom.discordEl.classList.remove("show");
    state.gcDramaActive = false;
  }
}
