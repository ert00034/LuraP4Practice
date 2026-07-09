import { phase, world } from '../config.js';
import { add2, mul2, len2, norm2, w2v } from '../math.js';
import { state } from '../state.js';

// Match the raid's ground speed: it sweeps raidAdvanceDegrees across the room
// (at stackDistance) over the moving portion of Heaven & Hell (~7s). This is
// how fast the AI raiders travel, so the player travels at the same pace.
const RAID_MOVE_SPEED = (phase.raidAdvanceDegrees * Math.PI / 180) * world.stackDistance
  / (phase.heavenRampDuration + phase.heavenLaserDuration - 1.0);

export function updatePlayer(t, dt, stackPos, liftY) {
  const dur = t >= phase.reintegrationCast && t <= phase.reintegrationCast + phase.stunDuration;
  const aft = t > phase.reintegrationCast + phase.stunDuration;
  state.playerArrow.visible = state.playerRing.visible = dur || aft; if (!state.playerArrow.visible) return;
  // During stun the player is forced to face the boss; otherwise facing is
  // steered by right-mouse drag (see initCameraControls)
  if (dur) {
    const toBoss = { x: -state.playerPos.x, y: -state.playerPos.y };
    if (len2(toBoss) > 1) state.playerFacingDir = norm2(toBoss);
  }
  if (aft && state.running) {
    const spd = RAID_MOVE_SPEED * dt, fwd = state.playerFacingDir, rgt = { x: -fwd.y, y: fwd.x };
    const leftKey = state.strafeKeys === 'qe' ? 'q' : 'a';
    const rightKey = state.strafeKeys === 'qe' ? 'e' : 'd';
    if (state.keys['w']) state.playerPos = add2(state.playerPos, mul2(fwd, spd));
    if (state.keys['s']) state.playerPos = add2(state.playerPos, mul2({ x: -fwd.x, y: -fwd.y }, spd));
    if (state.keys[leftKey]) state.playerPos = add2(state.playerPos, mul2({ x: fwd.y, y: -fwd.x }, spd));
    if (state.keys[rightKey]) state.playerPos = add2(state.playerPos, mul2(rgt, spd));
  }
  if (dur) state.playerPos = { ...stackPos };
  const baseY = .34 + (dur ? liftY : 0);
  state.playerArrow.position.copy(w2v(state.playerPos, baseY));
  state.playerArrow.rotation.y = Math.atan2(state.playerFacingDir.x, state.playerFacingDir.y);
  state.playerRing.position.copy(w2v(state.playerPos, .04 + (dur ? liftY : 0)));
}
