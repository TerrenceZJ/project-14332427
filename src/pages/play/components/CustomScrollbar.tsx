import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface Props {
  scrollRef: RefObject<HTMLDivElement | null>;
}

const MIN_THUMB = 28;

/**
 * 自定义垂直滚动条(移动端原生滚动条不可见/不可自定义时的替代方案)。
 * - 渲染一条始终可见的轨道 + 金色滑块,带内阴影与描边,立体感更强;
 * - 滑块 / 轨道可点击、可拖动(pointer 事件,兼容触屏与鼠标);
 * - 内容不足一屏时自动隐藏。
 */
export default function CustomScrollbar({ scrollRef }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ top: 0, height: 0, visible: false });
  const dragIdRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const sh = el.scrollHeight;
    const ch = el.clientHeight;
    if (sh <= ch) {
      setBar((b) => (b.visible ? { top: 0, height: 0, visible: false } : b));
      return;
    }
    const trackH = track.clientHeight;
    const thumbH = Math.max(MIN_THUMB, (ch / sh) * trackH);
    const maxTop = trackH - thumbH;
    const top = (el.scrollTop / (sh - ch)) * maxTop;
    setBar({ top, height: thumbH, visible: true });
  }, [scrollRef]);

  const compute = useCallback((clientY: number) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const sh = el.scrollHeight;
    const ch = el.clientHeight;
    if (sh <= ch) return;
    const rect = track.getBoundingClientRect();
    const thumbH = Math.max(MIN_THUMB, (ch / sh) * rect.height);
    const maxTop = rect.height - thumbH;
    const ratio = maxTop > 0 ? (clientY - rect.top - thumbH / 2) / maxTop : 0;
    el.scrollTop = Math.max(0, Math.min(1, ratio)) * (sh - ch);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    if (trackRef.current) ro.observe(trackRef.current);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollRef, update]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragIdRef.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    compute(e.clientY);
  }, [compute]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragIdRef.current !== e.pointerId) return;
    compute(e.clientY);
  }, [compute]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragIdRef.current === e.pointerId) {
      dragIdRef.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 忽略 */ }
    }
  }, []);

  return (
    <div
      ref={trackRef}
      className={`absolute right-1.5 inset-y-3 w-2 rounded-full transition-opacity duration-150 ${
        bar.visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        background: 'oklch(var(--foreground-400) / 0.22)',
        border: '1px solid oklch(var(--primary-500) / 0.55)',
        boxShadow: 'inset 0 2px 4px oklch(var(--background-950) / 0.65), 0 0 6px oklch(var(--primary-500) / 0.25)',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {bar.visible && (
        <div
          className="absolute left-0 w-full rounded-full"
          style={{
            top: bar.top,
            height: bar.height,
            background: 'oklch(var(--primary-500) / 0.8)',
            boxShadow: 'inset 0 1px 1px oklch(var(--background-950) / 0.4), 0 1px 3px oklch(var(--background-950) / 0.5)',
          }}
        />
      )}
    </div>
  );
}
