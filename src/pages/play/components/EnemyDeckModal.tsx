import { useEffect, useRef, useState } from 'react';
import type { CardCategory } from '@/game/types';
import { CARDS } from '@/game/cards';
import { useDragScroll } from '@/hooks/useDragScroll';

interface Props {
  onClose: () => void;
}

const META: Record<CardCategory, { label: string; text: string; bg: string; border: string }> = {
  attack: { label: '攻击', text: 'text-secondary-300', bg: 'bg-secondary-500/10', border: 'border-secondary-500/40' },
  support: { label: '辅助', text: 'text-accent-300', bg: 'bg-accent-500/10', border: 'border-accent-500/40' },
  special: { label: '特殊', text: 'text-primary-300', bg: 'bg-primary-500/10', border: 'border-primary-500/40' },
};

/** 指令阶段查看敌方牌组的全部 20 张卡牌(完整牌组,仅查看) */
export default function EnemyDeckModal({ onClose }: Props) {
  const total = CARDS.length;

  // 移动端横向卡牌轨道:边缘遮罩 / 页码圆点 / 居中高亮
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const { dragging, handlers: dragHandlers } = useDragScroll<HTMLDivElement>(railRef);

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
    const id = window.requestAnimationFrame(updateRail);
    return () => window.cancelAnimationFrame(id);
  }, []);

  const scrollByCard = (dir: number) => {
    const el = railRef.current;
    if (!el) return;
    const child = el.children[Math.min(Math.max(activeIdx, 0), el.children.length - 1)] as HTMLElement | undefined;
    const step = child ? child.offsetWidth + 12 : el.clientWidth * 0.72;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-background-950/85 backdrop-blur-md cursor-pointer" onClick={onClose}></div>

      {/* 背景微光 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, oklch(var(--secondary-500) / 0.14), transparent 55%), radial-gradient(circle at 80% 80%, oklch(var(--accent-500) / 0.10), transparent 50%)',
        }}
      ></div>

      <div className="pop-row relative w-full max-w-5xl max-h-[92vh] flex flex-col rune-border rounded-lg overflow-hidden">
        {/* 头部 */}
        <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4 border-b border-background-300/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-label text-[10px] text-secondary-400">ENEMY DECK</span>
              <h2 className="font-heading text-xl md:text-2xl text-foreground-950 mt-1">敌方牌组一览</h2>
              <p className="hidden md:block text-xs md:text-sm text-foreground-600 leading-relaxed mt-2">
                这是对手本局携带的完整牌组,共 <strong className="text-foreground-800">{total}</strong> 张卡牌。
                此界面为<strong className="text-foreground-800">情报查看</strong>,不可操作,方便你预判对方可能抽到的牌。
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              aria-label="关闭"
            >
              <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="font-label text-[10px] px-2 py-0.5 rounded border border-secondary-500/40 text-secondary-300 bg-secondary-500/10 whitespace-nowrap">
              牌组共 {total} 张卡牌
            </span>
            <span className="font-label text-[10px] text-foreground-600 whitespace-nowrap inline-flex items-center gap-1">
              <i className="ri-eye-line w-3.5 h-3.5 flex items-center justify-center"></i>
              仅查看
            </span>
          </div>
        </div>

        {/* 卡牌轨道(横向滑动,全尺寸通用) */}
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
            {CARDS.map((c, idx) => {
              const st = META[c.category];
              return (
                <div
                  key={c.id}
                  className={`shrink-0 snap-center w-[72%] max-w-[240px] sm:w-[46%] md:w-[31%] lg:w-[23%] xl:w-[18.5%] transition-transform duration-300 ${
                    activeIdx === idx ? 'scale-[1.03]' : 'scale-100'
                  }`}
                >
                <div
                  title={c.desc}
                  className="pop-row relative w-full h-full text-left rounded-lg border p-3 flex flex-col border-background-300 bg-background-100"
                  style={{ animationDelay: `${Math.min(idx, 14) * 45}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap ${st.text} ${st.border} ${st.bg}`}>
                        {st.label}
                      </span>
                      <i className="ri-eye-line text-foreground-500 w-3.5 h-3.5 flex items-center justify-center"></i>
                    </div>
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-background-200/80 font-heading text-[11px] text-foreground-600">
                      {c.cost}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                    <div className="w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-full border border-background-300 bg-background-200 text-foreground-600">
                      <i className={`${c.icon} text-lg md:text-2xl w-5 h-5 md:w-6 md:h-6 flex items-center justify-center`}></i>
                    </div>
                    <span className="font-heading text-sm text-foreground-950 text-center leading-tight">{c.name}</span>
                  </div>

                  <p className="text-[10px] leading-relaxed text-foreground-600 flex-1 [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical] overflow-hidden">{c.desc}</p>

                  <div className="mt-2 pt-2 border-t border-background-300/40 text-[9px] text-foreground-600 flex items-center gap-1">
                    <i className="ri-shining-2-line w-3 h-3 flex items-center justify-center"></i>
                    召唤 · {c.ownerName}
                  </div>
                </div>
                </div>
              );
            })}
            </div>

            {/* 页码圆点 */}
            <div className="flex items-center justify-center flex-wrap gap-1.5 mt-2 md:mt-3">
              {CARDS.map((c, i) => (
                <span
                  key={c.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activeIdx ? 'w-4 bg-primary-400' : 'w-1.5 bg-background-400/60'
                  }`}
                ></span>
              ))}
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="shrink-0 border-t border-background-300/60 px-4 md:px-8 py-3 md:py-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-md text-sm font-label bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            返回战场
          </button>
        </div>
      </div>
    </div>
  );
}