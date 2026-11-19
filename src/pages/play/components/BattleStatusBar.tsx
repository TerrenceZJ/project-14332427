import type { GameState, Piece } from '@/game/types';
import { BEASTS } from '@/game/beasts';
import { MAX_TURNS } from '@/game/constants';

interface Props {
  state: GameState;
}

/** 顶栏战况信息:回合数、己方/敌方棋子以职业图标显示(存活亮起,阵亡变暗并划斜痕),以及牌库 */
export default function BattleStatusBar({ state }: Props) {
  const ally = state.pieces.filter((p) => p.team === 'player');
  const enemy = state.pieces.filter((p) => p.team === 'enemy');

  return (
    <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
      <Stat label="回合" value={`${state.turn}/${MAX_TURNS}`} tone="text-primary-300" />
      <PieceRow pieces={ally} tone="ally" />
      <span className="text-foreground-400 text-[10px] leading-none">|</span>
      <PieceRow pieces={enemy} tone="enemy" />
      {!state.skillMode && <Stat label="牌库" value={`${state.deck.length}`} tone="text-foreground-900" />}
    </span>
  );
}

function PieceRow({ pieces, tone }: { pieces: Piece[]; tone: 'ally' | 'enemy' }) {
  const lit = tone === 'ally' ? 'text-accent-300' : 'text-secondary-300';
  return (
    <span className="inline-flex items-center gap-0.5">
      {pieces.map((p) => (
        <span key={p.id} className="relative w-5 h-5 flex items-center justify-center">
          <i
            className={`${BEASTS[p.type].icon} text-[15px] w-5 h-5 flex items-center justify-center ${
              p.alive ? lit : 'text-foreground-600/40'
            }`}
          ></i>
          {!p.alive && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-[2px] h-[16px] rounded-full bg-secondary-400/80 rotate-45"></span>
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      <span className="font-label text-[9px] text-foreground-600">{label}</span>
      <span className={`font-heading text-[10px] ${tone}`}>{value}</span>
    </span>
  );
}
