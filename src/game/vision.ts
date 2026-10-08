import type { GameState, Team } from './types';
import { COLS, ROWS, MID, key, inBounds } from './constants';

/** 某阵营的视野格集合:本方半场始终可见 + 己方棋子周围 1 格(侦察姿态 2 格) */
function visionFor(s: GameState, team: Team): Set<string> {
  const set = new Set<string>();
  if (team === 'player') {
    for (let y = MID; y < ROWS; y++) for (let x = 0; x < COLS; x++) set.add(key(x, y));
  } else {
    for (let y = 0; y < MID; y++) for (let x = 0; x < COLS; x++) set.add(key(x, y));
  }
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.team !== team) continue;
    const r = p.mode === 'scout' ? 2 : 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (inBounds(nx, ny)) set.add(key(nx, ny));
      }
    }
  }
  return set;
}

/** 玩家视野:下半场(己方半场)始终可见 + 己方棋子周围 */
export function visibleKeys(s: GameState): Set<string> {
  return visionFor(s, 'player');
}

/** 敌方视野:上半场(敌方半场)始终可见 + 敌方棋子周围(与玩家对称) */
export function enemyVisibleKeys(s: GameState): Set<string> {
  return visionFor(s, 'enemy');
}