import { useEffect, useRef, useState } from 'react';

/**
 * 为条件渲染的元素提供「进入 + 退出」过渡。
 *
 * - active 为 true:元素先以「未进入」状态挂载,下一帧切到「已进入」,从而播放滑入动画。
 * - active 变 false:元素保持挂载 duration 毫秒以播放滑出动画,结束后才真正卸载。
 *
 * @returns mounted 是否应渲染该元素;entered 是否处于「已进入」态(用于切换过渡类名)
 */
export default function useMountTransition(active: boolean, duration = 260) {
  const [mounted, setMounted] = useState(active);
  const [entered, setEntered] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (active) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    timer.current = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer.current);
  }, [active, duration]);

  return { mounted, entered };
}