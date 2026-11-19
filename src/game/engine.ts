import type { GameState, Piece, PieceType, Team, Mode, AttackOrder, TurnEvent, TurnFrame, Pt, LogSegment, AutoCommandStyle } from './types';
import { BEASTS } from './beasts';
import { COLS, ROWS, DEPLOY_GAP, START_AP, MAX_TURNS, HAND_SIZE, MAX_HAND, LINEUP_SIZE, TERRAIN_RATIO, key, inBounds, dist, cellName, midOf, canAttack, isObstacle, isBlackHole, blocksLine } from './constants';
import { CARDS, CARDS_BY_ID, cardCooldown } from './cards';
import { visibleKeys, enemyVisibleKeys } from './vision';
import { aiDeploy, aiCommand, planPath } from './ai';

export { visibleKeys, enemyVisibleKeys };

let pieceSeq = 0;
let logSeq = 0;
let zoneSeq = 0;

const makePiece = (type: PieceType, team: Team, fromCard?: string): Piece => {
  const d = BEASTS[type];
  return {
    id: `${team}-${++pieceSeq}`,
    type, team, fromCard, x: -1, y: -1, placed: false,
    hp: d.hp, maxHp: d.hp, atk: d.atk, range: d.range, move: d.move, heal: d.heal,
    isLord: false, lordRevealed: false, shieldTurns: 0, revived: false, alive: true,
    mode: 'attack', attackOrder: 'after', healOrder: 'after', facing: team === 'player' ? 'right' : 'left', path: [], attackTarget: undefined, healTarget: undefined, acted: false, revealed: team === 'player',
    stunned: 0, blockHits: 0, dmgReduction: 0, bonusMove: 0, bonusAtk: 0, tempAtk: 0, dotImmunity: 0, skill: fromCard ?? '', skillCd: 0, usedSkill: false,
  };
};

const clone = (s: GameState): GameState => ({
  ...s,
  pieces: s.pieces.map((p) => ({ ...p, path: p.path.map((c) => ({ ...c })) })),
  vision: [...s.vision],
  log: [...s.log],
  deck: [...s.deck],
  hand: [...s.hand],
  lineup: [...s.lineup],
  enemyDeck: [...s.enemyDeck],
  enemyHand: [...s.enemyHand],
  dotZones: s.dotZones.map((z) => ({ ...z })),
  deployTrail: s.deployTrail.map((t) => ({ ...t })),
  obstacles: [...s.obstacles],
  blackHoles: [...s.blackHoles],
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pushLog(
  s: GameState,
  text: string | LogSegment[],
  team?: Team,
  kind: 'info' | 'damage' | 'death' | 'turn' | 'system' | 'card' = 'info'
) {
  const segments = typeof text === 'string' ? undefined : text;
  const plain = typeof text === 'string' ? text : text.map((t) => t.text).join('');
  s.log = [...s.log, { id: ++logSeq, text: plain, segments, team, kind }].slice(-60);
}

/** 某棋子坐标是否对玩家已知(己方必知;敌方需曾被看见) */
function coordKnown(p: Piece): boolean {
  return p.team === 'player' || p.revealed;
}

/** 生成棋子名的着色片段(不显示坐标) */
function pieceRef(p: Piece): LogSegment[] {
  return [{ text: BEASTS[p.type].name, team: p.team }];
}

/** 根据一步位移(from → to)更新棋子朝向 */
function setFacing(p: Piece, from: Pt, to: Pt) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx > 0) p.facing = 'right';
  else if (dx < 0) p.facing = 'left';
  else if (dy > 0) p.facing = 'down';
  else if (dy < 0) p.facing = 'up';
}

/** 刷新"曾被看见"标记:当前处于玩家视野内的敌方棋子永久标记为已知 */
function markRevealed(s: GameState) {
  const vis = visibleKeys(s);
  for (const p of s.pieces) {
    if (p.team !== 'enemy' || !p.alive || !p.placed) continue;
    if (vis.has(key(p.x, p.y))) p.revealed = true;
  }
}

export function createGame(cols: number = COLS, rows: number = ROWS, deployGap: number = DEPLOY_GAP, lineupSize: number = LINEUP_SIZE, skillMode: boolean = false): GameState {
  const s: GameState = {
    phase: 'deploy', turn: 0, cols, rows, deployGap, lineupSize, skipCards: skillMode, lordBattle: true, skillMode, pieces: [], vision: [], ap: START_AP, enemyAp: START_AP, playerApPenalty: 0, enemyApPenalty: 0,
    deck: shuffle(CARDS.map((c) => c.id)),
    hand: [],
    lastDrawnCardId: null,
    lineup: [],
    enemyDeck: shuffle(CARDS.map((c) => c.id)),
    enemyHand: [],
    enemyLineupPreset: null,
    enemyLordPreset: null,
    enemyHpOverride: null,
    dotZones: [],
    obstacles: [],
    blackHoles: [],
    terrainEnabled: true,
    winner: null, selectedId: null,
    deployTrail: [],
    log: [{ id: ++logSeq, text: `准备阶段:从卡组中挑选 ${lineupSize} 张卡牌出战,每张卡召唤一只对应种族的灵兽。`, team: 'player', kind: 'turn' }],
  };
  // 开局即生成随机地形(障碍物 / 黑洞),部署阶段即可看到并规避
  generateTerrain(s);
  if (s.obstacles.length || s.blackHoles.length) {
    pushLog(s, `战场异变:${s.obstacles.length} 处障碍与 ${s.blackHoles.length} 个黑洞随机生成,越靠近中心越密集。`, undefined, 'system');
  }
  return s;
}

export interface LevelPreset {
  cols: number;
  rows: number;
  deployGap: number;
  /** 玩家固定出战卡牌(每张召唤一只对应种族灵兽) */
  lineup: string[];
  /** 敌方固定出战卡牌 */
  enemyLineup: string[];
  /** 出战数量,默认等于 lineup 长度(教程第 0 关可只有 1 只) */
  lineupSize?: number;
  /** 是否跳过卡牌阶段(教程第 0 关无卡牌,部署后直接进入指令阶段) */
  skipCards?: boolean;
  /** 敌方棋子血量覆盖(教程第 0 关敌方仅 1 血) */
  enemyHp?: number;
  /** 预放置的己方棋子(教程第 1 关:坦克已在场上,仅剩战士需手动放置) */
  prePlaced?: { cardId: string; x: number; y: number }[];
  /** 是否启用灵主机制(第 0 关关闭,其余默认开启) */
  lordBattle?: boolean;
  /** 敌方灵主卡牌 id(默认随机指定) */
  enemyLord?: string;
  /** 是否生成随机地形(障碍物 / 黑洞),默认关闭(教程关卡) */
  terrain?: boolean;
}

/** 创建教程关卡:固定棋盘尺寸与双方阵容,玩家只需在部署阶段摆放位置 */
export function createLevelGame(level: LevelPreset): GameState {
  const size = level.lineupSize ?? level.lineup.length;
  const s = createGame(level.cols, level.rows, level.deployGap, size);
  s.lineup = [...level.lineup];
  s.skipCards = !!level.skipCards;
  s.lordBattle = level.lordBattle ?? true;
  s.terrainEnabled = level.terrain ?? false;
  if (!s.terrainEnabled) {
    s.obstacles = [];
    s.blackHoles = [];
  }
  s.enemyHpOverride = level.enemyHp ?? null;
  s.pieces = level.lineup.map((id) => makePiece(CARDS_BY_ID[id].owner, 'player', id));
  s.enemyLineupPreset = [...level.enemyLineup];
  s.enemyLordPreset = level.enemyLord ?? null;
  for (const pp of level.prePlaced ?? []) {
    const p = s.pieces.find((q) => q.team === 'player' && q.fromCard === pp.cardId);
    if (p) {
      p.x = pp.x;
      p.y = pp.y;
      p.placed = true;
      s.deployTrail = [...s.deployTrail, { x: pp.x, y: pp.y }];
    }
  }
  s.log = [{
    id: ++logSeq,
    text: size > 1
      ? `准备阶段:将 ${size} 只灵兽部署到己方半场,并指定一只为灵主。`
      : '准备阶段:将灵兽部署到己方半场。',
    team: 'player',
    kind: 'turn',
  }];
  return s;
}

/** 从卡池里均衡地挑出一套阵容(每个种族取 1 张,不足再随机补足) */
function pickBalancedLineup(pool: string[], size: number): string[] {
  const races: PieceType[] = ['warrior', 'guardian', 'archer', 'mage', 'priest'];
  const picked: string[] = [];
  for (const race of races) {
    const arr = shuffle(pool.filter((id) => CARDS_BY_ID[id]?.owner === race));
    picked.push(...arr.slice(0, 1));
  }
  if (picked.length < size) {
    const rest = shuffle(pool.filter((id) => !picked.includes(id)));
    picked.push(...rest.slice(0, size - picked.length));
  }
  return picked.slice(0, size);
}

/** 部署阶段:切换某张卡牌是否出战。选中的卡会召唤一只对应种族的灵兽,并从战斗牌库移除 */
export function toggleLineup(state: GameState, cardId: string): GameState {
  if (state.phase !== 'deploy') return state;
  const card = CARDS_BY_ID[cardId];
  if (!card || !state.deck.includes(cardId)) return state;

  const s = clone(state);
  const chosen = s.lineup.includes(cardId);

  if (chosen) {
    s.lineup = s.lineup.filter((id) => id !== cardId);
    // 收回对应种族的灵兽(优先收未部署的)
    const sameType = s.pieces.filter((p) => p.team === 'player' && p.type === card.owner);
    const target = sameType.find((p) => !p.placed) || sameType[sameType.length - 1];
    if (target) {
      if (target.placed) {
        s.deployTrail = s.deployTrail.filter((t) => !(t.x === target.x && t.y === target.y));
      }
      s.pieces = s.pieces.filter((p) => p.id !== target.id);
      if (s.selectedId === target.id) s.selectedId = null;
    }
  } else {
    if (s.lineup.length >= s.lineupSize) return state;
    s.lineup = [...s.lineup, cardId];
    s.pieces = [...s.pieces, makePiece(card.owner, 'player', cardId)];
  }
  return s;
}

/** 部署阶段:一键挑出一套均衡阵容 */
export function randomLineup(state: GameState): GameState {
  if (state.phase !== 'deploy') return state;
  const picked = pickBalancedLineup(state.deck, state.lineupSize);
  const s = clone(state);
  s.lineup = picked;
  s.deployTrail = [];
  s.selectedId = null;
  s.pieces = [
    ...s.pieces.filter((p) => p.team !== 'player'),
    ...picked.map((id) => makePiece(CARDS_BY_ID[id].owner, 'player', id)),
  ];
  return s;
}

export const at = (s: GameState, x: number, y: number): Piece | undefined =>
  s.pieces.find((p) => p.alive && p.placed && p.x === x && p.y === y);

export function placePiece(state: GameState, pieceId: string, x: number, y: number): GameState {
  if (state.phase !== 'deploy') return state;
  const p = state.pieces.find((q) => q.id === pieceId);
  if (!p || p.team !== 'player') return state;
  if (x >= midOf(state.cols) - state.deployGap || x < 0) return state;
  if (y < 0 || y >= state.rows) return state;
  if (at(state, x, y)) return state;
  if (isObstacle(state.obstacles, x, y) || isBlackHole(state.blackHoles, x, y)) return state;
  const s = clone(state);
  const np = s.pieces.find((q) => q.id === pieceId)!;
  np.x = x; np.y = y; np.placed = true;
  s.deployTrail = [...s.deployTrail, { x, y }];
  return s;
}

export function unplacePiece(state: GameState, pieceId: string): GameState {
  if (state.phase !== 'deploy') return state;
  const s = clone(state);
  const np = s.pieces.find((q) => q.id === pieceId);
  if (!np) return state;
  const ox = np.x;
  const oy = np.y;
  np.x = -1; np.y = -1; np.placed = false; np.isLord = false;
  if (ox >= 0 && oy >= 0) {
    s.deployTrail = s.deployTrail.filter((t) => !(t.x === ox && t.y === oy));
  }
  return s;
}

export function redeployPiece(state: GameState, pieceId: string, x: number, y: number): GameState {
  if (state.phase !== 'deploy') return state;
  const p = state.pieces.find((q) => q.id === pieceId);
  if (!p || p.team !== 'player' || !p.placed) return state;
  if (x >= midOf(state.cols) - state.deployGap || x < 0) return state;
  if (y < 0 || y >= state.rows) return state;
  if (at(state, x, y)) return state;
  if (isObstacle(state.obstacles, x, y) || isBlackHole(state.blackHoles, x, y)) return state;
  if (p.x === x && p.y === y) return state;
  const s = clone(state);
  const np = s.pieces.find((q) => q.id === pieceId)!;
  const ox = np.x;
  const oy = np.y;
  np.x = x;
  np.y = y;
  s.deployTrail = s.deployTrail.map((t) => (t.x === ox && t.y === oy ? { x, y } : t));
  return s;
}

export function setLord(state: GameState, pieceId: string): GameState {
  const s = clone(state);
  s.pieces.forEach((p) => {
    if (p.team === 'player') p.isLord = p.id === pieceId && p.placed;
  });
  return s;
}

export function autoDeploy(state: GameState): GameState {
  if (state.phase !== 'deploy') return state;
  const s = clone(state);
  const mine = s.pieces.filter((p) => p.team === 'player');
  mine.forEach((p) => { p.x = -1; p.y = -1; p.placed = false; p.isLord = false; });
  const slots: { x: number; y: number }[] = [];
  for (let y = 0; y < s.rows; y++) for (let x = 1; x < midOf(s.cols) - s.deployGap; x++) {
    if (isObstacle(s.obstacles, x, y) || isBlackHole(s.blackHoles, x, y)) continue;
    slots.push({ x, y });
  }
  slots.sort(() => Math.random() - 0.5);
  mine.forEach((p, i) => {
    const slot = slots[i % slots.length];
    p.x = slot.x; p.y = slot.y; p.placed = true;
  });
  if (mine[0]) mine[0].isLord = true;
  return s;
}

function drawCard(s: GameState, team: Team) {
  if (team === 'player') {
    if (s.deck.length === 0 || s.hand.length >= MAX_HAND) return;
    s.hand = [...s.hand, s.deck[0]];
    s.lastDrawnCardId = s.deck[0];
    s.deck = s.deck.slice(1);
  } else {
    if (s.enemyDeck.length === 0 || s.enemyHand.length >= MAX_HAND) return;
    s.enemyHand = [...s.enemyHand, s.enemyDeck[0]];
    s.enemyDeck = s.enemyDeck.slice(1);
  }
}

/** 直接伤害结算(无视防御,尊重无敌/格挡/减伤);ignoreGuard 为真时无视一切防护(用于卡牌代价伤害) */
function dealDirectDamage(s: GameState, p: Piece, amount: number, events?: TurnEvent[], ignoreGuard = false, showNumber = true) {
  if (!p.alive) return;
  if (!ignoreGuard) {
    if (p.shieldTurns > 0) {
      if (events) events.push({ type: 'shield', x: p.x, y: p.y, text: '无敌' });
      return;
    }
    if (p.blockHits > 0) {
      p.blockHits -= 1;
      if (events) events.push({ type: 'shield', x: p.x, y: p.y, text: '格挡' });
      return;
    }
  }
  let amt = amount;
  if (!ignoreGuard && p.dmgReduction > 0) {
    amt = Math.max(0, amt - p.dmgReduction);
    p.dmgReduction = 0;
  }
  if (amt <= 0) return;
  p.hp -= amt;
  // showNumber=false 时只结算伤害与死亡,不再逐次弹出伤害数字(总伤害数字由上层统一展示)
  if (events && showNumber) events.push({ type: 'attack', x: p.x, y: p.y, amount: amt });
  if (p.hp <= 0) resolveDeath(s, p, events || []);
}

/** 击退:朝棋子朝向的反方向后退 steps 格 */
function knockback(s: GameState, p: Piece, steps: number) {
  let dx = 0;
  let dy = 0;
  switch (p.facing) {
    case 'right': dx = -1; break;
    case 'left': dx = 1; break;
    case 'up': dy = 1; break;
    case 'down': dy = -1; break;
  }
  let cx = p.x;
  let cy = p.y;
  for (let i = 0; i < steps; i++) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!inBounds(nx, ny, s.cols, s.rows)) break;
    if (at(s, nx, ny)) break;
    if (isObstacle(s.obstacles, nx, ny)) break;
    cx = nx;
    cy = ny;
  }
  if (cx !== p.x || cy !== p.y) {
    p.x = cx;
    p.y = cy;
  }
}

function shufflePositions(s: GameState, pieces: Piece[]) {
  const positions = shuffle(pieces.map((p) => ({ x: p.x, y: p.y })));
  pieces.forEach((p, i) => { p.x = positions[i].x; p.y = positions[i].y; });
}

function applyCardEffect(s: GameState, cardId: string, caster: Team, targets: { pieceIds: string[]; cell?: Pt }) {
  const byId = (id: string) => s.pieces.find((p) => p.id === id);

  /** 结算一次法术伤害并记录日志(按实际扣血计数);ignoreGuard 为真时无视无敌/格挡/减伤 */
  const hit = (t: Piece | undefined, amount: number, label: string, ignoreGuard = false) => {
    if (!t) return;
    const before = t.hp;
    dealDirectDamage(s, t, amount, undefined, ignoreGuard);
    const took = before - t.hp;
    if (took > 0) {
      pushLog(s, [
        ...pieceRef(t),
        { text: ` 受到 ${took} 点${label}。` },
      ], t.team, 'damage');
    }
  };

  switch (cardId) {
    case 'c_flame': {
      hit(byId(targets.pieceIds[0]), 2, '烈焰灼烧伤害');
      break;
    }
    case 'c_double': {
      targets.pieceIds.forEach((id) => hit(byId(id), 1, '双重打击伤害'));
      break;
    }
    case 'c_arrow': {
      hit(byId(targets.pieceIds[0]), 3, '灵箭贯穿伤害');
      // 己方代价伤害:作为使用卡牌的代价,无视无敌/格挡/减伤,固定扣除 1 点
      hit(byId(targets.pieceIds[1]), 1, '灵箭溅射伤害', true);
      break;
    }
    case 'c_knock2': {
      const t = byId(targets.pieceIds[0]);
      if (t) {
        const ox = t.x, oy = t.y;
        knockback(s, t, 2);
        if (t.x !== ox || t.y !== oy) {
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 被击退。' },
          ], t.team, 'info');
        }
      }
      break;
    }
    case 'c_lock': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (t) {
          t.stunned = 1;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 被封锁,下回合无法行动。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_swap': {
      const a = byId(targets.pieceIds[0]);
      const b = byId(targets.pieceIds[1]);
      if (a && b) {
        const ax = a.x, ay = a.y;
        a.x = b.x; a.y = b.y; b.x = ax; b.y = ay;
        pushLog(s, [
          ...pieceRef(a),
          { text: ' 与 ' },
          ...pieceRef(b),
          { text: ' 交换了位置。' },
        ], caster, 'info');
      }
      break;
    }
    case 'c_zone': {
      if (targets.cell) {
        s.dotZones = [...s.dotZones, { id: ++zoneSeq, x: targets.cell.x, y: targets.cell.y, turns: 2, team: caster }];
        pushLog(s, [
          { text: caster === 'player' ? '敌方' : '己方' },
          { text: ' 布下陷阵区域(持续 2 回合)。' },
        ], caster, 'info');
      }
      break;
    }
    case 'c_knock1': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (!t) return;
        const ox = t.x, oy = t.y;
        knockback(s, t, 1);
        if (t.x !== ox || t.y !== oy) {
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 被击退。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_apup': {
      if (caster === 'player') s.ap += 1; else s.enemyAp += 1;
      pushLog(s, [
        { text: caster === 'player' ? '你' : '敌方', team: caster },
        { text: ' 的行动点 +1。' },
      ], caster, 'info');
      break;
    }
    case 'c_apdown': {
      if (caster === 'player') s.enemyApPenalty += 1; else s.playerApPenalty += 1;
      pushLog(s, [
        { text: caster === 'player' ? '敌方' : '你', team: caster === 'player' ? 'enemy' : 'player' },
        { text: ' 下回合的行动点 -1。' },
      ], caster, 'info');
      break;
    }
    case 'c_block': {
      const t = byId(targets.pieceIds[0]);
      if (t) {
        t.blockHits += 1;
        pushLog(s, [
          ...pieceRef(t),
          { text: ' 获得格挡,可抵挡 1 次攻击。' },
        ], t.team, 'info');
      }
      break;
    }
    case 'c_shield': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (t) {
          t.dmgReduction += 1;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 获得护盾,下次受到的伤害 -1。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_speed': {
      const t = byId(targets.pieceIds[0]);
      if (t) {
        t.bonusMove += 2;
        pushLog(s, [
          ...pieceRef(t),
          { text: ' 移动力 +2(本回合)。' },
        ], t.team, 'info');
      }
      break;
    }
    case 'c_rush': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (t) {
          t.stunned = 0;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 解除封锁,本回合无视移动与攻击限制。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_charge': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (t) {
          t.bonusMove += 1;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 移动力 +1(本回合)。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_iron': {
      targets.pieceIds.forEach((id) => {
        const t = byId(id);
        if (t) {
          t.dotImmunity = 2;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 获得钢铁之躯,免疫持续伤害 2 回合。' },
          ], t.team, 'info');
        }
      });
      break;
    }
    case 'c_shuffle': {
      const vis = caster === 'player' ? visibleKeys(s) : enemyVisibleKeys(s);
      const foes = s.pieces.filter((p) => p.team !== caster && p.alive && p.placed && vis.has(key(p.x, p.y)));
      if (foes.length >= 2) {
        shufflePositions(s, foes);
        pushLog(s, [
          ...pieceRef(foes[0]),
          { text: ' 等 ' + foes.length + ' 只灵兽的位置被打乱。' },
        ], foes[0].team, 'info');
      }
      break;
    }
    case 'c_heal': {
      const allies = s.pieces.filter((p) => p.team === caster && p.alive && p.placed);
      allies.forEach((p) => {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        if (p.hp > before) {
          pushLog(s, [
            ...pieceRef(p),
            { text: ` 恢复 ${p.hp - before} 点生命。` },
          ], p.team, 'info');
        }
      });
      break;
    }
    case 'c_rain': {
      const vis = caster === 'player' ? visibleKeys(s) : enemyVisibleKeys(s);
      const foes = s.pieces.filter((p) => p.team !== caster && p.alive && p.placed && vis.has(key(p.x, p.y)));
      foes.forEach((p) => {
        const d = Math.floor(Math.random() * 3);
        if (d > 0) hit(p, d, '灵箭骤雨伤害');
      });
      break;
    }
    case 'c_mana': {
      const allies = s.pieces.filter((p) => p.team === caster && p.alive && p.placed);
      const boosted = shuffle(allies).slice(0, 3);
      boosted.forEach((p) => {
        p.tempAtk += 1;
        pushLog(s, [
          ...pieceRef(p),
          { text: ' 获得法力灌注,本回合攻击力 +1。' },
        ], p.team, 'info');
      });
      break;
    }
  }
}

export function playCard(state: GameState, cardId: string, caster: Team, targets: { pieceIds: string[]; cell?: Pt }): GameState {
  const card = CARDS_BY_ID[cardId];
  if (!card) return state;
  const ap = caster === 'player' ? state.ap : state.enemyAp;
  const hand = caster === 'player' ? state.hand : state.enemyHand;
  if (ap < card.cost || !hand.includes(cardId)) return state;

  const s = clone(state);
  if (caster === 'player') {
    s.ap -= card.cost;
    s.hand = s.hand.filter((id) => id !== cardId);
  } else {
    s.enemyAp -= card.cost;
    s.enemyHand = s.enemyHand.filter((id) => id !== cardId);
  }
  pushLog(s, [
    { text: caster === 'player' ? '你' : '敌方' },
    { text: '使用了' },
    { text: `【${card.name}】`, team: caster },
  ], caster, 'card');
  applyCardEffect(s, cardId, caster, targets);
  checkVictory(s);
  return s;
}

/** 技能模式:棋子释放其自带技能(不消耗行动点,受冷却与每回合一次限制) */
export function castSkill(state: GameState, pieceId: string, targets: { pieceIds: string[]; cell?: Pt }): GameState {
  if (state.phase !== 'command' || !state.skillMode) return state;
  const s = clone(state);
  const p = s.pieces.find((q) => q.id === pieceId);
  if (!p || p.team !== 'player' || !p.alive || !p.placed) return state;
  if (p.acted || p.usedSkill || p.skillCd > 0 || !p.skill) return state;
  const card = CARDS_BY_ID[p.skill];
  if (!card) return state;
  pushLog(s, [
    { text: '你的' },
    ...pieceRef(p),
    { text: '释放了' },
    { text: `【${card.name}】`, team: 'player' },
  ], 'player', 'card');
  applyCardEffect(s, p.skill, 'player', targets);
  p.skillCd = cardCooldown(p.skill);
  p.usedSkill = true;
  checkVictory(s);
  return s;
}

/** AI 出牌:从手牌中按优先级打出最多 2 张 */
function aiPlayCards(state: GameState): GameState {
  const priority = [
    'c_heal', 'c_rain', 'c_flame', 'c_double', 'c_arrow', 'c_lock',
    'c_knock1', 'c_knock2', 'c_apup', 'c_mana', 'c_speed', 'c_charge',
    'c_rush', 'c_block', 'c_shield', 'c_iron', 'c_apdown', 'c_shuffle',
  ];
  let s = state;
  let plays = 0;

  const allies = () => s.pieces.filter((p) => p.team === 'enemy' && p.alive && p.placed);
  // 只能“看到”自己视野内的玩家棋子(与玩家的迷雾规则对称),看不到的目标不能指定
  const foes = () => {
    const vis = enemyVisibleKeys(s);
    return s.pieces.filter(
      (p) => p.team === 'player' && p.alive && p.placed && vis.has(key(p.x, p.y))
    );
  };

  for (const cid of priority) {
    if (plays >= 2) break;
    if (!s.enemyHand.includes(cid)) continue;
    const card = CARDS_BY_ID[cid];
    if (s.enemyAp < card.cost) continue;

    // 生命祷歌只在有伤兵时用
    if (cid === 'c_heal' && !allies().some((a) => a.hp < a.maxHp)) continue;

    // 范围攻击卡(灵箭骤雨 / 空间乱流):看不到任何敌方目标时不使用,避免“隔雾打击”
    if ((cid === 'c_rain' || cid === 'c_shuffle') && foes().length === 0) continue;

    const lowestFoe = [...foes()].sort((a, b) => a.hp - b.hp);
    let targets: { pieceIds: string[]; cell?: Pt } | null = null;

    switch (card.target.kind) {
      case 'none': targets = { pieceIds: [] }; break;
      case 'enemy1': targets = lowestFoe[0] ? { pieceIds: [lowestFoe[0].id] } : null; break;
      case 'enemy2': targets = lowestFoe.length >= 2 ? { pieceIds: [lowestFoe[0].id, lowestFoe[1].id] } : null; break;
      case 'enemyAlly': {
        const a = allies()[0];
        targets = lowestFoe[0] && a ? { pieceIds: [lowestFoe[0].id, a.id] } : null;
        break;
      }
      case 'ally1': {
        const hurt = allies().filter((a) => a.hp < a.maxHp);
        const t = hurt[0] || allies()[0];
        targets = t ? { pieceIds: [t.id] } : null;
        break;
      }
      case 'ally2': {
        const hurt = allies().filter((a) => a.hp < a.maxHp);
        const picks = [...hurt, ...allies()];
        targets = picks.length >= 2 ? { pieceIds: [picks[0].id, picks[1].id] } : null;
        break;
      }
      case 'cell': targets = null; break;
    }

    if (!targets) continue;
    const next = playCard(s, cid, 'enemy', targets);
    if (next !== s) { s = next; plays += 1; }
  }

  return s;
}

/** 技能模式:AI 为敌方棋子释放就绪技能(简单启发式选择目标) */
function aiCastSkills(s: GameState): GameState {
  if (!s.skillMode) return s;
  const vis = enemyVisibleKeys(s);
  const foes = s.pieces
    .filter((p) => p.team === 'player' && p.alive && p.placed && vis.has(key(p.x, p.y)))
    .sort((a, b) => a.hp - b.hp);
  const allies = s.pieces.filter((p) => p.team === 'enemy' && p.alive && p.placed);

  for (const e of s.pieces) {
    if (e.team !== 'enemy' || !e.alive || !e.placed) continue;
    if (e.skillCd > 0 || e.usedSkill || !e.skill) continue;
    const card = CARDS_BY_ID[e.skill];
    if (!card) continue;

    let targets: { pieceIds: string[]; cell?: Pt } | null = null;
    switch (card.target.kind) {
      case 'none': {
        // 治疗卡仅在己方有伤兵时用;范围伤害仅在能看到敌方时用;换位仅在敌方≥2时用
        if (e.skill === 'c_heal') targets = allies.some((a) => a.hp < a.maxHp) ? { pieceIds: [] } : null;
        else if (e.skill === 'c_rain' || e.skill === 'c_shuffle') targets = foes.length > 0 ? { pieceIds: [] } : null;
        else if (e.skill === 'c_mana') targets = allies.length > 0 ? { pieceIds: [] } : null;
        else targets = { pieceIds: [] }; // c_apup / c_apdown 无行动点环境下无意义,仍释放以进入冷却
        break;
      }
      case 'enemy1': targets = foes[0] ? { pieceIds: [foes[0].id] } : null; break;
      case 'enemy2': targets = foes.length >= 2 ? { pieceIds: [foes[0].id, foes[1].id] } : null; break;
      case 'enemyAlly': {
        const a = allies.find((x) => x.hp < x.maxHp) || allies[0];
        targets = foes[0] && a ? { pieceIds: [foes[0].id, a.id] } : null;
        break;
      }
      case 'ally1': {
        const hurt = allies.filter((a) => a.hp < a.maxHp);
        const t = hurt[0] || allies[0];
        targets = t ? { pieceIds: [t.id] } : null;
        break;
      }
      case 'ally2': {
        const hurt = allies.filter((a) => a.hp < a.maxHp);
        const picks = [...hurt, ...allies];
        targets = picks.length >= 2 ? { pieceIds: [picks[0].id, picks[1].id] } : null;
        break;
      }
      case 'cell': {
        targets = foes[0] ? { pieceIds: [], cell: { x: foes[0].x, y: foes[0].y } } : null;
        break;
      }
    }

    if (!targets) continue;
    pushLog(s, [
      { text: '敌方' },
      ...pieceRef(e),
      { text: '释放了' },
      { text: `【${card.name}】`, team: 'enemy' },
    ], 'enemy', 'card');
    applyCardEffect(s, e.skill, 'enemy', targets);
    e.skillCd = cardCooldown(e.skill);
    e.usedSkill = true;
    checkVictory(s);
  }
  return s;
}

/** 生成随机地形:地图约 10% 的格子生成障碍物或黑洞,越靠近地图中心概率越高 */
function generateTerrain(s: GameState) {
  const total = Math.max(1, Math.round(s.cols * s.rows * TERRAIN_RATIO));
  const occupied = new Set(s.pieces.filter((p) => p.alive && p.placed).map((p) => key(p.x, p.y)));
  const cx = (s.cols - 1) / 2;
  const cy = (s.rows - 1) / 2;
  const halfX = Math.max(1, s.cols / 2);
  const halfY = Math.max(1, s.rows / 2);
  const pool: { x: number; y: number; w: number }[] = [];
  for (let x = 0; x < s.cols; x++) {
    for (let y = 0; y < s.rows; y++) {
      if (occupied.has(key(x, y))) continue;
      const nx = (x - cx) / halfX;
      const ny = (y - cy) / halfY;
      const d = Math.sqrt(nx * nx + ny * ny);
      const w = Math.pow(1 - Math.min(1, d), 2) + 0.05;
      pool.push({ x, y, w });
    }
  }
  const obstacles: string[] = [];
  const blackHoles: string[] = [];
  // 黑洞数量控制在 1~2 个,其余地形均为障碍物
  const blackHoleTarget = Math.min(Math.random() < 0.5 ? 1 : 2, total);
  let placed = 0;
  while (placed < total && pool.length > 0) {
    const totalW = pool.reduce((a, c) => a + c.w, 0);
    let r = Math.random() * totalW;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    const cell = pool.splice(idx, 1)[0];
    if (blackHoles.length < blackHoleTarget) blackHoles.push(key(cell.x, cell.y));
    else obstacles.push(key(cell.x, cell.y));
    placed += 1;
  }
  s.obstacles = obstacles;
  s.blackHoles = blackHoles;
}

export function startBattle(state: GameState): GameState {
  if (state.phase !== 'deploy') return state;
  const mine = state.pieces.filter((p) => p.team === 'player');
  if (state.lineup.length !== state.lineupSize || mine.length !== state.lineupSize) return state;
  if (mine.some((p) => !p.placed)) return state;

  const s = clone(state);
  const myPieces = s.pieces.filter((p) => p.team === 'player');
  if (!myPieces.some((p) => p.isLord)) myPieces[0].isLord = true;

  // 敌方阵容:教程关卡用预设阵容,否则从卡池里均衡挑选
  const aiLineup = s.enemyLineupPreset ?? pickBalancedLineup(s.enemyDeck, s.lineupSize);
  s.enemyDeck = s.enemyDeck.filter((id) => !aiLineup.includes(id));
  const enemyPieces = aiLineup.map((id) => makePiece(CARDS_BY_ID[id].owner, 'enemy', id));
  if (s.enemyHpOverride != null) {
    enemyPieces.forEach((p) => { p.hp = s.enemyHpOverride!; p.maxHp = s.enemyHpOverride!; });
  }
  s.pieces = [...myPieces, ...enemyPieces];

  // 玩家牌库 = 20 张卡池扣掉"献祭"掉的 10 张
  s.deck = s.deck.filter((id) => !s.lineup.includes(id));

  aiDeploy(s);
  // 教程关卡可指定敌方灵主:亮明其身份,便于玩家识别胜负目标
  if (s.enemyLordPreset) {
    const lord = s.pieces.find((p) => p.team === 'enemy' && p.fromCard === s.enemyLordPreset);
    if (lord) {
      s.pieces.forEach((p) => { if (p.team === 'enemy') p.isLord = false; });
      lord.isLord = true;
      lord.lordRevealed = true;
    }
  }
  s.turn = 1;
  s.ap = START_AP;
  s.enemyAp = START_AP;
  s.dotZones = [];
  s.selectedId = null;
  s.vision = [...visibleKeys(s)];
  markRevealed(s);

  // 教程第 0 关 / 技能模式:无卡牌,跳过抽卡阶段直接进入指令阶段
  if (s.skipCards) {
    s.phase = 'command';
    pushLog(s, '—— 回合 1 · 指令阶段 · 为灵兽下达指令 ——', 'player', 'turn');
    return aiCommand(aiCastSkills(s));
  }

  s.phase = 'command';
  for (let i = 0; i < HAND_SIZE; i++) {
    drawCard(s, 'player');
    drawCard(s, 'enemy');
  }
  // 开局发牌不触发抽卡动画,清空新抽牌标记
  s.lastDrawnCardId = null;

  pushLog(s, '—— 回合 1 · 执行阶段 · 出牌并下达指令 ——', 'player', 'turn');
  return aiCommand(aiPlayCards(s));
}

export function selectPiece(state: GameState, id: string | null): GameState {
  return { ...state, selectedId: id };
}

/** 计算从棋子当前位置到指定目标格的正交最短路径(BFS 避障);目标不可达或超出移动力则返回 null */
function pathTo(s: GameState, p: Piece, dest: Pt): Pt[] | null {
  if (dest.x === p.x && dest.y === p.y) return [];
  const budget = p.move + p.bonusMove;
  if (budget <= 0) return null;
  const others = s.pieces.filter((q) => q.id !== p.id);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const startK = key(p.x, p.y);
  const endK = key(dest.x, dest.y);
  const distMap = new Map<string, number>([[startK, 0]]);
  const queue: Pt[] = [{ x: p.x, y: p.y }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const steps = distMap.get(key(cur.x, cur.y))!;
    if (steps >= budget) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (!inBounds(nx, ny, s.cols, s.rows) || distMap.has(nk) || isCommandOccupied(others, nx, ny) || isObstacle(s.obstacles, nx, ny)) continue;
      distMap.set(nk, steps + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  const endSteps = distMap.get(endK);
  if (endSteps === undefined || endSteps > budget) return null;
  // 回溯最短路径:每一步在上一步可达的相邻格中随机挑选,多方案时随机生成轨迹
  const path: Pt[] = [];
  let cur = dest;
  let steps = endSteps;
  while (steps > 0) {
    path.push(cur);
    const candidates: Pt[] = [];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (distMap.get(key(nx, ny)) === steps - 1) candidates.push({ x: nx, y: ny });
    }
    cur = candidates[Math.floor(Math.random() * candidates.length)];
    steps -= 1;
  }
  path.reverse();
  return path;
}

/** 找到棋子移动力范围内、能攻击到目标的最远落点(优先保持最远攻击距离);不可达返回 null */
export function findAttackCell(s: GameState, p: Piece, target: Piece): Pt | null {
  const budget = p.move + p.bonusMove;
  if (budget <= 0) return null;
  const others = s.pieces.filter((q) => q.id !== p.id);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const startK = key(p.x, p.y);
  const distMap = new Map<string, number>([[startK, 0]]);
  const prev = new Map<string, string>();
  const queue: Pt[] = [{ x: p.x, y: p.y }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const steps = distMap.get(key(cur.x, cur.y))!;
    if (steps >= budget) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (!inBounds(nx, ny, s.cols, s.rows) || distMap.has(nk) || isCommandOccupied(others, nx, ny) || isObstacle(s.obstacles, nx, ny)) continue;
      distMap.set(nk, steps + 1);
      prev.set(nk, key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  // 在可达格中挑出能攻击目标者,取离目标最远(保持最远攻击距离)、其次移动步数最多者
  let best: Pt | null = null;
  let bestD = -1;
  let bestSteps = -1;
  for (const [k, steps] of distMap) {
    if (k === startK) continue;
    const [x, y] = k.split(',').map(Number);
    if (!canAttack(p.type, p.range, target.x - x, target.y - y)) continue;
    // 远程攻击被障碍物阻挡:仅攻击型棋子(治疗不计)需要视线
    if (p.atk > 0 && blocksLine(s.obstacles, x, y, target.x, target.y)) continue;
    const d = dist(x, y, target.x, target.y);
    if (d > bestD || (d === bestD && steps > bestSteps)) {
      bestD = d;
      bestSteps = steps;
      best = { x, y };
    }
  }
  return best;
}

export function command(
  state: GameState,
  pieceId: string,
  patch: { waypoint?: { x: number; y: number }; clearPath?: boolean; confirm?: boolean; mode?: Mode; attackOrder?: AttackOrder; healOrder?: AttackOrder; undoStep?: boolean; setAttackTarget?: string; setHealTarget?: string }
): GameState {
  if (state.phase !== 'command') return state;
  const s = clone(state);
  const p = s.pieces.find((q) => q.id === pieceId);
  if (!p || p.team !== 'player' || !p.alive || !p.placed) return state;

  // 已下令的棋子在本回合锁定指令,不可再修改
  if (p.acted) return state;

  // 结算指令消耗:每次 1 点行动点(技能模式无行动点,直接锁定)
  const charge = (cost: number) => {
    if (s.skillMode) { p.acted = true; return true; }
    if (s.ap < cost) return false;
    s.ap -= cost;
    p.acted = true;
    return true;
  };

  // 点击移动范围内的目标格:直接规划完整正交路径(草稿),不消耗行动点
  if (patch.waypoint) {
    const dest = patch.waypoint;
    // 当前路径终点(无路径时为棋子原位置)
    const last = p.path.length ? p.path[p.path.length - 1] : { x: p.x, y: p.y };
    // 点击与当前落点相邻的格子 → 逐格扩展,按点击顺序行进
    if (Math.abs(dest.x - last.x) + Math.abs(dest.y - last.y) === 1) {
      const budget = p.move + p.bonusMove;
      if (p.path.length >= budget) return state;
      if (!inBounds(dest.x, dest.y, s.cols, s.rows)) return state;
      if (isObstacle(s.obstacles, dest.x, dest.y)) return state;
      const others = s.pieces.filter((q) => q.id !== p.id);
      if (isCommandOccupied(others, dest.x, dest.y)) return state;
      p.path = [...p.path, { x: dest.x, y: dest.y }];
      return s;
    }
    // 否则:直达目标,重新计算最短路径(存在多种方案时随机生成)
    const next = pathTo(s, p, dest);
    if (!next) return state;
    p.path = next;
    return s;
  }

  // 后退一步:撤销路径上最后一段落点
  if (patch.undoStep) {
    if (p.path.length === 0) return state;
    p.path = p.path.slice(0, -1);
    return s;
  }

  // 确认指令:此时才计算行动点并结束该棋子的行动
  // 防御同样允许保留移动路径(先移动到指定格再进入防御姿态),因此不再清空路径
  if (patch.confirm) {
    // 没有任何移动/攻击/治疗操作时直接待机,不消耗行动点
    const hasAction = p.path.length > 0 || p.attackTarget !== undefined || p.healTarget !== undefined;
    if (hasAction) {
      if (!charge(1)) return state;
    } else {
      p.acted = true;
    }
    return s;
  }

  // 取消移动:清除草稿路径
  if (patch.clearPath) {
    p.path = [];
    return s;
  }

  // 切换行动模式(攻击 / 防御 / 待机):仅记录状态,不消耗行动点、不结束行动
  if (patch.mode !== undefined) {
    p.mode = patch.mode;
    return s;
  }

  // 切换攻击时机(先攻击再移动 / 先移动再攻击)
  if (patch.attackOrder !== undefined) {
    p.attackOrder = patch.attackOrder;
    return s;
  }

  // 切换治疗时机(先治疗再移动 / 先移动再治疗)
  if (patch.healOrder !== undefined) {
    p.healOrder = patch.healOrder;
    return s;
  }

  // 设置攻击目标(锁定目标即进入攻击模式);「先移动再攻击」且超出攻击范围时,自动移动到能打到目标的最远落点
  if (patch.setAttackTarget !== undefined) {
    const target = s.pieces.find((q) => q.id === patch.setAttackTarget && q.alive && q.placed && q.team !== p.team);
    if (target) {
      const ax = p.path.length ? p.path[p.path.length - 1].x : p.x;
      const ay = p.path.length ? p.path[p.path.length - 1].y : p.y;
      if (p.attackOrder === 'after' && (!canAttack(p.type, p.range, target.x - ax, target.y - ay) || blocksLine(s.obstacles, ax, ay, target.x, target.y))) {
        const cell = findAttackCell(s, p, target);
        if (cell) {
          const np = pathTo(s, p, cell);
          if (np) p.path = np;
        }
      }
    }
    p.attackTarget = patch.setAttackTarget || undefined;
    if (patch.setAttackTarget) p.mode = 'attack';
    return s;
  }

  // 设置治疗目标;「先移动再治疗」且超出治疗范围时,自动移动到能治疗到目标的位置
  if (patch.setHealTarget !== undefined) {
    const target = s.pieces.find((q) => q.id === patch.setHealTarget && q.alive && q.placed && q.team === p.team);
    if (target) {
      const ax = p.path.length ? p.path[p.path.length - 1].x : p.x;
      const ay = p.path.length ? p.path[p.path.length - 1].y : p.y;
      if (p.healOrder === 'after' && dist(ax, ay, target.x, target.y) > p.range) {
        const cell = findAttackCell(s, p, target);
        if (cell) {
          const np = pathTo(s, p, cell);
          if (np) p.path = np;
        }
      }
    }
    p.healTarget = patch.setHealTarget || undefined;
    return s;
  }

  return s;
}

/** 指令阶段:AI 代玩家为所有可行动棋子自动下达指令(按风格决定推进 / 后撤 / 集火目标) */
export function autoCommand(state: GameState, style: AutoCommandStyle = 'aggressive'): GameState {
  if (state.phase !== 'command') return state;
  const s = clone(state);
  const vis = visibleKeys(s);
  const allies = s.pieces.filter((p) => p.team === 'player' && p.alive && p.placed && p.stunned <= 0);
  const enemies = s.pieces.filter((p) => p.team === 'enemy' && p.alive && p.placed && vis.has(key(p.x, p.y)));

  // 草稿模式:只规划路径 / 目标,不扣行动点、不锁定,待玩家确认后统一生效
  let budget = s.ap;
  for (const a of allies) {
    if (a.acted || a.mode === 'defend') continue;
    if (budget < 1) continue;

    budget -= 1;
    const moveBudget = a.move + a.bonusMove;

    // 治疗者:向受伤最重的队友靠拢并锁定治疗目标
    if (a.heal > 0 && a.atk <= 0) {
      a.mode = 'attack';
      a.attackTarget = undefined;
      const wounded = s.pieces
        .filter((o) => o.alive && o.placed && o.team === 'player' && o !== a && o.hp < o.maxHp)
        .sort((x, y) => x.hp - y.hp);
      if (wounded.length > 0) {
        const t = wounded[0];
        a.healTarget = t.id;
        a.path = dist(a.x, a.y, t.x, t.y) > a.range ? planPath(a, t, s, moveBudget) : [];
      } else {
        a.healTarget = undefined;
        a.path = [];
      }
      continue;
    }

    // 选取目标:不同风格有不同的偏好
    let best: Piece | null = null;
    let bestScore = Infinity;
    for (const t of enemies) {
      const d = dist(a.x, a.y, t.x, t.y);
      let score = d;
      if (style === 'focusLord' && t.isLord) {
        score -= 10;
      }
      if (score < bestScore) { bestScore = score; best = t; }
    }

    if (style === 'defensive') {
      const inRange = best ? canAttack(a.type, a.range, best.x - a.x, best.y - a.y) && !blocksLine(s.obstacles, a.x, a.y, best.x, best.y) : false;
      const canReach = best ? dist(a.x, a.y, best.x, best.y) <= moveBudget + a.range : false;
      if (inRange) {
        a.path = [];
        a.mode = 'attack';
        if (best) a.attackTarget = best.id;
      } else if (canReach) {
        a.path = planPath(a, best!, s, moveBudget);
        a.mode = 'attack';
        if (best) a.attackTarget = best.id;
      } else {
        a.path = planPath(a, { x: 0, y: a.y }, s, moveBudget);
        a.mode = 'defend';
        a.attackTarget = undefined;
      }
      continue;
    }

    // aggressive / focusLord:主动压上
    if (best) {
      const d = dist(a.x, a.y, best.x, best.y);
      const inRange = canAttack(a.type, a.range, best.x - a.x, best.y - a.y) && !blocksLine(s.obstacles, a.x, a.y, best.x, best.y);
      // 目标处于无敌护盾时不再原地空打:未贴身则向前逼近/包抄,为下一回合破盾击杀铺路
      const approachShielded = best.shieldTurns > 0 && d > 1;
      a.path = !inRange || approachShielded ? planPath(a, best, s, moveBudget) : [];
      a.attackTarget = best.id;
    } else if (style === 'focusLord') {
      a.path = planPath(a, { x: s.cols - 1, y: Math.floor(s.rows / 2) }, s, moveBudget);
      a.attackTarget = undefined;
    } else {
      a.path = planPath(a, { x: s.cols - 1, y: a.y }, s, moveBudget);
      a.attackTarget = undefined;
    }
    a.mode = 'attack';
  }
  return s;
}

/** 指令阶段:一键确认所有未确认的草稿指令(按棋子数扣行动点并锁定) */
export function confirmAll(state: GameState): GameState {
  if (state.phase !== 'command') return state;
  const s = clone(state);
  for (const p of s.pieces) {
    if (p.team !== 'player' || !p.alive || !p.placed || p.acted) continue;
    const hasDraft = p.path.length > 0 || p.attackTarget !== undefined || p.healTarget !== undefined || p.mode === 'defend' || p.mode === 'standby';
    if (!hasDraft) continue;
    if (!s.skillMode) {
      if (s.ap < 1) continue;
      s.ap -= 1;
    }
    p.acted = true;
  }
  return s;
}

/** 指令阶段占用判定:目标格被预占 / 有棋子停留且不离开(仅己方待移动目标计入预占) */
function isCommandOccupied(pieces: Piece[], x: number, y: number): boolean {
  for (const p of pieces) {
    if (!p.alive || !p.placed) continue;
    const dest = p.path.length ? p.path[p.path.length - 1] : null;
    // 该棋子计划离开当前格(草稿路径或已确认路径,只要终点不等于原位就算离开)
    const willLeave = p.team === 'player' && dest !== null && (dest.x !== p.x || dest.y !== p.y);
    // 已确认移动的目标格视为预占,其他人不能抢同一落脚点
    if (p.acted && willLeave && dest!.x === x && dest!.y === y) return true;
    // 棋子停留在此格且不会离开 → 占用
    if (p.x === x && p.y === y && !willLeave) return true;
  }
  return false;
}

function legalMoves(s: GameState, p: Piece): Set<string> {
  const set = new Set<string>();
  const budget = p.move + p.bonusMove;
  if (budget <= 0) return set;
  const others = s.pieces.filter((q) => q.id !== p.id);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const startK = key(p.x, p.y);
  const distMap = new Map<string, number>([[startK, 0]]);
  const queue: Pt[] = [{ x: p.x, y: p.y }];
  let head = 0;
  // 正交 BFS:遍历移动力(方格数)内所有可到达格子,避开被占用的格子
  while (head < queue.length) {
    const cur = queue[head++];
    const steps = distMap.get(key(cur.x, cur.y))!;
    if (steps >= budget) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (!inBounds(nx, ny, s.cols, s.rows) || distMap.has(nk) || isCommandOccupied(others, nx, ny) || isObstacle(s.obstacles, nx, ny)) continue;
      distMap.set(nk, steps + 1);
      set.add(nk);
      queue.push({ x: nx, y: ny });
    }
  }

  return set;
}

export { legalMoves };

/** 推进阶段:card1 → command(含 AI 下指令) */
export function advancePhase(state: GameState): GameState {
  if (state.phase === 'card1') {
    let s = aiCommand(state);
    s = { ...s, phase: 'command' as const, selectedId: null };
    pushLog(s, '—— 指令阶段 · 为灵兽下达指令 ——', 'player', 'turn');
    return s;
  }
  return state;
}

/** 指令阶段结束:丢弃未确认棋子的草稿指令(路径 / 目标 / 姿态),准备进入同步执行 */
export function prepareExecute(state: GameState): GameState {
  const s = clone(state);
  s.pieces.forEach((p) => {
    if (p.team === 'player' && !p.acted) {
      p.path = [];
      p.attackTarget = undefined;
      p.healTarget = undefined;
      p.mode = 'attack';
    }
  });
  s.selectedId = null;
  return s;
}

/** 传送:棋子陷入黑洞后随机传送到任意空位,并丢弃剩余路径。落点需避开其他棋子当前位置、其他棋子本回合将要移动到的路径格、障碍物与黑洞,保证棋子不重叠 */
function teleportFromBlackHole(s: GameState, p: Piece, events?: TurnEvent[]) {
  // 不可落点集合:其他存活棋子的当前位置 + 它们本回合剩余的移动路径(预判未来占位)
  const reserved = new Set<string>();
  for (const q of s.pieces) {
    if (!q.alive || !q.placed || q.id === p.id) continue;
    reserved.add(key(q.x, q.y));
    for (const c of q.path) reserved.add(key(c.x, c.y));
  }
  const free: Pt[] = [];
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (x === p.x && y === p.y) continue;
      if (reserved.has(key(x, y))) continue;
      if (isObstacle(s.obstacles, x, y) || isBlackHole(s.blackHoles, x, y)) continue;
      free.push({ x, y });
    }
  }
  if (free.length === 0) return;
  const dest = free[Math.floor(Math.random() * free.length)];
  p.x = dest.x;
  p.y = dest.y;
  p.path = [];
  pushLog(s, [
    ...pieceRef(p),
    { text: ` 陷入黑洞,被传送到 ${cellName(dest.x, dest.y)}!` },
  ], p.team, 'info');
  if (events) events.push({ type: 'teleport', x: dest.x, y: dest.y, text: '传送' });
}

/** 执行本回合指令,拆分为逐帧动画序列,让玩家看清每一步 */
export function executeTurn(input: GameState): TurnFrame[] {
  const s = clone(input);
  const frames: TurnFrame[] = [];
  s.phase = 'execute';

  const hiddenLogged = new Set<string>();

  const pushFrame = (delay: number, events: TurnEvent[] = []) => {
    frames.push({ state: clone(s), events, delay });
  };
  // 把一次移动写入日志(与移动发生的帧同步) - 简化版:不记录每一步的路径
  const logStepMoves = (_moves: { p: Piece; from: Pt }[]) => {
    // 简化日志:不再逐格记录移动路径,只保留最终结果
  };

  // 刷新视野:当前能被玩家看到的敌方棋子标记为已知
  markRevealed(s);

  // 0) 战前宣告:封锁 / 防御姿态
  // 被封锁(眩晕)的棋子本回合无法行动
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.stunned <= 0) continue;
    if (!coordKnown(p)) continue;
    pushLog(s, [
      ...pieceRef(p),
      { text: ' 被封锁,本回合无法移动与攻击。' },
    ], p.team, 'info');
  }
  // 防御姿态宣告
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.mode !== 'defend') continue;
    if (!coordKnown(p)) continue;
    pushLog(s, [
      ...pieceRef(p),
      { text: ' 结阵防御,进入防御姿态(受到的伤害 -1)。' },
    ], p.team, 'info');
  }

  // 帧 0:执行开始,定格原始站位(含战前宣告信息)
  pushFrame(700);

  // 1) 先攻击/先治疗的棋子:移动前从原始位置结算(优先级:治疗 > 攻击)
  {
    // —— 先治疗(治疗时机 = first) ——
    const firstHeals = new Map<string, number>();
    const firstHealEvents: TurnEvent[] = [];
    for (const p of s.pieces) {
      if (!p.alive || !p.placed || p.mode === 'defend' || p.mode === 'standby' || p.stunned > 0) continue;
      if (p.atk > 0 || p.heal <= 0 || p.healOrder !== 'first') continue;
      const t = p.healTarget
        ? s.pieces.find((o) => o.id === p.healTarget && o.alive && o.placed && o.team === p.team && dist(p.x, p.y, o.x, o.y) <= p.range)
        : undefined;
      if (!t) continue;
      firstHeals.set(t.id, (firstHeals.get(t.id) || 0) + p.heal);
      firstHealEvents.push({ type: 'heal', x: t.x, y: t.y, amount: p.heal });
    }
    if (firstHealEvents.length > 0) {
      for (const p of s.pieces) {
        if (!p.alive) continue;
        const h = firstHeals.get(p.id);
        if (h) p.hp = Math.min(p.maxHp, p.hp + h);
      }
      pushFrame(1300, firstHealEvents);
    }

    // —— 先攻击(攻击时机 = first) ——
    const firstDmg = new Map<string, number>();
    const firstAttacks: { targetId: string; amount: number }[] = [];
    const firstEvents: TurnEvent[] = [];
    for (const p of s.pieces) {
      if (!p.alive || !p.placed || p.stunned > 0) continue;
      if (p.mode !== 'attack' || p.atk <= 0 || p.attackOrder !== 'first') continue;
      const effAtk = p.atk + p.bonusAtk + p.tempAtk;
      const t = p.attackTarget
        ? s.pieces.find((o) => o.id === p.attackTarget && o.alive && o.placed && o.team !== p.team && canAttack(p.type, p.range, o.x - p.x, o.y - p.y) && !blocksLine(s.obstacles, p.x, p.y, o.x, o.y))
        : undefined;
      if (!t) continue;
      if (t.shieldTurns > 0) {
        firstEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount: effAtk });
        firstEvents.push({ type: 'shield', x: t.x, y: t.y, text: '无敌' });
        continue;
      }
      if (t.blockHits > 0) {
        t.blockHits -= 1;
        firstEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount: effAtk });
        firstEvents.push({ type: 'shield', x: t.x, y: t.y, text: '格挡' });
        continue;
      }
      let amount = effAtk;
      if (t.mode === 'defend') amount = Math.max(0, amount - 1);
      if (t.dmgReduction > 0 && amount > 0) {
        const absorbed = Math.min(amount, t.dmgReduction);
        amount -= absorbed;
        t.dmgReduction = 0;
      }
      if (amount <= 0) continue;
      firstDmg.set(t.id, (firstDmg.get(t.id) || 0) + amount);
      firstAttacks.push({ targetId: t.id, amount });
      firstEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount });
    }
    if (firstEvents.length > 0) {
      pushFrame(2000, firstEvents);
      const firstDamageEvents: TurnEvent[] = [];
      for (const p of s.pieces) {
        if (!p.alive) continue;
        const d = firstDmg.get(p.id);
        if (d) firstDamageEvents.push({ type: 'attack', x: p.x, y: p.y, amount: d });
      }
      if (firstDamageEvents.length > 0) pushFrame(900, firstDamageEvents);
      const firstDeathEvents: TurnEvent[] = [];
      for (const atk of firstAttacks) {
        const p = s.pieces.find((o) => o.id === atk.targetId);
        if (p) dealDirectDamage(s, p, atk.amount, firstDeathEvents, false, false);
      }
      if (firstDeathEvents.length > 0) pushFrame(1500, firstDeathEvents);
    }
  }

  // 2) 同时移动(被封锁棋子不动),沿各自路径按格逐步推进
  const movers = s.pieces
    .filter((p) => p.alive && p.placed && p.stunned <= 0 && p.acted && p.path.length > 0)
    .map((p) => ({ p, idx: 0, stopped: false }));

  const maxStep = movers.reduce((mx, m) => Math.max(mx, m.p.path.length), 0);

  for (let step = 0; step < maxStep; step++) {
    let moved = false;
    const stepEvents: TurnEvent[] = [];
    const claims = new Map<string, { m: (typeof movers)[number]; x: number; y: number }[]>();
    for (const m of movers) {
      if (m.stopped || m.idx >= m.p.path.length) continue;
      const next = m.p.path[m.idx];
      // 落入黑洞:随机传送到任意空位,本回合不再继续移动
      if (isBlackHole(s.blackHoles, next.x, next.y)) {
        teleportFromBlackHole(s, m.p, stepEvents);
        m.idx = m.p.path.length;
        m.stopped = true;
        moved = true;
        continue;
      }
      const blocker = at(s, next.x, next.y);
      if (blocker) {
        // 暂时被堵:先记为停止,等所有棋子移动结束后再统一判定一次
        m.stopped = true;
        continue;
      }
      const k = key(next.x, next.y);
      const list = claims.get(k) || [];
      list.push({ m, x: next.x, y: next.y });
      claims.set(k, list);
    }

    const stepMoves: { p: Piece; from: Pt }[] = [];
    for (const list of claims.values()) {
      // 相同距离相遇:随机一个占领,其余被堵
      const winner = list[Math.floor(Math.random() * list.length)];
      for (const item of list) {
        if (item === winner) {
          const from = { x: item.m.p.x, y: item.m.p.y };
          item.m.p.x = item.x;
          item.m.p.y = item.y;
          setFacing(item.m.p, from, { x: item.x, y: item.y });
          item.m.idx += 1;
          moved = true;
          stepMoves.push({ p: item.m.p, from });
        } else {
          item.m.stopped = true;
        }
      }
    }

    if (moved) markRevealed(s);
    // 本帧发生的移动,与画面同帧写入战斗日志
    logStepMoves(stepMoves);
    pushFrame(moved ? 750 : 0, stepEvents);
  }

  // 二次判定:所有棋子移动结束后,原本被堵的棋子若前方已空出,可继续前往目标位置
  // 处理「挡路的相邻棋子本回合移开后,被堵棋子仍能抵达目的地」的特殊情况
  for (let round = 0; round < s.cols + s.rows; round++) {
    const retry = new Map<string, { m: (typeof movers)[number]; x: number; y: number }[]>();
    const retryEvents: TurnEvent[] = [];
    let moved = false;
    for (const m of movers) {
      if (!m.stopped || m.idx >= m.p.path.length) continue;
      const next = m.p.path[m.idx];
      if (at(s, next.x, next.y)) continue;
      if (isBlackHole(s.blackHoles, next.x, next.y)) {
        teleportFromBlackHole(s, m.p, retryEvents);
        m.idx = m.p.path.length;
        moved = true;
        continue;
      }
      const k = key(next.x, next.y);
      const list = retry.get(k) || [];
      list.push({ m, x: next.x, y: next.y });
      retry.set(k, list);
    }
    if (retry.size === 0) {
      // 仅发生黑洞传送时,也要补一帧展示传送效果
      if (moved) {
        markRevealed(s);
        pushFrame(750, retryEvents);
      }
      break;
    }
    const stepMoves: { p: Piece; from: Pt }[] = [];
    for (const list of retry.values()) {
      const winner = list[Math.floor(Math.random() * list.length)];
      for (const item of list) {
        if (item === winner) {
          const from = { x: item.m.p.x, y: item.m.p.y };
          item.m.p.x = item.x;
          item.m.p.y = item.y;
          setFacing(item.m.p, from, { x: item.x, y: item.y });
          item.m.idx += 1;
          moved = true;
          stepMoves.push({ p: item.m.p, from });
          if (item.m.idx >= item.m.p.path.length) item.m.stopped = false;
        }
      }
    }
    if (moved) {
      markRevealed(s);
      logStepMoves(stepMoves);
      pushFrame(750, retryEvents);
    }
  }

  // 记录最终仍被堵、未能抵达终点的棋子 - 简化版
  for (const m of movers) {
    if (!m.stopped || m.idx >= m.p.path.length) continue;
    const next = m.p.path[m.idx];
    const blocker = at(s, next.x, next.y);
    if (blocker) {
      const rel = blocker.team === m.p.team ? '己方' : '敌方';
      pushLog(s, [
        { text: BEASTS[m.p.type].name, team: m.p.team },
        { text: ` 被${rel}${BEASTS[blocker.type].name}阻挡。` },
      ], m.p.team, 'info');
    } else {
      pushLog(s, [
        { text: BEASTS[m.p.type].name, team: m.p.team },
        { text: ' 移动被阻断。' },
      ], m.p.team, 'info');
    }
  }

  // 移动收尾信息(被堵/抵达)单独成帧,确保与画面同步
  if (movers.length > 0) pushFrame(700);

  // 3) 先移动再攻击的棋子(攻击时机=后)在移动后发动攻击 + 治疗(被封锁棋子跳过)
  const dmg = new Map<string, number>();
  const heals = new Map<string, number>();
  const attackEvents: TurnEvent[] = [];
  const healEvents: TurnEvent[] = [];
  const failEvents: TurnEvent[] = [];
  const attacks: { targetId: string; amount: number }[] = [];
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.mode === 'defend' || p.mode === 'standby' || p.stunned > 0) continue;
    if (p.atk <= 0) {
      // 先治疗的棋子已在移动前结算,这里仅处理「先移动再治疗」
      if (p.heal > 0 && p.healOrder === 'after') {
        let t: Piece | undefined;
        if (p.team === 'player') {
          if (p.healTarget) {
            t = s.pieces.find((o) => o.id === p.healTarget && o.alive && o.placed && o.team === p.team && dist(p.x, p.y, o.x, o.y) <= p.range);
          }
        } else {
          const cand = s.pieces
            .filter((o) => o.alive && o.placed && o.team === p.team && o !== p
              && o.hp < o.maxHp && dist(p.x, p.y, o.x, o.y) <= p.range)
            .sort((a, b) => a.hp - b.hp);
          t = cand[0];
        }
        if (t) {
          heals.set(t.id, (heals.get(t.id) || 0) + p.heal);
          healEvents.push({ type: 'heal', x: t.x, y: t.y, amount: p.heal });
        }
      }
      continue;
    }
    // 先攻击的棋子已在移动前结算,这里仅处理「先移动再攻击」
    if (p.attackOrder !== 'after') continue;
    const effAtk = p.atk + p.bonusAtk + p.tempAtk;
    let t: Piece | undefined;
    if (p.attackTarget) {
      t = s.pieces.find((o) => o.id === p.attackTarget && o.alive && o.placed && o.team !== p.team && canAttack(p.type, p.range, o.x - p.x, o.y - p.y) && !blocksLine(s.obstacles, p.x, p.y, o.x, o.y));
    }
    if (!t) {
      // 先移动再攻击却无法命中目标:气馁(攻击失败)
      if (p.attackTarget) {
        failEvents.push({ type: 'fail', x: p.x, y: p.y, text: '攻击失败' });
        pushLog(s, [...pieceRef(p), { text: ' 未能攻击到目标,露出了气馁的神情。' }], p.team, 'info');
      }
      continue;
    }
    // 无敌护盾:完全免疫(仍播放攻击动画,让玩家看到"出手但被无敌挡下")
    if (t.shieldTurns > 0) {
      attackEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount: effAtk });
      attackEvents.push({ type: 'shield', x: t.x, y: t.y, text: '无敌' });
      continue;
    }
    // 格挡:抵挡本次攻击(仍播放攻击动画)
    if (t.blockHits > 0) {
      t.blockHits -= 1;
      attackEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount: effAtk });
      attackEvents.push({ type: 'shield', x: t.x, y: t.y, text: '格挡' });
      continue;
    }
    let amount = effAtk;
    // 防御姿态:减免 1 点
    if (t.mode === 'defend') {
      amount = Math.max(0, amount - 1);
    }
    // 护盾:一次性减伤
    if (t.dmgReduction > 0 && amount > 0) {
      const absorbed = Math.min(amount, t.dmgReduction);
      amount -= absorbed;
      t.dmgReduction = 0;
    }
    // 伤害被完全抵消
    if (amount <= 0) {
      continue;
    }
    dmg.set(t.id, (dmg.get(t.id) || 0) + amount);
    attacks.push({ targetId: t.id, amount });
    attackEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount });
  }

  // 4) 先结算治疗(保留「先治疗、后受伤」的原有语义)
  if (healEvents.length > 0) {
    for (const p of s.pieces) {
      if (!p.alive) continue;
      const h = heals.get(p.id);
      if (h) p.hp = Math.min(p.maxHp, p.hp + h);
    }
    pushFrame(1300, healEvents);
  }

  // 5) 攻击动画帧(2秒)
  if (attackEvents.length > 0) {
    pushFrame(2000, attackEvents);
  }

  // 5.5) 气馁(攻击失败)动画帧
  if (failEvents.length > 0) {
    pushFrame(1300, failEvents);
  }

  // 6) 伤害数字帧
  const damageEvents: TurnEvent[] = [];
  for (const p of s.pieces) {
    if (!p.alive) continue;
    const d = dmg.get(p.id);
    if (d) {
      damageEvents.push({ type: 'attack', x: p.x, y: p.y, amount: d });
    }
  }
  if (damageEvents.length > 0) {
    pushFrame(900, damageEvents);
  }

  // 6) 死亡帧:逐次结算伤害,灵主重生获得的无敌护盾会挡下本回合的溢出伤害
  const deathEvents: TurnEvent[] = [];
  for (const atk of attacks) {
    const p = s.pieces.find((o) => o.id === atk.targetId);
    if (p) dealDirectDamage(s, p, atk.amount, deathEvents, false, false);
  }
  if (deathEvents.length > 0) {
    pushFrame(1500, deathEvents);
  }

  // 5) 持续性伤害(骑士陷阵区域)
  const dotEvents: TurnEvent[] = [];
  for (const zone of s.dotZones) {
    for (const p of s.pieces) {
      if (!p.alive || !p.placed) continue;
      if (p.team === zone.team) continue;
      if (dist(p.x, p.y, zone.x, zone.y) > 1) continue;
      if (p.dotImmunity > 0) continue;
      // 被无敌 / 格挡 / 护盾抵挡时不记伤害
      if (p.shieldTurns > 0 || p.blockHits > 0 || p.dmgReduction > 0) {
        dealDirectDamage(s, p, 1, dotEvents);
        continue;
      }
      // 先写入日志再结算,保证「受伤 → 死亡」的日志顺序
      pushLog(s, [
        ...pieceRef(p),
        { text: ' 身陷陷阵区域,受到 1 点持续伤害。' },
      ], p.team, 'damage');
      dealDirectDamage(s, p, 1, dotEvents);
    }
  }
  if (dotEvents.length > 0) pushFrame(1400, dotEvents);

  // 6) 护盾倒计时
  s.pieces.forEach((p) => {
    if (p.alive && p.shieldTurns > 0) p.shieldTurns = Math.max(0, p.shieldTurns - 1);
  });

  // 7) 视野记忆
  const vis = [...visibleKeys(s)];
  s.vision = Array.from(new Set([...s.vision, ...vis]));

  // 8) 胜负
  if (!checkVictory(s)) s.phase = 'execute';

  // 末帧:定格结算后的最终局面
  pushFrame(1100);

  return frames;
}

function resolveDeath(s: GameState, p: Piece, events: TurnEvent[]) {
  // 第 0 关(无卡牌,不启用灵主机制)不触发灵主重生
  if (s.lordBattle && p.isLord && !p.revived) {
    p.revived = true;
    p.lordRevealed = true;
    p.hp = 1;
    p.shieldTurns = 2;
    events.push({ type: 'revive', x: p.x, y: p.y, text: '灵主重生' });
    pushLog(s, [
      { text: p.team === 'player' ? '你的' : '敌方' },
      { text: '灵主', team: p.team },
      { text: '首次陨落,以 1 血重生并获得 1 回合无敌护盾!' },
    ], p.team, 'death');
    return;
  }
  p.alive = false;
  events.push({ type: 'death', x: p.x, y: p.y });
  pushLog(s, [
    { text: p.team === 'player' ? '己方' : '敌方' },
    ...pieceRef(p),
    { text: '被消灭。' },
  ], p.team, 'damage');
}

/** 判定胜负:任一方灵主阵亡即结束 */
function checkVictory(s: GameState): boolean {
  const pLord = s.pieces.find((p) => p.team === 'player' && p.isLord);
  const eLord = s.pieces.find((p) => p.team === 'enemy' && p.isLord);
  if (!pLord || !pLord.alive) {
    s.winner = 'enemy'; s.phase = 'gameover';
    pushLog(s, s.lordBattle ? '你的灵主已陨落…… 战败。' : '你的灵兽被消灭…… 战败。', 'enemy', 'death');
    return true;
  } else if (!eLord || !eLord.alive) {
    s.winner = 'player'; s.phase = 'gameover';
    pushLog(s, s.lordBattle ? '敌方灵主陨落!你赢得了圣战!' : '敌方灵兽被消灭!你赢了!', 'player', 'death');
    return true;
  }
  return false;
}

/** 进入下一回合:重置行动点、抽牌、AI 出牌,回到卡牌阶段 1 */
export function beginNextTurn(state: GameState): GameState {
  const s = clone(state);
  s.turn += 1;

  if (s.turn > MAX_TURNS) {
    const pl = s.pieces.find((p) => p.team === 'player' && p.isLord);
    const el = s.pieces.find((p) => p.team === 'enemy' && p.isLord);
    const ph = pl ? pl.hp : 0;
    const eh = el ? el.hp : 0;
    s.winner = ph > eh ? 'player' : eh > ph ? 'enemy' : 'draw';
    s.phase = 'gameover';
    pushLog(s, '回合数已达上限,按灵主血量结算。', undefined, 'system');
    return s;
  }

  s.ap = START_AP;
  s.enemyAp = START_AP;
  // 应用上回合累积的行动点惩罚(干扰之音:下回合 -1 行动点)
  s.ap = Math.max(0, s.ap - s.playerApPenalty);
  s.enemyAp = Math.max(0, s.enemyAp - s.enemyApPenalty);
  s.playerApPenalty = 0;
  s.enemyApPenalty = 0;
  s.pieces.forEach((p) => {
    if (!p.alive) return;
    p.acted = false; p.path = []; p.mode = 'attack';
    p.attackTarget = undefined; p.healTarget = undefined;
    p.bonusMove = 0;
    p.tempAtk = 0;
    p.usedSkill = false;
    if (p.skillCd > 0) p.skillCd -= 1;
  });
  s.pieces.forEach((p) => {
    if (!p.alive) return;
    if (p.stunned > 0) p.stunned -= 1;
    if (p.dotImmunity > 0) p.dotImmunity -= 1;
  });
  s.dotZones = s.dotZones.map((z) => ({ ...z, turns: z.turns - 1 })).filter((z) => z.turns > 0);

  s.selectedId = null;

  // 教程第 0 关 / 技能模式:无卡牌,直接进入指令阶段
  if (s.skipCards) {
    s.phase = 'command';
    pushLog(s, `—— 回合 ${s.turn} · 指令阶段 · 为灵兽下达指令 ——`, 'player', 'turn');
    return aiCommand(aiCastSkills(s));
  }

  // 先清空新抽牌标记,再抽牌:牌库为空或手牌已满时不会留下上一回合的旧标记,
  // 这样「没抽到牌」就不会误触发抽卡动画。
  s.lastDrawnCardId = null;
  drawCard(s, 'player');
  drawCard(s, 'enemy');

  // 抽卡阶段与执行阶段合并:出牌 + 下达指令在同一阶段完成
  s.phase = 'command';
  pushLog(s, `—— 回合 ${s.turn} · 执行阶段 · 出牌并下达指令 ——`, 'player', 'turn');
  return aiCommand(aiPlayCards(s));
}