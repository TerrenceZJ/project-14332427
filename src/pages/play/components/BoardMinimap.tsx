import { useRef } from 'react';
import type { GameState } from '@/game/types';
import { COLS, ROWS, key } from '@/game/constants';

export interface MinimapView {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  state: GameState;
  visible: Set<string>;
  view: MinimapView;
  onNavigate: (fx: number, fy: number) => void;
}

/** 简易小地图:展示整张棋盘缩略图 + 当前可视范围框,可点/拖跳转视角 */
export default function BoardMinimap({ state, visible, view, onNavigate }: Props) {
  const draggingRef = useRef(false);

  const navigate = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onNavigate(fx, fy);
  };

  const dots = state.pieces.filter(
    (p) => p.alive && p.placed && (p.team === 'player' || visible.has(key(p.x, p.y)))
  );

  return (
    <div
      data-no-pan
      onPointerDown={(e) => {
        e.stopPropagation();
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        navigate(e);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) navigate(e);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }}
      onPointerCancel={() => { draggingRef.current = false; }}
      onClick={(e) => e.stopPropagation()}
      className="relative w-24 h-24 md:w-28 md:h-28 rounded-md overflow-hidden border border-background-300/70 bg-background-100/90 backdrop-blur-sm cursor-crosshair select-none touch-none"
    >
      {/* 迷雾区(上半场) */}
      <div className="absolute left-0 right-0 top-0 h-1/2 bg-background-400/45"></div>
      {/* 中线 */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-primary-500/50 -translate-y-1/2"></div>
      {/* 行列网格 */}
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {Array.from({ length: ROWS * COLS }).map((_, i) => (
          <div key={i} className="border border-background-400/20"></div>
        ))}
      </div>
      {/* 棋子点 */}
      {dots.map((p) => (
        <span
          key={p.id}
          className={`absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${
            p.team === 'player' ? 'bg-accent-500' : 'bg-secondary-500'
          }`}
          style={{ left: `${((p.x + 0.5) / COLS) * 100}%`, top: `${((p.y + 0.5) / ROWS) * 100}%` }}
        ></span>
      ))}
      {/* 当前可视范围框 */}
      <div
        className="absolute border border-primary-400 bg-primary-500/15 pointer-events-none"
        style={{
          left: `${view.left * 100}%`,
          top: `${view.top * 100}%`,
          width: `${view.width * 100}%`,
          height: `${view.height * 100}%`,
        }}
      ></div>
      <span className="absolute bottom-0.5 right-1 font-label text-[8px] text-foreground-500 pointer-events-none">全局</span>
    </div>
  );
}