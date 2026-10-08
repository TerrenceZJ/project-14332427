import { useEffect, useRef, useState } from 'react';
import type { Piece } from '@/game/types';
import { BEASTS } from '@/game/beasts';
import { COLS, ROWS } from '@/game/constants';

interface Props {
  piece: Piece;
  cellPct: number;
  revealLord: boolean;
  selected?: boolean;
  targetable?: boolean;
  faded?: boolean;
}

export default function PieceToken({ piece, cellPct, revealLord, selected, targetable, faded }: Props) {
  const def = BEASTS[piece.type];
  const isPlayer = piece.team === 'player';

  const base = isPlayer
    ? 'bg-accent-500 border-accent-200 text-background-50'
    : 'bg-secondary-500 border-secondary-200 text-background-50';

  const left = `${((piece.x + 0.5) / COLS) * 100}%`;
  const top = `${((piece.y + 0.5) / ROWS) * 100}%`;
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

  return (
    <>
      {/* 移动拖尾:常驻残影,靠延迟过渡制造落后的残像,静止时隐藏 */}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left, top,
          width: `${cellPct * 0.7}%`,
          height: `${cellPct * 0.7}%`,
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
          width: `${cellPct * 0.5}%`,
          height: `${cellPct * 0.5}%`,
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
          width: `${cellPct}%`,
          height: `${cellPct}%`,
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

          <div
            className={`relative w-[86%] h-[86%] rounded-full border flex items-center justify-center ${base} ${
              selected ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-background-50' : targetable ? 'ring-2 ring-accent-300 ring-offset-1 ring-offset-background-50' : ''
            }`}
          >
            <i className={`${def.icon} text-[min(2.2vw,13px)] w-3 h-3 flex items-center justify-center`}></i>

            {revealLord && piece.isLord && (
              <span className="absolute -top-[45%] left-1/2 -translate-x-1/2 text-primary-300">
                <i className="ri-vip-crown-fill w-3 h-3 flex items-center justify-center text-[min(2vw,11px)]"></i>
              </span>
            )}

            {piece.shieldTurns > 0 && (
              <span className="absolute inset-[-14%] rounded-full border-2 border-primary-300/80 pulse-ring"></span>
            )}

            {piece.stunned > 0 && (
              <span className="absolute -top-[32%] -left-[8%] text-secondary-300">
                <i className="ri-lock-2-fill w-3 h-3 flex items-center justify-center text-[min(2vw,11px)]"></i>
              </span>
            )}
            {piece.blockHits > 0 && (
              <span className="absolute -top-[32%] right-[2%] text-primary-300">
                <i className="ri-shield-star-fill w-3 h-3 flex items-center justify-center text-[min(2vw,11px)]"></i>
              </span>
            )}
            {piece.bonusAtk > 0 && (
              <span className="absolute top-[4%] -right-[4%] text-accent-300">
                <i className="ri-arrow-up-fill w-3 h-3 flex items-center justify-center text-[min(2vw,10px)]"></i>
              </span>
            )}

            {piece.mode === 'defend' && piece.team === 'player' && (
              <span className="absolute -bottom-[40%] left-1/2 -translate-x-1/2 text-accent-200">
                <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center text-[min(2vw,10px)]"></i>
              </span>
            )}
            {piece.mode === 'scout' && piece.team === 'player' && (
              <span className="absolute -bottom-[40%] left-1/2 -translate-x-1/2 text-accent-200">
                <i className="ri-radar-line w-3 h-3 flex items-center justify-center text-[min(2vw,10px)]"></i>
              </span>
            )}

            {piece.isLord && !piece.lordRevealed && isPlayer && (
              <span className="absolute -top-[30%] -right-[10%] w-[38%] h-[38%] rounded-full bg-primary-500 border border-primary-200"></span>
            )}
          </div>

          {/* HP 刻度条 + 剩余血量数字 */}
          <div className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 flex items-center gap-1">
            <div className="flex items-center gap-[1.5px]">
              {Array.from({ length: piece.maxHp }).map((_, i) => (
                <div
                  key={i}
                  className={`w-[3px] h-[6px] rounded-[1px] ${i < piece.hp ? 'bg-accent-400' : 'bg-background-300/70'}`}
                ></div>
              ))}
            </div>
            <span className="font-heading text-[9px] leading-none text-foreground-950">{piece.hp}</span>
          </div>
        </div>
      </div>
    </>
  );
}