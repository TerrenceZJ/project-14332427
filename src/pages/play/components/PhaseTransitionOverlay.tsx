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

interface Props {
  /** 当前阶段 */
  phase: string;
  /** 当前回合 */
  turn: number;
}

/**
 * 阶段切换过渡动画:
 * 每当阶段发生变化,在屏幕中央短暂浮现该阶段名称,
 * 上下分隔线展开 + 名称由模糊缩放淡入再淡出,强化阶段推进的节奏感。
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

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-hidden">
      <div className="phase-veil-in absolute inset-0 bg-background-950/35"></div>
      <div className="phase-name-in relative flex flex-col items-center gap-2 px-6">
        <span className="phase-rule-in h-px w-40 md:w-64 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent"></span>
        <span
          className="font-heading text-3xl md:text-4xl text-foreground-950 whitespace-nowrap"
          style={{ textShadow: '0 2px 18px rgba(0,0,0,0.55)' }}
        >
          {phaseLabel[phase] ?? ''}
        </span>
        <span className="font-label text-[10px] md:text-xs text-primary-300">TURN {turn}</span>
        <span className="phase-rule-in h-px w-40 md:w-64 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent"></span>
      </div>
    </div>,
    document.body,
  );
}