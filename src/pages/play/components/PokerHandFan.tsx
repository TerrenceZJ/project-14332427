import type { GameState, CardCategory } from '@/game/types';
import { CARDS_BY_ID } from '@/game/cards';

interface Props {
  state: GameState;
  onSelectCard: (id: string) => void;
}

const tone = (c: CardCategory) =>
  c === 'attack'
    ? { bg: 'bg-secondary-500/10', text: 'text-secondary-300', border: 'border-secondary-500/40', label: '攻击' }
    : c === 'support'
    ? { bg: 'bg-accent-500/10', text: 'text-accent-300', border: 'border-accent-500/40', label: '辅助' }
    : { bg: 'bg-primary-500/10', text: 'text-primary-300', border: 'border-primary-500/40', label: '特殊' };

/** 扑克牌式扇形手牌:从底部中心向两侧甩开,点击一张进入详情 */
export default function PokerHandFan({ state, onSelectCard }: Props) {
  const canPlay = state.phase === 'card1';
  const cards = state.hand.map((id) => CARDS_BY_ID[id]).filter(Boolean);
  const n = cards.length;
  const center = (n - 1) / 2;
  const SPACING = 46;
  const ANGLE = 6;

  if (n === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-foreground-600 text-center leading-relaxed px-4">
          {canPlay ? '手牌为空。每回合开始自动抽 1 张卡牌。' : '当前阶段无可用手牌。'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {cards.map((c, i) => {
        const offset = i - center;
        const x = offset * SPACING;
        const y = Math.abs(offset) * 4;
        const rot = offset * ANGLE;
        const t = tone(c.category);
        const usable = canPlay && state.ap >= c.cost;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => usable && onSelectCard(c.id)}
            className={`card-fan absolute rounded-xl border p-2 flex flex-col items-center text-left shadow-lg backdrop-blur-sm ${
              usable ? 'cursor-pointer' : 'cursor-not-allowed'
            } ${usable ? `${t.bg} ${t.border} hover:border-primary-400` : 'border-background-300 bg-background-100 opacity-60 grayscale'}`}
            style={{
              left: '50%',
              bottom: '16px',
              width: '108px',
              height: '152px',
              zIndex: 10 + i,
              transformOrigin: 'bottom center',
              ['--fan-x' as string]: `${x}px`,
              ['--fan-y' as string]: `${y}px`,
              ['--fan-rot' as string]: `${rot}deg`,
              animationDelay: `${i * 45}ms`,
            }}
          >
            {/* 顶部:费用 + 类别 */}
            <div className="w-full flex items-center justify-between">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background-200/80 text-primary-400 font-heading text-[11px]">
                {c.cost}
              </span>
              <span className={`font-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap ${t.border} ${t.text}`}>
                {t.label}
              </span>
            </div>

            {/* 图标 */}
            <div className={`w-12 h-12 shrink-0 my-2 flex items-center justify-center rounded-full border ${t.border} ${t.bg} ${t.text}`}>
              <i className={`${c.icon} text-2xl w-6 h-6 flex items-center justify-center`}></i>
            </div>

            {/* 名称 */}
            <span className="font-heading text-[12px] text-foreground-950 leading-tight line-clamp-2 text-center">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
