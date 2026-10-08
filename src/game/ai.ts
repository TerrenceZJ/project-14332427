import type { GameState, Piece, Pt } from './types';
import { COLS, MID, ROWS, dist, inBounds, key } from './constants';

/** AI 部署:上半场分散布置,并随机指定一只为灵主 */
export function aiDeploy(s: GameState) {
  const mine = s.pieces.filter((p) => p.team === 'enemy');
  mine.forEach((p) => { p.x = -1; p.y = -1; p.placed = false; p.isLord = false; });

  const slots: { x: number; y: number }[] = [];
  for (let y = 1; y < MID - 1; y++) for (let x = 1; x < COLS - 1; x++) slots.push({ x, y });
  slots.sort(() => Math.random() - 0.5);

  mine.forEach((p, i) => {
    const slot = slots[i % slots.length];
    p.x = slot.x;
    p.y = slot.y;
    p.placed = true;
  });

  // 灵主偏向后场中心
  const lord = mine[Math.floor(Math.random() * mine.length)];
  const centerSlots = slots.filter((sl) => sl.y <= 2).sort((a, b) => Math.abs(a.x - COLS / 2) - Math.abs(b.x - COLS / 2));
  if (centerSlots[0]) {
    const occupied = mine.filter((p) => p !== lord);
    const free = centerSlots.find((sl) => !occupied.some((o) => o.x === sl.x && o.y === sl.y));
    if (free) { lord.x = free.x; lord.y = free.y; }
  }
  lord.isLord = true;
}

/** AI 下指令:向最近的目标推进,进入射程则原地攻击(受封锁与行动点限制) */
export function aiCommand(state: GameState): GameState {
  const s = { ...state, pieces: state.pieces.map((p) => ({ ...p })) };
  const enemies = s.pieces.filter((p) => p.team === 'enemy' && p.alive && p.placed && p.stunned <= 0);
  const targets = s.pieces.filter((p) => p.team === 'player' && p.alive && p.placed);
  if (!targets.length) return s;

  let ap = s.enemyAp;
  const revealedLord = targets.find((t) => t.isLord && t.lordRevealed);

  for (const e of enemies) {
    if (e.mode === 'defend') continue;
    let best: Piece | null = null;
    let bestScore = Infinity;
    for (const t of targets) {
      const d = dist(e.x, e.y, t.x, t.y);
      const lordBias = (revealedLord && t.id === revealedLord.id) ? -1.5 : 0;
      const hpBias = (t.hp / 10) * 0.6;
      const score = d + lordBias + hpBias;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    if (!best) continue;

    const d = dist(e.x, e.y, best.x, best.y);
    if (d > e.range) {
      if (ap < 1) continue; // 无行动点,无法移动
      ap -= 1;
      const budget = e.move + e.bonusMove;
      e.path = planPath(e, best, s, budget);
      e.mode = 'attack';
      e.acted = true;
    } else {
      e.path = [];
      e.mode = 'attack';
      e.acted = true;
    }
  }

  s.enemyAp = ap;
  return s;
}

/** 为棋子计算正交折线路径:避开障碍,尽量逼近目标进入射程,预算为方格数 */
export function planPath(e: Piece, target: Pt, s: GameState, budget: number): Pt[] {
  if (budget <= 0) return [];

  const blocked = (x: number, y: number) =>
    !inBounds(x, y) ||
    s.pieces.some((q) => q.alive && q.placed && q.id !== e.id && q.x === x && q.y === y);

  const startK = key(e.x, e.y);
  const distMap = new Map<string, number>([[startK, 0]]);
  const prev = new Map<string, string>();
  const queue: Pt[] = [{ x: e.x, y: e.y }];
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const steps = distMap.get(key(cur.x, cur.y))!;
    if (steps >= budget) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (!inBounds(nx, ny) || blocked(nx, ny) || distMap.has(nk)) continue;
      distMap.set(nk, steps + 1);
      prev.set(nk, key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }

  // 优先:进入射程且步数最少的格子
  let bestPt: Pt | null = null;
  let bestSteps = Infinity;
  for (const [k, steps] of distMap) {
    if (k === startK) continue;
    const [x, y] = k.split(',').map(Number);
    if (dist(x, y, target.x, target.y) <= e.range && steps < bestSteps) {
      bestSteps = steps;
      bestPt = { x, y };
    }
  }
  if (bestPt) return reconstruct(prev, startK, key(bestPt.x, bestPt.y));

  // 次选:未进入射程时,选离目标最近(切比雪夫),同距步数少者优先
  let bestD = Infinity;
  for (const [k, steps] of distMap) {
    if (k === startK) continue;
    const [x, y] = k.split(',').map(Number);
    const d = dist(x, y, target.x, target.y);
    if (d < bestD || (d === bestD && steps < bestSteps)) {
      bestD = d;
      bestSteps = steps;
      bestPt = { x, y };
    }
  }
  if (!bestPt) return [];
  return reconstruct(prev, startK, key(bestPt.x, bestPt.y));
}

/** 依据 BFS 的 prev 回溯出从起点到终点的正交步进序列 */
function reconstruct(prev: Map<string, string>, startK: string, endK: string): Pt[] {
  const pts: Pt[] = [];
  let k = endK;
  while (k !== startK) {
    const [x, y] = k.split(',').map(Number);
    pts.push({ x, y });
    k = prev.get(k)!;
  }
  pts.reverse();
  return pts;
}