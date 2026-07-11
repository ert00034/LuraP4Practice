import { world, CAM_PITCH } from './config.js';

export const dom = {
  mount: document.getElementById("scene"),
  clockEl: document.getElementById("clock"),
  stateEl: document.getElementById("state"),
  cycleEl: document.getElementById("cycle"),
  scorePillEl: document.getElementById("scorepill"),
  playBtn: document.getElementById("play"),
  restartBtn: document.getElementById("restart"),
  speedInput: document.getElementById("speed"),
  camDistInput: document.getElementById("camDist"),
  spFlashEl: document.getElementById("sp-flash"),
  worldCupEl: document.getElementById("worldcup"),
  guildChatEl: document.getElementById("guildchat"),
  gcMsgsEl: document.getElementById("gc-messages"),
  discordEl: document.getElementById("discord-notif"),
  dcSenderEl: document.getElementById("dc-sender"),
  dcTextEl: document.getElementById("dc-text"),
  raidcallEl: document.getElementById("raidcall"),
  movecallEl: document.getElementById("movecall"),
  movecountdownEl: document.getElementById("movecountdown"),
  messageEl: document.getElementById("message"),
  spSlotEls: [0, 1, 2].map(i => document.getElementById(`sp${i}`)),
  castbarEl: document.getElementById("castbar"),
  castfillEl: document.getElementById("castfill"),
  bossCastbarEl: document.getElementById("boss-castbar"),
  bcbLabelEl: document.getElementById("bcb-label"),
  bcbFillEl: document.getElementById("bcb-fill"),
  scoreboardEl: document.getElementById("scoreboard"),
  luaErrorEl: document.getElementById("lua-error"),
  luaErrorBodyEl: document.getElementById("lua-error-body"),
  deathMsgEl: document.getElementById("death-msg"),
  reintHintEl: document.getElementById("reint-hint"),
  penaltyFlashEl: document.getElementById("penalty-flash"),
  modeSelectEl: document.getElementById("mode-select"),
  legendEl: document.querySelector(".legend"),
  neAEl: document.getElementById("ne-a"),
  neBEl: document.getElementById("ne-b"),
  neLabelAEl: document.getElementById("ne-label-a"),
  neLabelBEl: document.getElementById("ne-label-b"),
  raidNoteEl: document.getElementById("raid-note"),
  raidFramesEl: document.getElementById("raid-frames"),
  melodyEl: document.getElementById("melody"),
  melodyNotesEl: document.getElementById("melody-notes"),
  yourRuneEl: document.getElementById("your-rune"),
  yrGlyphEl: document.getElementById("yr-glyph"),
  yrSpotEl: document.getElementById("yr-spot"),
};

export const state = {
  // ── Time / run state ─────────────────────────────────────────────────
  time: 0,
  last: performance.now(),
  running: false,
  prevScore: 0,
  penaltyFlashExpiry: -999,
  spFlashExpiry: -999,

  playerSplinterForceExplodeAt: Infinity,
  selectedMode: 'normal',
  selectedPhase: 'p4', // 'p3' | 'p4'
  selectedRole: 'dps', // 'dps' | 'light' | 'tank' (P4 only)
  helperOn: false,  // easy mode: movement helper ring, 0.5× score
  chaoticOn: false, // chaotic mode: distractions, raid deaths, 1.15× score
  strafeKeys: 'ad', // 'ad' | 'qe' — which keys strafe left/right

  // ── Tank abilities ───────────────────────────────────────────────────
  // Keybinds support an optional Shift modifier (eabShift / defShift).
  eabKey: 'r', eabShift: false, eabCooldownUntil: -Infinity, eabConePos: null, eabConeDir: { x: 0, y: 1 }, eabConeExpiry: -Infinity, eabConeFired: false,
  tankEabWaveKillCycles: new Set(), checkedWavePenalties: new Set(),
  defKey: 'f', defShift: false, defCharges: 3, defExpiry: -Infinity,
  lightMovePenaltyExpiry: -Infinity, lastAddsHnHMsg: -999,

  // ── Adds ─────────────────────────────────────────────────────────────
  seed: 5, lastAddTime: -999, nextAddId: 1,
  adds: [], dyingAdds: [], waveSpawned: new Set(),

  // ── Player ───────────────────────────────────────────────────────────
  playerPos: { x: 0, y: -world.stackDistance },
  playerFacingDir: { x: 0, y: 1 }, // facing: forced toward boss during stun; otherwise steered via right-mouse drag
  keys: {},

  // ── Camera orbit (WoW-style) ─────────────────────────────────────────
  camYaw: 0,          // horizontal orbit angle; 0 = looking north toward boss
  camPitch: CAM_PITCH, // vertical angle above horizontal

  // ── Splinter cycle caches ────────────────────────────────────────────
  cycleAssignments: {}, cycleOrientations: {}, cycleDelays: {}, cycleAdjustedDrops: {}, cycleFakeouts: {}, cycleSafeDrops: {},
  cyclePlayerOrientations: {},

  // ── Phase 3 (filled by resetP3 / initP3Scene in mechanics/p3.js) ─────
  p3: null,
  p3Formation: null,

  // ── AI wander ────────────────────────────────────────────────────────
  nextWanderTime: 20 + Math.random() * 12,
  aiWander: Array.from({ length: 17 }, () => ({ active: false, startTime: 0, endTime: 0, fromPos: { x: 0, y: 0 }, target: { x: 0, y: 0 } })),

  // ── Collision de-dupe sets ───────────────────────────────────────────
  checkedExplosions: new Set(), checkedLasers: new Set(), firedConeKills: new Set(),

  // ── Messages ─────────────────────────────────────────────────────────
  messageExpiry: 0,
  lastMunchTime: -999, lastLeftLightTime: -999,

  // ── Chaotic mode state ───────────────────────────────────────────────
  deadAI: new Set(),
  worldCupExpiry: -999, nextWorldCupTime: 18 + Math.random() * 8,
  easterEggSchedule: [], gcEggExpiry: -999, pendingGcReplies: [],
  chaosMoveText: 'WAIT!!', nextChaosMoveFlip: -999,
  gcQueue: [], gcDramaStart: -999, gcDramaActive: false, nextGuildDrama: 22 + Math.random() * 8,
  nextOfflineTime: 45 + Math.random() * 10,
  dcExpiry: -999, nextDcTime: 35 + Math.random() * 10,
  luaErrorShowing: false, nextLuaErrorTime: 28 + Math.random() * 12,
  deathMsgExpiry: -999, lastDeathMsgTime: -999,

  // ── Score ────────────────────────────────────────────────────────────
  score: 0,
  penalties: { sliceOthers: 0, sliced: 0, munched: 0, leftLight: 0, zapped: 0, wrongSide: 0, addsHnH: 0 },
  safeAccum: 0,
  scoreboardShown: false,

  // ── Heaven beam ──────────────────────────────────────────────────────
  beamTip2d: { x: 0, y: 0 },

  // ── Three.js refs (filled by initScene) ─────────────────────────────
  scene: null,
  camera: null,
  renderer: null,
  keyLight: null,
  worldMarkers: null,
  floorMesh: null,
  boss: null,
  lightRing: null,
  lightRingGlow: null,
  stackGlow: null,
  lightDiscRed: null,
  lightDisc: null,
  otCyl: null,
  otConeMesh: null,
  aiPlayers: null,
  playerArrow: null,
  playerRing: null,
  targetRing: null,
  immuneMesh: null,
  stunFieldMat: null,
  stunField: null,
  laserFlashMat: null,
  laserFlash: null,
  beamCyl: null,
  beamGlowCyl: null,
  beamPulses: null,
  shardInnerMat: null,
  shardOuterMat: null,
  shardInners: null,
  shardOuters: null,
  pulseTriangles: null,
  splinterMeshes: null,
  mPurp: null,
  mPink: null,
  mWhite: null,
};
