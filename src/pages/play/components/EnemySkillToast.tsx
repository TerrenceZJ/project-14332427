import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LogEntry, CardCategory } from '@/game/types';
import { CARDS } from '@/game/cards';

interface ToastItem {
  id: number;
  name: string;
  icon: string;
  category: CardCategory;
}

const CAT_LABEL: Record<CardCategory, string> = {
  attack: '攻击',
  support: '辅助',
  special: '特殊',
};

const CAT_STYLE: Record<CardCategory, string> = {
  attack: 'text-secondary-300 border-secondary-500/40 bg-secondary-500/10',
  support: 'text-accent-300 border-accent-500/40 bg-accent-500/10',
  special: 'text-primary-300 border-primary-500/40 bg-primary-500/10',
};

const DURATION = 2600;

/** 敌方使用技能时,在屏幕顶部弹出提示(纯展示层,不拦截点击) */
export default function EnemySkillToast({ log }: { log: LogEntry[] }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastId = useRef(0);
  const seq = useRef(0);
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const batch: ToastItem[] = [];
    for (const l of log) {
      if (l.id <= lastId.current) continue;
      lastId.current = l.id;
      if (l.kind !== 'card' || l.team !== 'enemy') continue;
      const name = l.text.match(/【([^】]+)】/)?.[1];
      const card = name ? CARDS.find((c) => c.name === name) : null;
      if (!card) continue;
      batch.push({ id: ++seq.current, name: card.name, icon: card.icon, category: card.category });
    }
    if (batch.length === 0) return;

    setToasts((prev) => [...prev, ...batch]);
    batch.forEach((t) => {
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DURATION);
      timers.current.add(timer);
    });
  }, [log]);

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[95] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="enemy-toast flex items-center gap-2 px-4 py-2.5 rounded-full bg-background-950/85 border border-secondary-500/60 shadow-lg"
        >
          <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-secondary-500/20 text-secondary-300">
            <i className={`${t.icon} w-4 h-4 flex items-center justify-center`}></i>
          </span>
          <span className="font-label text-[11px] text-secondary-300 whitespace-nowrap">敌方使用技能</span>
          <span className="font-heading text-[13px] text-foreground-50 whitespace-nowrap">【{t.name}】</span>
          <span className={`font-label text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${CAT_STYLE[t.category]}`}>
            {CAT_LABEL[t.category]}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
