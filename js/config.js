// ── Phase / world ────────────────────────────────────────────────────────
export const phase = {
  duration: 90, reintegrationCast: 5,
  firstStarsplinter: 16, starsplinterSpacing: 20,
  heavenSpacing: 20, firstHeaven: 22,
  starsApplyGap: 1, starsExplosionDelay: 2,
  moveOutDuration: 1.0, returnDuration: 1.45,
  stunDuration: 7, heavenRampDuration: 4, heavenLaserDuration: 4,
  raidDirection: -1, raidAdvanceDegrees: 110,
  shaBaseInterval: 0.4, shaSpeed: 28, shaWaveSpeed: 38,
  tankConeDelay: 0.5, tankConeDuration: 0.5
};
export const world = {
  roomRadius: 285, bossRadius: 36, stackDistance: 161,
  offTankDistance: 151, lightRadius: 60, shardLength: 90, coneLength: 109
};
export const scale = 0.052;

// ── Phase 3 — "Midnight Falls" (Death's Requiem + Dark Constellation) ────
// Timings approximate the Mythic cadence: marks → first constellation set
// ~4s later → ~8s window to finish the rune chain before the next set.
// Distances are world units (world.lightRadius 60 = the 12yd Torchbearer
// aura, so 1yd ≈ 5 units).
export const phase3 = {
  duration: 102,
  introCast: 4,                    // "Severance" opener
  // Death's Requiem memory games — casts at 8 / 38 / 68
  firstRequiem: 8, requiemSpacing: 30,
  requiemCast: 2,                  // boss cast; marks apply at cast end
  melodyNoteTime: 0.8,             // seconds per revealed note (0.55 chaotic)
  melodyLinger: 1.2,               // normal: melody stays this long after reveal
  requiemDeadline: 12,             // marks → all runes popped by here, or Dissonance
  chainStart: 5.5,                 // AI holder of rune 1 waits out the first set
  runeCount: 5,
  collideRadius: 10,               // touch distance (~2yd)
  partnerStandOff: 20,             // partner waits this far outside the spot
  //   (must exceed collideRadius + the 6-unit settle tolerance, so a settling
  //   partner can never brush a player standing on the spot)
  resonanceRadius: 15,             // 3yd splash on each pop
  spotArcRadius: 110,              // numbered rune spots, arc on the player's side
  spotArcSpan: 80,                 // degrees across the 5 spots
  spotArcCenter: 205,              // arc centred deep in the player's WEST dimension
  // ── Severance: the room splits into two dimensions at the boss meridian ──
  // (x = 0, running north-south). The player belongs to the WEST (x<0) half;
  // the rift down the middle is lethal to cross ("Dimension Breach").
  severance: {
    clampMargin: 4,                // hard rift wall this far west of x=0
    breachPenalty: 75, breachThrottle: 2.5,
    westAI: 9,                     // raiders in the player's dimension (rune game)
    wallHeight: 3,
    westColor: 0x2ad4c4, eastColor: 0xb060ff,
  },
  // Dark Constellation — near-constant pressure: with the in-game sets this
  // lands a wave every ~7-8s for the whole phase (impacts at 14, 22, 30, 37,
  // 44, 52, 60, 67, 74, 82, 90, 97), matching the live Mythic per-side cadence.
  standaloneWaves: [27, 34, 57, 64, 87, 94], // boss-cast waves between games
  standaloneCast: 3,               // Mythic cast time (12.0.7 hotfix value)
  gameSetOffsets: [4, 12],         // per game: sets impact at marks+4 / marks+12
  starCount: 30,
  starImpactRadius: 12.5,          // 2.5yd
  starMinR: 40, starMaxR: 190, starMinSep: 32,
  starFallTime: 2.5,               // telegraph + falling orb before impact
  beamDelay: 1.2,                  // beams turn deadly this long after impact
  beamFlashes: 3, beamFlashPeriod: 1.0,
  beamHalfWidth: 5,                // ~1yd
  starFade: 0.8,                   // fade-out after the last flash
  // Raid formation / scoring
  spreadRadius: 140, spreadBand: 45,
};
// The five Dark Rune symbols (Circle, Cross, Diamond, T, Triangle) with
// raid-marker-ish colours; T has no marker in-game (Square stands in).
export const P3_RUNES = [
  { key: 'circle', label: 'CIRCLE', glyph: '●', color: 0xff8c00 },
  { key: 'cross', label: 'CROSS', glyph: '✖', color: 0xff3344 },
  { key: 'diamond', label: 'DIAMOND', glyph: '◆', color: 0xaa44ff },
  { key: 'tshape', label: 'T-RUNE', glyph: '⊤', color: 0x3388ff },
  { key: 'triangle', label: 'TRIANGLE', glyph: '▲', color: 0x44ff88 },
];
export const P3_CHAOS_MELODY_LINES = [
  'WAS THAT CIRCLE OR DIAMOND FIRST??', 'WHO HAS CROSS?? CROSS??',
  'JUST TOUCH SOMEONE!!', 'NO NOT YET!! WAIT!!', 'ITS REVERSED THIS TIME (it is not)'];
export const splinterSides = [1, -1, 1];
export const splinterProfiles = [{ tangential: 46, radial: 13 }, { tangential: 58, radial: 14 }, { tangential: 56, radial: 10 }];
export const immunityColors = [0xaad372, 0xffd45a, 0xff89c2];
export const MARKER_COLORS = [0xffdd00, 0xff8c00, 0xaa44ff, 0x44ff88];
export const CAM_PITCH = 1.44, CAM_DIST = 16.5; // spherical orbit camera defaults (pitch rad, distance in scene units)

// ── Chaotic mode string constants ───────────────────────────────────────
export const WCGOALS = ['⚽ World Cup Goal Scored!!!!', '⚽ GOOOOOAL!!!!', '⚽ HE SHOOTS HE SCORES!!!!', '⚽ UNBELIEVABLE SCENES!!!!'];
export const chaoticSPLines = ['RIGHT NO LEFT NO I MEAN LEFT', 'LEFT?? NO WAIT RIGHT!! LEFT!!!', 'WHICH SIDE AGAIN?? GO!! NOW!!', 'LEFT I THINK?? JUST MOVE!!'];
export const GUILD_NAMES = ['Ruby', 'Cydonion', 'Layelle', 'Boltern', 'Josh', 'Darktheist', 'Dizzypete', 'Catters', 'Max', 'Sessanelly', 'Slowbolts', 'Aratiel', 'Zafu', 'Convoke', 'Exality', 'Tarrackk', 'Unfortunate', 'Stigdk', 'Girlstreamer', 'Fred', 'Klkl', 'Mox', 'Melwalor', 'Anaxstrasza', 'Sekrai', 'Zivvs', 'Jaffa', 'Desolate', 'Khiraen', 'Nordisk', 'Denarr', 'Tuulip', 'Luca', 'Silccu', 'Mikhe', 'Rquin', 'Kalse', 'Sproodle', 'Shadowdager', 'Itrinx', 'Yaela', 'Fester'];
export const GUILD_FIXED = { 'Sekrai': 'bad joke', 'Jaffa': 'thats cooked actually', 'Fester': '🇫🇷' };
export const GUILD_RESPONSES = ['omg', 'wtf', 'Good Riddance', 'wait what', 'nooo', 'the audacity', '???', 'lmao', 'finally', 'I knew it', 'lol bye', 'carry diff', 'thank god', 'bruh', 'oof', 'not surprised', 'cya', 'drama queen', 'toxic tbh', 'expected', 'L + ratio', 'real ones know', 'this is fine', 'who tanks now', 'I called it', 'rip bozo', 'no way', 'was it something I said', 'lmaooo', 'the plot thickens', 'and they were our best dps too', 'ngl saw this coming', 'big yikes', 'free at last', 'don\'t let the door hit you', 'been months coming tbh', 'does officer know', 'wait when did they even join', 'pour one out', 'who does their role now', 'kicked or left?', 'classic', 'press F', 'F', 'insert surprised pikachu', 'honestly deserved', 'touched grass we assume', 'another one bites the dust', 'guild on life support at this point', 'RIP', 'we go again', 'bro really said bye mid progression'];
export const DISCORD_NAMES = ['Josh', 'Layelle', 'Mum', 'Sarah', 'Dave', 'Conor', 'Alex', 'Catters', 'Boltern'];
export const DISCORD_MSGS = ["Hey, you coming over later?", "You left the fridge open", "I'm thinking of quitting the game", "Did you see the game last night?", "Dinner's ready", "You still owe me £20", "Can you walk the dog?", "Just found your cat on my roof", "Meeting at 9am tomorrow", "We need to talk", "Your package arrived", "Are you even listening?", "I found your wallet", "Stop ignoring me lol", "Bro your car is blocking mine", "Did you remember to take your meds?", "Your parking ticket expires in 10 minutes", "I think I scratched your car", "The cat knocked everything off the shelf again", "Can you pick up milk on the way home?", "Why is there a horse in the front garden", "Did you change the WiFi password??", "Bro wake up new patch dropped", "Your sister called again", "I accidentally sent that to the group chat", "The dishwasher is making that noise again", "Did you pay the electricity bill", "Your boss called the house phone", "I think I failed my exam", "The pizza arrived but I ate some of it", "Why is there a tent in the living room", "Someone keyed your car mate", "I've been accepted into a cult, brb", "Bro log off it's 3am", "Your mum added me on Facebook", "I'm outside your front door", "Sorry wrong number", "Did you feed the fish", "There's a spider and I need you home NOW", "I accidentally bought a boat", "You've been selected for jury duty", "I told everyone about that thing", "Are you coming to Karen's wedding or not", "My router keeps dropping, can I come over", "Just remembered I still have your charger from 2019"];
export const EASTER_EGGS = [
  { name: 'Darktheist', text: 'it just keeps growing back, I gotta keep cuttin' },
  { name: 'Darktheist', text: "i'm not in it, I'm not in it bro!!! I'm not even in it!!!" },
  { name: 'Layelle', text: 'use cooldowns anyone you have' },
  { name: 'Layelle', text: 'I have 18 atonements rn' },
  { name: 'Jamesmarcus', text: "Why can't you soak?!?!" },
  { name: 'Josh', text: "I'm thinking of re-rolling for the 246th time this tier, shall I play monk?" },
  { name: 'Layelle', text: 'turn on in game music this is SO good' },
  { name: 'Elizaslein', text: 'can we take a break soon btw?' },
  { name: 'Zafu', text: "I'm thinking of pinging the entire raid team for the 15th time this evening. @LHF @LHF @LHF" },
  { name: 'Max', text: "I'm not the max you're thinking of." },
  { name: 'Ruby', text: 'SOLO SOAKING' },
  { name: 'Ruby', text: 'I am English' },
  { name: 'Ruby', text: 'My class does no dps just none at all what the -', reply: { name: 'Zafu', text: 'Shut up.' } }
];
export const CHAOS_MOVE_CALLS = ['MOVE!!', 'WAIT!!', 'NO WAIT!!', 'GO!!', 'STOP!!', 'ACTUALLY MOVE!!'];
export const DEATH_REACTIONS = ["I wasn't even in it!", "DESK SLAM", "What are you doing?!?!?!", "bro WHAT", "ARE YOU KIDDING ME??", "MY KEYBOARD", "I HATE THIS GAME", "hello???? wtf", "unbelievable", "that's a rage DC", "NOT MY FAULT", "I WAS MOVING", "LAG", "REPORTED", "are you serious rn", "TOUCH GRASS", "I can't believe this", "my poor chair"];
export const LUA_ERRORS = [
`Message: Interface\\FrameXML\\UIParent.lua:3092: attempt to index nil value 'self'\nstack traceback:\n[C]: ?\nInterface\\FrameXML\\UIParent.lua:3092: in function 'SetPoint'\nInterface\\AddOns\\RaidFrameHelper\\core.lua:887: in local 'UpdateRaidFrame'\nInterface\\AddOns\\RaidFrameHelper\\core.lua:1204: in function <...>\n...\n(tail call): ?`,
`Message: Interface\\AddOns\\DBM-Core\\DBM-Core.lua:7341: attempt to perform arithmetic on nil value (global 'timerOffset')\nstack traceback:\n[C]: ?\nInterface\\AddOns\\DBM-Core\\DBM-Core.lua:7341: in method 'Start'\nInterface\\AddOns\\DBM-Raids-DF\\LuraP4.lua:448: in function 'COMBAT_LOG_EVENT_UNFILTERED'\n...\n(tail call): ?`,
`Message: Interface\\AddOns\\WeakAuras\\RegionTypes\\Text.lua:512: table index is NaN\nstack traceback:\n[C]: ?\nInterface\\AddOns\\WeakAuras\\RegionTypes\\Text.lua:512: in function 'SetText'\nInterface\\AddOns\\WeakAuras\\WeakAuras.lua:2991: in function 'UpdateTriggerState'\n...\n(tail call): ?`,
`Message: Interface\\FrameXML\\ActionButton.lua:234: Cannot find a library instance of 'LibStub-1.0'\nstack traceback:\n[C]: ?\nInterface\\AddOns\\ElvUI\\Core\\API.lua:234: in function 'Embed'\nInterface\\AddOns\\ElvUI\\Modules\\UnitFrames\\UF.lua:881: in function 'Initialize'\n...\n(tail call): ?`,
`Message: Interface\\AddOns\\Plater\\Plater.lua:9042: attempt to call nil (method 'GetName')\nstack traceback:\n[C]: ?\nInterface\\AddOns\\Plater\\Plater.lua:9042: in method 'ApplyProfile'\nInterface\\AddOns\\Plater\\Plater.lua:1337: in function 'ADDON_LOADED'\n...\n(tail call): ?`,
`Message: Interface\\AddOns\\Shadowed Unit Frames\\modules\\auras.lua:177: bad argument #1 to 'pairs' (table expected, got nil)\nstack traceback:\n[C]: in function 'pairs'\nInterface\\AddOns\\SUF\\modules\\auras.lua:177: in function 'UpdateAuras'\nInterface\\AddOns\\SUF\\units\\player.lua:44: in function 'FullUpdate'\n...\n(tail call): ?`];
export const OFFLINE_RESPONSES = ["during a pull?", "ffs not again", "every. single. time.", "disconnect or rage?", "classic", "rip", "pulled the plug lmao", "not again bro", "bruh", "come on man", "always at the worst time", "we needed them"];
export const STUN_HINTS = {
  dps: [
    'Remain pixel-stacked with the group whenever possible.',
    'Move to the correct side with Starsplinter. (WASD)',
    'Don\'t get hit by Void Swarm adds.',
    'Don\'t fall behind the raid during Heaven &amp; Hell.'
  ],
  light: [
    'Stand still on top of the raid during Starsplinters.',
    'Move during Heaven and Hell without leaving people behind. (WASD)',
    'Don\'t get hit by Void Swarm adds.'
  ],
  tank: [
    'Remain slightly in front of the group at all times.',
    'Use \'The Last Light\' action to clear adds in front of you.',
    'Use a defensive to soak any adds that will hit the group.',
    'Move during Heaven &amp; Hell and help to soak adds.'
  ],
  p3: [
    'Severance splits the room in two — you belong to the <strong>WEST</strong> half.',
    'Never cross the glowing rift down the middle. Touching it is a Dimension Breach.',
    'Watch the melody — remember where <strong>your</strong> rune sits in the order.',
    'Runes are private — you can\'t see anyone else\'s symbol. Trust the spots.',
    'Move to the numbered spot matching your rune\'s position (1–5).',
    'On your turn, run in and touch the next spot\'s player. In order only!',
    'Touching a marked player out of order is Dissonance — don\'t.',
    'Dodge the falling dark stars, and the beams linking each star to its nearest neighbour.',
    'Finish the rune chain before the next constellation goes off.'
  ],
  chaotic: [
    'You have selected Chaos Mode. Good Luck.',
    'Your raid is arguing about whether someone was in the wrong spot in P3.',
    'Your Raid Leader tells you to calm down.',
    'Your raid leader tells you that this is the easiest part of the fight.',
    'Rage consumes you as someone disconnects.',
    'Your UI has been throwing errors all pull.'
  ]
};
export const CHAOTIC_CORNERS = [
  { top: '90px', left: '16px', right: 'auto', bottom: 'auto' },
  { top: '90px', right: '270px', left: 'auto', bottom: 'auto' },
  { bottom: '120px', left: '16px', top: 'auto', right: 'auto' },
  { bottom: '120px', right: '270px', left: 'auto', top: 'auto' }];

// ── Raid roster + note (overlay shown on normal+ difficulty) ─────────────
// WoW class colours keyed by short slug.
const CC = {
  dk: '#C41E3A', dh: '#A330C9', druid: '#FF7C0A', evoker: '#33937F', hunter: '#AAD372',
  mage: '#3FC7EB', monk: '#00FF98', pala: '#F48CBA', priest: '#ffffff', rogue: '#FFF468',
  shaman: '#0070DD', warlock: '#8788EE', warrior: '#C69B6D'
};
// 20 raiders across 4 groups of 5 (for the raid frames).
export const RAID_ROSTER = [
  { name: 'Palashank', color: CC.pala, group: 0 },
  { name: 'Gunrunner', color: CC.hunter, group: 0 },
  { name: 'Alpacable', color: CC.druid, group: 0 },
  { name: 'Stoic', color: CC.warrior, group: 0 },
  { name: 'Deadhuman', color: CC.dk, group: 0 },
  { name: 'Funts', color: CC.monk, group: 1 },
  { name: 'Kreexwindrun', color: CC.shaman, group: 1 },
  { name: 'Alehster', color: CC.mage, group: 1 },
  { name: 'Diddly', color: CC.rogue, group: 1 },
  { name: 'Shâdøwsîn', color: CC.warlock, group: 1 },
  { name: 'Piburi', color: CC.priest, group: 2 },
  { name: 'Vaporweight', color: CC.evoker, group: 2 },
  { name: 'Vervâda', color: CC.dh, group: 2 },
  { name: 'Balke', color: CC.warrior, group: 2 },
  { name: 'Kotohito', color: CC.monk, group: 2 },
  { name: 'Sobert', color: CC.mage, group: 3 },
  { name: 'Skyhaven', color: CC.pala, group: 3 },
  { name: 'Ryland', color: CC.hunter, group: 3 },
  { name: 'Palabuns', color: CC.pala, group: 3 },
  { name: 'Ashterah', color: CC.druid, group: 3 }
];
// Raid note: literal boundary lines + 3 rows of 4 class-coloured assignments.
export const RAID_NOTE = [
  { tag: 'intstart' },
  { names: [['Deadhuman', CC.dk], ['Kreexwindrun', CC.shaman], ['Stoic', CC.warrior], ['Vervâda', CC.dh]] },
  { names: [['Shâdøwsîn', CC.warlock], ['Gunrunner', CC.hunter], ['Vaporweight', CC.evoker], ['Alpacable', CC.druid]] },
  { names: [['Palashank', CC.pala], ['Ashterah', CC.druid], ['Ryland', CC.hunter], ['Diddly', CC.rogue]] },
  { tag: 'intend' }
];
