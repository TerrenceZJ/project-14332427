import { useCallback, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

/**
 * 让横向滚动容器支持「鼠标按住拖动」。
 * - 仅对鼠标生效(触屏交给原生滚动,保留惯性/吸附手感);
 * - 只在真正拖动(超过阈值)后才捕获指针,普通点击不受影响,卡片照常可点选;
 * - 拖动结束后会在容器层面抑制一次 click,避免拖完误触到卡片。
 */
export function useDragScroll<T extends HTMLElement>(ref: RefObject<T | null>) {
  const stateRef = useRef({
    dragging: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<T>) => {
      // 每次按下先清掉上一次遗留的抑制标记,避免误伤
      suppressClickRef.current = false;
      if (e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      stateRef.current = {
        dragging: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        moved: false,
      };
      // 注意:此处不调用 setPointerCapture,否则会把 click 重定向到容器,导致卡片点不动
    },
    [ref],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      const st = stateRef.current;
      const el = ref.current;
      if (!st.dragging || !el) return;
      const dx = e.clientX - st.startX;
      if (!st.moved && Math.abs(dx) > 5) {
        st.moved = true;
        setDragging(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* 忽略不支持指针捕获的环境 */
        }
      }
      if (st.moved) {
        e.preventDefault();
        el.scrollLeft = st.startScrollLeft - dx;
      }
    },
    [ref],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<T>) => {
      const st = stateRef.current;
      if (!st.dragging) return;
      st.dragging = false;
      setDragging(false);
      suppressClickRef.current = st.moved;
      const el = ref.current;
      if (el && st.moved) {
        try {
          el.releasePointerCapture(st.pointerId);
        } catch {
          /* 忽略 */
        }
      }
    },
    [ref],
  );

  /** 若刚发生过拖动,消费掉这一次点击(冒泡阶段兜底) */
  const consumeClickSuppression = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  /**
   * 在容器捕获阶段拦截:拖动后 click 会被重定向到容器,
   * 这里统一吞掉,确保不会触发到里面的卡片。
   */
  const onClickCapture = useCallback((e: ReactMouseEvent<T>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return {
    dragging,
    consumeClickSuppression,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}