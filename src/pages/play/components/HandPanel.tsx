import { useEffect, useRef, useState } from 'react';
import type { GameState, CardCategory, Phase } from '@/game/types';
import { CARDS_BY_ID } from '@/game/cards';
import { useDragScroll } from '@/hooks/useDragScroll';

interface Props {
  state: GameState;
  className?: string;
  onPlayCard: (cardId: string) => void;
  pendingCardId: string | null;
  onCancel: () => void;
  /** 竖排列表(桌面侧栏) / 横排可拖拽轨道(移动端底部抽屉) */
  orientation?: 'vertical' | 'horizontal';
}

const tone = (c: CardCategory) =>
  c === 'attack'
    ? { bg: 'bg-secondary-500/10', text: 'text-secondary-300', border: 'border-secondary-500/40', label: '攻击' }
    : c === 'support'
    ? { bg: 'bg-accent-500/10', text: 'text-accent-300', border: 'border-accent-500/40', label: '辅助' }
    : { bg: 'bg-primary-500/10', text: 'text-primary-300', border: 'border-primary-500/40', label: '特殊' };

const phaseLabel: Record<Phase, string> = {
  deploy: '部署阶段',
  card1: '抽卡阶段',
  command: '指令阶段',
  card2: '援救阶段',
  execute: '结算中',
  gameover: '战斗结束',
};

export default function HandPanel({
  state,
  className,
  onPlayCard,
  pendingCardId,
  onCancel,
  orientation = 'vertical',
}: Props) {
  const canPlay = state.phase === 'card1' || state.phase === 'card2';
  const horizontal = orientation === 'horizontal';
  const pendingCard = pendingCardId ? CARDS_BY_ID[pendingCardId] : null;
  const pendingActive = !!pendingCard && canPlay;
  // 保留上一张已选卡牌,让说明栏滑出时内容不闪空
  const [shownCardId, setShownCardId] = useState<string | null>(null);
  useEffect(() => {
    if (pendingCardId) setShownCardId(pendingCardId);
  }, [pendingCardId]);
  const shownCard = shownCardId ? CARDS_BY_ID[shownCardId] : null;
  const shownTone = shownCard ? tone(shownCard.category) : null;
  const listRef = useRef<HTMLDivElement>(null);
  const newCardRef = useRef<HTMLButtonElement>(null);
  const { dragging, consumeClickSuppression, handlers } = useDragScroll<HTMLDivElement>(listRef);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // 横排模式:跟踪滚动位置,控制左右箭头显隐
  const updateRail = () => {
    const el = listRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  const scrollByCard = (dir: number) => {
    const el = listRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const step = first ? first.offsetWidth + 10 : el.clientWidth * 0.6;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!horizontal) return;
    const id = window.requestAnimationFrame(updateRail);
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizontal, state.hand.length]);

  // 新抽到的卡牌:横排模式把它滚进可视区,竖排模式滚到底部
  useEffect(() => {
    if (state.phase !== 'card1' || !state.lastDrawnCardId) return;
    const el = listRef.current;
    if (!el) return;
    if (horizontal) {
      const cardEl = newCardRef.current;
      if (!cardEl) return;
      const delta = cardEl.getBoundingClientRect().left - el.getBoundingClientRect().left;
      el.scrollBy({ left: delta - 8, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [state.phase, state.lastDrawnCardId, horizontal]);

  return (
    <div className={`rune-border rounded-lg flex flex-col overflow-hidden ${className ?? ''}`}>
      {/* 头部 */}
      <div className="shrink-0 px-4 py-3 border-b border-background-300/60 flex items-center justify-between gap-2 flex-wrap">
        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-background-200/70 border border-background-300/60 text-foreground-600 whitespace-nowrap">
          {phaseLabel[state.phase]}
        </span>
        {/* 抽卡 / 援救阶段:显示自己牌库剩余与当前手牌数量 */}
        {canPlay ? (
          <div className="flex items-center gap-2">
            <span
              title="牌库剩余"
              className="flex items-center gap-1 font-label text-[10px] px-2 py-1 rounded-md bg-primary-500/10 border border-primary-500/30 text-primary-300 whitespace-nowrap"
            >
              <i className="ri-stack-line w-3.5 h-3.5 flex items-center justify-center"></i>
              <span className="font-heading text-xs">{state.deck.length}</span>
            </span>
            <span
              title="当前手牌"
              className="flex items-center gap-1 font-label text-[10px] px-2 py-1 rounded-md bg-accent-500/10 border border-accent-500/30 text-accent-300 whitespace-nowrap"
            >
              <i className="ri-hand-coin-line w-3.5 h-3.5 flex items-center justify-center"></i>
              <span className="font-heading text-xs">{state.hand.length}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-foreground-600 whitespace-nowrap">
            <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
            当前阶段不可使用,仅可查看
          </div>
        )}
      </div>

      {/* 已选卡牌:完整展示技能描述,选中后随时可回看 */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-out ${
          pendingActive
            ? 'max-h-40 opacity-100 border-b border-primary-500/50'
            : 'max-h-0 opacity-0 border-b-0 border-transparent'
        }`}
      >
        {shownCard && shownTone && (
          <div className="px-3 py-2 bg-primary-500/10">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 w-6 h-6 flex items-center justify-center rounded border ${shownTone.border} ${shownTone.bg} ${shownTone.text}`}
              >
                <i className={`${shownCard.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
              </span>
              <span className="font-heading text-[13px] text-foreground-950 truncate">{shownCard.name}</span>
              <span
                className={`shrink-0 font-label text-[9px] px-1 py-0.5 rounded border ${shownTone.border} ${shownTone.text}`}
              >
                {shownTone.label}
              </span>
              <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-background-200/80 text-primary-400 font-heading text-[10px]">
                {shownCard.cost}
              </span>
              <button
                type="button"
                onClick={onCancel}
                className="ml-auto shrink-0 flex items-center gap-0.5 font-label text-[9px] px-1.5 py-0.5 rounded border border-secondary-500/40 text-secondary-300 hover:bg-secondary-500/10 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
                取消
              </button>
            </div>
            <p className="mt-1 text-[11px] text-foreground-700 leading-relaxed">{shownCard.desc}</p>
          </div>
        )}
      </div>

      {horizontal ? (
        /* 卡牌 · 横排可拖拽轨道(移动端) */
        state.hand.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className="text-xs text-foreground-600 text-center leading-relaxed px-4">
              {canPlay ? '手牌为空。每回合开始自动抽 1 张卡牌。' : '当前阶段无可用手牌。'}
            </p>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0">
            {/* 左右箭头:一卡一卡地跳到相邻卡牌 */}
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="上一张手牌"
              className={`absolute left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-background-100/95 border border-background-300 text-foreground-700 hover:text-primary-300 cursor-pointer ${
                atStart ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <i className="ri-arrow-left-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="下一张手牌"
              className={`absolute right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-background-100/95 border border-background-300 text-foreground-700 hover:text-primary-300 cursor-pointer ${
                atEnd ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <div
              ref={listRef}
              onScroll={updateRail}
              {...handlers}
              className={`h-full flex gap-2.5 overflow-x-auto px-3 py-3 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                dragging ? 'snap-none cursor-grabbing select-none' : 'snap-x snap-mandatory cursor-grab'
              }`}
            >
            {state.hand.map((id) => {
              const c = CARDS_BY_ID[id];
              if (!c) return null;
              const t = tone(c.category);
              const usable = canPlay && state.ap >= c.cost;
              const isPending = pendingCardId === c.id;
              const isNew = state.phase === 'card1' && state.lastDrawnCardId === c.id;
              return (
                <button
                  key={id}
                  ref={isNew ? newCardRef : undefined}
                  onClick={() => {
                    if (consumeClickSuppression()) return;
                    if (usable) onPlayCard(id);
                  }}
                  className={`relative shrink-0 snap-center w-[150px] rounded-lg border p-2.5 flex flex-col text-left transition-all ${
                    usable ? 'cursor-pointer' : 'cursor-not-allowed'
                  } ${
                    isNew
                      ? 'card-new border-accent-500/60 ring-1 ring-accent-400/70'
                      : isPending
                      ? 'border-primary-500 bg-primary-500/15 ring-1 ring-primary-400'
                      : usable
                      ? `${t.bg} ${t.border} hover:border-primary-400`
                      : 'border-background-300 bg-background-100 opacity-55 grayscale'
                  }`}
                >
                  {isNew && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 new-tag z-10 font-label text-[8px] px-1.5 py-0.5 rounded-full bg-accent-500 text-background-50 whitespace-nowrap">
                      新抽到
                    </span>
                  )}

                  {/* 顶部:职业 + 费用 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`font-label text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${t.border} ${t.text}`}
                    >
                      {t.label}
                    </span>
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-background-200/80 text-primary-400 font-heading text-[10px]">
                      {c.cost}
                    </span>
                  </div>

                  {/* 图标 */}
                  <div
                    className={`w-10 h-10 shrink-0 mx-auto flex items-center justify-center rounded-full border ${t.border} ${t.bg} ${t.text}`}
                  >
                    <i className={`${c.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
                  </div>

                  {/* 名称 */}
                  <div className="mt-1.5 flex items-center justify-center gap-1">
                    <span className="font-heading text-[13px] text-foreground-950 truncate">{c.name}</span>
                  </div>

                  {/* 描述 */}
                  <p className="mt-1 text-[10px] text-foreground-700 leading-relaxed flex-1 [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
                    {c.desc}
                  </p>

                  {/* 归属 */}
                  <div className="mt-1.5 pt-1.5 border-t border-background-300/40 text-[9px] text-foreground-600 truncate">
                    归属 · {c.ownerName}
                  </div>
                </button>
              );
            })}
            </div>
          </div>
        )
      ) : (
        /* 卡牌 · 竖排列表(桌面) */
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
          {state.hand.length === 0 ? (
            <div className="text-xs text-foreground-600 text-center leading-relaxed py-8">
              {canPlay ? '手牌为空。每回合开始自动抽 1 张卡牌。' : '当前阶段无可用手牌。'}
            </div>
          ) : (
            state.hand.map((id) => {
              const c = CARDS_BY_ID[id];
              if (!c) return null;
              const t = tone(c.category);
              const usable = canPlay && state.ap >= c.cost;
              const isPending = pendingCardId === c.id;
              const isNew = state.phase === 'card1' && state.lastDrawnCardId === c.id;
              return (
                <button
                  key={id}
                  onClick={() => { if (usable) onPlayCard(id); }}
                  className={`group relative text-left rounded-md border p-2.5 flex items-start gap-2.5 transition-all ${
                    usable ? 'cursor-pointer' : 'cursor-not-allowed'
                  } ${
                    isNew
                      ? 'card-new border-accent-500/60 ring-1 ring-accent-400/70'
                      : isPending
                      ? 'border-primary-500 bg-primary-500/15 ring-1 ring-primary-400'
                      : usable
                      ? t.bg + ' ' + t.border + ' hover:border-primary-400'
                      : 'border-background-300 bg-background-100 opacity-55 grayscale'
                  }`}
                >
                  {isNew && (
                    <span className="absolute -top-2 right-2 new-tag font-label text-[8px] px-1.5 py-0.5 rounded-full bg-accent-500 text-background-50 whitespace-nowrap">
                      新抽到
                    </span>
                  )}
                  {/* 卡牌图标 */}
                  <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-md border ${t.border} ${t.bg} ${t.text}`}>
                    <i className={`${c.icon} text-xl w-6 h-6 flex items-center justify-center`}></i>
                  </div>

                  {/* 卡牌信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading text-[13px] text-foreground-950 truncate">{c.name}</span>
                      <span className={`shrink-0 font-label text-[8px] px-1 py-0.5 rounded border ${t.border} ${t.text}`}>
                        {t.label}
                      </span>
                      <span className="ml-auto shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-background-200/80 text-primary-400 font-heading text-[10px]">
                        {c.cost}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground-700 leading-relaxed mt-1">{c.desc}</p>
                    <div className="mt-1 text-[9px] text-foreground-600 truncate">归属 · {c.ownerName}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}