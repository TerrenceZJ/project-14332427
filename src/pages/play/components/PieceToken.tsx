import { useEffect, useRef, useState } from 'react';
import type { Piece } from '@/game/types';
import { BEASTS } from '@/game/beasts';
import { COLS, ROWS } from '@/game/constants';
import { getPieceBuffs, BUFF_TONES } from '@/game/buffs';

interface Props {
  piece: Piece;
  revealLord: boolean;
  selected?: boolean;
  targetable?: boolean;
  targeted?: boolean;
  faded?: boolean;
  /** 精简模式(小地图):只显示棋子圆点图标,省略血条与状态标记 */
  minimal?: boolean;
}

export default function PieceToken({ piece, revealLord, selected, targetable, targeted, faded, minimal }: Props) {
  const def = BEASTS[piece.type];
  const isPlayer = piece.team === 'player';

  const base = isPlayer
    ? 'bg-accent-500 border-accent-200 text-background-50'
    : 'bg-secondary-500 border-secondary-200 text-background-50';

  const left = `${((piece.x + 0.5) / COLS) * 100}%`;
  const top = `${((piece.y + 0.5) / ROWS) * 100}%`;
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;
  const ghostColor = isPlayer ? 'oklch(var(--accent-500))' : 'oklch(var(--secondary-500))';

  // 位置变化 → 移动过程中显示拖尾,到达后播放落地涟漪
  const [moving, setMoving] = useState(false);
  const [landing, setLanding] = useState(false);
  const prev = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = { x: piece.x, y: piece.y };
    if (!p || (p.x === piece.x && p.y === piece.y)) return;
    setMoving(true);
    setLanding(false);
    const t1 = window.setTimeout(() => { setMoving(false); setLanding(true); }, 620);
    const t2 = window.setTimeout(() => { setLanding(false); }, 1200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [piece.x, piece.y]);

  if (minimal) {
    const miniBase = isPlayer
      ? 'bg-blue-500 border-blue-200 text-white'
      : 'bg-red-500 border-red-200 text-white';
    const miniGhost = isPlayer ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)';
    return (
      <>
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            left, top,
            width: `${cellW * 0.7}%`,
            height: `${cellH * 0.7}%`,
            transform: 'translate(-50%, -50%)',
            background: miniGhost,
            opacity: moving ? 0.3 : 0,
            transition: 'left .62s ease, top .62s ease',
            transitionDelay: '80ms',
            zIndex: 22,
          }}
        ></span>
        <div
          className="absolute pointer-events-none"
          style={{
            left, top,
            width: `${cellW}%`,
            height: `${cellH}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left .62s ease, top .62s ease',
            zIndex: 30,
          }}
        >
          <div className={`relative w-[64%] h-[64%] mx-auto mt-[18%] rounded-full border flex items-center justify-center ${miniBase}`}>
            <i className={`${def.icon} text-[10px] w-3 h-3 flex items-center justify-center`}></i>
          </div>
        </div>
      </>
    );
  }

  const buffs = getPieceBuffs(piece);

  return (
    <>
      {/* 移动拖尾:常驻残影,靠延迟过渡制造落后的残像,静止时隐藏 */}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left, top,
          width: `${cellW * 0.7}%`,
          height: `${cellH * 0.7}%`,
          transform: 'translate(-50%, -50%)',
          background: ghostColor,
          opacity: moving ? 0.28 : 0,
          transition: 'left .62s ease, top .62s ease',
          transitionDelay: '80ms',
          zIndex: 22,
        }}
      ></span>
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left, top,
          width: `${cellW * 0.5}%`,
          height: `${cellH * 0.5}%`,
          transform: 'translate(-50%, -50%)',
          background: ghostColor,
          opacity: moving ? 0.15 : 0,
          transition: 'left .62s ease, top .62s ease',
          transitionDelay: '160ms',
          zIndex: 21,
        }}
      ></span>

      <div
        className="absolute pointer-events-none"
        style={{
          left,
          top,
          width: `${cellW}%`,
          height: `${cellH}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left .62s ease, top .62s ease, opacity .3s ease',
          opacity: faded ? 0.35 : 1,
          zIndex: 30,
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center piece-spawn">
          {/* 上场光环 */}
          <span
            className="absolute inset-[8%] rounded-full spawn-ring pointer-events-none"
            style={{ border: '2px solid oklch(var(--primary-300) / 0.8)' }}
          ></span>
          {/* 落地涟漪 */}
          {landing && (
            <span
              className="absolute inset-[6%] rounded-full land-ring pointer-events-none"
              style={{ border: '2px solid oklch(var(--primary-300) / 0.85)' }}
            ></span>
          )}

          {/* 棋子本体(略缩小,给顶部 buff 留空间) */}
          <div
            className={`relative w-[72%] h-[72%] rounded-full border flex items-center justify-center ${base} ${
              selected || targeted ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-background-50' : targetable ? 'ring-2 ring-accent-300 ring-offset-1 ring-offset-background-50' : ''
            }`}
          >
            <i className={`${def.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>

            {revealLord && piece.isLord && (
              <span className="absolute top-[3%] left-[3%] w-[28%] h-[28%] min-w-[13px] min-h-[13px] flex items-center justify-center rounded-full bg-primary-500 text-background-50 border border-primary-200 text-[min(2.6vw,11px)] leading-none font-semibold pointer-events-none">
                主
              </span>
            )}

            {/* 姿态标记(底部) */}
            {piece.mode === 'defend' && piece.team === 'player' && (
              <span className="absolute -bottom-[34%] left-1/2 -translate-x-1/2 text-accent-200">
                <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center text-[min(2vw,10px)]"></i>
              </span>
            )}
            {piece.mode === 'scout' && piece.team === 'player' && (
              <span className="absolute -bottom-[34%] left-1/2 -translate-x-1/2 text-accent-200">
                <i className="ri-radar-line w-3 h-3 flex items-center justify-center text-[min(2vw,10px)]"></i>
              </span>
            )}
          </div>

          {/* buff / debuff 横排(顶部,保持在格内) */}
          {buffs.length > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-[1px] pointer-events-none">
              {buffs.map((b) => {
                const t = BUFF_TONES[b.tone];
                return (
                  <span
                    key={b.key}
                    className={`relative w-3.5 h-3.5 flex items-center justify-center rounded-full border ${t.bg} ${t.border} ${t.text}`}
                  >
                    <i className={`${b.icon} text-[9px] leading-none flex items-center justify-center`}></i>
                    {b.count > 1 && (
                      <span className="absolute -top-[3px] -right-[3px] min-w-[10px] h-[10px] px-[1px] flex items-center justify-center rounded-full bg-background-950 text-background-50 text-[7px] leading-none font-label">
                        {b.count}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
