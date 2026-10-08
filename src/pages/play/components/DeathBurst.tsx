import type { CSSProperties } from 'react';
import { COLS, ROWS } from '@/game/constants';

/** 阵亡时朝六个方向飞散的碎片 */
const SHARDS = [
  { dx: '-16px', dy: '-20px', rot: '150deg' },
  { dx: '18px', dy: '-14px', rot: '-160deg' },
  { dx: '-20px', dy: '12px', rot: '-120deg' },
  { dx: '22px', dy: '16px', rot: '130deg' },
  { dx: '0px', dy: '-24px', rot: '90deg' },
  { dx: '0px', dy: '24px', rot: '-90deg' },
];

interface Props {
  x: number;
  y: number;
  cellPct: number;
}

/** 棋子被击杀时的碎裂 / 消散特效(暗色冲击环 + 飞散碎片 + 骷髅浮现) */
export default function DeathBurst({ x, y, cellPct }: Props) {
  const cx = `${((x + 0.5) / COLS) * 100}%`;
  const cy = `${((y + 0.5) / ROWS) * 100}%`;

  return (
    <>
      <span
        className="absolute death-ring rounded-full pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: `${cellPct * 1.1}%`,
          height: `${cellPct * 1.1}%`,
          border: '2px solid oklch(var(--secondary-400) / 0.85)',
          background: 'oklch(var(--background-950) / 0.35)',
          zIndex: 42,
        }}
      ></span>

      {SHARDS.map((s, i) => (
        <span
          key={i}
          className="absolute death-shard pointer-events-none"
          style={{
            left: cx,
            top: cy,
            width: `${cellPct * 0.26}%`,
            height: `${cellPct * 0.26}%`,
            background: 'oklch(var(--foreground-700))',
            clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
            '--dx': s.dx,
            '--dy': s.dy,
            '--rot': s.rot,
            zIndex: 42,
          } as CSSProperties}
        ></span>
      ))}

      <span className="absolute death-skull pointer-events-none" style={{ left: cx, top: cy, zIndex: 43 }}>
        <i className="ri-skull-2-fill w-5 h-5 flex items-center justify-center text-foreground-300"></i>
      </span>
    </>
  );
}