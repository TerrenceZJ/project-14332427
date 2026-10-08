import type { Pt } from '@/game/types';
import { COLS, ROWS } from '@/game/constants';

/** 部署轨迹:按部署顺序用虚线连接各棋子摆放位置 */
export default function DeployTrail({ trail }: { trail: Pt[] }) {
  if (trail.length < 2) return null;

  return (
    <>
      {trail.slice(0, -1).map((p, i) => {
        const a = { x: ((p.x + 0.5) / COLS) * 100, y: ((p.y + 0.5) / ROWS) * 100 };
        const q = trail[i + 1];
        const b = { x: ((q.x + 0.5) / COLS) * 100, y: ((q.y + 0.5) / ROWS) * 100 };
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        return (
          <div
            key={i}
            className="absolute pointer-events-none border-t-2 border-dashed border-accent-400/70"
            style={{
              left: `${midX}%`,
              top: `${midY}%`,
              width: `${len}%`,
              transform: `translate(-50%, -50%) rotate(${angle}rad)`,
              zIndex: 8,
            }}
          ></div>
        );
      })}
    </>
  );
}