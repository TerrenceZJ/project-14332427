import type { GameState, Piece, PieceType, Team, Mode, TurnEvent, TurnFrame, Pt, LogSegment, AutoCommandStyle } from './types';
import { BEASTS } from './beasts';
import { COLS, ROWS, MID, START_AP, MAX_TURNS, HAND_SIZE, MAX_HAND, LINEUP_SIZE, key, inBounds, dist, manhattan, cellName } from './constants';
import { CARDS, CARDS_BY_ID } from './cards';
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
    mode: 'attack', path: [], attackTarget: undefined, healTarget: undefined, acted: false, revealed: team === 'player',
    stunned: 0, blockHits: 0, dmgReduction: 0, bonusMove: 0, bonusAtk: 0, dotImmunity: 0,
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

/** 刷新"曾被看见"标记:当前处于玩家视野内的敌方棋子永久标记为已知 */
function markRevealed(s: GameState) {
  const vis = visibleKeys(s);
  for (const p of s.pieces) {
    if (p.team !== 'enemy' || !p.alive || !p.placed) continue;
    if (vis.has(key(p.x, p.y))) p.revealed = true;
  }
}

export function createGame(): GameState {
  return {
    phase: 'deploy', turn: 0, pieces: [], vision: [], ap: START_AP, enemyAp: START_AP,
    deck: shuffle(CARDS.map((c) => c.id)),
    hand: [],
    lastDrawnCardId: null,
    lineup: [],
    enemyDeck: shuffle(CARDS.map((c) => c.id)),
    enemyHand: [],
    dotZones: [],
    winner: null, selectedId: null,
    deployTrail: [],
    log: [{ id: ++logSeq, text: `准备阶段:从卡组中挑选 ${LINEUP_SIZE} 张卡牌出战,每张卡召唤一只对应种族的灵兽。`, team: 'player', kind: 'turn' }],
  };
}

/** 从卡池里均衡地挑出一套阵容(每个种族取 1 张,不足再随机补足) */
function pickBalancedLineup(pool: string[]): string[] {
  const races: PieceType[] = ['warrior', 'guardian', 'archer', 'mage', 'priest'];
  const picked: string[] = [];
  for (const race of races) {
    const arr = shuffle(pool.filter((id) => CARDS_BY_ID[id]?.owner === race));
    picked.push(...arr.slice(0, 1));
  }
  if (picked.length < LINEUP_SIZE) {
    const rest = shuffle(pool.filter((id) => !picked.includes(id)));
    picked.push(...rest.slice(0, LINEUP_SIZE - picked.length));
  }
  return picked.slice(0, LINEUP_SIZE);
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
    if (s.lineup.length >= LINEUP_SIZE) return state;
    s.lineup = [...s.lineup, cardId];
    s.pieces = [...s.pieces, makePiece(card.owner, 'player', cardId)];
  }
  return s;
}

/** 部署阶段:一键挑出一套均衡阵容 */
export function randomLineup(state: GameState): GameState {
  if (state.phase !== 'deploy') return state;
  const picked = pickBalancedLineup(state.deck);
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
  if (y < MID || y >= ROWS) return state;
  if (x < 0 || x >= COLS) return state;
  if (at(state, x, y)) return state;
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
  if (y < MID || y >= ROWS) return state;
  if (x < 0 || x >= COLS) return state;
  if (at(state, x, y)) return state;
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
  for (let y = MID + 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) slots.push({ x, y });
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

/** 直接伤害结算(无视防御,尊重无敌/格挡/减伤) */
function dealDirectDamage(s: GameState, p: Piece, amount: number, events?: TurnEvent[]) {
  if (!p.alive) return;
  if (p.shieldTurns > 0) {
    if (events) events.push({ type: 'shield', x: p.x, y: p.y, text: '无敌' });
    return;
  }
  if (p.blockHits > 0) {
    p.blockHits -= 1;
    if (events) events.push({ type: 'shield', x: p.x, y: p.y, text: '格挡' });
    return;
  }
  let amt = amount;
  if (p.dmgReduction > 0) {
    amt = Math.max(0, amt - p.dmgReduction);
    p.dmgReduction = 0;
  }
  if (amt <= 0) return;
  p.hp -= amt;
  if (events) events.push({ type: 'attack', x: p.x, y: p.y, amount: amt });
  if (p.hp <= 0) resolveDeath(s, p, events || []);
}

/** 击退:朝己方底线方向后退 steps 格 */
function knockback(s: GameState, p: Piece, steps: number) {
  const dir = p.y < MID ? -1 : 1;
  let cy = p.y;
  for (let i = 0; i < steps; i++) {
    const ny = cy + dir;
    if (!inBounds(p.x, ny)) break;
    if (at(s, p.x, ny)) break;
    cy = ny;
  }
  if (cy !== p.y) p.y = cy;
}

function shufflePositions(s: GameState, pieces: Piece[]) {
  const positions = shuffle(pieces.map((p) => ({ x: p.x, y: p.y })));
  pieces.forEach((p, i) => { p.x = positions[i].x; p.y = positions[i].y; });
}

function applyCardEffect(s: GameState, cardId: string, caster: Team, targets: { pieceIds: string[]; cell?: Pt }) {
  const byId = (id: string) => s.pieces.find((p) => p.id === id);

  /** 结算一次法术伤害并记录日志(按实际扣血计数) */
  const hit = (t: Piece | undefined, amount: number, label: string) => {
    if (!t) return;
    const before = t.hp;
    dealDirectDamage(s, t, amount);
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
      hit(byId(targets.pieceIds[1]), 1, '灵箭溅射伤害');
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
      if (caster === 'player') s.enemyAp = Math.max(0, s.enemyAp - 1); else s.ap = Math.max(0, s.ap - 1);
      pushLog(s, [
        { text: caster === 'player' ? '敌方' : '你', team: caster === 'player' ? 'enemy' : 'player' },
        { text: ' 的行动点 -1。' },
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
          t.bonusMove += 2;
          pushLog(s, [
            ...pieceRef(t),
            { text: ' 移动力 +2(本回合)。' },
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
        p.bonusAtk += 1;
        pushLog(s, [
          ...pieceRef(p),
          { text: ' 获得法力灌注,攻击力 +1。' },
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

export function startBattle(state: GameState): GameState {
  if (state.phase !== 'deploy') return state;
  const mine = state.pieces.filter((p) => p.team === 'player');
  if (state.lineup.length !== LINEUP_SIZE || mine.length !== LINEUP_SIZE) return state;
  if (mine.some((p) => !p.placed)) return state;

  const s = clone(state);
  const myPieces = s.pieces.filter((p) => p.team === 'player');
  if (!myPieces.some((p) => p.isLord)) myPieces[0].isLord = true;

  // 敌方阵容:同样从卡池里挑 10 张献祭成灵兽
  const aiLineup = pickBalancedLineup(s.enemyDeck);
  s.enemyDeck = s.enemyDeck.filter((id) => !aiLineup.includes(id));
  const enemyPieces = aiLineup.map((id) => makePiece(CARDS_BY_ID[id].owner, 'enemy', id));
  s.pieces = [...myPieces, ...enemyPieces];

  // 玩家牌库 = 20 张卡池扣掉"献祭"掉的 10 张
  s.deck = s.deck.filter((id) => !s.lineup.includes(id));

  aiDeploy(s);
  s.phase = 'card1';
  s.turn = 1;
  s.ap = START_AP;
  s.enemyAp = START_AP;
  s.dotZones = [];
  s.selectedId = null;
  s.vision = [...visibleKeys(s)];
  markRevealed(s);

  for (let i = 0; i < HAND_SIZE; i++) {
    drawCard(s, 'player');
    drawCard(s, 'enemy');
  }
  // 开局发牌不触发抽卡动画,清空新抽牌标记
  s.lastDrawnCardId = null;

  pushLog(s, '—— 回合 1 · 抽卡阶段 ——', 'player', 'turn');
  return aiPlayCards(s);
}

export function selectPiece(state: GameState, id: string | null): GameState {
  return { ...state, selectedId: id };
}

/** 尝试把一个新的转角格加入棋子路径,返回新的完整路径;非法则返回 null */
function extendPath(p: Piece, waypoint: Pt): Pt[] | null {
  const anchor = p.path.length ? p.path[p.path.length - 1] : { x: p.x, y: p.y };
  if (waypoint.x === anchor.x && waypoint.y === anchor.y) return null;
  if (waypoint.x !== anchor.x && waypoint.y !== anchor.y) return null;
  if (!inBounds(waypoint.x, waypoint.y)) return null;
  const segment = manhattan(anchor.x, anchor.y, waypoint.x, waypoint.y);
  if (p.path.length + segment > p.move + p.bonusMove) return null;
  const steps: Pt[] = [...p.path];
  let cx = anchor.x;
  let cy = anchor.y;
  while (cx !== waypoint.x || cy !== waypoint.y) {
    cx += Math.sign(waypoint.x - cx);
    cy += Math.sign(waypoint.y - cy);
    steps.push({ x: cx, y: cy });
  }
  return steps;
}

export function command(
  state: GameState,
  pieceId: string,
  patch: { waypoint?: { x: number; y: number }; clearPath?: boolean; confirm?: boolean; mode?: Mode; undoStep?: boolean; setAttackTarget?: string; setHealTarget?: string }
): GameState {
  if (state.phase !== 'command') return state;
  const s = clone(state);
  const p = s.pieces.find((q) => q.id === pieceId);
  if (!p || p.team !== 'player' || !p.alive || !p.placed) return state;

  // 已下令的棋子在本回合锁定指令,不可再修改
  if (p.acted) return state;

  // 结算指令消耗:基础 1 点;侦察姿态额外多消耗 1 点
  const charge = (cost: number) => {
    if (s.ap < cost) return false;
    s.ap -= cost;
    p.acted = true;
    return true;
  };

  // 添加转角格:仅规划折角路径(草稿),不消耗行动点
  if (patch.waypoint) {
    const next = extendPath(p, patch.waypoint);
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
  // 侦察姿态额外多消耗 1 点行动点,行动点不足时无法确认
  if (patch.confirm) {
    const cost = p.mode === 'scout' ? 2 : 1;
    if (!charge(cost)) return state;
    return s;
  }

  // 取消移动:清除草稿路径
  if (patch.clearPath) {
    p.path = [];
    return s;
  }

  // 切换行动模式(攻击 / 防御 / 侦察):仅记录状态,不消耗行动点、不结束行动
  if (patch.mode !== undefined) {
    p.mode = patch.mode;
    return s;
  }

  // 设置攻击目标
  if (patch.setAttackTarget !== undefined) {
    p.attackTarget = patch.setAttackTarget || undefined;
    return s;
  }

  // 设置治疗目标
  if (patch.setHealTarget !== undefined) {
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

  let ap = s.ap;
  for (const a of allies) {
    if (a.acted || a.mode === 'defend') continue;
    if (ap < 1) continue;

    ap -= 1;
    const budget = a.move + a.bonusMove;

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
      const inRange = best ? dist(a.x, a.y, best.x, best.y) <= a.range : false;
      const canReach = best ? dist(a.x, a.y, best.x, best.y) <= budget + a.range : false;
      if (inRange) {
        a.path = [];
        a.mode = 'attack';
        if (best) a.attackTarget = best.id;
      } else if (canReach) {
        a.path = planPath(a, best!, s, budget);
        a.mode = 'attack';
        if (best) a.attackTarget = best.id;
      } else {
        a.path = planPath(a, { x: a.x, y: ROWS - 1 }, s, budget);
        a.mode = 'defend';
        a.attackTarget = undefined;
      }
      a.acted = true;
      continue;
    }

    // aggressive / focusLord:主动压上
    if (best) {
      const d = dist(a.x, a.y, best.x, best.y);
      a.path = d > a.range ? planPath(a, best, s, budget) : [];
      a.attackTarget = best.id;
    } else if (style === 'focusLord') {
      a.path = planPath(a, { x: Math.floor(COLS / 2), y: 0 }, s, budget);
      a.attackTarget = undefined;
    } else {
      a.path = planPath(a, { x: a.x, y: 0 }, s, budget);
      a.attackTarget = undefined;
    }
    a.mode = 'attack';
    a.acted = true;
  }
  s.ap = ap;
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
  const remaining = p.move + p.bonusMove - p.path.length;
  if (remaining <= 0) return set;
  const anchor = p.path.length ? p.path[p.path.length - 1] : { x: p.x, y: p.y };
  const others = s.pieces.filter((q) => q.id !== p.id);
  for (let dx = -remaining; dx <= remaining; dx++) {
    if (dx === 0) continue;
    const nx = anchor.x + dx;
    const ny = anchor.y;
    if (!inBounds(nx, ny)) continue;
    if (isCommandOccupied(others, nx, ny)) continue;
    set.add(key(nx, ny));
  }
  for (let dy = -remaining; dy <= remaining; dy++) {
    if (dy === 0) continue;
    const nx = anchor.x;
    const ny = anchor.y + dy;
    if (!inBounds(nx, ny)) continue;
    if (isCommandOccupied(others, nx, ny)) continue;
    set.add(key(nx, ny));
  }
  return set;
}

export { legalMoves };

/** 推进阶段:card1 → command(含 AI 下指令)→ card2 */
export function advancePhase(state: GameState): GameState {
  if (state.phase === 'card1') {
    let s = aiCommand(state);
    s = { ...s, phase: 'command' as const, selectedId: null };
    pushLog(s, '—— 指令阶段 · 为灵兽下达指令 ——', 'player', 'turn');
    return s;
  }
  if (state.phase === 'command') {
    const s = clone(state);
    // 丢弃未确认的草稿移动路径(未点「确认移动」的移动不生效)
    s.pieces.forEach((p) => {
      if (p.team === 'player' && !p.acted) p.path = [];
    });
    s.phase = 'card2';
    s.selectedId = null;
    pushLog(s, '—— 援救阶段 ——', 'player', 'turn');
    return s;
  }
  return state;
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

  // 0) 战前宣告:封锁 / 防御姿态 / 侦察结果
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
  // 侦察结果:玩家的侦察姿态棋子报告所见
  for (const p of s.pieces) {
    if (p.team !== 'player' || !p.alive || !p.placed || p.mode !== 'scout') continue;
    const found = s.pieces.filter(
      (e) => e.team === 'enemy' && e.alive && e.placed && dist(p.x, p.y, e.x, e.y) <= 2
    );
    if (found.length === 0) {
      pushLog(s, [
      ...pieceRef(p),
      { text: ' 展开侦察,周围未见敌踪。' },
      ], 'player', 'info');
      continue;
    }
    const segs: LogSegment[] = [...pieceRef(p), { text: ' 展开侦察,发现 ' }];
    found.forEach((e, i) => {
      if (i > 0) segs.push({ text: '、' });
      segs.push({ text: BEASTS[e.type].name, team: 'enemy' });
    });
    segs.push({ text: '。' });
    pushLog(s, segs, 'player', 'info');
  }

  // 帧 0:执行开始,定格原始站位(含战前宣告信息)
  pushFrame(700);

  // 1) 同时移动(被封锁棋子不动),沿各自路径按格逐步推进
  const movers = s.pieces
    .filter((p) => p.alive && p.placed && p.stunned <= 0 && p.acted && p.path.length > 0)
    .map((p) => ({ p, idx: 0, stopped: false }));

  const maxStep = movers.reduce((mx, m) => Math.max(mx, m.p.path.length), 0);

  for (let step = 0; step < maxStep; step++) {
    let moved = false;
    const claims = new Map<string, { m: (typeof movers)[number]; x: number; y: number }[]>();
    for (const m of movers) {
      if (m.stopped || m.idx >= m.p.path.length) continue;
      const next = m.p.path[m.idx];
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
    pushFrame(moved ? 750 : 0);
  }

  // 二次判定:所有棋子移动结束后,原本被堵的棋子若前方已空出,可继续前往目标位置
  // 处理「挡路的相邻棋子本回合移开后,被堵棋子仍能抵达目的地」的特殊情况
  for (let round = 0; round < COLS + ROWS; round++) {
    const retry = new Map<string, { m: (typeof movers)[number]; x: number; y: number }[]>();
    for (const m of movers) {
      if (!m.stopped || m.idx >= m.p.path.length) continue;
      const next = m.p.path[m.idx];
      if (at(s, next.x, next.y)) continue;
      const k = key(next.x, next.y);
      const list = retry.get(k) || [];
      list.push({ m, x: next.x, y: next.y });
      retry.set(k, list);
    }
    if (retry.size === 0) break;
    let moved = false;
    const stepMoves: { p: Piece; from: Pt }[] = [];
    for (const list of retry.values()) {
      const winner = list[Math.floor(Math.random() * list.length)];
      for (const item of list) {
        if (item === winner) {
          const from = { x: item.m.p.x, y: item.m.p.y };
          item.m.p.x = item.x;
          item.m.p.y = item.y;
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
      pushFrame(750);
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

  // 2) 计算攻击 / 治疗(被封锁棋子跳过)
  const dmg = new Map<string, number>();
  const heals = new Map<string, number>();
  const attackEvents: TurnEvent[] = [];
  const healEvents: TurnEvent[] = [];
  for (const p of s.pieces) {
    if (!p.alive || !p.placed || p.mode === 'defend' || p.stunned > 0) continue;
    if (p.atk <= 0) {
      if (p.heal > 0) {
        let t: Piece | undefined;
        if (p.team === 'player' && p.healTarget) {
          t = s.pieces.find((o) => o.id === p.healTarget && o.alive && o.placed && o.team === p.team && dist(p.x, p.y, o.x, o.y) <= p.range);
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
    const effAtk = p.atk + p.bonusAtk;
    let t: Piece | undefined;
    if (p.team === 'player' && p.attackTarget) {
      t = s.pieces.find((o) => o.id === p.attackTarget && o.alive && o.placed && o.team !== p.team && dist(p.x, p.y, o.x, o.y) <= p.range);
    } else {
      const enemies = s.pieces
        .filter((o) => o.alive && o.placed && o.team !== p.team && dist(p.x, p.y, o.x, o.y) <= p.range)
        .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y) || a.hp - b.hp);
      t = enemies[0];
    }
    if (!t) continue;
    // 无敌护盾:完全免疫
    if (t.shieldTurns > 0) {
      attackEvents.push({ type: 'shield', x: t.x, y: t.y, text: '无敌' });
      continue;
    }
    // 格挡:抵挡本次攻击
    if (t.blockHits > 0) {
      t.blockHits -= 1;
      attackEvents.push({ type: 'shield', x: t.x, y: t.y, text: '格挡' });
      continue;
    }
    let amount = effAtk;
    const notes: string[] = [];
    // 防御姿态:减免 1 点
    if (t.mode === 'defend') {
      amount = Math.max(0, amount - 1);
      notes.push('防御姿态减免 1 点');
    }
    // 护盾:一次性减伤
    if (t.dmgReduction > 0 && amount > 0) {
      const absorbed = Math.min(amount, t.dmgReduction);
      amount -= absorbed;
      t.dmgReduction = 0;
      notes.push(`护盾吸收 ${absorbed} 点`);
    }
    // 伤害被完全抵消
    if (amount <= 0) {
      continue;
    }
    dmg.set(t.id, (dmg.get(t.id) || 0) + amount);
    attackEvents.push({ type: 'attack', x: t.x, y: t.y, fx: p.x, fy: p.y, amount });
  }

  // 3) 先结算治疗(保留「先治疗、后受伤」的原有语义)
  if (healEvents.length > 0) {
    for (const p of s.pieces) {
      if (!p.alive) continue;
      const h = heals.get(p.id);
      if (h) p.hp = Math.min(p.maxHp, p.hp + h);
    }
    pushFrame(1300, healEvents);
  }

  // 4) 攻击动画帧(2秒)
  if (attackEvents.length > 0) {
    pushFrame(2000, attackEvents);
  }

  // 5) 伤害数字帧
  const damageEvents: TurnEvent[] = [];
  for (const p of s.pieces) {
    if (!p.alive) continue;
    const d = dmg.get(p.id);
    if (d) {
      damageEvents.push({ type: 'attack', x: p.x, y: p.y, amount: d });
    }
  }
  if (damageEvents.length > 0) {
    pushFrame(100, damageEvents);
  }

  // 6) 死亡帧
  const deathEvents: TurnEvent[] = [];
  for (const p of s.pieces) {
    if (!p.alive) continue;
    const d = dmg.get(p.id);
    if (d) dealDirectDamage(s, p, d, deathEvents);
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
  const pLord = s.pieces.find((p) => p.team === 'player' && p.isLord);
  const eLord = s.pieces.find((p) => p.team === 'enemy' && p.isLord);
  if (!pLord || !pLord.alive) {
    s.winner = 'enemy'; s.phase = 'gameover';
    pushLog(s, '你的灵主已陨落…… 战败。', 'enemy', 'death');
  } else if (!eLord || !eLord.alive) {
    s.winner = 'player'; s.phase = 'gameover';
    pushLog(s, '敌方灵主陨落!你赢得了圣战!', 'player', 'death');
  } else {
    s.phase = 'execute';
  }

  // 末帧:定格结算后的最终局面
  pushFrame(1100);

  return frames;
}

function resolveDeath(s: GameState, p: Piece, events: TurnEvent[]) {
  if (p.isLord && !p.revived) {
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
  s.pieces.forEach((p) => {
    if (!p.alive) return;
    p.acted = false; p.path = []; p.mode = 'attack';
    p.attackTarget = undefined; p.healTarget = undefined;
    p.bonusMove = 0;
  });
  s.pieces.forEach((p) => {
    if (!p.alive) return;
    if (p.stunned > 0) p.stunned -= 1;
    if (p.dotImmunity > 0) p.dotImmunity -= 1;
  });
  s.dotZones = s.dotZones.map((z) => ({ ...z, turns: z.turns - 1 })).filter((z) => z.turns > 0);

  // 先清空新抽牌标记,再抽牌:牌库为空或手牌已满时不会留下上一回合的旧标记,
  // 这样「没抽到牌」就不会误触发抽卡动画。
  s.lastDrawnCardId = null;
  drawCard(s, 'player');
  drawCard(s, 'enemy');

  s.selectedId = null;
  s.phase = 'card1';
  pushLog(s, `—— 回合 ${s.turn} · 抽卡阶段 ——`, 'player', 'turn');
  return aiPlayCards(s);
}