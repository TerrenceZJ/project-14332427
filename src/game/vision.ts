import type { GameState, Team } from './types';
import { key, inBounds, midOf } from './constants';

/** 某阵营的视野格集合:本方半场始终可见 + 己方棋子周围 1 格(侦察姿态 2 格) */
function visionFor(s: GameState, team: Team): Set<string> {
  const set = new Set<string>();
  const mid = midOf(s.cols);
  if (team === 'player') {
    for (let x = 0; x < mid; x++) for (let y = 0; y < s.rows; y++) set.add(key(x, y));
  } else {
    for (let x = mid; x < s.cols; x++) for (let y = 0; y < s.rows; y++) set.add(key(x, y));
  }
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.team !== team) continue;
    const r = p.mode === 'scout' ? 2 : 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (inBounds(nx, ny, s.cols, s.rows)) set.add(key(nx, ny));
      }
    }
  }
  return set;
}

/** 玩家视野:左半场(己方半场)始终可见 + 己方棋子周围 */
export function visibleKeys(s: GameState): Set<string> {
  return visionFor(s, 'player');
}

/** 敌方视野:右半场(敌方半场)始终可见 + 敌方棋子周围(与玩家对称) */
export function enemyVisibleKeys(s: GameState): Set<string> {
  return visionFor(s, 'enemy');
}
