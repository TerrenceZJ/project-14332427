import { useEffect, useState } from 'react';

interface Phase {
  n: string;
  icon: string;
  name: string;
  time: string;
  desc: string;
  highlight?: string;
  final?: boolean;
}

const phases: Phase[] = [
  {
    n: '1',
    icon: 'ri-refresh-line',
    name: '回合开始',
    time: '',
    desc: '行动点重置为 10,双方各抽 1 张牌,开启本回合的博弈。',
  },
  {
    n: '2',
    icon: 'ri-stack-line',
    name: '抽卡阶段',
    time: '2 分钟',
    desc: '可打出任意张攻击 / 辅助 / 特殊卡,先手扰乱或强化战场。',
  },
  {
    n: '3',
    icon: 'ri-crosshair-2-line',
    name: '指令阶段',
    time: '60 秒',
    desc: '消耗行动点为每只灵兽下达移动、防御或侦察指令。',
    highlight: '侦察姿态会额外多消耗 1 点行动点。',
  },
  {
    n: '4',
    icon: 'ri-stack-line',
    name: '援救阶段',
    time: '40 秒',
    desc: '指令之后再打一张牌,针对局势即时应变、补强阵容。',
  },
  {
    n: '5',
    icon: 'ri-skip-forward-line',
    name: '同步执行',
    time: '',
    desc: '双方指令同时结算,自动攻击、治疗与碰撞逐帧播放,可快进或跳过。',
  },
  {
    n: '?',
    icon: 'ri-trophy-line',
    name: '判定胜负',
    time: '',
    desc: '灵主被击杀两次即战败。若分出胜负,进入结算画面;否则回到回合开始,循环往复。',
    final: true,
  },
];

export default function TurnFlowModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const total = phases.length;
  const cur = phases[page];

  const goto = (i: number) => setPage(Math.max(0, Math.min(total - 1, i)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(total - 1, p + 1));
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, total]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative rune-border rounded-lg w-full max-w-xl bg-background-100 flex flex-col max-h-[86vh]">
        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-background-200">
          <div className="flex items-center gap-2.5">
            <i className="ri-route-line text-accent-400 w-5 h-5 flex items-center justify-center"></i>
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-base text-foreground-950">一个回合的完整流程</span>
              <span className="font-label text-[10px] text-foreground-600">点击箭头或圆点翻页查看</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:text-primary-300 hover:border-primary-400 cursor-pointer"
          >
            <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>

        {/* 内容 · 单页展示,不滚动 */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-8 py-10">
          <div
            className={`w-20 h-20 flex items-center justify-center rounded-full font-heading text-3xl mb-5 shrink-0 ${
              cur.final
                ? 'bg-accent-500 text-background-50'
                : 'bg-background-50 border-2 border-primary-500/40 text-primary-400'
            }`}
          >
            {cur.n}
          </div>
          <div className="flex items-center justify-center gap-2.5 mb-3 flex-wrap">
            <i
              className={`${cur.icon} w-5 h-5 flex items-center justify-center ${
                cur.final ? 'text-accent-500' : 'text-accent-400'
              }`}
            ></i>
            <h3 className="font-heading text-xl text-foreground-950">{cur.name}</h3>
            {cur.time && (
              <span className="inline-flex items-center gap-1.5 font-label text-[11px] px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 whitespace-nowrap">
                <i className="ri-time-line w-3.5 h-3.5 flex items-center justify-center"></i>
                {cur.time}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground-700 leading-relaxed max-w-md">{cur.desc}</p>
          {cur.highlight && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100/70 border border-primary-200 text-primary-700 font-label text-[11px]">
              <i className="ri-flashlight-line w-3.5 h-3.5 flex items-center justify-center"></i>
              {cur.highlight}
            </div>
          )}
        </div>

        {/* 底部翻页 */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-background-200">
          <button
            onClick={() => goto(page - 1)}
            disabled={page === 0}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-xs font-label border border-background-300 text-foreground-700 hover:border-primary-400 hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-s-line w-4 h-4 flex items-center justify-center"></i>
            上一阶段
          </button>

          <div className="flex items-center gap-2">
            {phases.map((p, i) => (
              <button
                key={p.name}
                onClick={() => goto(i)}
                aria-label={`第 ${i + 1} 阶段`}
                className={`rounded-full transition-all cursor-pointer ${
                  i === page ? 'w-6 h-2 bg-primary-500' : 'w-2 h-2 bg-background-300 hover:bg-primary-400'
                }`}
              ></button>
            ))}
          </div>

          <button
            onClick={() => goto(page + 1)}
            disabled={page === total - 1}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-xs font-label border border-background-300 text-foreground-700 hover:border-primary-400 hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            下一阶段
            <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>
      </div>
    </div>
  );
}