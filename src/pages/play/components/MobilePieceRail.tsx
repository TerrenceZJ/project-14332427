import { useRef } from 'react';
import type { GameState, CardCategory } from '@/game/types';
import { CARDS_BY_ID } from '@/game/cards';
import { BEASTS } from '@/game/beasts';
import { LINEUP_SIZE } from '@/game/constants';
import { useDragScroll } from '@/hooks/useDragScroll';

interface Props {
  state: GameState;
  onSelect: (id: string | null) => void;
  onUnplace: (id: string) => void;
  onMakeLord: (id: string) => void;
  onRandomize: () => void;
  onReopenSummon: () => void;
}

const META: Record<CardCategory, { label: string; text: string; bg: string; border: string }> = {
  attack: { label: '攻击', text: 'text-secondary-300', bg: 'bg-secondary-500/10', border: 'border-secondary-500/40' },
  support: { label: '辅助', text: 'text-accent-300', bg: 'bg-accent-500/10', border: 'border-accent-500/40' },
  special: { label: '特殊', text: 'text-primary-300', bg: 'bg-primary-500/10', border: 'border-primary-500/40' },
};

/** 移动端布阵 · 灵兽棋子横滑轨道:点击 / 鼠标拖拽 / 触屏滑动选择 */
export default function MobilePieceRail({
  state,
  onSelect,
  onUnplace,
  onMakeLord,
  onRandomize,
  onReopenSummon,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const { dragging, consumeClickSuppression, handlers } = useDragScroll<HTMLDivElement>(railRef);

  const mine = state.pieces.filter((p) => p.team === 'player');
  const placedCount = mine.filter((p) => p.placed).length;
  const selected = mine.find((p) => p.id === state.selectedId) || null;

  if (mine.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
        <i className="ri-ghost-2-line text-2xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
        <p className="text-xs text-foreground-600 leading-relaxed">
          尚未召唤灵兽。
          <br />
          请先在「召唤出战卡牌」中挑选卡牌。
        </p>
        <button
          onClick={onReopenSummon}
          className="mt-1 px-4 py-2 rounded-md text-xs border border-primary-400/60 text-primary-300 hover:bg-primary-500/10 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
        >
          <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
          重新召唤
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 棋子横滑轨道 */}
      <div
        ref={railRef}
        {...handlers}
        className={`flex-1 min-h-0 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          dragging ? 'snap-none cursor-grabbing select-none' : 'snap-x snap-mandatory cursor-grab'
        }`}
      >
        {mine.map((p) => {
          const card = p.fromCard ? CARDS_BY_ID[p.fromCard] : null;
          const def = BEASTS[p.type];
          const st = META[card?.category ?? 'special'];
          const sel = p.id === state.selectedId;
          const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp));
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (consumeClickSuppression()) return;
                onSelect(sel ? null : p.id);
              }}
              className={`relative shrink-0 snap-center w-[118px] h-full rounded-lg border p-2.5 flex flex-col items-center text-center transition-all cursor-pointer ${
                sel
                  ? 'border-primary-500 bg-primary-500/15'
                  : p.placed
                  ? 'border-background-300 bg-background-100 hover:border-primary-400'
                  : 'border-background-300 bg-background-100 hover:border-accent-400'
              }`}
            >
              {/* 顶部:类别 + 状态 */}
              <div className="w-full flex items-center justify-between mb-1.5">
                <span className={`font-label text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${st.text} ${st.border} ${st.bg}`}>
                  {st.label}
                </span>
                {p.isLord ? (
                  <i className="ri-vip-crown-fill text-primary-400 w-3.5 h-3.5 flex items-center justify-center"></i>
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${p.placed ? 'bg-primary-400' : 'bg-background-400/70'}`}
                  ></span>
                )}
              </div>

              {/* 图标 */}
              <div
                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full border ${
                  sel ? 'border-primary-400 bg-primary-500/15' : 'border-background-300 bg-background-200'
                } ${st.text}`}
              >
                <i className={`${card?.icon ?? def.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
              </div>

              {/* 种族(突出) */}
              <span className="font-heading text-[13px] text-foreground-950 leading-tight mt-1.5 truncate w-full">
                {def.name}
              </span>
              {/* 卡牌名称(弱化) */}
              <span className="text-[10px] text-foreground-600 leading-tight truncate w-full mt-0.5">
                {card?.name ?? def.name}
              </span>

              {/* 血量 */}
              <div className="w-full mt-2">
                <div className="h-1 rounded-full bg-background-200 overflow-hidden">
                  <div
                    className={`h-full ${hpPct > 0.5 ? 'bg-accent-400' : hpPct > 0.25 ? 'bg-primary-400' : 'bg-secondary-400'}`}
                    style={{ width: `${hpPct * 100}%` }}
                  ></div>
                </div>
                <div className="font-label text-[9px] text-foreground-600 mt-0.5">
                  HP {p.hp}/{p.maxHp}
                </div>
              </div>

              {/* 状态 */}
              <span
                className={`mt-auto pt-1.5 font-label text-[9px] whitespace-nowrap ${
                  p.placed ? 'text-primary-300' : 'text-foreground-600'
                }`}
              >
                {p.placed ? '已部署' : '待部署'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 操作区 */}
      <div className="shrink-0 flex flex-col gap-2">
        {selected && selected.placed && (
          <div className="flex gap-2">
            <button
              onClick={() => onMakeLord(selected.id)}
              disabled={selected.isLord}
              className="flex-1 px-3 py-2 rounded-md text-xs border border-primary-400/60 text-primary-300 hover:bg-primary-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
            >
              <i className="ri-vip-crown-line w-3.5 h-3.5 flex items-center justify-center"></i>
              {selected.isLord ? '当前灵主' : '设为灵主'}
            </button>
            <button
              onClick={() => { onUnplace(selected.id); onSelect(null); }}
              className="flex-1 px-3 py-2 rounded-md text-xs border border-background-300 text-foreground-700 hover:border-secondary-400 hover:text-secondary-300 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
            >
              <i className="ri-arrow-go-back-line w-3.5 h-3.5 flex items-center justify-center"></i>
              收回
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="font-label text-[10px] text-foreground-600 whitespace-nowrap">
            {placedCount}/{LINEUP_SIZE} 已部署
          </span>
          <button
            onClick={onRandomize}
            className="ml-auto px-3 py-2 rounded-md text-xs border border-background-300 text-foreground-800 hover:border-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
          >
            <i className="ri-shuffle-line w-3.5 h-3.5 flex items-center justify-center"></i>
            随机布阵
          </button>
        </div>
      </div>
    </div>
  );
}