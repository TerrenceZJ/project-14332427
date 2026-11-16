import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GameState, Piece, TurnEvent } from '@/game/types';
import { key, midOf } from '@/game/constants';
import PieceToken from './PieceToken';
import PieceHpBar from './PieceHpBar';
import DeployTrail from './DeployTrail';
import DeathBurst from './DeathBurst';

export interface BattleBoardHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  /** 将指定格子平移到视口中心(选中棋子时自动居中) */
  centerOn: (x: number, y: number) => void;
  /** 将棋盘滚到底(棋盘底部贴齐面板/状态条顶部),露出被遮挡的底部区域 */
  revealBottom: () => void;
}

interface Props {
  state: GameState;
  visible: Set<string>;
  selectedId: string | null;
  moveCells: Set<string>;
  /** 移动范围外两圈的红色不可移动格子 */
  blockedCells: Set<string>;
  /** 选中敌方棋子时的射程格子(红色) */
  enemyRangeCells: Set<string>;
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
  { state, visible, selectedId, moveCells, blockedCells, enemyRangeCells, targetPieceIds, selectedTargetIds, events, onCellClick, onZoomChange, bottomOverlay = 0, previewCell = null }: Props,
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const cols = state.cols;
  const rows = state.rows;
  const mid = midOf(cols);

  const CELL_PCT_X = 100 / cols;
  const CELL_PCT_Y = 100 / rows;

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

  // 横向地图(宽高比 >= 2):格子放大并垂直居中,横向可滚动
  const isWide = cols / rows >= 2;

  // 棋盘尺寸:横向地图用放大后的格子;否则高度铺满,保证格子为正方形
  const computeBoard = (s: number, vw: number, vh: number) => {
    const aspect = cols / rows;
    if (isWide) {
      const cell = Math.max(vw / cols, 116) * s;
      return { w: cell * cols, h: cell * rows };
    }
    const h = vh * s;
    return { w: h * aspect, h };
  };
  const { w: boardW, h: boardH } = computeBoard(scale, vp.w, vp.h);

  const computeMaxPan = () => {
    const { w: boardWNow, h: boardHNow } = computeBoard(scaleRef.current, vpRef.current.w, vpRef.current.h);
    return {
      x: Math.max(0, boardWNow - vpRef.current.w),
      y: isWide ? 0 : Math.max(0, boardHNow - vpRef.current.h) + bottomOverlayRef.current,
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
    const prevBoard = computeBoard(scaleRef.current, w, h);
    const nextBoard = computeBoard(clamped, w, h);
    // 以视口中心为锚点缩放,保持画面中心不变
    const cx = w / 2 - offsetRef.current.x;
    const cy = h / 2 - offsetRef.current.y;
    const nx = prevBoard.w > 0 ? w / 2 - (cx * nextBoard.w) / prevBoard.w : 0;
    const ny = prevBoard.h > 0 ? h / 2 - (cy * nextBoard.h) / prevBoard.h : 0;
    scaleRef.current = clamped;
    setScaleState(clamped);
    updateOffset(nx, ny);
    onZoomChange?.(clamped);
  };

  const zoomIn = () => applyScale(scaleRef.current + 0.25);
  const zoomOut = () => applyScale(scaleRef.current - 0.25);

  const centerOn = (x: number, y: number) => {
    const { w, h } = vpRef.current;
    const { w: boardWNow, h: boardHNow } = computeBoard(scaleRef.current, w, h);
    const cx = ((x + 0.5) / cols) * boardWNow;
    const cy = ((y + 0.5) / rows) * boardHNow;
    const overlay = bottomOverlayRef.current;
    // 横向地图纵向已居中,只做横向居中
    if (isWide) {
      updateOffset(w / 2 - cx, 0);
      return;
    }
    // 可见区域 = 视口去掉底部面板遮挡后的高度
    const visibleH = Math.max(1, h - overlay);
    // 纵向居中到可见区域中心,但最多滚动到「棋盘底部贴齐面板顶部」,不露出空隙
    updateOffset(w / 2 - cx, visibleH / 2 - cy);
  };

  const revealBottom = () => {
    const m = computeMaxPan();
    offsetRef.current = { x: offsetRef.current.x, y: -m.y };
    setOffset({ x: offsetRef.current.x, y: -m.y });
  };

  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    resetView,
    centerOn,
    revealBottom,
  }), []);

  useEffect(() => {
    bottomOverlayRef.current = bottomOverlay;
    const m = computeMaxPan();
    const c = {
      x: Math.min(0, Math.max(-m.x, offsetRef.current.x)),
      y: Math.min(0, Math.max(-m.y, offsetRef.current.y)),
    };
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
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const x = Math.floor((relX / rect.width) * cols);
    const y = Math.floor((relY / rect.height) * rows);
    if (x >= 0 && y >= 0 && x < cols && y < rows) onCellClick(x, y);
  };

  const isExecute = state.phase === 'execute';
  const playerPieces = state.pieces.filter(p => p.team === 'player' && p.alive && p.placed);
  const enemyPieces = state.pieces.filter(p => p.team === 'enemy' && p.alive && p.placed && visible.has(key(p.x, p.y)));

  const cells = Array.from({ length: rows * cols });
  const shownPieces = state.pieces.filter(
    (p) => p.alive && p.placed && (p.team === 'player' || visible.has(key(p.x, p.y)))
  );
  const pendingMoves = (state.phase === 'command')
    ? state.pieces.filter((p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0)
    : [];

  // 需要显示移动轨迹(流线箭头)的棋子:草稿 + 被重新选中的已确认棋子
  const trajectoryMoves = (state.phase === 'command')
    ? state.pieces.filter((p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0 && (!p.acted || p.id === selectedId))
    : [];

  // 指令阶段:已锁定的攻击/治疗目标(用于棋盘上绘制连线与目标标记)
  const commandTargets: { from: Piece; to: Piece; kind: 'attack' | 'heal' }[] = state.phase === 'command'
    ? state.pieces
        .filter((p) => p.team === 'player' && p.alive && p.placed && !p.acted && p.id === selectedId && p.stunned <= 0)
        .flatMap((p) => {
          // 连线起点以「移动后的最终落点」为基准,与攻击/治疗范围一致
          const dest = p.path.length ? p.path[p.path.length - 1] : { x: p.x, y: p.y };
          // 目标的有效位置:若目标也已规划移动,则取其移动后落点
          const eff = (o: Piece): { x: number; y: number } => (o.path.length ? o.path[o.path.length - 1] : { x: o.x, y: o.y });
          const list: { from: Piece; to: Piece; kind: 'attack' | 'heal' }[] = [];
          if (p.attackTarget) {
            const t = state.pieces.find(
              (o) => o.id === p.attackTarget && o.alive && o.placed && o.team !== p.team && visible.has(key(o.x, o.y)),
            );
            // 敌方棋子移动不展示预览,攻击连线指向其原位置,避免与实际显示位置产生偏差
            if (t) list.push({ from: { ...p, x: dest.x, y: dest.y }, to: t, kind: 'attack' });
          }
          if (p.heal > 0 && p.atk <= 0 && p.healTarget) {
            const t = state.pieces.find((o) => o.id === p.healTarget && o.alive && o.placed && o.team === p.team);
            if (t) {
              const td = eff(t);
              list.push({ from: { ...p, x: dest.x, y: dest.y }, to: { ...t, x: td.x, y: td.y }, kind: 'heal' });
            }
          }
          return list;
        })
    : [];

  const cellStyle = (x: number, y: number) => {
    const isPlayerSide = x < mid;
    const fog = !isPlayerSide && !visible.has(key(x, y));
    const isMove = moveCells.has(key(x, y));
    const checker = (x + y) % 2 === 0;
    if (fog) return 'bg-background-400/75';
    if (isPlayerSide) {
      return checker ? 'bg-emerald-500/[0.13]' : 'bg-emerald-500/[0.22]';
    }
    return checker ? 'bg-emerald-700/[0.17]' : 'bg-emerald-700/[0.26]';
  };

  // 山体边框厚度:至少覆盖底层面板高度,拖动地图时不会露出黑色背景
  const mountainMargin = Math.max(bottomOverlay + 120, 220);

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
        data-tutorial="board"
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
            top: `${offset.y + (isWide ? (vp.h - boardH) / 2 : 0)}px`,
          }}
        >
          {/* 山体边框:环绕地图外围(中间镂空露出草丛),随地图一起拖动 */}
          <div
            className="absolute board-mountain"
            style={{
              left: -mountainMargin,
              top: -mountainMargin,
              right: -mountainMargin,
              bottom: -mountainMargin,
              padding: mountainMargin,
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          ></div>

          {/* 网格层 */}
          <div
            className="absolute inset-0 grid board-grass"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {cells.map((_, i) => {
              const x = i % cols;
              const y = Math.floor(i / cols);
              const k = key(x, y);
              const isMove = moveCells.has(k);
              const isBlocked = !isMove && blockedCells.has(k);
              const isEnemyRange = !isMove && !isBlocked && enemyRangeCells.has(k);
              return (
                <div
                  key={i}
                  className={`border border-background-400/40 relative ${cellStyle(x, y)}`}
                >
                  {isMove && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{ left: '6%', top: '6%', width: '88%', height: '88%', zIndex: 12, filter: 'drop-shadow(0 0 2px oklch(var(--accent-400) / 0.55))' }}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polygon points="18,0 82,0 100,18 100,82 82,100 18,100 0,82 0,18" fill="oklch(var(--accent-500) / 0.28)" stroke="oklch(var(--accent-300))" strokeWidth="3" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isMove && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 13 }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-200"></div>
                    </div>
                  )}
                  {isBlocked && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{ left: '6%', top: '6%', width: '88%', height: '88%', zIndex: 12, filter: 'drop-shadow(0 0 2px oklch(var(--secondary-400) / 0.5))' }}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polygon points="18,0 82,0 100,18 100,82 82,100 18,100 0,82 0,18" fill="oklch(var(--secondary-500) / 0.28)" stroke="oklch(var(--secondary-300))" strokeWidth="3" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isEnemyRange && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{ left: '6%', top: '6%', width: '88%', height: '88%', zIndex: 11, filter: 'drop-shadow(0 0 2px oklch(var(--secondary-400) / 0.6))' }}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polygon points="18,0 82,0 100,18 100,82 82,100 18,100 0,82 0,18" fill="oklch(var(--secondary-500) / 0.4)" stroke="oklch(var(--secondary-300))" strokeWidth="3" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* 部署阶段:中线两侧禁止放置的缓冲带 */}
          {state.phase === 'deploy' && (
            <div
              data-tutorial="no-deploy"
              className="absolute deploy-restrict pointer-events-none"
              style={{
                left: `${((mid - state.deployGap) / cols) * 100}%`,
                top: 0,
                bottom: 0,
                width: `${((state.deployGap * 2) / cols) * 100}%`,
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
            style={{ left: `${(mid / cols) * 100}%`, zIndex: 6 }}
          ></div>

          {/* 敌方侧薄云层 */}
          <div
            data-tutorial="enemy-zone"
            className="absolute board-clouds pointer-events-none"
            style={{
              left: `${(mid / cols) * 100}%`,
              top: 0,
              bottom: 0,
              width: `${((cols - mid) / cols) * 100}%`,
              zIndex: 4,
            }}
          ></div>

          {/* 部署轨迹 */}
          {state.phase === 'deploy' && <DeployTrail trail={state.deployTrail} cols={cols} rows={rows} />}

          {/* 持续性伤害区域 */}
          {state.dotZones.map((z) => (
            <div
              key={z.id}
              className="absolute pointer-events-none bg-secondary-500/15 border border-secondary-400/40"
              style={{
                left: `${((z.x - 1) / cols) * 100}%`,
                top: `${((z.y - 1) / rows) * 100}%`,
                width: `${(3 / cols) * 100}%`,
                height: `${(3 / rows) * 100}%`,
                zIndex: 6,
              }}
            ></div>
          ))}

          {/* 卡牌 3×3 技能范围预览 */}
          {previewCell && (
            <div
              className="absolute pointer-events-none bg-primary-500/20 border-2 border-primary-400/80 animate-pulse"
              style={{
                left: `${((previewCell.x - 1) / cols) * 100}%`,
                top: `${((previewCell.y - 1) / rows) * 100}%`,
                width: `${(3 / cols) * 100}%`,
                height: `${(3 / rows) * 100}%`,
                zIndex: 7,
              }}
            ></div>
          )}

          {/* 移动目标(目的地虚线框) */}
          {trajectoryMoves.map((p) => {
            const dest = p.path[p.path.length - 1];
            return (
              <div
                key={`dest-${p.id}`}
                className="absolute pointer-events-none border-2 border-dashed border-primary-400/70 bg-primary-500/10 rounded-md"
                style={{
                  left: `${(dest.x / cols) * 100}%`,
                  top: `${(dest.y / rows) * 100}%`,
                  width: `${CELL_PCT_X}%`,
                  height: `${CELL_PCT_Y}%`,
                  zIndex: 7,
                }}
              ></div>
            );
          })}

          {/* 移动轨迹:流线带箭头(草稿 + 被选中的已确认棋子) */}
          {trajectoryMoves.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
              viewBox={`0 0 ${boardW} ${boardH}`}
              style={{ zIndex: 8 }}
            >
              <defs>
                <marker id="move-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(var(--primary-400))" />
                </marker>
              </defs>
              {trajectoryMoves.map((p) => {
                const pts = [{ x: p.x, y: p.y }, ...p.path];
                return (
                  <g key={`traj-${p.id}`}>
                    {pts.slice(0, -1).map((a, i) => {
                      const b = pts[i + 1];
                      const ax = ((a.x + 0.5) / cols) * boardW;
                      const ay = ((a.y + 0.5) / rows) * boardH;
                      const bx = ((b.x + 0.5) / cols) * boardW;
                      const by = ((b.y + 0.5) / rows) * boardH;
                      return (
                        <line
                          key={`seg-${i}`}
                          x1={ax}
                          y1={ay}
                          x2={bx}
                          y2={by}
                          stroke="oklch(var(--primary-400))"
                          strokeWidth={3}
                          strokeLinecap="round"
                          markerEnd="url(#move-arrow)"
                          className="move-flow-line"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          )}

          {/* 棋子 */}
          {shownPieces.map((p) => (
            <PieceToken
              key={p.id}
              piece={p}
                revealLord={!state.lordBattle ? p.lordRevealed : p.team === 'player' || p.lordRevealed}
              selected={p.id === selectedId}
              targetable={targetPieceIds.has(p.id)}
              targeted={selectedTargetIds.has(p.id)}
              faded={(state.phase === 'command') && p.team === 'player' && (p.path.length > 0 || p.acted)}
              cols={cols}
              rows={rows}
            />
          ))}

          {/* 指令阶段:移动目的地的半透明预览棋子(接下来要达到的目标) */}
          {pendingMoves.map((p) => {
            const dest = p.path[p.path.length - 1];
            const ghost = { ...p, x: dest.x, y: dest.y };
            return (
              <PieceToken
                key={`dest-piece-${p.id}`}
                piece={ghost}
                revealLord={!state.lordBattle ? ghost.lordRevealed : ghost.team === 'player' || ghost.lordRevealed}
                selected={false}
                targetable={false}
                targeted={false}
                preview
                cols={cols}
                rows={rows}
              />
            );
          })}

          {/* 血条层:独立于棋子,始终位于最上方;仅指令阶段移动过的棋子原位置(残影)不显示血条,血条随预览到目的地 */}
          {shownPieces.filter((p) => !(state.phase === 'command' && p.team === 'player' && p.path.length > 0)).map((p) => (
            <PieceHpBar key={`hp-${p.id}`} piece={p} cols={cols} rows={rows} />
          ))}

          {/* 移动目的地预览棋子的血条 */}
          {pendingMoves.map((p) => {
            const dest = p.path[p.path.length - 1];
            const ghost = { ...p, x: dest.x, y: dest.y };
            return (
              <div key={`hp-dest-${p.id}`} style={{ opacity: 0.6 }}>
                <PieceHpBar piece={ghost} cols={cols} rows={rows} />
              </div>
            );
          })}

          {/* 指令阶段:已锁定的攻击 / 治疗目标(连线 + 目标标记) */}
          {commandTargets.map((ct, i) => {
            const isHeal = ct.kind === 'heal';
            const color = isHeal ? 'oklch(var(--accent-300))' : 'oklch(var(--secondary-400))';
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
                    left: `${(((ax + bx) / 2) / cols) * 100}%`,
                    top: `${(((ay + by) / 2) / rows) * 100}%`,
                    width: `${(len / cols) * 100}%`,
                    borderTop: `2px ${isHeal ? 'dashed' : 'solid'} ${color}`,
                    transform: `translate(-50%, -50%) rotate(${angle}rad)`,
                    zIndex: 24,
                  }}
                ></div>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(ct.to.x / cols) * 100}%`,
                    top: `${(ct.to.y / rows) * 100}%`,
                    width: `${CELL_PCT_X}%`,
                    height: `${CELL_PCT_Y}%`,
                    zIndex: 50,
                  }}
                >
                  <div
                    className="absolute inset-[-5%] rounded-full border-2 target-lock"
                    style={{ borderColor: color, boxShadow: `0 0 12px ${color}` }}
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
              const ax = ((ev.fx ?? ev.x) + 0.5) / cols * 100;
              const ay = ((ev.fy ?? ev.y) + 0.5) / rows * 100;
              const bx = (ev.x + 0.5) / cols * 100;
              const by = (ev.y + 0.5) / rows * 100;
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
                      left: `${((ev.x + 0.5) / cols) * 100}%`,
                      top: `${((ev.y + 0.5) / rows) * 100}%`,
                      width: `${CELL_PCT_X * 1.3}%`,
                      height: `${CELL_PCT_Y * 1.3}%`,
                      zIndex: 38,
                      transform: 'translate(-50%, -50%)',
                    }}
                  ></div>
                  <div
                    className="absolute pointer-events-none font-heading text-sm font-bold text-accent-300 dmg-float"
                    style={{
                      left: `${((ev.x + 0.5) / cols) * 100}%`,
                      top: `${((ev.y + 0.5) / rows) * 100}%`,
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
              return <DeathBurst key={`death-${i}`} x={ev.x} y={ev.y} cols={cols} rows={rows} />;
            }
            if (ev.type === 'fail') {
              return (
                <div
                  key={`fail-${i}`}
                  className="absolute pointer-events-none fail-float"
                  style={{
                    left: `${((ev.x + 0.5) / cols) * 100}%`,
                    top: `${((ev.y + 0.5) / rows) * 100}%`,
                    transform: 'translate(-50%, -150%)',
                    zIndex: 41,
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <i className="ri-emotion-sad-line text-foreground-300 text-2xl w-6 h-6 flex items-center justify-center" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}></i>
                    <span className="font-label text-[11px] px-2 py-0.5 rounded-full bg-background-950/80 text-foreground-300 whitespace-nowrap">气馁</span>
                  </div>
                </div>
              );
            }
            if (ev.text) {
              return (
                <div
                  key={`text-${i}`}
                  className="absolute pointer-events-none font-heading text-xs px-2 py-1 rounded bg-primary-500 text-background-50 whitespace-nowrap"
                  style={{
                    left: `${((ev.x + 0.5) / cols) * 100}%`,
                    top: `${((ev.y + 0.5) / rows) * 100}%`,
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
            aspectRatio: `${cols}/${rows}`,
            zIndex: 10,
          }}
        >
          <div className="relative w-full h-full bg-background-300/90">
            {/* 敌方视角网格 */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
            >
              {cells.map((_, i) => {
                const x = i % cols;
                const y = Math.floor(i / cols);
                const checker = (x + y) % 2 === 0;
                const isPlayerSide = x < mid;
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
              style={{ left: `${(mid / cols) * 100}%` }}
            ></div>

            {/* 双方棋子(蓝=己方 / 红=敌方) */}
            {[...playerPieces, ...enemyPieces].map((p) => (
              <PieceToken
                key={p.id}
                piece={p}
              revealLord={!state.lordBattle ? p.lordRevealed : p.team === 'player' || p.lordRevealed}
                selected={false}
                targetable={false}
                faded={false}
                minimal
                cols={cols}
                rows={rows}
              />
            ))}

            {/* 敌方持续性伤害 */}
            {state.dotZones.map((z) => (
              <div
                key={z.id}
                className="absolute pointer-events-none bg-secondary-500/20 border border-secondary-400/50"
                style={{
                  left: `${((z.x - 1) / cols) * 100}%`,
                  top: `${((z.y - 1) / rows) * 100}%`,
                  width: `${(3 / cols) * 100}%`,
                  height: `${(3 / rows) * 100}%`,
                  zIndex: 6,
                }}
              ></div>
            ))}

            {/* 敌方死亡效果 */}
            {events.filter(ev => ev.type === 'death').map((ev, i) => (
              <DeathBurst key={`death-sup-${i}`} x={ev.x} y={ev.y} cols={cols} rows={rows} />
            ))}

            {/* 攻击弹道 + 命中效果 */}
            {events.filter(ev => ev.type === 'attack').map((ev, i) => {
              const hasFrom = ev.fx !== undefined && ev.fy !== undefined;
              const ax = ((ev.fx ?? ev.x) + 0.5) / cols * 100;
              const ay = ((ev.fy ?? ev.y) + 0.5) / rows * 100;
              const bx = (ev.x + 0.5) / cols * 100;
              const by = (ev.y + 0.5) / rows * 100;
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
