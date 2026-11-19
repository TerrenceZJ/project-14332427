import type { PieceType } from './types';

/** 默认棋盘尺寸(教程关卡可自定义为更小/更大的棋盘) */
export const COLS = 10;
export const ROWS = 8;
/** 中线列号:左半场己方 (x < mid), 右半场敌方 (x >= mid) */
export const midOf = (cols: number) => Math.floor(cols / 2);

/** 中线两侧各保留的空地列数:部署阶段不能在这些竖排放置棋子(中间缓冲带) */
export const DEPLOY_GAP = 2;
export const START_AP = 6;
export const MAX_TURNS = 12;

export const HAND_SIZE = 4;
export const MAX_HAND = 7;

/** 出战阵容:从卡组中挑选的卡牌数量,每张卡召唤一只对应种族的灵兽 */
export const LINEUP_SIZE = 5;

/** 是否启用「一键自动指令」功能(暂时隐藏,置为 true 恢复) */
export const AUTO_COMMAND_ENABLED = false;

export const key = (x: number, y: number) => `${x},${y}`;

export const inBounds = (x: number, y: number, cols: number, rows: number) =>
  x >= 0 && y >= 0 && x < cols && y < rows;

/** 地图随机地形占比:每局约 10% 的格子生成障碍物或黑洞 */
export const TERRAIN_RATIO = 0.1;

/** 某格是否为障碍物(阻挡移动与远程攻击) */
export const isObstacle = (obstacles: string[], x: number, y: number) => obstacles.includes(key(x, y));

/** 某格是否为黑洞(棋子落入后被随机传送) */
export const isBlackHole = (blackHoles: string[], x: number, y: number) => blackHoles.includes(key(x, y));

/** 两点之间(不含端点)的直线 / 对角线上是否存在障碍物;非共线输入直接视为不遮挡 */
export const blocksLine = (obstacles: string[], ax: number, ay: number, bx: number, by: number): boolean => {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let x = ax + sx;
  let y = ay + sy;
  while (x !== bx || y !== by) {
    if (isObstacle(obstacles, x, y)) return true;
    x += sx;
    y += sy;
  }
  return false;
};

/** 切比雪夫距离(八方向,用于攻击/治疗范围判定) */
export const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** 曼哈顿距离(四方向,用于移动步数) */
export const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/** 攻击范围判定:按职业区分攻击形状;默认(盾卫/牧师等)为切比雪夫范围 */
export const canAttack = (type: PieceType, range: number, dx: number, dy: number): boolean => {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  switch (type) {
    case 'guardian':
      // 盾卫:仅上下左右相邻一格,斜向打不到
      return ax + ay === 1;
    case 'mage':
      // 法师:上下左右可达 range 格,斜向仅 1 格
      if (ax === 0 || ay === 0) return ax + ay <= range;
      return ax === 1 && ay === 1;
    case 'archer':
      // 弓箭手:上下左右可达 range 格,但紧邻一格打不到
      if (ax === 0 || ay === 0) return ax + ay >= 2 && ax + ay <= range;
      return false;
    default:
      // 战士(周围1格)/牧师等:切比雪夫范围
      return Math.max(ax, ay) <= range;
  }
};

export interface Pt {
  x: number;
  y: number;
}

/** 列字母(A~P) */
export const colLabel = (x: number) => String.fromCharCode(65 + x);

/** 格坐标名称,如 A1、K12,用于战斗日志与棋盘标注 */
export const cellName = (x: number, y: number) => `${colLabel(x)}${y + 1}`;