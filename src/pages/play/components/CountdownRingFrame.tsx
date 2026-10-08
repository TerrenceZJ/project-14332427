import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** 剩余秒数 */
  remaining: number;
  /** 该阶段总秒数 */
  total: number;
  /** 剩余多少秒开始进入警戒色 */
  warnAt?: number;
  /** 圆角半径(需与按钮的 rounded-* 大致一致) */
  radius?: number;
  className?: string;
  children: ReactNode;
}

/** 复用同一个 AudioContext,避免频繁创建导致资源泄漏 */
let sharedAudioCtx: AudioContext | null = null;

/** 播放一声短促的提示音(时间紧迫时音调更高、更急促) */
function playAlarmBeep(urgent: boolean) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = urgent ? 'square' : 'sine';
    osc.frequency.setValueAtTime(urgent ? 920 : 680, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(urgent ? 0.11 : 0.08, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  } catch {
    /* 音效失败不影响倒计时本身 */
  }
}

/**
 * 阶段推进按钮的倒计时进度环:
 * 沿按钮外沿画一圈圆角矩形进度环,剩余时间越少环越短;
 * 剩余时间进入警戒阈值后变成警戒色并轻微脉动;
 * 同时每秒触发一次震动 + 提示音,进入最后 3 秒时加强提醒,减少超时误操作。
 */
export default function CountdownRingFrame({
  remaining,
  total,
  warnAt = 10,
  radius = 6,
  className = '',
  children,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const lastAlertRef = useRef(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((p) =>
        Math.abs(p.w - r.width) > 0.5 || Math.abs(p.h - r.height) > 0.5
          ? { w: r.width, h: r.height }
          : p,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 进入警戒区后,每一秒触发一次震动 + 提示音(最后 3 秒加强)
  useEffect(() => {
    if (remaining > warnAt) {
      lastAlertRef.current = -1;
      return;
    }
    if (remaining <= 0 || lastAlertRef.current === remaining) return;
    lastAlertRef.current = remaining;
    const urgent = remaining <= 3;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(urgent ? [50, 45, 50] : 45);
      }
    } catch {
      /* 震动失败忽略 */
    }
    playAlarmBeep(urgent);
  }, [remaining, warnAt]);

  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const warn = remaining <= warnAt;
  const urgent = remaining <= 3;
  const w = box.w;
  const h = box.h;
  const r = Math.min(radius, w / 2, h / 2);

  const d =
    w > 0 && h > 0
      ? `M ${w / 2} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} ` +
        `A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} ` +
        `A ${r} ${r} 0 0 1 0 ${h - r} V ${r} ` +
        `A ${r} ${r} 0 0 1 ${r} 0 Z`
      : '';

  return (
    <span
      ref={ref}
      className={`relative inline-flex rounded-md ${warn ? 'countdown-warn' : ''} ${
        urgent ? 'countdown-urgent' : ''
      } ${className}`}
    >
      {children}
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className={`absolute inset-0 pointer-events-none overflow-visible ${warn ? 'animate-pulse' : ''}`}
        >
          {/* 轨道 */}
          <path
            d={d}
            fill="none"
            strokeWidth={2.5}
            pathLength={100}
            stroke="oklch(var(--background-300) / 0.6)"
          />
          {/* 进度 */}
          <path
            d={d}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 * (1 - frac)}
            stroke={warn ? 'oklch(var(--secondary-500))' : 'oklch(var(--primary-500))'}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
      )}
    </span>
  );
}