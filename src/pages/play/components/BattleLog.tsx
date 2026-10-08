import { useEffect, useRef, useState } from 'react';
import type { LogEntry, Team, CardCategory } from '@/game/types';
import { CARDS, CARDS_BY_ID, type CardDef } from '@/game/cards';

const TEAM_TEXT: Record<Team, string> = {
  player: 'text-blue-400',
  enemy: 'text-red-400',
};

/** 卡牌名 → 卡牌 id,用于把日志里的【技能名】变成可点击 */
const CARD_BY_NAME: Record<string, string> = Object.fromEntries(CARDS.map((c) => [c.name, c.id]));

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

/** 日志关键词高亮:按语义给伤害 / 治疗 / 防御等词着色 */
const KEYWORD_GROUPS: { words: string[]; cls: string }[] = [
  { words: ['持续伤害', '伤害', '灼烧', '溅射', '贯穿', '受到'], cls: 'text-secondary-300' },
  { words: ['被消灭', '陨落', '阵亡', '击败'], cls: 'text-secondary-300 font-medium' },
  { words: ['恢复', '回复', '治疗', '重生'], cls: 'text-accent-300' },
  { words: ['格挡', '无敌', '护盾', '防御姿态', '防御'], cls: 'text-primary-300' },
  { words: ['封锁', '击退', '行动点', '移动力'], cls: 'text-primary-200' },
];

const KEYWORD_CLASS: Record<string, string> = {};
KEYWORD_GROUPS.forEach((g) => g.words.forEach((w) => { KEYWORD_CLASS[w] = g.cls; }));

const KEYWORD_RE = new RegExp(`(${KEYWORD_GROUPS.flatMap((g) => g.words).join('|')})`, 'g');

function highlightKeywords(text: string) {
  const parts = text.split(KEYWORD_RE);
  return parts.map((p, i) => {
    const cls = KEYWORD_CLASS[p];
    if (cls) return <span key={i} className={`${cls} font-medium`}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

function lineTone(l: LogEntry): string {
  if (l.kind === 'turn') return 'text-primary-300';
  if (l.kind === 'system') return 'text-foreground-500';
  return 'text-foreground-600';
}

/** 日志筛选维度:全部 / 只看伤害 / 只看状态变化 / 只看卡牌使用 */
type LogFilter = 'all' | 'damage' | 'status' | 'card';

const FILTERS: { id: LogFilter; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: 'ri-list-check-2' },
  { id: 'damage', label: '伤害', icon: 'ri-sword-line' },
  { id: 'status', label: '状态', icon: 'ri-heart-pulse-line' },
  { id: 'card', label: '卡牌', icon: 'ri-magic-line' },
];

const matchesFilter = (l: LogEntry, f: LogFilter) => {
  if (f === 'all') return true;
  if (l.kind === 'turn') return true; // 回合分隔始终保留,提供上下文
  if (f === 'damage') return l.kind === 'damage' || l.kind === 'death';
  if (f === 'status') return l.kind === 'info' || l.kind === 'system';
  if (f === 'card') return l.kind === 'card';
  return true;
};

interface TipState {
  cardId: string;
  left: number;
  top: number;
}

/** 把一段文本里的【卡牌名】渲染成可点击的技能名 */
function SegmentText({ text, onCard }: { text: string; onCard: (id: string, el: HTMLElement) => void }) {
  const parts = text.split(/【([^】]+)】/g);
  return (
    <>
      {parts.map((p, i) => {
        const cardId = i % 2 === 1 ? CARD_BY_NAME[p] : undefined;
        if (cardId) {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); onCard(cardId, e.currentTarget); }}
              className="mx-0.5 underline decoration-dotted decoration-1 underline-offset-2 hover:text-accent-300 cursor-pointer"
            >
              【{p}】
            </button>
          );
        }
        return <span key={i}>{highlightKeywords(p)}</span>;
      })}
    </>
  );
}

function LogLine({ l, onCard }: { l: LogEntry; onCard: (id: string, el: HTMLElement) => void }) {
  if (l.segments && l.segments.length > 0) {
    return (
      <span>
        {l.segments.map((s, i) => (
          <span key={i} className={s.team ? `${TEAM_TEXT[s.team]} font-medium` : undefined}>
            <SegmentText text={s.text} onCard={onCard} />
          </span>
        ))}
      </span>
    );
  }
  return <SegmentText text={l.text} onCard={onCard} />;
}

function CardTipBody({ card, onClose }: { card: CardDef; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-heading text-sm text-foreground-950 leading-tight">{card.name}</span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded border border-background-300 text-foreground-600 hover:text-foreground-950 cursor-pointer"
          aria-label="关闭"
        >
          <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={`font-label text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${CAT_STYLE[card.category]}`}>
          {CAT_LABEL[card.category]}
        </span>
        <span className="inline-flex items-center gap-1 font-label text-[10px] text-foreground-600 whitespace-nowrap">
          <i className="ri-flashlight-fill w-3.5 h-3.5 flex items-center justify-center"></i>
          消耗 {card.cost}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-foreground-700">{card.desc}</p>

      <div className="mt-2 pt-2 border-t border-background-300/50 text-[10px] text-foreground-600 flex items-center gap-1">
        <i className="ri-shining-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
        召唤 · {card.ownerName}
      </div>
    </>
  );
}

export default function BattleLog({ log }: { log: LogEntry[] }) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const items = [...log].reverse().filter((l) => matchesFilter(l, filter));
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  // 最新一条日志的高亮 + 用户已滚离顶部时积累的未读数量
  const [flashId, setFlashId] = useState<number | null>(null);
  const [pendingNew, setPendingNew] = useState(0);
  const lastNewestId = useRef<number | null>(null);

  const newestId = log.length > 0 ? log[log.length - 1].id : null;

  // 切换筛选回到顶部
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
    setPendingNew(0);
  }, [filter]);

  // 有新日志:靠近顶部时自动滚到最新并高亮,否则累计未读数并提示
  useEffect(() => {
    if (newestId === null || newestId === lastNewestId.current) return;
    lastNewestId.current = newestId;
    setFlashId(newestId);
    const el = logRef.current;
    if (el && el.scrollTop < 24) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      setPendingNew(0);
    } else {
      setPendingNew((c) => c + 1);
    }
    const t = window.setTimeout(() => setFlashId(null), 1600);
    return () => window.clearTimeout(t);
  }, [newestId]);

  const handleCard = (cardId: string, el: HTMLElement) => {
    setTip((prev) => {
      if (prev && prev.cardId === cardId) return null;
      const panel = panelRef.current;
      if (!panel) return null;
      const pr = panel.getBoundingClientRect();
      const tr = el.getBoundingClientRect();
      const width = 260;
      const height = 168;
      const left = Math.min(pr.right + 12, window.innerWidth - width - 12);
      const top = Math.min(Math.max(tr.top - 6, 12), window.innerHeight - height - 12);
      return { cardId, left, top };
    });
  };

  const tipCard = tip ? CARDS_BY_ID[tip.cardId] : null;

  return (
    <div ref={panelRef} className="rune-border rounded-lg p-5 h-full flex flex-col relative">
      <h3 className="hidden lg:block font-heading text-lg text-foreground-950 mb-3 shrink-0">战斗日志</h3>
      <div className="flex items-center gap-3 mb-3 shrink-0 text-[10px] font-label">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          己方
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          敌方
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-foreground-500">
          <i className="ri-cursor-line w-3.5 h-3.5 flex items-center justify-center"></i>
          点技能名看说明
        </span>
      </div>

      {/* 日志筛选:全部 / 伤害 / 状态 / 卡牌 */}
      <div className="flex items-center gap-0.5 mb-3 shrink-0 p-0.5 rounded-full bg-background-200/70 border border-background-300/50">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFilter(f.id); setTip(null); }}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-full font-label text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
              filter === f.id ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
            }`}
          >
            <i className={`${f.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
            {f.label}
          </button>
        ))}
      </div>

      <div
        className="space-y-1.5 flex-1 overflow-y-auto pr-1"
        ref={logRef}
        onScroll={() => {
          setTip(null);
          if (logRef.current && logRef.current.scrollTop < 24) setPendingNew(0);
        }}
        onClick={() => setTip(null)}
      >
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-foreground-500">
            <i className="ri-filter-off-line text-2xl w-6 h-6 flex items-center justify-center"></i>
            <span className="text-[11px] font-label">当前筛选下暂无日志</span>
          </div>
        )}
        {items.map((l) => (
          <div
            key={l.id}
            className={`text-xs leading-relaxed px-1.5 -mx-1.5 ${lineTone(l)} ${l.id === flashId ? 'log-new' : ''}`}
          >
            <LogLine l={l} onCard={handleCard} />
          </div>
        ))}
      </div>

      {/* 滚离顶部时:提示有新日志,一键回到最新 */}
      {pendingNew > 0 && (
        <button
          type="button"
          onClick={() => {
            logRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            setPendingNew(0);
          }}
          className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-500 text-background-50 font-label text-[11px] whitespace-nowrap pop-row cursor-pointer"
        >
          <i className="ri-arrow-up-line w-3.5 h-3.5 flex items-center justify-center"></i>
          回到最新{pendingNew > 1 ? ` · ${pendingNew}` : ''}
        </button>
      )}

      {/* 技能说明:桌面端跟随日志右侧浮层,移动端改为居中弹层 */}
      {tipCard && tip && (
        <>
          <div
            className="hidden lg:block fixed z-[80] w-[260px] rounded-lg border border-background-300 bg-background-100 p-3"
            style={{ left: tip.left, top: tip.top }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardTipBody card={tipCard} onClose={() => setTip(null)} />
          </div>

          <div
            className="lg:hidden fixed inset-0 z-[90] flex items-center justify-center p-5"
            onClick={() => setTip(null)}
          >
            <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm"></div>
            <div
              className="relative w-full max-w-sm rounded-lg border border-background-300 bg-background-100 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <CardTipBody card={tipCard} onClose={() => setTip(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}