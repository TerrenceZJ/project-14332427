import type { GameState } from '@/game/types';
import { MAX_TURNS } from '@/game/constants';

interface Props {
  state: GameState;
}

/** 棋盘顶部迷你战况栏:回合 / 牌库 / 双方存活棋子 */
export default function BattleStatusBar({ state }: Props) {
  const allyAlive = state.pieces.filter((p) => p.team === 'player' && p.alive).length;
  const allyTotal = state.pieces.filter((p) => p.team === 'player').length;
  const enemyAlive = state.pieces.filter((p) => p.team === 'enemy' && p.alive).length;
  const enemyTotal = state.pieces.filter((p) => p.team === 'enemy').length;

  return (
    <div className="shrink-0 h-5 min-h-5 mb-0.5 flex items-center gap-x-1.5 px-1.5 rounded border border-background-400/60 bg-background-200/80">
      <Stat icon="ri-time-line" value={`${state.turn}/${MAX_TURNS}`} tone="text-primary-300" compact />
      <Divider />
      <Stat icon="ri-flashlight-line" value={`AP:${state.ap}`} tone="text-primary-400" compact />
      <Divider />
      <Stat icon="ri-shield-star-line" value={`己:${allyAlive}/${allyTotal}`} tone="text-accent-300" compact />
      <Divider />
      <Stat icon="ri-skull-2-line" value={`敌:${enemyAlive}/${enemyTotal}`} tone="text-secondary-300" compact />
      <Divider />
      <Stat icon="ri-stack-line" value={`${state.deck.length}`} tone="text-foreground-900" compact />
    </div>
  );
}

function Stat({ icon, value, tone, compact }: { icon: string; value: string; tone: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
      <i className={`${icon} ${compact ? 'w-2 h-2' : 'w-3.5 h-3.5'} flex items-center justify-center ${tone}`}></i>
      <span className={`font-heading ${compact ? 'text-[8px]' : 'text-xs'} ${tone}`}>{value}</span>
    </span>
  );
}

function Divider() {
  return <span className="w-px h-2 bg-background-400/50"></span>;
}
