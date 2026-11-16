import type { Piece } from '@/game/types';
import { BEASTS } from '@/game/beasts';
import { getPieceBuffs } from '@/game/buffs';

interface Props {
  piece: Piece;
  onClose: () => void;
}

export default function PieceInfoPanel({ piece, onClose }: Props) {
  const def = BEASTS[piece.type];
  const isPlayer = piece.team === 'player';
  const hpPct = Math.max(0, Math.min(1, piece.hp / piece.maxHp));
  const buffs = getPieceBuffs(piece);
  const gains = buffs.filter((b) => b.tone !== 'secondary');
  const debuffs = buffs.filter((b) => b.tone === 'secondary');
  const atk = piece.atk + piece.bonusAtk + piece.tempAtk;
  const move = piece.move + piece.bonusMove;

  const fmt = (list: typeof gains) =>
    list.length ? list.map((b) => (b.count > 1 ? `${b.label}×${b.count}` : b.label)).join('、') : '无';
  const gainsText = fmt(gains);
  const debuffsText = fmt(debuffs);

  return (
    <div className="rune-border rounded-lg px-3 py-2">
      {/* 头部:头像 + 名称/职业 + HP(血量条放在右侧空白处) */}
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md border ${
            isPlayer ? 'bg-accent-500/15 border-accent-500/40 text-accent-300' : 'bg-secondary-500/15 border-secondary-500/40 text-secondary-300'
          }`}
        >
          <i className={`${def.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
        </div>
        <div className="shrink-0 flex items-baseline gap-1.5 overflow-hidden">
          <span className="font-heading text-sm text-foreground-950 whitespace-nowrap">{def.name}</span>
          <span className="text-[10px] text-foreground-600 whitespace-nowrap">{def.role}</span>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="font-label text-[9px] text-foreground-600 shrink-0">HP</span>
          <span className="font-heading text-xs text-foreground-950 tabular-nums shrink-0">{piece.hp}/{piece.maxHp}</span>
          <div className="flex-1 flex items-center gap-0.5">
            {Array.from({ length: piece.maxHp }).map((_, i) => {
              const lit = i < piece.hp;
              const color = hpPct > 0.5 ? 'bg-accent-400' : hpPct > 0.25 ? 'bg-primary-400' : 'bg-secondary-400';
              return <div key={i} className={`h-1.5 flex-1 rounded-sm ${lit ? color : 'bg-background-200'}`}></div>;
            })}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:text-primary-300 hover:border-primary-400 cursor-pointer"
        >
          <i className="ri-close-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </button>
      </div>

      {/* 属性横排:攻击 / 移动 / 射程 / 治疗 / 增益 / 减益 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5">
        <Stat label="攻击" value={atk} />
        <Stat label="移动" value={move} />
        <Stat label="射程" value={piece.range} />
        <Stat label="治疗" value={piece.heal} />
        <Stat label="增益" value={gainsText} />
        <Stat label="减益" value={debuffsText} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-label text-[10px] text-foreground-600 whitespace-nowrap">{label}</span>
      <span className="font-heading text-xs text-foreground-950">{value}</span>
    </span>
  );
}
