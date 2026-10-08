import type { PieceType } from './types';

export interface BeastDef {
  type: PieceType;
  name: string;
  en: string;
  hp: number;
  atk: number;
  range: number;
  move: number;
  heal: number;
  icon: string;
  role: string;
  skill: string;
}

export const BEASTS: Record<PieceType, BeastDef> = {
  warrior: {
    type: 'warrior', name: '战士', en: 'Warrior', hp: 6, atk: 1, range: 1, move: 3, heal: 0,
    icon: 'ri-sword-fill', role: '近战 · 前排', skill: '近战搏杀',
  },
  guardian: {
    type: 'guardian', name: '盾卫', en: 'Guardian', hp: 7, atk: 1, range: 1, move: 2, heal: 0,
    icon: 'ri-shield-fill', role: '坦克 · 护卫', skill: '铁壁护卫',
  },
  archer: {
    type: 'archer', name: '弓箭', en: 'Archer', hp: 4, atk: 1, range: 2, move: 4, heal: 0,
    icon: 'ri-crosshair-line', role: '远程 · 点杀', skill: '远程狙杀',
  },
  mage: {
    type: 'mage', name: '法师', en: 'Mage', hp: 4, atk: 1, range: 2, move: 4, heal: 0,
    icon: 'ri-magic-line', role: '远程 · 控场', skill: '法术压制',
  },
  priest: {
    type: 'priest', name: '牧师', en: 'Priest', hp: 5, atk: 0, range: 2, move: 2, heal: 1,
    icon: 'ri-hand-heart-line', role: '辅助 · 治疗', skill: '治愈之光',
  },
};