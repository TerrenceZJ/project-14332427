import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GameState, TurnEvent } from '@/game/types';
import { COLS, ROWS, MID, key, colLabel } from '@/game/constants';
import PieceToken from './PieceToken';
import DeployTrail from './DeployTrail';
import DeathBurst from './DeathBurst';
import BoardMinimap from './BoardMinimap';
import BattleStatusBar from './BattleStatusBar';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export interface BattleBoardHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Props {
  state: GameState;
  visible: Set<string>;
  selectedId: string | null;
  moveCells: Set<string>;
  rangeCells: Set<string>;
  targetPieceIds: Set<string>;
  events: TurnEvent[];
  onCellClick: (x: number, y: number) => void;
  /** 缩放比例变化回调,便于外部同步显示 */
  onZoomChange?: (zoom: number) => void;
}

const BattleBoard = forwardRef<BattleBoardHandle, Props>(function BattleBoard(
  { state, visible, selectedId, moveCells, rangeCells, targetPieceIds, events, onCellClick, onZoomChange }: Props,
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const cellPct = 100 / COLS;

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [side, setSide] = useState(0);

  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const suppressClickRef = useRef(false);
  // 双指缩放:记录当前按下的指针与捏合起始状态
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; c0x: number; c0y: number } | null>(null);

  const updateView = (z: number, o: { x: number; y: number }) => {
    zoomRef.current = z;
    offsetRef.current = o;
    setZoom(z);
    setOffset(o);
    onZoomChange?.(z);
  };

  // 平移量(以棋盘宽度百分比计)不得超过缩放露出的范围,保证画面始终铺满
  const clampOffset = (o: { x: number; y: number }, z: number) => {
    const max = ((z - 1) / 2) * 100;
    return {
      x: Math.min(max, Math.max(-max, o.x)),
      y: Math.min(max, Math.max(-max, o.y)),
    };
  };

  const zoomAt = (factor: number, cx = 0.5, cy = 0.5) => {
    const z = zoomRef.current;
    const o = offsetRef.current;
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
    if (Math.abs(nz - z) < 0.001) return;
    // 以光标处为锚点缩放,该点缩放前后位置保持不变
    const px = (cx - 0.5 + 0.5 * z - o.x / 100) / z;
    const py = (cy - 0.5 + 0.5 * z - o.y / 100) / z;
    const nx = (cx - 0.5 - nz * (px - 0.5)) * 100;
    const ny = (cy - 0.5 - nz * (py - 0.5)) * 100;
    updateView(nz, clampOffset({ x: nx, y: ny }, nz));
  };

  const resetView = () => updateView(1, { x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(0.8),
    resetView: () => updateView(1, { x: 0, y: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width;
      const cy = (e.clientY - rect.top) / rect.height;
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 测量可用区域,让棋盘始终取宽高中较小者作为边长,保证格子为正方形
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const s = Math.floor(Math.min(r.width, r.height));
      if (s > 0) setSide((prev) => (Math.abs(prev - s) > 1 ? s : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, [data-no-pan]')) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    // 双指按住:进入捏合缩放
    if (pointersRef.current.size >= 2) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) {
        const pts = [...pointersRef.current.values()];
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const z0 = zoomRef.current;
        const o0 = offsetRef.current;
        pinchRef.current = {
          dist,
          zoom: z0,
          c0x: ((midX - rect.left) / rect.width - 0.5 - o0.x / 100) / z0 + 0.5,
          c0y: ((midY - rect.top) / rect.height - 0.5 - o0.y / 100) / z0 + 0.5,
        };
      }
      dragRef.current.active = false;
      setDragging(false);
      suppressClickRef.current = true;
      return;
    }

    // 单指:仅在放大后可拖动画面
    if (zoomRef.current <= 1) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指:以中点作锚点缩放
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pts = [...pointersRef.current.values()];
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const p = pinchRef.current;
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.zoom * (curDist / p.dist)));
      const f1x = (midX - rect.left) / rect.width;
      const f1y = (midY - rect.top) / rect.height;
      updateView(nz, clampOffset({
        x: (f1x - 0.5 - (p.c0x - 0.5) * nz) * 100,
        y: (f1y - 0.5 - (p.c0y - 0.5) * nz) * 100,
      }, nz));
      suppressClickRef.current = true;
      return;
    }

    const d = dragRef.current;
    if (!d.active) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const nx = d.originX + (dx / rect.width) * 100;
    const ny = d.originY + (dy / rect.height) * 100;
    updateView(zoomRef.current, clampOffset({ x: nx, y: ny }, zoomRef.current));
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size > 0) return;
    const d = dragRef.current;
    if (d.active && d.moved) suppressClickRef.current = true;
    d.active = false;
    setDragging(false);
  };

  const handleNavigate = (fx: number, fy: number) => {
    const z = zoomRef.current;
    if (z <= 1) return;
    updateView(z, clampOffset({ x: z * (0.5 - fx) * 100, y: z * (0.5 - fy) * 100 }, z));
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) onCellClick(x, y);
  };

  // 当前可视范围在整张棋盘中的位置(0~1),供小地图绘制视野框
  const viewRect = {
    left: Math.max(0, Math.min(1, 0.5 - (0.5 + offset.x / 100) / zoom)),
    top: Math.max(0, Math.min(1, 0.5 - (0.5 + offset.y / 100) / zoom)),
    width: 1 / zoom,
    height: 1 / zoom,
  };

  const cells = Array.from({ length: ROWS * COLS });
  const shownPieces = state.pieces.filter(
    (p) => p.alive && p.placed && (p.team === 'player' || visible.has(key(p.x, p.y)))
  );
  const pendingMoves = (state.phase === 'command' || state.phase === 'card2')
    ? state.pieces.filter((p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0)
    : [];

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <BattleStatusBar state={state} />
      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div
          className="h-full aspect-square max-w-full flex flex-col min-h-0"
          style={side > 0 ? { width: `${side}px`, height: `${side}px` } : undefined}
        >
          <div className="flex-1 min-h-0 flex items-stretch">
        {/* 行号(左侧) */}
        <div className="hidden lg:flex flex-col shrink-0 w-4 mr-1">
          {Array.from({ length: ROWS }).map((_, y) => (
            <div key={`r-${y}`} className="flex-1 flex items-center justify-center text-[8px] text-foreground-500 font-label">
              {y + 1}
            </div>
          ))}
        </div>

        <div
        ref={viewportRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => endDrag(e)}
        className={`relative flex-1 min-w-0 min-h-0 rounded-lg overflow-hidden border border-background-300/60 bg-background-200/40 select-none touch-none ${
          zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
        }`}
      >
        <div
          ref={contentRef}
          className="absolute inset-0"
          style={{ transform: `translate(${offset.x}%, ${offset.y}%) scale(${zoom})`, transformOrigin: 'center center' }}
        >
        {/* 格子层 */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {cells.map((_, i) => {
            const x = i % COLS;
            const y = Math.floor(i / COLS);
            const enemyHalf = y < MID;
            const k = key(x, y);
            const fog = enemyHalf && !visible.has(k);
            const isMove = moveCells.has(k);
            const isRange = !isMove && rangeCells.has(k);
            const checker = (x + y) % 2 === 0;
            return (
              <div
                key={i}
                className={`border border-background-400/40 relative ${
                  fog
                    ? 'bg-background-400/70'
                    : enemyHalf
                    ? checker
                      ? 'bg-secondary-500/[0.06]'
                      : 'bg-secondary-500/[0.11]'
                    : checker
                    ? 'bg-accent-500/[0.05]'
                    : 'bg-accent-500/[0.10]'
                }`}
              >
                {isMove && <div className="absolute inset-0 bg-primary-400/40"></div>}
                {isMove && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-300"></div>
                  </div>
                )}
                {isRange && <div className="absolute inset-0 bg-secondary-400/25"></div>}
              </div>
            );
          })}
        </div>

        {/* 中线 */}
        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-primary-500/40 -translate-y-1/2 z-10"></div>

        {/* 部署轨迹虚线 */}
        {state.phase === 'deploy' && <DeployTrail trail={state.deployTrail} />}

        {/* 持续性伤害区域(骑士陷阵) */}
        {state.dotZones.map((z) => (
          <div
            key={z.id}
            className="absolute pointer-events-none bg-secondary-500/15 border border-secondary-400/40"
            style={{
              left: `${((z.x - 1) / COLS) * 100}%`,
              top: `${((z.y - 1) / ROWS) * 100}%`,
              width: `${(3 / COLS) * 100}%`,
              height: `${(3 / ROWS) * 100}%`,
              zIndex: 6,
            }}
          ></div>
        ))}

        {/* 指令阶段:移动目标虚影 */}
        {pendingMoves.map((p) => {
          const dest = p.path[p.path.length - 1];
          return (
            <div
              key={`dest-${p.id}`}
              className="absolute pointer-events-none border-2 border-dashed border-primary-400/70 bg-primary-500/10 rounded-md"
              style={{
                left: `${(dest.x / COLS) * 100}%`,
                top: `${(dest.y / ROWS) * 100}%`,
                width: `${cellPct}%`,
                height: `${cellPct}%`,
                zIndex: 7,
              }}
            ></div>
          );
        })}

        {/* 指令阶段:移动轨迹虚线(折线路径) */}
        {pendingMoves.map((p) => {
          const pts = [{ x: p.x, y: p.y }, ...p.path];
          return (
            <Fragment key={`line-${p.id}`}>
              {pts.slice(0, -1).map((a, i) => {
                const b = pts[i + 1];
                const ax = ((a.x + 0.5) / COLS) * 100;
                const ay = ((a.y + 0.5) / ROWS) * 100;
                const bx = ((b.x + 0.5) / COLS) * 100;
                const by = ((b.y + 0.5) / ROWS) * 100;
                const dx = bx - ax;
                const dy = by - ay;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                return (
                  <div
                    key={`seg-${i}`}
                    className="absolute pointer-events-none border-t-2 border-dashed border-primary-400/70"
                    style={{
                      left: `${(ax + bx) / 2}%`,
                      top: `${(ay + by) / 2}%`,
                      width: `${len}%`,
                      transform: `translate(-50%, -50%) rotate(${angle}rad)`,
                      zIndex: 8,
                    }}
                  ></div>
                );
              })}
            </Fragment>
          );
        })}

        {/* 指令阶段:草稿路径步数序号 */}
        {pendingMoves.map((p) => (
          <Fragment key={`steps-${p.id}`}>
            {p.path.map((c, i) => (
              <div
                key={`step-${p.id}-${i}`}
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  left: `${(c.x / COLS) * 100}%`,
                  top: `${(c.y / ROWS) * 100}%`,
                  width: `${cellPct}%`,
                  height: `${cellPct}%`,
                  zIndex: 9,
                }}
              >
                <span className="w-4 h-4 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-[9px] font-label">
                  {i + 1}
                </span>
              </div>
            ))}
          </Fragment>
        ))}

        {/* 棋子 */}
        {shownPieces.map((p) => (
          <PieceToken
            key={p.id}
            piece={p}
            cellPct={cellPct}
            revealLord={p.team === 'player' || p.lordRevealed}
            selected={p.id === selectedId}
            targetable={targetPieceIds.has(p.id)}
            faded={(state.phase === 'command' || state.phase === 'card2') && p.team === 'player' && p.path.length > 0}
          />
        ))}

        {/* 事件飘字 + 攻击指向线 */}
        {events.map((ev, i) => {
          if (ev.type === 'attack') {
            const hasFrom = ev.fx !== undefined && ev.fy !== undefined;
            const ax = ((ev.fx ?? ev.x) + 0.5) / COLS * 100;
            const ay = ((ev.fy ?? ev.y) + 0.5) / ROWS * 100;
            const bx = (ev.x + 0.5) / COLS * 100;
            const by = (ev.y + 0.5) / ROWS * 100;
            const isPlayerAttack = state.pieces.some(p => p.x === ev.fx && p.y === ev.fy && p.team === 'player');
            const lineColor = isPlayerAttack ? 'oklch(var(--accent-400))' : 'oklch(var(--secondary-400))';

            return (
              <Fragment key={`attack-${i}`}>
                {hasFrom && (
                  <div
                    className="absolute rounded-full attack-projectile"
                    style={{
                      backgroundColor: lineColor,
                      boxShadow: `0 0 12px ${lineColor}, 0 0 24px ${lineColor}`,
                      width: '14px',
                      height: '14px',
                      zIndex: 39,
                      ['--sx' as string]: `${ax}%`,
                      ['--sy' as string]: `${ay}%`,
                      ['--tx' as string]: `${bx}%`,
                      ['--ty' as string]: `${by}%`,
                    }}
                  ></div>
                )}
                {!hasFrom && ev.amount !== undefined && (
                  <>
                    <div
                      className="absolute pointer-events-none hit-burst rounded-full border-2"
                      style={{
                        left: `${bx}%`,
                        top: `${by}%`,
                        width: `${cellPct * 1.3}%`,
                        height: `${cellPct * 1.3}%`,
                        borderColor: lineColor,
                        zIndex: 38,
                      }}
                    ></div>
                    <div
                      className="absolute pointer-events-none font-heading text-sm font-bold dmg-float"
                      style={{
                        left: `${((ev.x + 0.5) / COLS) * 100}%`,
                        top: `${((ev.y + 0.5) / ROWS) * 100}%`,
                        zIndex: 40,
                        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                        color: lineColor,
                      }}
                    >
                      -{ev.amount}
                    </div>
                  </>
                )}
              </Fragment>
            );
          }
          if (ev.type === 'heal') {
            return (
              <Fragment key={`heal-${i}`}>
                <div
                  className="absolute pointer-events-none hit-burst rounded-full border-2 border-accent-300/80"
                  style={{
                    left: `${((ev.x + 0.5) / COLS) * 100}%`,
                    top: `${((ev.y + 0.5) / ROWS) * 100}%`,
                    width: `${cellPct * 1.3}%`,
                    height: `${cellPct * 1.3}%`,
                    zIndex: 38,
                  }}
                ></div>
                <div
                  className="absolute pointer-events-none font-heading text-sm font-bold text-accent-300 dmg-float"
                  style={{
                    left: `${((ev.x + 0.5) / COLS) * 100}%`,
                    top: `${((ev.y + 0.5) / ROWS) * 100}%`,
                    zIndex: 40,
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}
                >
                  +{ev.amount}
                </div>
              </Fragment>
            );
          }
          if (ev.type === 'death') {
            return <DeathBurst key={`death-${i}`} x={ev.x} y={ev.y} cellPct={cellPct} />;
          }
          if (ev.text) {
            return (
              <div
                key={`text-${i}`}
                className="absolute pointer-events-none font-heading text-xs px-2 py-1 rounded bg-primary-500 text-background-50 whitespace-nowrap"
                style={{
                  left: `${((ev.x + 0.5) / COLS) * 100}%`,
                  top: `${((ev.y + 0.5) / ROWS) * 100}%`,
                  transform: 'translate(-50%, -160%)',
                  zIndex: 41,
                }}
              >
                {ev.text}
              </div>
            );
          }
          return null;
        })}
        </div>

        {/* 缩放时左上角显示全局小地图 */}
        {zoom > 1.01 && (
          <div className="absolute top-3 left-3 md:top-4 md:left-4 z-[55]">
            <BoardMinimap state={state} visible={visible} view={viewRect} onNavigate={handleNavigate} />
          </div>
        )}

      </div>
      </div>

          {/* 列字母(底部) */}
          <div className="hidden lg:flex ml-5 mt-1 shrink-0">
            {Array.from({ length: COLS }).map((_, x) => (
              <div key={`c-${x}`} className="flex-1 flex items-center justify-center text-[8px] text-foreground-500 font-label">
                {colLabel(x)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 hidden lg:flex items-center justify-between gap-4 mt-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-foreground-600">
          <Legend cls="bg-accent-500" label="己方灵兽" />
          <Legend cls="bg-secondary-500" label="敌方灵兽" />
          <Legend cls="bg-background-400/60" label="迷雾区" />
          <Legend cls="bg-primary-400/40" label="可移动" />
          <Legend cls="bg-secondary-400/30" label="攻击范围" />
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-0 border-t-2 border-dashed border-accent-400/70"></span>
            部署轨迹
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-dashed border-primary-400/70 bg-primary-500/10"></span>
            移动目标
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-0 border-t-2 border-dashed border-primary-400/70"></span>
            移动轨迹
          </span>
        </div>
        {/* 缩放控制:移到棋盘外的图例行右端,避免遮挡棋子 */}
        <div
          data-no-pan
          className="shrink-0 flex items-center gap-0.5 rounded-full border border-background-300/60 bg-background-100/85 p-0.5"
        >
          <button
            onClick={() => zoomAt(0.8)}
            title="缩小"
            className="w-6 h-6 flex items-center justify-center rounded-full text-foreground-600 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-subtract-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </button>
          <button
            onClick={resetView}
            title="重置视角"
            className="min-w-8 h-6 px-1 flex items-center justify-center rounded-full font-label text-[9px] text-foreground-600 hover:text-primary-300 cursor-pointer tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => zoomAt(1.25)}
            title="放大"
            className="w-6 h-6 flex items-center justify-center rounded-full text-foreground-600 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>
      </div>
    </div>
  );
});

export default BattleBoard;

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${cls}`}></span>
      {label}
    </span>
  );
}