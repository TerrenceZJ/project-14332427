import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GameState, Piece, TurnEvent } from '@/game/types';
import { COLS, ROWS, MID, DEPLOY_GAP, key, dist } from '@/game/constants';
import PieceToken from './PieceToken';
import PieceHpBar from './PieceHpBar';
import DeployTrail from './DeployTrail';
import DeathBurst from './DeathBurst';

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
  selectedTargetIds: Set<string>;
  events: TurnEvent[];
  onCellClick: (x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
  /** 底部被面板遮挡的高度(px),让棋盘可额外向上平移,露出被挡住的下方区域 */
  bottomOverlay?: number;
  /** 卡牌 3×3 技能范围的预览中心(选中区域卡时,展示即将覆盖的范围) */
  previewCell?: { x: number; y: number } | null;
}

const BattleBoard = forwardRef<BattleBoardHandle, Props>(function BattleBoard(
  { state, visible, selectedId, moveCells, rangeCells, targetPieceIds, selectedTargetIds, events, onCellClick, onZoomChange, bottomOverlay = 0, previewCell = null }: Props,
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const CELL_PCT_X = 100 / COLS;
  const CELL_PCT_Y = 100 / ROWS;

  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [scale, setScaleState] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const vpRef = useRef({ w: 0, h: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const bottomOverlayRef = useRef(bottomOverlay);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const suppressClickRef = useRef(false);

  const MIN_SCALE = 1;
  const MAX_SCALE = 2.5;

  // 棋盘高度铺满视口,宽度按 10:8 比例推导,保证格子为正方形
  const boardH = vp.h * scale;
  const boardW = boardH * (COLS / ROWS);

  const computeMaxPan = () => {
    const boardHNow = vpRef.current.h * scaleRef.current;
    const boardWNow = boardHNow * (COLS / ROWS);
    return {
      x: Math.max(0, boardWNow - vpRef.current.w),
      y: Math.max(0, boardHNow - vpRef.current.h) + bottomOverlayRef.current,
    };
  };

  const clampOffset = (x: number, y: number) => {
    const m = computeMaxPan();
    return {
      x: Math.min(0, Math.max(-m.x, x)),
      y: Math.min(0, Math.max(-m.y, y)),
    };
  };

  const updateOffset = (x: number, y: number) => {
    const c = clampOffset(x, y);
    offsetRef.current = c;
    setOffset(c);
  };

  const resetView = () => {
    scaleRef.current = MIN_SCALE;
    setScaleState(MIN_SCALE);
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
    onZoomChange?.(MIN_SCALE);
  };

  const applyScale = (next: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    if (clamped === scaleRef.current) return;
    const { w, h } = vpRef.current;
    const prevBoardH = h * scaleRef.current;
    const prevBoardW = prevBoardH * (COLS / ROWS);
    const nextBoardH = h * clamped;
    const nextBoardW = nextBoardH * (COLS / ROWS);
    // 以视口中心为锚点缩放,保持画面中心不变
    const cx = w / 2 - offsetRef.current.x;
    const cy = h / 2 - offsetRef.current.y;
    const nx = prevBoardW > 0 ? w / 2 - (cx * nextBoardW) / prevBoardW : 0;
    const ny = prevBoardH > 0 ? h / 2 - (cy * nextBoardH) / prevBoardH : 0;
    scaleRef.current = clamped;
    setScaleState(clamped);
    updateOffset(nx, ny);
    onZoomChange?.(clamped);
  };

  const zoomIn = () => applyScale(scaleRef.current + 0.25);
  const zoomOut = () => applyScale(scaleRef.current - 0.25);

  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    resetView,
  }), []);

  useEffect(() => {
    bottomOverlayRef.current = bottomOverlay;
    const c = clampOffset(offsetRef.current.x, offsetRef.current.y);
    offsetRef.current = c;
    setOffset(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomOverlay]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      vpRef.current = { w: r.width, h: r.height };
      setVp({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = offsetRef.current;
      updateOffset(cur.x - e.deltaX * 0.6, cur.y - e.deltaY * 0.6);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, [data-no-pan]')) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    updateOffset(d.originX + dx, d.originY + dy);
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.active && d.moved) suppressClickRef.current = true;
    d.active = false;
    setDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vpRect = viewportRef.current?.getBoundingClientRect();
    if (!vpRect) return;
    const relX = e.clientX - vpRect.left - offsetRef.current.x;
    const relY = e.clientY - vpRect.top - offsetRef.current.y;
    const x = Math.floor((relX / rect.width) * COLS);
    const y = Math.floor((relY / rect.height) * ROWS);
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) onCellClick(x, y);
  };

  const isExecute = state.phase === 'execute';
  const playerPieces = state.pieces.filter(p => p.team === 'player' && p.alive && p.placed);
  const enemyPieces = state.pieces.filter(p => p.team === 'enemy' && p.alive && p.placed && visible.has(key(p.x, p.y)));

  const cells = Array.from({ length: ROWS * COLS });
  const shownPieces = state.pieces.filter(
    (p) => p.alive && p.placed && (p.team === 'player' || visible.has(key(p.x, p.y)))
  );
  const pendingMoves = (state.phase === 'command')
    ? state.pieces.filter((p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0)
    : [];

  // 指令阶段:已锁定的攻击/治疗目标(用于棋盘上绘制连线与目标标记)
  const commandTargets: { from: Piece; to: Piece; kind: 'attack' | 'heal'; auto?: boolean }[] = state.phase === 'command'
    ? state.pieces
        .filter((p) => p.team === 'player' && p.alive && p.placed && !p.acted)
        .flatMap((p) => {
          const list: { from: Piece; to: Piece; kind: 'attack' | 'heal'; auto?: boolean }[] = [];
          if (p.attackTarget) {
            const t = state.pieces.find(
              (o) => o.id === p.attackTarget && o.alive && o.placed && o.team !== p.team && visible.has(key(o.x, o.y)),
            );
            if (t) list.push({ from: p, to: t, kind: 'attack' });
          }
          if (p.heal > 0 && p.atk <= 0) {
            if (p.healTarget) {
              const t = state.pieces.find((o) => o.id === p.healTarget && o.alive && o.placed && o.team === p.team);
              if (t) list.push({ from: p, to: t, kind: 'heal' });
            } else {
              // 自动治疗:从移动后的最终位置计算受伤最重的队友
              const dest = p.path.length ? p.path[p.path.length - 1] : { x: p.x, y: p.y };
              const t = state.pieces
                .filter(
                  (o) =>
                    o.alive && o.placed && o.team === 'player' && o !== p &&
                    o.hp < o.maxHp && dist(dest.x, dest.y, o.x, o.y) <= p.range,
                )
                .sort((a, b) => a.hp - b.hp)[0];
              if (t) list.push({ from: p, to: t, kind: 'heal', auto: true });
            }
          }
          return list;
        })
    : [];

  const cellStyle = (x: number, y: number) => {
    const isPlayerSide = x < MID;
    const fog = !isPlayerSide && !visible.has(key(x, y));
    const isMove = moveCells.has(key(x, y));
    const isRange = !isMove && rangeCells.has(key(x, y));
    const checker = (x + y) % 2 === 0;
    if (fog) return 'bg-background-400/75';
    if (isPlayerSide) {
      return checker ? 'bg-emerald-500/[0.13]' : 'bg-emerald-500/[0.22]';
    }
    return checker ? 'bg-emerald-700/[0.17]' : 'bg-emerald-700/[0.26]';
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 主视图区域 */}
      <div
        ref={viewportRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => endDrag(e)}
        className={`absolute inset-0 overflow-hidden rounded-lg border border-background-300/60 bg-background-200/40 cursor-grab ${
          dragging ? 'cursor-grabbing' : ''
        }`}
        style={{ zIndex: 1, touchAction: 'none' }}
      >
        <div
          ref={contentRef}
          className="absolute"
          style={{
            width: boardW > 0 ? `${boardW}px` : '100%',
            height: boardH > 0 ? `${boardH}px` : '100%',
            left: `${offset.x}px`,
            top: `${offset.y}px`,
          }}
        >
          {/* 网格层 */}
          <div
            className="absolute inset-0 grid board-grass"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
          >
            {cells.map((_, i) => {
              const x = i % COLS;
              const y = Math.floor(i / COLS);
              const k = key(x, y);
              const isMove = moveCells.has(k);
              const isRange = !isMove && rangeCells.has(k);
              return (
                <div
                  key={i}
                  className={`border border-background-400/40 relative ${cellStyle(x, y)}`}
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

          {/* 部署阶段:中线两侧禁止放置的缓冲带 */}
          {state.phase === 'deploy' && (
            <div
              className="absolute deploy-restrict pointer-events-none"
              style={{
                left: `${((MID - DEPLOY_GAP) / COLS) * 100}%`,
                top: 0,
                bottom: 0,
                width: `${((DEPLOY_GAP * 2) / COLS) * 100}%`,
                zIndex: 3,
              }}
            >
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-background-950/70 text-background-50 font-label text-[10px] whitespace-nowrap">
                <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
                初始不可放置
              </span>
            </div>
          )}

          {/* 中线 */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-primary-500/40"
            style={{ left: `${(MID / COLS) * 100}%`, zIndex: 6 }}
          ></div>

          {/* 敌方侧薄云层 */}
          <div
            className="absolute board-clouds pointer-events-none"
            style={{
              left: `${(MID / COLS) * 100}%`,
              top: 0,
              bottom: 0,
              width: `${((COLS - MID) / COLS) * 100}%`,
              zIndex: 4,
            }}
          ></div>

          {/* 部署轨迹 */}
          {state.phase === 'deploy' && <DeployTrail trail={state.deployTrail} />}

          {/* 持续性伤害区域 */}
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

          {/* 卡牌 3×3 技能范围预览 */}
          {previewCell && (
            <div
              className="absolute pointer-events-none bg-primary-500/20 border-2 border-primary-400/80 animate-pulse"
              style={{
                left: `${((previewCell.x - 1) / COLS) * 100}%`,
                top: `${((previewCell.y - 1) / ROWS) * 100}%`,
                width: `${(3 / COLS) * 100}%`,
                height: `${(3 / ROWS) * 100}%`,
                zIndex: 7,
              }}
            ></div>
          )}

          {/* 移动目标 */}
          {pendingMoves.map((p) => {
            const dest = p.path[p.path.length - 1];
            return (
              <div
                key={`dest-${p.id}`}
                className="absolute pointer-events-none border-2 border-dashed border-primary-400/70 bg-primary-500/10 rounded-md"
                style={{
                  left: `${(dest.x / COLS) * 100}%`,
                  top: `${(dest.y / ROWS) * 100}%`,
                  width: `${CELL_PCT_X}%`,
                  height: `${CELL_PCT_Y}%`,
                  zIndex: 7,
                }}
              ></div>
            );
          })}

          {/* 移动轨迹 */}
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

          {/* 步数序号 */}
          {pendingMoves.map((p) => (
            <Fragment key={`steps-${p.id}`}>
              {p.path.map((c, i) => (
                <div
                  key={`step-${p.id}-${i}`}
                  className="absolute pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${(c.x / COLS) * 100}%`,
                    top: `${(c.y / ROWS) * 100}%`,
                    width: `${CELL_PCT_X}%`,
                    height: `${CELL_PCT_Y}%`,
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
              revealLord={p.team === 'player' || p.lordRevealed}
              selected={p.id === selectedId}
              targetable={targetPieceIds.has(p.id)}
              targeted={selectedTargetIds.has(p.id)}
              faded={(state.phase === 'command') && p.team === 'player' && p.path.length > 0}
            />
          ))}

          {/* 血条层:独立于棋子,始终位于最上方 */}
          {shownPieces.map((p) => (
            <PieceHpBar key={`hp-${p.id}`} piece={p} />
          ))}

          {/* 指令阶段:已锁定的攻击 / 治疗目标(连线 + 目标标记) */}
          {commandTargets.map((ct, i) => {
            const isHeal = ct.kind === 'heal';
            const isAuto = !!ct.auto;
            const color = isHeal ? 'oklch(var(--accent-300))' : 'oklch(var(--secondary-400))';
            const lineColor = isAuto ? 'oklch(var(--accent-300) / 0.7)' : color;
            const ax = ct.from.x + 0.5;
            const ay = ct.from.y + 0.5;
            const bx = ct.to.x + 0.5;
            const by = ct.to.y + 0.5;
            const dx = bx - ax;
            const dy = by - ay;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            return (
              <Fragment key={`ct-${i}`}>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(((ax + bx) / 2) / COLS) * 100}%`,
                    top: `${(((ay + by) / 2) / ROWS) * 100}%`,
                    width: `${(len / COLS) * 100}%`,
                    borderTop: `2px ${isAuto ? 'dotted' : isHeal ? 'dashed' : 'solid'} ${lineColor}`,
                    transform: `translate(-50%, -50%) rotate(${angle}rad)`,
                    zIndex: 24,
                  }}
                ></div>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(ct.to.x / COLS) * 100}%`,
                    top: `${(ct.to.y / ROWS) * 100}%`,
                    width: `${CELL_PCT_X}%`,
                    height: `${CELL_PCT_Y}%`,
                    zIndex: 50,
                  }}
                >
                  <div
                    className="absolute inset-[-5%] rounded-full border-2 target-lock"
                    style={{ borderColor: lineColor, boxShadow: `0 0 12px ${lineColor}` }}
                  ></div>
                  <span
                    className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-full ${
                      isHeal ? 'bg-accent-500/25 text-accent-300' : 'bg-secondary-500/25 text-secondary-400'
                    }`}
                  >
                    <i className={`${isHeal ? 'ri-heart-pulse-line' : 'ri-crosshair-2-line'} w-3 h-3 flex items-center justify-center`}></i>
                  </span>
                </div>
              </Fragment>
            );
          })}

          {/* 事件 */}
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
                          width: `${CELL_PCT_X * 1.3}%`,
                          height: `${CELL_PCT_Y * 1.3}%`,
                          borderColor: lineColor,
                          zIndex: 38,
                          transform: 'translate(-50%, -50%)',
                        }}
                      ></div>
                      <div
                        className="absolute pointer-events-none font-heading text-sm font-bold dmg-float"
                        style={{
                          left: `${bx}%`,
                          top: `${by}%`,
                          transform: 'translate(-50%, -160%)',
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
                      width: `${CELL_PCT_X * 1.3}%`,
                      height: `${CELL_PCT_Y * 1.3}%`,
                      zIndex: 38,
                      transform: 'translate(-50%, -50%)',
                    }}
                  ></div>
                  <div
                    className="absolute pointer-events-none font-heading text-sm font-bold text-accent-300 dmg-float"
                    style={{
                      left: `${((ev.x + 0.5) / COLS) * 100}%`,
                      top: `${((ev.y + 0.5) / ROWS) * 100}%`,
                      zIndex: 40,
                      textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                      transform: 'translate(-50%, -160%)',
                    }}
                  >
                    +{ev.amount}
                  </div>
                </Fragment>
              );
            }
            if (ev.type === 'death') {
              return <DeathBurst key={`death-${i}`} x={ev.x} y={ev.y} />;
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
      </div>

      {/* 同步执行阶段:补充视角(敌方视角) */}
      {isExecute && (
        <div
          className="absolute right-2 bottom-2 border-2 border-secondary-500 rounded-lg overflow-hidden shadow-xl"
          style={{
            width: '38%',
            aspectRatio: `${COLS}/${ROWS}`,
            zIndex: 10,
          }}
        >
          <div className="relative w-full h-full bg-background-300/90">
            {/* 敌方视角网格 */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
            >
              {cells.map((_, i) => {
                const x = i % COLS;
                const y = Math.floor(i / COLS);
                const checker = (x + y) % 2 === 0;
                const isPlayerSide = x < MID;
                    return (
                      <div
                        key={i}
                        className={`border border-background-400/30 ${isPlayerSide ? (checker ? 'bg-accent-600/20' : 'bg-accent-600/35') : (checker ? 'bg-secondary-600/30' : 'bg-secondary-600/50')}`}
                  ></div>
                );
              })}
            </div>

            {/* 中线 */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-secondary-500/60"
              style={{ left: `${(MID / COLS) * 100}%` }}
            ></div>

            {/* 双方棋子(蓝=己方 / 红=敌方) */}
            {[...playerPieces, ...enemyPieces].map((p) => (
              <PieceToken
                key={p.id}
                piece={p}
                revealLord={p.team === 'player' || p.lordRevealed}
                selected={false}
                targetable={false}
                faded={false}
                minimal
              />
            ))}

            {/* 敌方持续性伤害 */}
            {state.dotZones.map((z) => (
              <div
                key={z.id}
                className="absolute pointer-events-none bg-secondary-500/20 border border-secondary-400/50"
                style={{
                  left: `${((z.x - 1) / COLS) * 100}%`,
                  top: `${((z.y - 1) / ROWS) * 100}%`,
                  width: `${(3 / COLS) * 100}%`,
                  height: `${(3 / ROWS) * 100}%`,
                  zIndex: 6,
                }}
              ></div>
            ))}

            {/* 敌方死亡效果 */}
            {events.filter(ev => ev.type === 'death').map((ev, i) => (
              <DeathBurst key={`death-sup-${i}`} x={ev.x} y={ev.y} />
            ))}

            {/* 攻击弹道 + 命中效果 */}
            {events.filter(ev => ev.type === 'attack').map((ev, i) => {
              const hasFrom = ev.fx !== undefined && ev.fy !== undefined;
              const ax = ((ev.fx ?? ev.x) + 0.5) / COLS * 100;
              const ay = ((ev.fy ?? ev.y) + 0.5) / ROWS * 100;
              const bx = (ev.x + 0.5) / COLS * 100;
              const by = (ev.y + 0.5) / ROWS * 100;
              const isPlayerAttack = state.pieces.some(p => p.x === ev.fx && p.y === ev.fy && p.team === 'player');
              const lineColor = isPlayerAttack ? 'oklch(var(--accent-400))' : 'oklch(var(--secondary-400))';
              return (
                <Fragment key={`sup-attack-${i}`}>
                  {hasFrom && (
                    <div
                      className="absolute rounded-full attack-projectile"
                      style={{
                        backgroundColor: lineColor,
                        boxShadow: `0 0 8px ${lineColor}, 0 0 16px ${lineColor}`,
                        width: '10px',
                        height: '10px',
                        zIndex: 39,
                        ['--sx' as string]: `${ax}%`,
                        ['--sy' as string]: `${ay}%`,
                        ['--tx' as string]: `${bx}%`,
                        ['--ty' as string]: `${by}%`,
                      }}
                    ></div>
                  )}
                  {!hasFrom && ev.amount !== undefined && (
                    <div
                      className="absolute pointer-events-none hit-burst rounded-full border-2"
                      style={{
                        left: `${bx}%`,
                        top: `${by}%`,
                        width: `${CELL_PCT_X * 1.3}%`,
                        height: `${CELL_PCT_Y * 1.3}%`,
                        borderColor: lineColor,
                        zIndex: 38,
                      }}
                    ></div>
                  )}
                </Fragment>
              );
            })}

          </div>
        </div>
      )}
    </div>
  );
});

export default BattleBoard;
