import type { GameState, CardCategory } from '@/game/types';
import { CARDS_BY_ID } from '@/game/cards';
import { BEASTS } from '@/game/beasts';
import { LINEUP_SIZE } from '@/game/constants';

interface Props {
  state: GameState;
  className?: string;
  onSelect: (id: string | null) => void;
  onUnplace: (id: string) => void;
  onMakeLord: (id: string) => void;
  onRandomize: () => void;
  onStart: () => void;
  onReopenSummon: () => void;
}

const META: Record<CardCategory, { label: string; text: string; bg: string; border: string }> = {
  attack: { label: '攻击', text: 'text-secondary-300', bg: 'bg-secondary-500/10', border: 'border-secondary-500/40' },
  support: { label: '辅助', text: 'text-accent-300', bg: 'bg-accent-500/10', border: 'border-accent-500/40' },
  special: { label: '特殊', text: 'text-primary-300', bg: 'bg-primary-500/10', border: 'border-primary-500/40' },
};

export default function DeployRosterPanel({
  state,
  className,
  onSelect,
  onUnplace,
  onMakeLord,
  onRandomize,
  onStart,
  onReopenSummon,
}: Props) {
  const mine = state.pieces.filter((p) => p.team === 'player');
  const reserve = mine.filter((p) => !p.placed);
  const placed = mine.filter((p) => p.placed);
  const lord = placed.find((p) => p.isLord);
  const selected = mine.find((p) => p.id === state.selectedId) || null;
  const ready = mine.length === LINEUP_SIZE && reserve.length === 0 && state.lineup.length === LINEUP_SIZE;

  return (
    <div className={`rune-border rounded-lg flex flex-col overflow-hidden ${className ?? ''}`}>
      {/* 头部 */}
      <div className="shrink-0 px-4 py-3 border-b border-background-300/60">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-foreground-950 flex items-center gap-1.5">
            <i className="ri-layout-grid-fill text-accent-300 w-4 h-4 flex items-center justify-center"></i>
            灵兽棋子
          </h3>
          <button
            onClick={onReopenSummon}
            className="font-label text-[10px] text-foreground-600 hover:text-primary-300 cursor-pointer whitespace-nowrap flex items-center gap-1"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            重新召唤
          </button>
        </div>

        <p className="text-[10px] text-foreground-600 leading-relaxed mt-1.5">
          点击卡牌选中对应灵兽,再点棋盘下半场格子放置;也可一键随机布阵。
        </p>

        <div className="flex items-center justify-between mt-2 text-[10px] text-foreground-600">
          <span>
            {lord ? `灵主:${BEASTS[lord.type].name}` : '尚未指定灵主'}
          </span>
          <span className="whitespace-nowrap">
            {placed.length}/{LINEUP_SIZE} 已部署
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-background-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-300"
            style={{ width: `${(placed.length / LINEUP_SIZE) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* 棋子列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {mine.length === 0 && (
          <div className="text-xs text-foreground-600 text-center leading-relaxed py-8">
            尚未召唤灵兽。
            <br />
            请先在「召唤出战卡牌」中挑选卡牌。
          </div>
        )}

        {mine.map((p) => {
          const card = p.fromCard ? CARDS_BY_ID[p.fromCard] : null;
          const def = BEASTS[p.type];
          const st = META[card?.category ?? 'special'];
          const sel = p.id === state.selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`text-left rounded-md border p-2.5 flex items-center gap-3 transition-all cursor-pointer ${
                sel
                  ? 'border-primary-500 bg-primary-500/15'
                  : p.placed
                  ? 'border-background-300 bg-background-100 hover:border-primary-400'
                  : 'border-background-300 bg-background-100 hover:border-accent-400'
              }`}
            >
              <div className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md border ${st.border} ${st.bg} ${st.text}`}>
                <i className={`${card?.icon ?? def.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-[13px] text-foreground-950 truncate">{card?.name ?? def.name}</span>
                  {p.isLord && <i className="ri-vip-crown-fill text-primary-400 w-3 h-3 flex items-center justify-center"></i>}
                </div>
                <div className="text-[10px] text-foreground-600 truncate">
                  {st.label}卡 · 召唤 {def.name} · HP {p.hp}
                </div>
              </div>
              <span
                className={`shrink-0 font-label text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                  p.placed
                    ? 'border-primary-400/50 text-primary-300 bg-primary-500/10'
                    : 'border-background-300 text-foreground-600 bg-background-200/60'
                }`}
              >
                {p.placed ? '已部署' : '待部署'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 底部操作 */}
      <div className="shrink-0 px-3 py-3 border-t border-background-300/60 flex flex-col gap-2">
        {selected && selected.placed && (
          <div className="flex gap-2">
            <button
              onClick={() => onMakeLord(selected.id)}
              className="flex-1 px-3 py-2 rounded-md text-xs border border-primary-400/60 text-primary-300 hover:bg-primary-500/10 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
            >
              <i className="ri-vip-crown-line w-3.5 h-3.5 flex items-center justify-center"></i>
              设为灵主
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

        <div className="flex gap-2">
          <button
            onClick={onRandomize}
            className="flex-1 px-3 py-2.5 rounded-md text-xs border border-background-300 text-foreground-800 hover:border-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <i className="ri-shuffle-line w-3.5 h-3.5 flex items-center justify-center"></i>
            随机布阵
          </button>
          <button
            onClick={onStart}
            disabled={!ready}
            className="flex-1 px-3 py-2.5 rounded-md text-xs font-label bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <i className="ri-sword-fill w-3.5 h-3.5 flex items-center justify-center"></i>
            确认出战
          </button>
        </div>

        {!ready && (
          <p className="text-[10px] text-secondary-300 text-center">
            {mine.length < LINEUP_SIZE
              ? `还需召唤 ${LINEUP_SIZE - mine.length} 只灵兽`
              : `还需部署 ${reserve.length} 只灵兽`}
          </p>
        )}
      </div>
    </div>
  );
}