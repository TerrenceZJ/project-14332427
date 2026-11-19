export type Team = 'player' | 'enemy';

export type PieceType =
  | 'warrior'
  | 'guardian'
  | 'archer'
  | 'mage'
  | 'priest';

export type Mode = 'attack' | 'defend' | 'standby';

/** 攻击时机:先攻击再移动 / 先移动再攻击(仅攻击模式) */
export type AttackOrder = 'first' | 'after';

/** 棋子朝向:上 / 下 / 左 / 右 */
export type Facing = 'up' | 'down' | 'left' | 'right';

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
  /** 攻击时机:先攻击再移动 / 先移动再攻击(仅攻击模式生效) */
  attackOrder: AttackOrder;
  /** 治疗时机:先治疗再移动 / 先移动再治疗(仅治疗生效) */
  healOrder: AttackOrder;
  /** 棋子自带技能(其召唤卡牌 id),第二版「技能模式」下可释放 */
  skill: string;
  /** 技能剩余冷却回合数(0 = 就绪) */
  skillCd: number;
  /** 本回合是否已释放过技能(每回合限一次) */
  usedSkill: boolean;
  /** 棋子朝向:初始面向对手,移动后朝向最后一次移动的方向 */
  facing: Facing;
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
  /** 本回合临时攻击力加成 */
  tempAtk: number;
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
  type: 'attack' | 'heal' | 'shield' | 'revive' | 'death' | 'card' | 'fail' | 'teleport';
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
  /** 棋盘列数 / 行数(教程关卡可配置,默认 10×8) */
  cols: number;
  rows: number;
  /** 中线两侧保留的空地列数(部署禁放区,教程小地图可更小) */
  deployGap: number;
  pieces: Piece[];
  vision: string[];
  ap: number;
  enemyAp: number;
  /** 下回合开局时扣除的行动点(玩家 / 敌方),由「干扰之音」等卡牌施加 */
  playerApPenalty: number;
  enemyApPenalty: number;
  deck: string[];
  hand: string[];
  /** 玩家本回合新抽到的卡牌 id(用于抽卡阶段的抽卡动画与手牌高亮) */
  lastDrawnCardId: string | null;
  /** 部署阶段玩家挑选的出战卡牌 id(每张召唤一只对应种族灵兽,并从战斗牌库中移除) */
  lineup: string[];
  /** 出战阵容数量(默认 5,教程关卡可更少) */
  lineupSize: number;
  /** 是否跳过卡牌阶段(教程第 0 关无卡牌,直接进入指令阶段) */
  skipCards: boolean;
  /** 是否启用灵主机制(灵主重生 + 灵主胜负判定)。第 0 关关闭,其余默认开启 */
  lordBattle: boolean;
  /** 第二版「技能模式」:去除卡牌与行动点,技能绑定棋子并带冷却 */
  skillMode: boolean;
  /** 预设敌方灵主卡牌 id(教程关卡指定敌方某只棋子为灵主) */
  enemyLordPreset: string | null;
  enemyDeck: string[];
  enemyHand: string[];
  /** 预设敌方出战卡牌(教程关卡固定敌方阵容;为空则按常规随机) */
  enemyLineupPreset: string[] | null;
  /** 教程关卡敌方棋子血量覆盖(如第 0 关敌方仅 1 血) */
  enemyHpOverride: number | null;
  dotZones: DotZone[];
  /** 地形:障碍物格(阻挡棋子移动与远程攻击) */
  obstacles: string[];
  /** 地形:黑洞格(棋子落入后随机传送到任意位置) */
  blackHoles: string[];
  /** 是否生成随机地形(常规对局开启,教程关卡关闭) */
  terrainEnabled: boolean;
  winner: Winner;
  log: LogEntry[];
  selectedId: string | null;
  /** 部署轨迹:按部署顺序记录位置 */
  deployTrail: Pt[];
}