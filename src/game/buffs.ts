import type { Piece } from './types';

export type BuffTone = 'primary' | 'accent' | 'secondary';

export interface BuffInfo {
  key: string;
  icon: string;
  label: string;
  desc: string;
  count: number;
  tone: BuffTone;
}

export const BUFF_TONES: Record<BuffTone, { bg: string; border: string; text: string }> = {
  primary: { bg: 'bg-primary-500/25', border: 'border-primary-400/60', text: 'text-primary-300' },
  accent: { bg: 'bg-accent-500/25', border: 'border-accent-400/60', text: 'text-accent-300' },
  secondary: { bg: 'bg-secondary-500/25', border: 'border-secondary-400/60', text: 'text-secondary-300' },
};

/** 汇总棋子当前的 buff / debuff(带名称与说明,供棋盘图标与详情面板共用) */
export function getPieceBuffs(piece: Piece): BuffInfo[] {
  const list: BuffInfo[] = [];
  if (piece.stunned > 0) {
    list.push({ key: 'stun', icon: 'ri-lock-2-fill', label: '封锁', desc: `无法移动与攻击 · ${piece.stunned} 回合`, count: piece.stunned, tone: 'secondary' });
  }
  if (piece.shieldTurns > 0) {
    list.push({ key: 'inv', icon: 'ri-shield-fill', label: '无敌', desc: `完全免疫伤害 · ${piece.shieldTurns} 回合`, count: piece.shieldTurns, tone: 'primary' });
  }
  if (piece.blockHits > 0) {
    list.push({ key: 'block', icon: 'ri-shield-star-fill', label: '格挡', desc: `抵挡接下来 ${piece.blockHits} 次攻击`, count: piece.blockHits, tone: 'primary' });
  }
  if (piece.dmgReduction > 0) {
    list.push({ key: 'dmg', icon: 'ri-shield-flash-fill', label: '减伤', desc: `下次受到伤害 -${piece.dmgReduction}`, count: piece.dmgReduction, tone: 'accent' });
  }
  if (piece.dotImmunity > 0) {
    list.push({ key: 'dot', icon: 'ri-shield-cross-fill', label: '免疫', desc: `无视持续性伤害 · ${piece.dotImmunity} 回合`, count: piece.dotImmunity, tone: 'accent' });
  }
  if (piece.bonusMove > 0) {
    list.push({ key: 'move', icon: 'ri-run-fill', label: '移速', desc: `本回合移动距离 +${piece.bonusMove}`, count: piece.bonusMove, tone: 'accent' });
  }
  if (piece.bonusAtk > 0) {
    list.push({ key: 'atk', icon: 'ri-sword-fill', label: '攻击', desc: `攻击力 +${piece.bonusAtk}`, count: piece.bonusAtk, tone: 'primary' });
  }
  if (piece.tempAtk > 0) {
    list.push({ key: 'atkTemp', icon: 'ri-sword-fill', label: '攻击', desc: `本回合攻击力 +${piece.tempAtk}`, count: piece.tempAtk, tone: 'accent' });
  }
  return list;
}
