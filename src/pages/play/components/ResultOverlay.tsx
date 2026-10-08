import type { GameState } from '@/game/types';
import { BEASTS } from '@/game/beasts';

interface Props {
  state: GameState;
  onRestart: () => void;
  onLobby: () => void;
}

export default function ResultOverlay({ state, onRestart, onLobby }: Props) {
  if (state.phase !== 'gameover') return null;

  const win = state.winner === 'player';
  const draw = state.winner === 'draw';

  const survived = state.pieces.filter((p) => p.team === 'player' && p.alive && p.placed);
  const slain = state.pieces.filter((p) => p.team === 'enemy' && !p.alive);
  const lost = state.pieces.filter((p) => p.team === 'player' && !p.alive);
  const pLord = state.pieces.find((p) => p.team === 'player' && p.isLord);
  const eLord = state.pieces.find((p) => p.team === 'enemy' && p.isLord);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background-50/85 backdrop-blur-md px-6">
      <div className="rune-border rounded-lg w-full max-w-lg p-8 text-center bg-background-100">
        <div
          className={`w-20 h-20 mx-auto mb-5 flex items-center justify-center rounded-full border ${
            win ? 'bg-primary-500/15 border-primary-500/50 text-primary-400'
              : draw ? 'bg-background-200 border-background-300 text-foreground-600'
              : 'bg-secondary-500/15 border-secondary-500/50 text-secondary-400'
          }`}
        >
          <i className={`${win ? 'ri-vip-crown-fill' : draw ? 'ri-scales-3-line' : 'ri-skull-2-line'} text-4xl w-9 h-9 flex items-center justify-center`}></i>
        </div>

        <h2 className="font-heading text-4xl text-foreground-950 mb-2">
          {win ? '王座加冕' : draw ? '势均力敌' : '灵主陨落'}
        </h2>
        <p className="text-sm text-foreground-700 mb-7">
          {win
            ? '你击败了敌方灵主,赢得了这场圣战!'
            : draw
            ? '双方灵主血量相同,本局以平局收场。'
            : '你的灵主再次陨落…… 王座暂时旁落。'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-md bg-background-50 border border-background-200 p-4">
            <div className="font-label text-[10px] text-foreground-600">对局回合</div>
            <div className="font-heading text-2xl text-primary-300 mt-1">{state.turn}</div>
          </div>
          <div className="rounded-md bg-background-50 border border-background-200 p-4">
            <div className="font-label text-[10px] text-foreground-600">歼灭敌方</div>
            <div className="font-heading text-2xl text-accent-300 mt-1">{slain.length}</div>
          </div>
          <div className="rounded-md bg-background-50 border border-background-200 p-4">
            <div className="font-label text-[10px] text-foreground-600">己方存活</div>
            <div className="font-heading text-2xl text-foreground-900 mt-1">{survived.length}</div>
          </div>
          <div className="rounded-md bg-background-50 border border-background-200 p-4">
            <div className="font-label text-[10px] text-foreground-600">己方阵亡</div>
            <div className="font-heading text-2xl text-secondary-300 mt-1">{lost.length}</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6 text-[11px] text-foreground-700">
          {pLord && <span className="px-2.5 py-1 rounded-full bg-accent-500/10 border border-accent-500/30">己方灵主:{BEASTS[pLord.type].name} · {pLord.alive ? `${pLord.hp}血` : '阵亡'}</span>}
          {eLord && <span className="px-2.5 py-1 rounded-full bg-secondary-500/10 border border-secondary-500/30">敌方灵主:{BEASTS[eLord.type].name} · {eLord.alive ? `${eLord.hp}血` : '阵亡'}</span>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onLobby}
            className="flex-1 px-5 py-3.5 rounded-md text-sm border border-background-300 text-foreground-800 hover:border-primary-400 hover:text-primary-300 cursor-pointer whitespace-nowrap"
          >
            返回大厅
          </button>
          <button
            onClick={onRestart}
            className="flex-1 px-5 py-3.5 rounded-md text-sm font-label bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            再战一局
          </button>
        </div>
      </div>
    </div>
  );
}