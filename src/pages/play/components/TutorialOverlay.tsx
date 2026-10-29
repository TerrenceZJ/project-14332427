import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TutorialStep } from '@/game/levels';

interface Props {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

const BUBBLE_W = 300;
const BUBBLE_H = 190;

function bubbleStyle(rect: DOMRect | null): CSSProperties {
  if (!rect) return {};
  const margin = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const left = Math.min(Math.max(rect.left + rect.width / 2 - BUBBLE_W / 2, 8), vw - BUBBLE_W - 8);

  // 大目标(如棋盘):气泡放屏幕底部,避免遮挡目标中心或被挤出屏幕
  if (rect.height > 260) {
    return { left, top: Math.max(8, vh - BUBBLE_H - 16), width: BUBBLE_W };
  }

  let top = rect.bottom + margin;
  if (top + BUBBLE_H > vh - 8) {
    top = rect.top - margin - BUBBLE_H;
  }
  if (top < 8) top = 8;

  return { left, top, width: BUBBLE_W };
}

const block = (e: React.MouseEvent) => e.stopPropagation();

/** 新手教程引导层:遮罩拦截非高亮区域的点击,高亮可操作元素,等待操作完成后自动推进 */
export default function TutorialOverlay({ step, stepIndex, totalSteps, onNext, onSkip }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const waiting = step.wait?.type !== 'none';

  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro.disconnect();
    };
  }, [step]);

  const bubble = (
    <div
      className="absolute z-[102] rounded-lg rune-border bg-background-100/95 backdrop-blur px-4 py-3 shadow-xl pointer-events-auto"
      style={rect ? bubbleStyle(rect) : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: BUBBLE_W }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-label text-[9px] text-primary-400">TUTORIAL</span>
        <span className="ml-auto font-label text-[9px] text-foreground-600">{stepIndex + 1}/{totalSteps}</span>
      </div>
      <h3 className="font-heading text-base text-foreground-950 leading-snug">{step.title}</h3>
      <p className="mt-1.5 text-xs text-foreground-700 leading-relaxed">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onSkip}
          className="px-2.5 py-1.5 rounded-md text-xs border border-background-300 text-foreground-600 hover:text-foreground-900 cursor-pointer"
        >
          跳过教程
        </button>
        {!waiting && (
          <button
            onClick={onNext}
            className="ml-auto px-4 py-1.5 rounded-md text-xs font-label bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
          >
            {stepIndex >= totalSteps - 1 ? '开始战斗' : '知道了'}
          </button>
        )}
      </div>
    </div>
  );

  if (!rect) {
    // 无目标元素时:全屏遮罩 + 居中气泡
    return (
      <div className="fixed inset-0 z-[100] bg-background-950/75 pointer-events-auto" onClick={block}>
        {bubble}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* 四块遮罩:拦截非高亮区域的点击,高亮区域可穿透 */}
      <div className="absolute bg-background-950/55 pointer-events-auto" style={{ left: 0, top: 0, right: 0, height: Math.max(0, rect.top) }} onClick={block} />
      <div className="absolute bg-background-950/55 pointer-events-auto" style={{ left: 0, top: rect.bottom, right: 0, bottom: 0 }} onClick={block} />
      <div className="absolute bg-background-950/55 pointer-events-auto" style={{ left: 0, top: rect.top, width: Math.max(0, rect.left), height: rect.height }} onClick={block} />
      <div className="absolute bg-background-950/55 pointer-events-auto" style={{ left: rect.right, top: rect.top, right: 0, height: rect.height }} onClick={block} />

      {/* 高亮框 */}
      <div
        className="absolute rounded-md border-2 border-primary-400 pointer-events-none"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, boxShadow: '0 0 0 3px oklch(var(--primary-400) / 0.35)' }}
      />

      {bubble}
    </div>
  );
}
