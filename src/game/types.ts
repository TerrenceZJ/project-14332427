export type Team = 'player' | 'enemy';

export type PieceType =
  | 'warrior'
  | 'guardian'
  | 'archer'
  | 'mage'
  | 'priest';

export type Mode = 'attack' | 'defend' | 'scout';

/** 自动指令风格:激进压上 / 保守防御 / 优先集火灵主 */
export type AutoCommandStyle = 'aggressive' | 'defensive' | 'focusLord';

export type CardCategory = 'attack' | 'support' | 'special';

export type Phase = 'deploy' | 'card1' | 'command' | 'card2' | 'execute' | 'gameover';

export type Winner = Team | 'draw' | null;

export interface Pt {
  x: number;
  y: number;
}

export interface Piece {
  id: string;
  type: PieceType;
  team: Team;
  /** 召唤该灵兽的卡牌 id(部署阶段由玩家挑选的卡决定) */
  fromCard?: string;
  x: number;
  y: number;
  placed: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  move: number;
  heal: number;
  isLord: boolean;
  lordRevealed: boolean;
  shieldTurns: number;
  revived: boolean;
  alive: boolean;
  mode: Mode;
  /** 移动路径:指令阶段规划的完整步进序列(每项为下一步落点,按顺序执行) */
  path: Pt[];
  /** 攻击模式指定的目标棋子 id */
  attackTarget?: string;
  /** 治疗模式指定的目标棋子 id */
  healTarget?: string;
  acted: boolean;
  /** 是否曾被玩家看见(敌方棋子一旦进入视野即永久标记,用于战斗日志的迷雾遮蔽) */
  revealed: boolean;
  /** 被封锁(无法移动/攻击)的剩余回合数 */
  stunned: number;
  /** 抵挡接下来 N 次伤害 */
  blockHits: number;
  /** 下一次受到伤害减免的数值(一次性) */
  dmgReduction: number;
  /** 本回合临时移动加成 */
  bonusMove: number;
  /** 永久攻击力加成 */
  bonusAtk: number;
  /** 无视持续性伤害的剩余回合数 */
  dotImmunity: number;
}

export interface LogSegment {
  text: string;
  team?: Team;
}

export interface LogEntry {
  id: number;
  text: string;
  segments?: LogSegment[];
  team?: Team;
  kind?: 'info' | 'damage' | 'death' | 'turn' | 'system' | 'card';
}

export interface TurnEvent {
  type: 'attack' | 'heal' | 'shield' | 'revive' | 'death' | 'card';
  x: number;
  y: number;
  amount?: number;
  text?: string;
  /** 攻击来源坐标(仅 attack 事件),用于绘制指向性连线 */
  fx?: number;
  fy?: number;
}

/** 执行阶段的一帧:一次状态快照 + 该帧展示的事件 + 停留时长(ms) */
export interface TurnFrame {
  state: GameState;
  events: TurnEvent[];
  delay: number;
}

export interface DotZone {
  id: number;
  x: number;
  y: number;
  turns: number;
  team: Team;
}

export interface GameState {
  phase: Phase;
  turn: number;
  pieces: Piece[];
  vision: string[];
  ap: number;
  enemyAp: number;
  deck: string[];
  hand: string[];
  /** 玩家本回合新抽到的卡牌 id(用于抽卡阶段的抽卡动画与手牌高亮) */
  lastDrawnCardId: string | null;
  /** 部署阶段玩家挑选的出战卡牌 id(每张召唤一只对应种族灵兽,并从战斗牌库中移除) */
  lineup: string[];
  enemyDeck: string[];
  enemyHand: string[];
  dotZones: DotZone[];
  winner: Winner;
  log: LogEntry[];
  selectedId: string | null;
  /** 部署轨迹:按部署顺序记录位置 */
  deployTrail: Pt[];
}