import { useEffect, useState } from 'react';
import type { GameState, AutoCommandStyle } from '@/game/types';
import type { PlaySpeed } from '@/pages/play/hooks/useBattle';
import { MAX_TURNS, START_AP } from '@/game/constants';
import CountdownRingFrame from './CountdownRingFrame';

interface Props {
  state: GameState;
  busy: boolean;
  speed: PlaySpeed;
  /** 部署阶段中若召唤卡牌弹窗仍开启,则暂停倒计时 */
  paused?: boolean;
  onTimeout: () => void;
  onEnd: () => void;
  onSkip: () => void;
  onToggleSpeed: () => void;
  /** 指令阶段查看敌方全部卡牌 */
  onViewEnemyDeck?: () => void;
  /** 指令阶段 AI 代玩家自动下达所有棋子指令 */
  onAutoCommand?: () => void;
  /** 自动指令风格 */
  autoStyle?: AutoCommandStyle;
  onAutoStyle?: (style: AutoCommandStyle) => void;
}

/** 自动指令可选风格 */
const AUTO_STYLES: { id: AutoCommandStyle; label: string; icon: string; tip: string }[] = [
  { id: 'aggressive', label: '激进', icon: 'ri-fire-line', tip: '激进压上:主动扑向视野内最近的敌人(偏好残血)' },
  { id: 'defensive', label: '保守', icon: 'ri-shield-line', tip: '保守防御:据守反击,威胁在外时后撤结阵' },
  { id: 'focusLord', label: '集火', icon: 'ri-focus-3-line', tip: '优先集火:优先攻击敌方灵主' },
];

const phaseLabel: Record<string, string> = {
  deploy: '部署阶段',
  card1: '抽卡阶段',
  command: '指令阶段',
  card2: '援救阶段',
  execute: '同步执行',
  gameover: '战斗结束',
};

const confirmLabel: Record<string, string> = {
  card1: '结束抽卡 · 下指令',
  command: '结束指令 · 用卡牌',
  card2: '结束 · 同步执行',
};

export default function TurnHeader({ state, busy, speed, paused, onTimeout, onEnd, onSkip, onToggleSpeed, onViewEnemyDeck, onAutoCommand, autoStyle, onAutoStyle }: Props) {
  // 需要倒计时的阶段:部署(1 分钟)/ 抽卡(2 分钟)/ 指令(1 分钟)/ 援救(40 秒)
  const countdown = state.phase === 'deploy' || state.phase === 'card1' || state.phase === 'command' || state.phase === 'card2';
  // 仅这些阶段可通过按钮手动结束(部署阶段由面板内的「确认出战」结束)
  const canEnd = state.phase === 'card1' || state.phase === 'command' || state.phase === 'card2';
  const [count, setCount] = useState(60);

  useEffect(() => {
    setCount(
      state.phase === 'deploy' ? 60 : state.phase === 'card1' ? 120 : state.phase === 'command' ? 60 : 40,
    );
  }, [state.phase, state.turn]);

  useEffect(() => {
    if (!countdown || busy || paused) return;
    const t = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(t);
          onTimeout();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [state.phase, state.turn, busy, countdown, paused, onTimeout]);

  const apPct = (state.ap / START_AP) * 100;
  const phaseTotal = state.phase === 'deploy' ? 60 : state.phase === 'card1' ? 120 : state.phase === 'command' ? 60 : 40;
  const mm = String(Math.floor(count / 60)).padStart(2, '0');
  const ss = String(count % 60).padStart(2, '0');
  return (
    <div className="rune-border rounded-lg px-3 py-2.5 shrink-0">
      {/* 回合 + 阶段 + 敌方点数 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-500/15 border border-primary-500/40">
            <span className="font-heading text-primary-400 text-base">{state.turn}</span>
          </div>
          <div className="leading-tight">
            <div className="font-heading text-sm text-foreground-950 whitespace-nowrap">{phaseLabel[state.phase]}</div>
            <div className="font-label text-[9px] text-foreground-600 whitespace-nowrap">TURN {state.turn}/{MAX_TURNS}</div>
          </div>
        </div>
        <span className="font-label text-[10px] text-secondary-300 whitespace-nowrap">敌 AP {state.enemyAp}</span>
      </div>

      {/* 行动点 */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="font-label text-[10px] text-foreground-600 whitespace-nowrap">行动点</span>
        <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all" style={{ width: `${apPct}%` }}></div>
        </div>
        <span className="text-xs whitespace-nowrap">
          <span className="font-heading text-primary-300">剩 {state.ap}</span>
          <span className="text-foreground-600">/{START_AP}</span>
        </span>
      </div>

      {/* 倒计时 / 结算控制 */}
      <div className="mt-2.5">
        {state.phase === 'execute' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-1 py-0.5 rounded-full bg-background-200/70 border border-background-300/50">
              <button
                onClick={() => { if (speed !== 'normal') onToggleSpeed(); }}
                className={`px-3 py-1 rounded-full font-label text-xs whitespace-nowrap cursor-pointer transition-colors ${
                  speed === 'normal' ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
                }`}
              >
                普通
              </button>
              <button
                onClick={() => { if (speed !== 'fast') onToggleSpeed(); }}
                className={`px-3 py-1 rounded-full font-label text-xs whitespace-nowrap cursor-pointer transition-colors ${
                  speed === 'fast' ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
                }`}
              >
                快进
              </button>
            </div>
            <button
              onClick={onSkip}
              className="ml-auto px-3 py-1.5 rounded-md font-label text-xs border border-secondary-500/50 text-secondary-300 hover:bg-secondary-500/10 cursor-pointer whitespace-nowrap"
            >
              跳过动画
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <i className="ri-timer-line w-4 h-4 flex items-center justify-center text-foreground-600"></i>
              <span className={`font-heading text-lg ${count <= 10 ? 'text-secondary-400' : 'text-foreground-900'}`}>
                {mm}:{ss}
              </span>
            </div>

            {canEnd && (
              <CountdownRingFrame remaining={count} total={phaseTotal} warnAt={10} radius={6} className="ml-auto flex-1">
                <button
                  onClick={onEnd}
                  disabled={busy}
                  className="w-full px-3 py-2 rounded-md font-label text-xs bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {busy ? '结算中…' : confirmLabel[state.phase]}
                </button>
              </CountdownRingFrame>
            )}
          </div>
        )}

        {/* 指令阶段工具:自动指令风格 / 查看敌方牌组 / AI 自动下达指令 */}
        {state.phase === 'command' && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-background-200/70 border border-background-300/50">
              {AUTO_STYLES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onAutoStyle?.(o.id)}
                  disabled={busy}
                  title={o.tip}
                  className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-full font-label text-[11px] whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    autoStyle === o.id ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
                  }`}
                >
                  <i className={`${o.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onViewEnemyDeck}
                disabled={busy}
                title="查看敌方牌组全部 20 张卡牌"
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md font-label text-xs border border-secondary-500/50 text-secondary-300 hover:bg-secondary-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <i className="ri-eye-line w-4 h-4 flex items-center justify-center"></i>
                敌方牌组
              </button>
              <button
                onClick={onAutoCommand}
                disabled={busy}
                title="AI 自动为所有棋子下达指令"
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md font-label text-xs border border-accent-500/50 text-accent-300 hover:bg-accent-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <i className="ri-magic-line w-4 h-4 flex items-center justify-center"></i>
                自动指令
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}