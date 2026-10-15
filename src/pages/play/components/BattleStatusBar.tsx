import type { GameState } from '@/game/types';
import { MAX_TURNS } from '@/game/constants';

interface Props {
  state: GameState;
}

/** 顶栏战况信息(纯中文,内联片段):回合 / 行动点 / 双方存活棋子 / 牌库 */
export default function BattleStatusBar({ state }: Props) {
  const allyAlive = state.pieces.filter((p) => p.team === 'player' && p.alive).length;
  const allyTotal = state.pieces.filter((p) => p.team === 'player').length;
  const enemyAlive = state.pieces.filter((p) => p.team === 'enemy' && p.alive).length;
  const enemyTotal = state.pieces.filter((p) => p.team === 'enemy').length;

  return (
    <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
      <Stat label="回合" value={`${state.turn}/${MAX_TURNS}`} tone="text-primary-300" />
      <Stat label="行动点" value={`${state.ap}`} tone="text-primary-400" />
      <Stat label="己方" value={`${allyAlive}/${allyTotal}`} tone="text-accent-300" />
      <Stat label="敌方" value={`${enemyAlive}/${enemyTotal}`} tone="text-secondary-300" />
      <Stat label="牌库" value={`${state.deck.length}`} tone="text-foreground-900" />
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
