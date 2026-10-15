import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const phaseLabel: Record<string, string> = {
  deploy: '部署阶段',
  card1: '抽卡阶段',
  command: '指令阶段',
  card2: '援救阶段',
  execute: '同步执行',
  gameover: '战斗结束',
};

const CN_DIGIT = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 把数字转为中文序数回合名,如 1 → 第一回合、12 → 第十二回合 */
function turnLabel(turn: number): string {
  if (turn <= 10) return `第${CN_DIGIT[turn]}回合`;
  return `第十${CN_DIGIT[turn - 10]}回合`;
}

interface Props {
  /** 当前阶段 */
  phase: string;
  /** 当前回合 */
  turn: number;
}

/**
 * 阶段切换过渡动画:
 * 每当阶段发生变化,在屏幕中央短暂浮现提示。
 * 新回合开始(进入抽卡阶段)时,主标题显示「第 X 回合」,副标题显示阶段名;
 * 其余阶段主标题显示阶段名,副标题显示当前回合。
 * 纯展示层,不拦截任何点击。
 */
export default function PhaseTransitionOverlay({ phase, turn }: Props) {
  const [show, setShow] = useState(false);
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (prevPhaseRef.current === phase) return;
    prevPhaseRef.current = phase;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1150);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (!show) return null;

  const isTurnStart = phase === 'card1';
  const title = isTurnStart ? turnLabel(turn) : (phaseLabel[phase] ?? '');
  const subtitle = isTurnStart ? phaseLabel[phase] : phase === 'gameover' ? '' : turnLabel(turn);

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-hidden">
      <div className="phase-veil-in absolute inset-0 bg-background-950/35"></div>
      <div className="phase-name-in relative flex flex-col items-center gap-2 px-6">
        <span className="phase-rule-in h-px w-40 md:w-64 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent"></span>
        <span
          className="font-heading text-3xl md:text-4xl text-foreground-950 whitespace-nowrap"
          style={{ textShadow: '0 2px 18px rgba(0,0,0,0.55)' }}
        >
          {title}
        </span>
        {subtitle && <span className="font-label text-[10px] md:text-xs text-primary-300">{subtitle}</span>}
        <span className="phase-rule-in h-px w-40 md:w-64 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent"></span>
      </div>
    </div>,
    document.body,
  );
}
