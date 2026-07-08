import { phase } from '../config.js';
import { add2, mul2, len2, norm2, w2v } from '../math.js';
import { state } from '../state.js';
import { currentHeaven } from '../timing.js';

export function updatePlayer(t, dt, stackPos, liftY) {
  const dur = t >= phase.reintegrationCast && t <= phase.reintegrationCast + phase.stunDuration;
  const aft = t > phase.reintegrationCast + phase.stunDuration;
  state.playerCyl.visible = state.playerRing.visible = dur || aft; if (!state.playerCyl.visible) return;
  // Update facing only during stun and Heaven movement — locked otherwise
  if (dur || currentHeaven(t)) {
    const toBoss = { x: -state.playerPos.x, y: -state.playerPos.y };
    if (len2(toBoss) > 1) state.playerFacingDir = norm2(toBoss);
  }
  if (aft && state.running) {
    const spd = (state.selectedRole === 'light' ? 45.5 : 35) * dt, fwd = state.playerFacingDir, rgt = { x: -fwd.y, y: fwd.x };
    if (state.keys['w']) state.playerPos = add2(state.playerPos, mul2(fwd, spd));
    if (state.keys['s']) state.playerPos = add2(state.playerPos, mul2({ x: -fwd.x, y: -fwd.y }, spd));
    if (state.keys['a']) state.playerPos = add2(state.playerPos, mul2({ x: fwd.y, y: -fwd.x }, spd));
    if (state.keys['d']) state.playerPos = add2(state.playerPos, mul2(rgt, spd));
  }
  if (dur) state.playerPos = { ...stackPos };
  const baseY = .34 + (dur ? liftY : 0);
  state.playerCyl.position.copy(w2v(state.playerPos, baseY));
  state.playerRing.position.copy(w2v(state.playerPos, .04 + (dur ? liftY : 0)));
}
