import type { PieceType, Facing, Team } from '@/game/types';

interface Props {
  type: PieceType;
  facing: Facing;
  team: Team;
}

const SKIN = '#ffe3c2';
const INK = '#3b2f2f';
const BLUSH = '#f9a8b4';

/** 队伍描边色:我方蓝 / 敌方红 */
const TEAM_COLOR: Record<Team, string> = {
  player: '#3b82f6',
  enemy: '#ef4444',
};

/** 整眼位移:朝向右则双眼整体右移,上/下/左同理 */
const EYE_SHIFT: Record<Facing, [number, number]> = {
  up: [0, -3],
  down: [0, 3],
  left: [-3, 0],
  right: [3, 0],
};

/** 瞳孔在眼内额外偏移(与整眼同向,让"看"的方向更明显) */
const PUPIL_SHIFT: Record<Facing, [number, number]> = {
  up: [0, -1.3],
  down: [0, 1.3],
  left: [-1.3, 0],
  right: [1.3, 0],
};

/** 头顶职业符号 + 发色(发色按队伍区分:我方/敌方各自同一颜色) */
function Headwear({ type, color }: { type: PieceType; color: string }) {
  switch (type) {
    case 'warrior':
      return (
        <>
          <path d="M2 30 a30 30 0 0 1 60 0 z" fill={color} />
          <g transform="rotate(-34 32 13)">
            <rect x="30" y="0" width="4" height="14" rx="2" fill="#e2e8f0" />
            <rect x="26" y="13" width="12" height="3.5" rx="1.75" fill="#fbbf24" />
            <rect x="31" y="16.5" width="2" height="6" rx="1" fill="#94a3b8" />
          </g>
          <g transform="rotate(34 32 13)">
            <rect x="30" y="0" width="4" height="14" rx="2" fill="#e2e8f0" />
            <rect x="26" y="13" width="12" height="3.5" rx="1.75" fill="#fbbf24" />
            <rect x="31" y="16.5" width="2" height="6" rx="1" fill="#94a3b8" />
          </g>
        </>
      );
    case 'guardian':
      return (
        <>
          <path d="M2 30 a30 30 0 0 1 60 0 z" fill={color} />
          <path d="M32 4 L44 9 L44 22 L32 32 L20 22 L20 9 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="16" r="2.5" fill="#cbd5e1" />
        </>
      );
    case 'archer':
      return (
        <>
          <path d="M2 30 a30 30 0 0 1 60 0 z" fill={color} />
          <path d="M16 10 Q32 26 48 10" fill="none" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" />
          <line x1="16" y1="10" x2="48" y2="10" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="32" y1="10" x2="32" y2="2" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 0 L29 4 L35 4 Z" fill="#fbbf24" />
        </>
      );
    case 'mage':
      return (
        <>
          <path d="M22 25 L32 0 L42 25 Z" fill={color} />
          <ellipse cx="32" cy="25" rx="19" ry="5" fill={color} />
          <path d="M32 10 l1.3 3 l3 1.3 l-3 1.3 l-1.3 3 l-1.3 -3 l-3 -1.3 l3 -1.3 z" fill="#fde68a" />
        </>
      );
    case 'priest':
      return (
        <>
          <path d="M2 30 a30 30 0 0 1 60 0 z" fill={color} />
          <g stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round">
            <path d="M18 12 h8 M22 8 v8" />
            <path d="M38 12 h8 M42 8 v8" />
            <path d="M28 4 h8 M32 0 v8" />
          </g>
        </>
      );
  }
}

/** 棋子头像:竖直的可爱脑袋,瞳孔朝向代表棋子朝向,队伍描边区分敌我 */
export default function PieceAvatar({ type, facing, team }: Props) {
  const [ex, ey] = EYE_SHIFT[facing];
  const [px, py] = PUPIL_SHIFT[facing];
  const teamColor = TEAM_COLOR[team];
  const leftEye = { x: 26 + ex, y: 38 + ey };
  const rightEye = { x: 38 + ex, y: 38 + ey };

  return (
    <svg
      viewBox="0 0 64 64"
      className="w-full h-full"
      style={{
        filter: [
          `drop-shadow(2px 0 0 ${teamColor})`,
          `drop-shadow(-2px 0 0 ${teamColor})`,
          `drop-shadow(0 2px 0 ${teamColor})`,
          `drop-shadow(0 -2px 0 ${teamColor})`,
          `drop-shadow(0 0 5px ${teamColor})`,
        ].join(' '),
      }}
    >
      {/* 脑袋(肤色,描边为队伍色) */}
      <circle cx="32" cy="32" r="30" fill={SKIN} stroke={teamColor} strokeWidth="3" />

      {/* 头发 + 职业符号 */}
      <Headwear type={type} color={teamColor} />

      {/* 眼睛(瞳孔朝向代表朝向) */}
      <circle cx={leftEye.x} cy={leftEye.y} r="5.5" fill="#ffffff" />
      <circle cx={leftEye.x + px} cy={leftEye.y + py} r="3.2" fill={INK} />
      <circle cx={leftEye.x - 1.8} cy={leftEye.y - 1.8} r="1.1" fill="#ffffff" />

      <circle cx={rightEye.x} cy={rightEye.y} r="5.5" fill="#ffffff" />
      <circle cx={rightEye.x + px} cy={rightEye.y + py} r="3.2" fill={INK} />
      <circle cx={rightEye.x - 1.8} cy={rightEye.y - 1.8} r="1.1" fill="#ffffff" />

      {/* 腮红 */}
      <circle cx="19" cy="46" r="2.8" fill={BLUSH} opacity="0.85" />
      <circle cx="45" cy="46" r="2.8" fill={BLUSH} opacity="0.85" />

      {/* 微笑 */}
      <path d="M29 47 Q32 50 35 47" stroke={INK} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}
