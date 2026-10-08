import { useEffect, useRef, useState } from 'react';
import type { GameState, CardCategory } from '@/game/types';
import { CARDS_BY_ID } from '@/game/cards';
import { LINEUP_SIZE } from '@/game/constants';
import { useDragScroll } from '@/hooks/useDragScroll';

/** 召唤出战卡牌(阵容挑选)限时 2 分钟 */
const SUMMON_SECONDS = 120;

interface Props {
  state: GameState;
  onToggleLineup: (cardId: string) => void;
  onRandomLineup: () => void;
  onConfirm: () => void;
}

const META: Record<CardCategory, { label: string; text: string; bg: string; border: string }> = {
  attack: { label: '攻击', text: 'text-secondary-300', bg: 'bg-secondary-500/10', border: 'border-secondary-500/40' },
  support: { label: '辅助', text: 'text-accent-300', bg: 'bg-accent-500/10', border: 'border-accent-500/40' },
  special: { label: '特殊', text: 'text-primary-300', bg: 'bg-primary-500/10', border: 'border-primary-500/40' },
};

export default function SummonDeckModal({ state, onToggleLineup, onRandomLineup, onConfirm }: Props) {
  const picked = state.lineup.length;
  const full = picked >= LINEUP_SIZE;
  const ready = picked === LINEUP_SIZE;

  const [count, setCount] = useState(SUMMON_SECONDS);
  const timerRef = useRef<number | null>(null);
  const [view, setView] = useState<'mine' | 'enemy'>('mine');
  const enemyView = view === 'enemy';
  const list = enemyView ? state.enemyDeck : state.deck;

  // 移动端横向卡牌轨道:跟踪滚动位置,用于边缘遮罩 / 页码圆点 / 居中高亮
  const railRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const { dragging, consumeClickSuppression, handlers: dragHandlers } = useDragScroll<HTMLDivElement>(railRef);
  const {
    dragging: previewDragging,
    consumeClickSuppression: consumePreviewClick,
    handlers: previewDragHandlers,
  } = useDragScroll<HTMLDivElement>(previewRef);

  const updateRail = () => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    children.forEach((c, i) => {
      const cc = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.abs(cc - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActiveIdx(best);
  };

  useEffect(() => {
    const el = railRef.current;
    if (el) el.scrollLeft = 0;
    setActiveIdx(0);
    const id = window.requestAnimationFrame(updateRail);
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const scrollByCard = (dir: number) => {
    const el = railRef.current;
    if (!el) return;
    const child = el.children[Math.min(Math.max(activeIdx, 0), el.children.length - 1)] as HTMLElement | undefined;
    const step = child ? child.offsetWidth + 12 : el.clientWidth * 0.72;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  // 时间到:阵容未满则自动随机补足,随后直接进入布阵
  useEffect(() => {
    if (count > 0) return;
    if (state.lineup.length < LINEUP_SIZE) onRandomLineup();
    onConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const mm = String(Math.floor(count / 60)).padStart(2, '0');
  const ss = String(count % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-background-950/85 backdrop-blur-md"></div>

      {/* 背景微光 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, oklch(var(--primary-500) / 0.14), transparent 55%), radial-gradient(circle at 80% 80%, oklch(var(--accent-500) / 0.10), transparent 50%)',
        }}
      ></div>

      <div className="pop-row relative w-full max-w-5xl max-h-[92vh] flex flex-col rune-border rounded-lg overflow-hidden">
        {/* 头部 · 文字解释 */}
        <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4 border-b border-background-300/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-label text-[10px] text-primary-400">SUMMON RITUAL</span>
              <h2 className="font-heading text-xl md:text-2xl text-foreground-950 mt-1">召唤出战卡牌</h2>
            </div>
            <div className="text-right shrink-0">
              <div className="font-heading text-2xl md:text-3xl text-primary-300 leading-none">
                {picked}
                <span className="text-foreground-500 text-base md:text-lg">/{LINEUP_SIZE}</span>
              </div>
              <div className="font-label text-[9px] text-foreground-600 mt-1">已选卡牌</div>
              <div
                className={`mt-1.5 inline-flex items-center gap-1 font-label text-xs ${
                  count <= 15 ? 'text-secondary-300' : 'text-foreground-700'
                }`}
              >
                <i className="ri-timer-line w-3.5 h-3.5 flex items-center justify-center"></i>
                {mm}:{ss}
              </div>
            </div>
          </div>

          <p className="hidden md:block text-xs md:text-sm text-foreground-600 leading-relaxed mt-3">
            从卡组中挑选 <strong className="text-foreground-800">{LINEUP_SIZE}</strong> 张卡牌出战,每张卡会召唤一只
            <strong className="text-foreground-800">对应种族</strong>的灵兽上阵;被选中的卡将从战斗牌库中移除。
            点击卡牌即可选中,再次点击可取消。
          </p>

          <div className="mt-3 h-1.5 rounded-full bg-background-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-300"
              style={{ width: `${(picked / LINEUP_SIZE) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 已选卡牌 · 迷你预览带 */}
        <div className="shrink-0 px-4 md:px-8 pt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-label text-[10px] text-foreground-600 whitespace-nowrap">已选卡牌</span>
            <span className="font-heading text-xs text-primary-300">
              {picked}
              <span className="text-foreground-500">/{LINEUP_SIZE}</span>
            </span>
            <span className="ml-auto font-label text-[9px] text-foreground-600 whitespace-nowrap">
              {picked === 0 ? '点击下方卡牌加入阵容' : '点击小图可取消该卡'}
            </span>
          </div>
          <div
            ref={previewRef}
            {...previewDragHandlers}
            className={`flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              previewDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
          >
            {Array.from({ length: LINEUP_SIZE }).map((_, i) => {
              const id = state.lineup[i];
              const c = id ? CARDS_BY_ID[id] : undefined;
              if (!id || !c) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-md border border-dashed border-background-300 flex items-center justify-center text-foreground-500/60"
                  >
                    <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
                  </div>
                );
              }
              const st = META[c.category];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { if (consumePreviewClick()) return; onToggleLineup(id); }}
                  title={`取消 ${c.name}`}
                  className={`group relative shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-md border ${st.border} ${st.bg} flex items-center justify-center cursor-pointer transition-colors hover:border-secondary-400`}
                >
                  <i className={`${c.icon} text-lg w-5 h-5 flex items-center justify-center ${st.text}`}></i>
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-secondary-500 text-background-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 卡组切换:我方 / 敌方 */}
        <div className="shrink-0 px-4 md:px-8 pt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1 px-1 py-1 rounded-full bg-background-200/70 border border-background-300/50">
            <button
              onClick={() => setView('mine')}
              className={`px-4 py-1.5 rounded-full font-label text-xs whitespace-nowrap cursor-pointer transition-colors ${
                !enemyView ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
              }`}
            >
              我方卡组
            </button>
            <button
              onClick={() => setView('enemy')}
              className={`px-4 py-1.5 rounded-full font-label text-xs whitespace-nowrap cursor-pointer transition-colors ${
                enemyView ? 'bg-secondary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
              }`}
            >
              敌方卡组
            </button>
          </div>
          <span className="font-label text-[10px] text-foreground-600">
            {enemyView
              ? `敌方共 ${state.enemyDeck.length} 张卡牌 · 仅查看`
              : `我方共 ${state.deck.length} 张卡牌 · 点击选中出战`}
          </span>
        </div>

        {/* 卡牌 · 横向滑动轨道(全尺寸通用) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-3 md:py-4">
          <div className="relative">
            {!atStart && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-3 z-10 w-8 bg-gradient-to-r from-background-100 to-transparent"></div>
            )}
            {!atEnd && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-3 z-10 w-8 bg-gradient-to-l from-background-100 to-transparent"></div>
            )}
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="上一张"
              className={`absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-background-100/90 border border-background-300 text-foreground-700 cursor-pointer ${
                atStart ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <i className="ri-arrow-left-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="下一张"
              className={`absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-background-100/90 border border-background-300 text-foreground-700 cursor-pointer ${
                atEnd ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <div
              ref={railRef}
              onScroll={updateRail}
              {...dragHandlers}
              className={`flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                dragging ? 'snap-none cursor-grabbing select-none' : 'snap-x snap-mandatory scroll-smooth cursor-grab'
              }`}
            >
            {list.map((id, idx) => {
              const c = CARDS_BY_ID[id];
              if (!c) return null;
              const st = META[c.category];
              const on = !enemyView && state.lineup.includes(id);
              const locked = !enemyView && !on && full;
              return (
                <div
                  key={id}
                  className={`shrink-0 snap-center w-[72%] max-w-[240px] sm:w-[46%] md:w-[31%] lg:w-[23%] xl:w-[18.5%] transition-transform duration-300 ${
                    !enemyView && activeIdx === idx ? 'scale-[1.03]' : 'scale-100'
                  }`}
                >
                <button
                  onClick={() => { if (consumeClickSuppression()) return; if (enemyView || locked) return; onToggleLineup(id); }}
                  disabled={locked}
                  title={c.desc}
                  className={`pop-row relative w-full h-full text-left rounded-lg border p-3 flex flex-col transition-all ${
                    enemyView
                      ? 'border-background-300 bg-background-100 cursor-default'
                      : on
                      ? 'border-primary-500 bg-primary-500/10 cursor-pointer'
                      : locked
                      ? 'border-background-300 bg-background-100 opacity-40 cursor-not-allowed'
                      : 'border-background-300 bg-background-100 hover:border-primary-400 cursor-pointer'
                  }`}
                  style={{ animationDelay: `${Math.min(idx, 14) * 45}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap ${st.text} ${st.border} ${st.bg}`}>
                        {st.label}
                      </span>
                      {on && <i className="ri-check-line text-primary-300 w-3.5 h-3.5 flex items-center justify-center"></i>}
                      {enemyView && <i className="ri-eye-line text-foreground-500 w-3.5 h-3.5 flex items-center justify-center"></i>}
                    </div>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full bg-background-200/80 font-heading text-[11px] ${enemyView ? 'text-foreground-600' : 'text-primary-400'}`}>
                      {c.cost}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                    <div
                      className={`w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-full border ${
                        on ? 'border-primary-400 bg-primary-500/15' : 'border-background-300 bg-background-200'
                      } ${enemyView ? 'text-foreground-600' : st.text}`}
                    >
                      <i className={`${c.icon} text-lg md:text-2xl w-5 h-5 md:w-6 md:h-6 flex items-center justify-center`}></i>
                    </div>
                    <span className="font-heading text-sm text-foreground-950 text-center leading-tight">{c.name}</span>
                  </div>

                  <p className="text-[10px] leading-relaxed text-foreground-600 flex-1 [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical] overflow-hidden">{c.desc}</p>

                  <div className="mt-2 pt-2 border-t border-background-300/40 text-[9px] text-foreground-600 flex items-center gap-1">
                    <i className="ri-shining-2-line w-3 h-3 flex items-center justify-center"></i>
                    召唤 · {c.ownerName}
                  </div>
                </button>
                </div>
              );
            })}
            </div>

            {/* 页码圆点 */}
            <div className="flex items-center justify-center flex-wrap gap-1.5 mt-2 md:mt-3">
              {list.map((id, i) => (
                <span
                  key={id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activeIdx ? 'w-4 bg-primary-400' : 'w-1.5 bg-background-400/60'
                  }`}
                ></span>
              ))}
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="shrink-0 border-t border-background-300/60 px-4 md:px-8 py-3 md:py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3">
          <button
            onClick={onRandomLineup}
            className="px-5 py-3 rounded-md text-sm border border-background-300 text-foreground-800 hover:border-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-shuffle-line w-4 h-4 flex items-center justify-center"></i>
            随机挑选阵容
          </button>

          <p className="flex-1 text-[10px] text-foreground-600 leading-relaxed sm:px-2">
            {ready
              ? '阵容已就绪,确认后进入布阵,把灵兽放到己方半场。'
              : `还需挑选 ${LINEUP_SIZE - picked} 张卡牌才能确认阵容。`}
          </p>

          <button
            onClick={onConfirm}
            disabled={!ready}
            className="px-6 py-3 rounded-md text-sm font-label bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-flag-2-line w-4 h-4 flex items-center justify-center"></i>
            确认阵容({picked}/{LINEUP_SIZE})
          </button>
        </div>
      </div>
    </div>
  );
}