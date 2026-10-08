import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CardPreviewModal from '@/pages/play/components/CardPreviewModal';
import TurnFlowModal from '@/pages/play/components/TurnFlowModal';

const modes = [
  {
    key: 'ai',
    name: '单人 · VS AI',
    desc: '与智能对手展开一场同步指令的博弈,无需等待,随时开战。',
    icon: 'ri-robot-2-line',
    ready: true,
  },
  {
    key: 'local',
    name: '本地双人',
    desc: '两人同屏轮流下达指令,面对面对战。',
    icon: 'ri-group-line',
    ready: false,
  },
  {
    key: 'online',
    name: '在线联机',
    desc: '与全球御灵者实时匹配,登上王座排名。',
    icon: 'ri-global-line',
    ready: false,
  },
];

export default function Play() {
  const navigate = useNavigate();
  const [showCards, setShowCards] = useState(false);
  const [showFlow, setShowFlow] = useState(false);

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-background-50 text-foreground-900">
      <header className="shrink-0 w-full px-4 md:px-10 h-16 md:h-20 flex items-center justify-between gap-3 border-b border-background-200/60">
        <button className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 shrink-0 flex items-center justify-center rune-border rounded-md">
            <i className="ri-sparkling-2-fill text-primary-400 text-lg md:text-xl w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div className="flex flex-col leading-tight text-left min-w-0">
            <span className="font-heading text-base md:text-lg text-foreground-950 whitespace-nowrap">灵契终焉</span>
            <span className="font-label text-[10px] text-primary-400 whitespace-nowrap">SPIRIT · PACT</span>
          </div>
        </button>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={() => navigate('/mobile')}
            className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-sm font-label border border-secondary-500/40 text-secondary-300 hover:bg-secondary-500/10 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-smartphone-line w-4 h-4 flex items-center justify-center"></i>
            <span className="hidden sm:inline">移动端</span>
          </button>
          <button
            onClick={() => setShowFlow(true)}
            className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-sm font-label border border-accent-500/40 text-accent-300 hover:bg-accent-500/10 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-route-line w-4 h-4 flex items-center justify-center"></i>
            <span className="hidden sm:inline">回合流程</span>
          </button>
          <button
            onClick={() => setShowCards(true)}
            className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-sm font-label border border-primary-500/40 text-primary-300 hover:bg-primary-500/10 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-stack-line w-4 h-4 flex items-center justify-center"></i>
            <span className="hidden sm:inline">卡组预览</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-10 flex flex-col items-center justify-center">
        <div className="text-center mb-6 md:mb-8 shrink-0">
          <span className="font-label text-xs text-primary-400">GAME LOBBY</span>
          <h1 className="font-heading text-3xl md:text-5xl text-foreground-950 mt-2 mb-3">御灵者大厅</h1>
          <p className="text-sm md:text-base text-foreground-700 max-w-2xl mx-auto">
            选择你的战斗方式。迷雾之下,每一次同步指令都是一场心理博弈。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 w-full">
          {modes.map((m) => (
            <div
              key={m.key}
              className={`rune-border rounded-lg p-5 md:p-6 flex flex-col ${m.ready ? '' : 'opacity-60'}`}
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-md bg-primary-500/15 border border-primary-500/40 text-primary-400 mb-4">
                <i className={`${m.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="font-heading text-lg text-foreground-950">{m.name}</h3>
                {!m.ready && (
                  <span className="font-label text-[9px] px-2 py-1 rounded-full bg-background-200 text-foreground-600">即将推出</span>
                )}
              </div>
              <p className="text-sm text-foreground-700 leading-relaxed flex-1 mb-5">{m.desc}</p>
              {m.ready ? (
                <button
                  onClick={() => navigate('/play/battle')}
                  className="w-full px-5 py-3 rounded-md text-sm font-label bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap"
                >
                  开始对战
                </button>
              ) : (
                <button
                  disabled
                  className="w-full px-5 py-3 rounded-md text-sm font-label border border-background-300 text-foreground-600 cursor-not-allowed whitespace-nowrap"
                >
                  敬请期待
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      {showCards && <CardPreviewModal onClose={() => setShowCards(false)} />}
      {showFlow && <TurnFlowModal onClose={() => setShowFlow(false)} />}
    </div>
  );
}