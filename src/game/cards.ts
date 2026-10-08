import type { CardCategory, PieceType } from './types';

export type TargetKind = 'none' | 'enemy1' | 'enemy2' | 'ally1' | 'ally2' | 'enemyAlly' | 'cell';

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  cost: number;
  owner: PieceType;
  ownerName: string;
  desc: string;
  icon: string;
  target: { kind: TargetKind; count: number };
}

export const CARDS: CardDef[] = [
  // —— 攻击卡(消耗 1 点行动点)——
  { id: 'c_flame', name: '烈焰断魂', category: 'attack', cost: 1, owner: 'warrior', ownerName: '战士', desc: '对指定敌方目标造成 2 点伤害。', icon: 'ri-fire-fill', target: { kind: 'enemy1', count: 1 } },
  { id: 'c_double', name: '双击破阵', category: 'attack', cost: 1, owner: 'guardian', ownerName: '盾卫', desc: '对指定两个敌方目标各造成 1 点伤害。', icon: 'ri-sword-line', target: { kind: 'enemy2', count: 2 } },
  { id: 'c_arrow', name: '穿云箭雨', category: 'attack', cost: 1, owner: 'archer', ownerName: '弓箭', desc: '对敌方目标造成 3 点伤害,同时一名己方目标受 1 点伤害。', icon: 'ri-crosshair-2-line', target: { kind: 'enemyAlly', count: 2 } },
  { id: 'c_knock2', name: '灵力冲击', category: 'attack', cost: 1, owner: 'mage', ownerName: '法师', desc: '让指定敌方目标后退 2 格。', icon: 'ri-magic-line', target: { kind: 'enemy1', count: 1 } },
  { id: 'c_lock', name: '幽影封锁', category: 'attack', cost: 1, owner: 'guardian', ownerName: '盾卫', desc: '封锁两个敌方目标一回合,无法移动与攻击。', icon: 'ri-lock-2-line', target: { kind: 'enemy2', count: 2 } },
  { id: 'c_swap', name: '异位祈祷', category: 'attack', cost: 1, owner: 'priest', ownerName: '牧师', desc: '让指定两个敌方目标互换位置。', icon: 'ri-exchange-line', target: { kind: 'enemy2', count: 2 } },
  { id: 'c_zone', name: '骑士陷阵', category: 'attack', cost: 1, owner: 'mage', ownerName: '法师', desc: '选定 3×3 区域,持续 2 回合,每回合对其中敌方造成 1 点伤害。', icon: 'ri-tornado-line', target: { kind: 'cell', count: 1 } },
  { id: 'c_knock1', name: '轰天炮击', category: 'attack', cost: 1, owner: 'archer', ownerName: '弓箭', desc: '让指定两个敌方目标各后退 1 格。', icon: 'ri-rocket-line', target: { kind: 'enemy2', count: 2 } },

  // —— 辅助卡(消耗 0 点行动点)——
  { id: 'c_apup', name: '战意涌动', category: 'support', cost: 0, owner: 'warrior', ownerName: '战士', desc: '增加 1 点行动点。', icon: 'ri-flashlight-line', target: { kind: 'none', count: 0 } },
  { id: 'c_apdown', name: '干扰之音', category: 'support', cost: 0, owner: 'guardian', ownerName: '盾卫', desc: '减少对方 1 点行动点。', icon: 'ri-voice-recognition-line', target: { kind: 'none', count: 0 } },
  { id: 'c_block', name: '灵箭结界', category: 'support', cost: 0, owner: 'archer', ownerName: '弓箭', desc: '让己方 1 个目标抵挡下一次伤害。', icon: 'ri-shield-star-line', target: { kind: 'ally1', count: 1 } },
  { id: 'c_shield', name: '法术之盾', category: 'support', cost: 0, owner: 'mage', ownerName: '法师', desc: '让己方 2 个目标下次受到的伤害各 -1。', icon: 'ri-shield-flash-line', target: { kind: 'ally2', count: 2 } },
  { id: 'c_speed', name: '疾风奥义', category: 'support', cost: 0, owner: 'priest', ownerName: '牧师', desc: '让己方 1 个目标本回合移动距离 +2。', icon: 'ri-windy-line', target: { kind: 'ally1', count: 1 } },
  { id: 'c_rush', name: '神圣狂奔', category: 'support', cost: 0, owner: 'priest', ownerName: '牧师', desc: '让己方 2 个目标本回合无视移动与攻击限制。', icon: 'ri-run-line', target: { kind: 'ally2', count: 2 } },
  { id: 'c_charge', name: '骑兵冲刺', category: 'support', cost: 0, owner: 'warrior', ownerName: '战士', desc: '让己方 2 个目标本回合移动距离各 +1。', icon: 'ri-speed-up-line', target: { kind: 'ally2', count: 2 } },
  { id: 'c_iron', name: '钢铁意志', category: 'support', cost: 0, owner: 'priest', ownerName: '牧师', desc: '让己方 2 个目标无视持续性伤害 2 回合。', icon: 'ri-ancient-gate-line', target: { kind: 'ally2', count: 2 } },

  // —— 特殊卡(消耗 2 点行动点)——
  { id: 'c_shuffle', name: '空间乱流', category: 'special', cost: 2, owner: 'warrior', ownerName: '战士', desc: '让对方所有目标互相随机更换位置。', icon: 'ri-shuffle-line', target: { kind: 'none', count: 0 } },
  { id: 'c_heal', name: '生命祷歌', category: 'special', cost: 2, owner: 'guardian', ownerName: '盾卫', desc: '让己方所有目标各回复 1 点血量。', icon: 'ri-heart-pulse-line', target: { kind: 'none', count: 0 } },
  { id: 'c_rain', name: '灵箭骤雨', category: 'special', cost: 2, owner: 'archer', ownerName: '弓箭', desc: '让对方所有目标各随机受到 0-2 点伤害。', icon: 'ri-rainy-line', target: { kind: 'none', count: 0 } },
  { id: 'c_mana', name: '法力狂潮', category: 'special', cost: 2, owner: 'mage', ownerName: '法师', desc: '让己方随机 3 个目标各永久增加 1 点攻击力。', icon: 'ri-flood-line', target: { kind: 'none', count: 0 } },
];

export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c])
);

export type CardRarity = 'common' | 'rare' | 'legendary';

/** 稀有度:按消耗划分——0 普通 / 1 稀有 / 2 传说 */
export function cardRarity(id: string): CardRarity {
  const c = CARDS_BY_ID[id];
  if (!c) return 'common';
  if (c.cost >= 2) return 'legendary';
  if (c.cost >= 1) return 'rare';
  return 'common';
}

export const RARITY: Record<CardRarity, { label: string; stars: number }> = {
  common: { label: '普通', stars: 1 },
  rare: { label: '稀有', stars: 2 },
  legendary: { label: '传说', stars: 3 },
};