import { useMemo, useRef, useState } from 'react';
import { CARDS, type CardDef } from '@/game/cards';
import type { CardCategory } from '@/game/types';
import { useDragScroll } from '@/hooks/useDragScroll';

type TabKey = 'all' | CardCategory;

const TABS: { key: TabKey; label: string; icon: string; active: string }[] = [
  { key: 'all', label: '全部', icon: 'ri-stack-line', active: 'bg-primary-500 text-background-50' },
  { key: 'attack', label: '攻击卡', icon: 'ri-fire-fill', active: 'bg-secondary-500 text-background-50' },
  { key: 'support', label: '辅助卡', icon: 'ri-shield-star-line', active: 'bg-accent-500 text-background-50' },
  { key: 'special', label: '特殊卡', icon: 'ri-sparkling-2-fill', active: 'bg-primary-500 text-background-50' },
];

const CATEGORY_META: Record<CardCategory, { label: string; text: string; bg: string; border: string }> = {
  attack: { label: '攻击', text: 'text-secondary-300', bg: 'bg-secondary-500/15', border: 'border-secondary-500/40' },
  support: { label: '辅助', text: 'text-accent-300', bg: 'bg-accent-500/15', border: 'border-accent-500/40' },
  special: { label: '特殊', text: 'text-primary-300', bg: 'bg-primary-500/15', border: 'border-primary-500/40' },
};

const TARGET_LABEL: Record<string, string> = {
  none: '自动生效',
  enemy1: '指定 1 个敌方',
  enemy2: '指定 2 个敌方',
  ally1: '指定 1 个己方',
  ally2: '指定 2 个己方',
  enemyAlly: '敌我各 1 个',
  cell: '指定区域',
};

export default function CardPreviewModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>('all');
  const tabsRef = useRef<HTMLDivElement>(null);
  const { dragging, consumeClickSuppression, handlers: dragHandlers } = useDragScroll<HTMLDivElement>(tabsRef);

  const filtered = useMemo(() => {
    return tab === 'all' ? CARDS : CARDS.filter((c) => c.category === tab);
  }, [tab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-5xl max-h-[88vh] flex flex-col rune-border rounded-lg bg-background-100 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-background-300/60">
          <div>
            <span className="font-label text-[10px] text-primary-400">DECK OVERVIEW</span>
            <h2 className="font-heading text-xl text-foreground-950 mt-0.5">卡组预览 · 20 张策略卡</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:text-primary-300 hover:border-primary-400 cursor-pointer"
          >
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        {/* 分类切换 */}
        <div
          ref={tabsRef}
          {...dragHandlers}
          className={`flex items-center gap-2 px-6 py-3 border-b border-background-300/60 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            dragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { if (consumeClickSuppression()) return; setTab(t.key); }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-label whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.key
                  ? t.active
                  : 'bg-background-200 text-foreground-700 hover:bg-background-300'
              }`}
            >
              <i className={`${t.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
              {t.label}
            </button>
          ))}
          <span className="ml-auto font-label text-[10px] text-foreground-600 whitespace-nowrap">
            {filtered.length} 张
          </span>
        </div>

        {/* 卡牌网格 */}
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((card) => (
              <CardItem key={card.id} card={card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardItem({ card }: { card: CardDef }) {
  const meta = CATEGORY_META[card.category];
  return (
    <div className="rune-border rounded-lg p-4 flex flex-col gap-3 bg-background-50">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200 border border-background-300 text-primary-400">
          <i className={`${card.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-label ${meta.text} ${meta.bg} border ${meta.border}`}>
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-label bg-background-200 text-foreground-600 border border-background-300">
            <i className="ri-flashlight-fill text-primary-400 w-3 h-3 flex items-center justify-center"></i>
            {card.cost > 0 ? `${card.cost} 行动点` : '免费'}
          </span>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-base text-foreground-950">{card.name}</h3>
        <p className="font-label text-[9px] text-foreground-600 mt-0.5">
          关联灵兽 · {card.ownerName}
        </p>
      </div>

      <p className="text-xs text-foreground-700 leading-relaxed flex-1">{card.desc}</p>

      <div className="inline-flex items-center gap-1.5 text-[10px] text-foreground-600 pt-2 border-t border-background-300/40">
        <i className="ri-focus-3-line text-accent-400 w-3 h-3 flex items-center justify-center"></i>
        {TARGET_LABEL[card.target.kind]}
      </div>
    </div>
  );
}