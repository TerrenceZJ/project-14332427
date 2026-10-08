export const COLS = 10;
export const ROWS = 10;
export const MID = ROWS / 2; // 上半场敌方, 下半场己方
export const START_AP = 6;
export const MAX_TURNS = 12;

export const HAND_SIZE = 4;
export const MAX_HAND = 7;

/** 出战阵容:从卡组中挑选的卡牌数量,每张卡召唤一只对应种族的灵兽 */
export const LINEUP_SIZE = 5;

export const key = (x: number, y: number) => `${x},${y}`;

export const inBounds = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < COLS && y < ROWS;

/** 切比雪夫距离(八方向,用于攻击/治疗范围判定) */
export const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** 曼哈顿距离(四方向,用于移动步数) */
export const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

export interface Pt {
  x: number;
  y: number;
}

/** 列字母(A~P) */
export const colLabel = (x: number) => String.fromCharCode(65 + x);

/** 格坐标名称,如 A1、K12,用于战斗日志与棋盘标注 */
export const cellName = (x: number, y: number) => `${colLabel(x)}${y + 1}`;