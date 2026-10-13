import type { CardDef } from '@/game/cards';
import type { CardCategory } from '@/game/types';
import { cardRarity, RARITY } from '@/game/cards';

interface Props {
  card: CardDef;
  onPlay: () => void;
  onCancel: () => void;
}

const tone = (c: CardCategory) =>
  c === 'attack'
    ? { bg: 'bg-secondary-500/10', text: 'text-secondary-300', border: 'border-secondary-500/40', label: '攻击' }
    : c === 'support'
    ? { bg: 'bg-accent-500/10', text: 'text-accent-300', border: 'border-accent-500/40', label: '辅助' }
    : { bg: 'bg-primary-500/10', text: 'text-primary-300', border: 'border-primary-500/40', label: '特殊' };

/** 屏幕中央卡牌详情:点击卡牌使用,点击其它区域取消 */
export default function CardCenterOverlay({ card, onPlay, onCancel }: Props) {
  const t = tone(card.category);
  const r = RARITY[cardRarity(card.id)];

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center" onClick={onCancel}>
      <div
        className="card-center-in relative flex flex-col items-center"
        style={{ width: 'min(76vw, 260px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 卡面 */}
        <button
          type="button"
          onClick={onPlay}
          className={`w-full rounded-2xl border-2 p-4 flex flex-col items-center text-left shadow-2xl cursor-pointer transition-transform active:scale-95 bg-background-50 ${t.border}`}
          style={{ aspectRatio: '3 / 4' }}
        >
          {/* 顶部:费用 + 类别 + 稀有度 */}
          <div className="w-full flex items-center justify-between">
            <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-background-200/80 text-primary-400 font-heading text-sm">
              {card.cost}
            </span>
            <span className="flex items-center gap-1">
              <span className={`font-label text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${t.border} ${t.text}`}>
                {t.label}
              </span>
              <span className="font-label text-[9px] px-1.5 py-0.5 rounded border border-primary-500/40 text-primary-300 whitespace-nowrap">
                {r.label}
              </span>
            </span>
          </div>

          {/* 图标 */}
          <div className={`w-20 h-20 shrink-0 my-4 flex items-center justify-center rounded-full border-2 ${t.border} bg-background-100 ${t.text}`}>
            <i className={`${card.icon} text-4xl w-9 h-9 flex items-center justify-center`}></i>
          </div>

          {/* 名称 */}
          <span className="font-heading text-lg text-foreground-950 text-center">{card.name}</span>

          {/* 技能描述 */}
          <p className="mt-3 text-xs text-foreground-700 leading-relaxed text-center">{card.desc}</p>

          {/* 归属 */}
          <div className="mt-auto pt-2 text-[10px] text-foreground-600 text-center">
            归属 · {card.ownerName}
          </div>
        </button>

        <span className="mt-3 font-label text-[10px] text-background-200">
          点击卡牌使用 · 点击空白处取消
        </span>
      </div>
    </div>
  );
}
