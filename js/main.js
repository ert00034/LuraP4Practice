import { phase, world, scale, CAM_BACK, CAM_H, immunityColors } from './config.js';
import { w2v, clamp } from './math.js';
import { state, dom } from './state.js';
import { initScene, updateCamera } from './scene.js';
import { raidPosAt, currentHeaven, activeStarsplinterCycle, stunLiftAt } from './timing.js';
import { getCycleAssignment } from './splinter-layout.js';
import { showMessage } from './messages.js';

import { offTankPos, immunityPos, updateAdds, updateDyingAdds, updateConeKills } from './mechanics/adds.js';
import { updatePlayer } from './mechanics/player.js';
import { updateAIPlayers } from './mechanics/ai.js';
import { updateSplinters } from './mechanics/splinters.js';
import { updateBeam, updateOTCone, updateWorldMarkers, updateStun } from './mechanics/heaven.js';
import { checkExplosions, checkOnYouSP, checkZap, checkMunch, checkMidnight } from './mechanics/collision.js';
import { updateScore, showScoreboard } from './mechanics/score.js';
import {
  updateRaidCall, updateHud, updateCastBar, updateBossCastBar, updateStunHints,
  buildStunHints, buildEasterEggSchedule, updateDefUI, updateChaoticOverlays
} from './ui.js';

// ── Scene setup ──────────────────────────────────────────────────────────
initScene();

document.getElementById("lua-close-btn").addEventListener("click", () => { dom.luaErrorEl.classList.remove("show"); state.luaErrorShowing = false; });

// ── Input ────────────────────────────────────────────────────────────────
window.addEventListener("keydown", e => {
  if ("wasd".includes(e.key.toLowerCase())) e.preventDefault();
  state.keys[e.key.toLowerCase()] = true;
  if (state.selectedRole === 'tank' && state.running && e.key.toLowerCase() === state.eabKey && state.time > state.eabCooldownUntil
    && state.time > phase.reintegrationCast + phase.stunDuration) {
    state.eabConePos = { ...state.playerPos }; state.eabConeDir = { ...state.playerFacingDir };
    state.eabConeExpiry = state.time + 0.5; state.eabCooldownUntil = state.time + 18; state.eabConeFired = false;
    const ac = activeStarsplinterCycle(state.time);
    if (ac && state.waveSpawned.has(ac.index)) state.tankEabWaveKillCycles.add(ac.index);
  }
  if (state.selectedRole === 'tank' && state.running && e.key.toLowerCase() === state.defKey && state.defCharges > 0
    && state.time > phase.reintegrationCast + phase.stunDuration) {
    state.defCharges--; state.defExpiry = state.time + 6;
    updateDefUI();
  }
});
window.addEventListener("keyup", e => { state.keys[e.key.toLowerCase()] = false; });
window.addEventListener("blur", () => Object.keys(state.keys).forEach(k => state.keys[k] = false));

// ── Restart ──────────────────────────────────────────────────────────────
function doRestart() {
  for (const a of state.adds) state.scene.remove(a.mesh);
  for (const d of state.dyingAdds) state.scene.remove(d.mesh);
  state.adds = []; state.dyingAdds = []; state.time = 0; state.seed = 5; state.lastAddTime = -999; state.nextAddId = 1; state.waveSpawned = new Set();
  Object.keys(state.cycleAssignments).forEach(k => delete state.cycleAssignments[k]);
  Object.keys(state.cycleOrientations).forEach(k => delete state.cycleOrientations[k]);
  Object.keys(state.cycleDelays).forEach(k => delete state.cycleDelays[k]);
  Object.keys(state.cycleAdjustedDrops).forEach(k => delete state.cycleAdjustedDrops[k]);
  Object.keys(state.cycleFakeouts).forEach(k => delete state.cycleFakeouts[k]);
  Object.keys(state.cycleSafeDrops).forEach(k => delete state.cycleSafeDrops[k]);
  state.aiWander.forEach(w => w.active = false); state.nextWanderTime = 20 + Math.random() * 12;
  state.checkedExplosions.clear(); state.checkedLasers.clear(); state.firedConeKills.clear();
  state.tankEabWaveKillCycles.clear(); state.checkedWavePenalties.clear();
  state.playerPos = { x: 0, y: -world.stackDistance }; state.playerFacingDir = { x: 0, y: 1 };
  state.messageExpiry = 0; dom.messageEl.className = ''; state.lastMunchTime = -999; state.lastMidnightTime = -999;
  state.score = 0; state.safeAccum = 0; Object.keys(state.penalties).forEach(k => state.penalties[k] = 0); state.scoreboardShown = false;
  state.deadAI.clear(); state.aiPlayers.forEach(ai => ai.mesh.visible = true);
  state.worldCupExpiry = -999; state.nextWorldCupTime = 18 + Math.random() * 8; dom.worldCupEl.classList.remove("show");
  state.gcQueue = []; state.gcDramaActive = false; dom.gcMsgsEl.innerHTML = ''; dom.guildChatEl.classList.remove("show"); state.nextGuildDrama = 22 + Math.random() * 8;
  state.dcExpiry = -999; state.nextDcTime = 35 + Math.random() * 10; dom.discordEl.classList.remove("show");
  state.chaosMoveText = 'WAIT!!'; state.nextChaosMoveFlip = -999;
  dom.luaErrorEl.classList.remove("show"); state.luaErrorShowing = false; state.nextLuaErrorTime = 28 + Math.random() * 12;
  dom.deathMsgEl.classList.remove("show"); state.deathMsgExpiry = -999; state.lastDeathMsgTime = -999;
  state.nextOfflineTime = 45 + Math.random() * 10;
  state.gcEggExpiry = -999; state.pendingGcReplies = []; buildEasterEggSchedule(); buildStunHints();
  dom.scoreboardEl.classList.remove("show");
  dom.reintHintEl.style.opacity = '0';
  state.prevScore = 0; state.penaltyFlashExpiry = -999; state.spFlashExpiry = -999; dom.penaltyFlashEl.classList.remove("on"); dom.spFlashEl.classList.remove("on");
  state.eabCooldownUntil = -Infinity; state.eabConePos = null; state.eabConeExpiry = -Infinity; state.eabConeFired = false;
  state.defCharges = 3; state.defExpiry = -Infinity; state.lightMovePenaltyExpiry = -Infinity;
  document.getElementById('eab-icon').classList.remove('show');
  document.getElementById('def-charges').classList.remove('show');
  document.getElementById('def-bar-wrap').classList.remove('show');
  document.getElementById('role-step').style.display = 'flex';
  document.getElementById('diff-step').style.display = 'none';
  document.getElementById('eab-bind-row').style.display = 'none';
  document.getElementById('tank-continue-btn').style.display = 'none';
  dom.modeSelectEl.style.display = 'flex';
  state.running = false; dom.playBtn.textContent = "Pause";
  state.camera.position.set(0, Number(dom.camHeightInput.value), -Number(dom.camDistInput.value) * scale); state.last = performance.now();
}

// ── Mode / role selection ────────────────────────────────────────────────
function startMode(mode) {
  state.selectedMode = mode;
  dom.helperCheck.checked = (mode === 'easy');
  dom.chaoticCheck.checked = (mode === 'chaotic');
  buildEasterEggSchedule();
  buildStunHints();
  dom.modeSelectEl.style.display = 'none';
  if (state.selectedRole === 'tank') {
    document.getElementById('eab-icon').classList.add('show');
    document.getElementById('def-charges').classList.add('show');
    state.defCharges = 3; state.defExpiry = -Infinity; updateDefUI();
  }
  state.running = true; dom.playBtn.textContent = "Pause"; state.last = performance.now();
}

const roleLabels = { 'dps': 'DPS / Healer', 'light': 'Light Holder', 'tank': 'Add Tank' };
function selectRole(role) {
  state.selectedRole = role;
  document.getElementById('diff-role-label').textContent = roleLabels[role] + ' · Choose difficulty';
  document.getElementById('role-step').style.display = 'none';
  document.getElementById('diff-step').style.display = 'flex';
}
document.getElementById("btn-role-dps").addEventListener("click", () => selectRole('dps'));
document.getElementById("btn-role-light").addEventListener("click", () => selectRole('light'));
document.getElementById("btn-role-tank").addEventListener("click", () => {
  document.getElementById('eab-bind-row').style.display = 'flex';
  document.getElementById('tank-continue-btn').style.display = 'block';
  state.selectedRole = 'tank';
});
document.getElementById("tank-continue-btn").addEventListener("click", () => selectRole('tank'));
document.getElementById("btn-back-role").addEventListener("click", () => {
  document.getElementById('diff-step').style.display = 'none';
  document.getElementById('role-step').style.display = 'flex';
});

// ── EAB / Defensive keybind capture ──────────────────────────────────────
const eabKeyBtn = document.getElementById('eab-key-btn');
const defKeyBtn = document.getElementById('def-key-btn');
let capturingEab = false, capturingDef = false;
eabKeyBtn.addEventListener("click", () => { capturingEab = true; capturingDef = false; eabKeyBtn.textContent = '…'; eabKeyBtn.classList.add('capturing'); });
defKeyBtn.addEventListener("click", () => { capturingDef = true; capturingEab = false; defKeyBtn.textContent = '…'; defKeyBtn.classList.add('capturing'); });
window.addEventListener("keydown", e => {
  if (capturingEab) {
    e.preventDefault(); state.eabKey = e.key.toLowerCase();
    eabKeyBtn.textContent = e.key.toUpperCase(); eabKeyBtn.classList.remove('capturing'); capturingEab = false; return;
  }
  if (capturingDef) {
    e.preventDefault(); state.defKey = e.key.toLowerCase();
    defKeyBtn.textContent = e.key.toUpperCase(); document.getElementById('def-key-label').textContent = e.key.toUpperCase();
    defKeyBtn.classList.remove('capturing'); capturingDef = false; return;
  }
}, true);

document.getElementById("btn-easy").addEventListener("click", () => startMode('easy'));
document.getElementById("btn-normal").addEventListener("click", () => startMode('normal'));
document.getElementById("btn-chaotic").addEventListener("click", () => startMode('chaotic'));
dom.playBtn.addEventListener("click", () => { state.running = !state.running; dom.playBtn.textContent = state.running ? "Pause" : "Play"; state.last = performance.now(); });
dom.restartBtn.addEventListener("click", doRestart);
document.getElementById("sbRestart").addEventListener("click", doRestart);
window.addEventListener("resize", () => {
  state.camera.aspect = innerWidth / innerHeight; state.camera.updateProjectionMatrix(); state.renderer.setSize(innerWidth, innerHeight);
});

// ── Frame ─────────────────────────────────────────────────────────────────
function frame(now) {
  const dt = Math.min(.08, (now - state.last) / 1000); state.last = now;
  if (state.running) {
    state.time += dt * Number(dom.speedInput.value);
    if (state.time >= phase.duration) {
      state.time = phase.duration; state.running = false; dom.playBtn.textContent = "Play";
      if (!state.scoreboardShown) showScoreboard();
    }
  }
  const stackPos = raidPosAt(state.time), otPos = offTankPos(stackPos);
  const immunePosNow = immunityPos(state.time, stackPos);
  const liftY = stunLiftAt(state.time);
  const dur = state.time >= phase.reintegrationCast && state.time <= phase.reintegrationCast + phase.stunDuration;
  const aft = state.time > phase.reintegrationCast + phase.stunDuration;
  const showRaid = dur || aft;

  updateAdds(state.time, dt * Number(dom.speedInput.value), stackPos, otPos, immunePosNow);
  updateDyingAdds(state.time);

  if (dur) state.playerPos = { ...stackPos };

  state.stackGlow.visible = state.lightRing.visible = state.lightRingGlow.visible = state.lightDisc.visible = state.lightDiscRed.visible = showRaid;
  state.stackGlow.position.copy(w2v(stackPos, .05 + liftY));
  const lightCenter = state.selectedRole === 'light' ? state.playerPos : stackPos;
  state.lightRing.position.copy(w2v(lightCenter, .06 + liftY));
  state.lightRingGlow.position.copy(w2v(lightCenter, .06 + liftY));
  state.lightDisc.position.set(lightCenter.x * scale, .06 + liftY, lightCenter.y * scale);
  state.lightDiscRed.position.set(lightCenter.x * scale, .065 + liftY, lightCenter.y * scale);

  state.otCyl.visible = showRaid && state.selectedRole !== 'tank'; state.otCyl.position.copy(w2v(otPos, .36 + liftY));

  state.immuneMesh.visible = Boolean(aft && currentHeaven(state.time));
  state.immuneMesh.position.copy(w2v(immunePosNow, .34));
  const heaven = currentHeaven(state.time);
  if (heaven) state.immuneMesh.material.color.setHex(immunityColors[heaven.index]);

  updateStun(state.time);
  updateBeam(state.time);
  updateSplinters(state.time, stackPos);
  updateAIPlayers(state.time, stackPos, liftY);
  updatePlayer(state.time, dt * Number(dom.speedInput.value), stackPos, liftY);
  updateOTCone(state.time, stackPos);
  updateConeKills(state.time, stackPos);
  updateWorldMarkers(state.time);
  updateStunHints(state.time);
  updateBossCastBar(state.time);
  updateCastBar(state.time);
  updateCamera(liftY);
  // reintHintEl opacity managed by updateStunHints
  if (state.score < state.prevScore) state.penaltyFlashExpiry = state.time + 0.15;
  dom.penaltyFlashEl.classList.toggle("on", state.time < state.penaltyFlashExpiry);
  dom.spFlashEl.classList.toggle("on", state.time < state.spFlashExpiry);
  state.prevScore = state.score;
  // EAB cooldown icon
  if (state.selectedRole === 'tank' && state.running) {
    const eabCvs = document.getElementById('eab-canvas');
    const ctx2 = eabCvs.getContext('2d');
    const W = 52, cx = W / 2, cy = W / 2, rad = 22;
    ctx2.clearRect(0, 0, W, W);
    const onCd = state.time < state.eabCooldownUntil;
    ctx2.beginPath(); ctx2.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx2.fillStyle = onCd ? 'rgba(30,10,0,0.85)' : 'rgba(255,122,69,0.18)'; ctx2.fill();
    if (onCd) {
      const frac = 1 - (state.eabCooldownUntil - state.time) / 18;
      ctx2.beginPath(); ctx2.moveTo(cx, cy);
      ctx2.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx2.closePath(); ctx2.fillStyle = 'rgba(255,122,69,0.45)'; ctx2.fill();
    }
    ctx2.font = 'bold 13px monospace'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    ctx2.fillStyle = onCd ? '#ff7a45' : '#fff';
    ctx2.fillText(state.eabKey.toUpperCase(), cx, cy);
  }
  // Defensive bar + pips
  if (state.selectedRole === 'tank' && state.running) {
    const defBarWrap = document.getElementById('def-bar-wrap');
    const defFill = document.getElementById('def-fill');
    const defActive = state.time < state.defExpiry;
    defBarWrap.classList.toggle('show', defActive);
    if (defActive) defFill.style.width = `${clamp((state.defExpiry - state.time) / 6, 0, 1) * 100}%`;
    updateDefUI();
  }
  updateRaidCall(state.time);
  updateHud(state.time);
  if (aft) {
    updateScore(state.time, dt, stackPos);
    checkExplosions(state.time, stackPos);
    if (state.playerSplinterForceExplodeAt < Infinity) {
      const sc = activeStarsplinterCycle(state.time);
      if (!sc || state.time > phase.firstStarsplinter + sc.index * phase.starsplinterSpacing + getCycleAssignment(sc.index) * phase.starsApplyGap + phase.starsExplosionDelay + phase.returnDuration)
        state.playerSplinterForceExplodeAt = Infinity;
    }
    checkOnYouSP(state.time, stackPos);
    checkZap(state.time);
    checkMunch(state.time, stackPos);
    // Add Tank: penalise −75 if EAB not used to clear red wave
    if (state.selectedRole === 'tank') {
      const wc = activeStarsplinterCycle(state.time);
      if (wc && state.waveSpawned.has(wc.index) && !state.checkedWavePenalties.has(wc.index) && state.time >= wc.start + 3.0) {
        state.checkedWavePenalties.add(wc.index);
        if (!state.tankEabWaveKillCycles.has(wc.index)) {
          state.score -= 75; state.penalties.noEabClear = (state.penalties.noEabClear || 0) + 75;
          showMessage('ADDS HIT THE RAID! −75', 'danger', 3);
        }
      }
    }
    checkMidnight(state.time, stackPos);
  }

  // ── Chaotic mode overlays ────────────────────────────────────────────────
  updateChaoticOverlays();

  state.boss.rotation.y += dt * .35;
  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(frame);
}

state.camera.position.set(0, CAM_H, -CAM_BACK * scale);
requestAnimationFrame(frame);
