import { useEffect, type CSSProperties } from 'react';
import type { CardCategory } from '@/game/types';
import { CARDS_BY_ID, cardRarity, RARITY, type CardRarity } from '@/game/cards';

interface Props {
  cardId: string;
  /** 抽走这张牌后,玩家牌库剩余数量 */
  deckLeft: number;
  onDone: () => void;
}

const catTone: Record<CardCategory, { text: string; border: string; bg: string; label: string }> = {
  attack: { text: 'text-secondary-300', border: 'border-secondary-500/50', bg: 'bg-secondary-500/10', label: '攻击' },
  support: { text: 'text-accent-300', border: 'border-accent-500/50', bg: 'bg-accent-500/10', label: '辅助' },
  special: { text: 'text-primary-300', border: 'border-primary-500/50', bg: 'bg-primary-500/10', label: '特殊' },
};

/** 稀有度配色:普通低调 / 稀有青色 / 传说金焰 */
const rarityTone: Record<CardRarity, { text: string; border: string; ray: string; glow: string }> = {
  common: { text: 'text-foreground-800', border: 'border-background-400/70', ray: 'oklch(var(--foreground-500))', glow: 'bg-foreground-500/10' },
  rare: { text: 'text-accent-200', border: 'border-accent-400/70', ray: 'oklch(var(--accent-400))', glow: 'bg-accent-500/15' },
  legendary: { text: 'text-primary-200', border: 'border-primary-400/80', ray: 'oklch(var(--primary-400))', glow: 'bg-primary-500/25' },
};

export default function DrawReveal({ cardId, deckLeft, onDone }: Props) {
  const c = CARDS_BY_ID[cardId];
  const rarity: CardRarity = c ? cardRarity(cardId) : 'common';

  useEffect(() => {
    const t = window.setTimeout(onDone, rarity === 'legendary' ? 2350 : 1900);
    return () => window.clearTimeout(t);
  }, [cardId, rarity, onDone]);

  if (!c) return null;
  const t = catTone[c.category];
  const rt = rarityTone[rarity];
  const info = RARITY[rarity];
  const sparkCount = rarity === 'legendary' ? 9 : rarity === 'rare' ? 5 : 0;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none">
      {/* 传说卡:全屏金光一闪 */}
      {rarity === 'legendary' && <div className="absolute inset-0 rarity-flash bg-primary-500/25"></div>}

      <div className={`absolute w-72 h-72 rounded-full blur-2xl draw-glow ${rt.glow}`}></div>

      <div className="relative flex items-center justify-center">
        {/* 稀有度光环:缓慢旋转 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rarity-rays w-80 h-80 rounded-full" style={{ '--rc': rt.ray } as CSSProperties}></div>
        </div>
        {/* 迸发环 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`rarity-burst w-72 h-72 rounded-full border-2 ${rt.border}`}></span>
        </div>
        {/* 火花四射 */}
        {Array.from({ length: sparkCount }).map((_, i) => {
          const a = (i / sparkCount) * Math.PI * 2;
          const dist = 110 + (i % 3) * 24;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full rarity-spark"
              style={{
                background: rt.ray,
                animationDelay: `${i * 45}ms`,
                '--sx': `${Math.cos(a) * dist}px`,
                '--sy': `${Math.sin(a) * dist}px`,
              } as CSSProperties}
            ></span>
          );
        })}

        <div className="relative draw-flip">
          <div className="font-label text-[11px] text-primary-300 text-center mb-3 tracking-[0.3em]">抽 到 新 卡 牌</div>

          <div className={`rune-border rounded-lg p-4 w-72 ${t.bg}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-14 h-14 shrink-0 flex items-center justify-center rounded-md border ${t.border} ${t.text}`}>
                <i className={`${c.icon} text-3xl w-8 h-8 flex items-center justify-center`}></i>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-lg text-foreground-950 truncate">{c.name}</span>
                  <span className={`shrink-0 font-label text-[9px] px-1.5 py-0.5 rounded border ${t.border} ${t.text}`}>{t.label}</span>
                </div>
                <div className="text-[10px] text-foreground-600 mt-0.5">消耗 {c.cost} 行动点 · {c.ownerName}</div>
              </div>
            </div>

            {/* 稀有度标签 + 星级 */}
            <div className="flex items-center justify-between mb-2">
              <span className={`font-label text-[10px] px-2 py-0.5 rounded-full border ${rt.border} ${rt.text}`}>{info.label}</span>
              <span className={`text-sm leading-none tracking-widest ${rt.text}`}>{'★'.repeat(info.stars)}</span>
            </div>

            <p className="text-xs text-foreground-700 leading-relaxed">{c.desc}</p>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 font-label text-[11px] text-foreground-600">
            <i className="ri-stack-line w-4 h-4 flex items-center justify-center text-primary-300"></i>
            牌库剩余 <span className="font-heading text-primary-300">{deckLeft}</span> 张
          </div>
        </div>
      </div>
    </div>
  );
}