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
    <div className="shrink-0 mb-1 md:mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-background-300/50 bg-background-100/70 px-2 py-1 md:py-1.5">
      <Stat icon="ri-time-line" label="回合" value={`${state.turn}/${MAX_TURNS}`} tone="text-primary-300" />
      <Divider />
      <Stat icon="ri-flashlight-line" label="行动点" value={`${state.ap}`} tone="text-primary-400" />
      <Divider />
      <Stat icon="ri-stack-line" label="牌库" value={`${state.deck.length}`} tone="text-foreground-900" />
      <Divider />
      <Stat icon="ri-shield-star-line" label="己方" value={`${allyAlive}/${allyTotal}`} tone="text-accent-300" />
      <Divider />
      <Stat icon="ri-skull-2-line" label="敌方" value={`${enemyAlive}/${enemyTotal}`} tone="text-secondary-300" />
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-label text-[10px]">
      <i className={`${icon} w-3.5 h-3.5 flex items-center justify-center ${tone}`}></i>
      <span className="text-foreground-600">{label}</span>
      <span className={`font-heading text-xs ${tone}`}>{value}</span>
    </span>
  );
}

function Divider() {
  return <span className="hidden sm:block w-px h-3 bg-background-300/70"></span>;
}