import type { Piece } from '@/game/types';
import { COLS, ROWS } from '@/game/constants';

/** 棋子血条(独立渲染层,始终位于其它棋子之上,不被遮挡) */
export default function PieceHpBar({ piece }: { piece: Piece }) {
  const left = `${((piece.x + 0.5) / COLS) * 100}%`;
  const top = `${((piece.y + 0.5) / ROWS) * 100}%`;
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width: `${cellW}%`,
        height: `${cellH}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left .62s ease, top .62s ease',
        zIndex: 35,
      }}
    >
      <div className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 flex items-center gap-1">
        <div className="flex items-center gap-[1.5px]">
          {Array.from({ length: piece.maxHp }).map((_, i) => (
            <div
              key={i}
              className={`w-[3px] h-[6px] rounded-[1px] ${i < piece.hp ? 'bg-green-400' : 'bg-background-300/70'}`}
            ></div>
          ))}
        </div>
        <span className="font-heading text-[9px] leading-none text-foreground-950">{piece.hp}</span>
      </div>
    </div>
  );
}
