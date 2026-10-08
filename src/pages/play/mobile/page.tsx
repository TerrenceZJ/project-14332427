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

export default function PlayMobile() {
  const navigate = useNavigate();
  const [showCards, setShowCards] = useState(false);
  const [showFlow, setShowFlow] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background-50 text-foreground-900">
      <header className="shrink-0 w-full px-4 h-14 flex items-center justify-between gap-3 border-b border-background-200/60">
        <button className="flex items-center gap-2 cursor-pointer min-w-0" onClick={() => navigate('/')}>
          <div className="w-8 h-8 shrink-0 flex items-center justify-center rune-border rounded-md">
            <i className="ri-sparkling-2-fill text-primary-400 text-base w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div className="flex flex-col leading-tight text-left min-w-0">
            <span className="font-heading text-sm text-foreground-950 whitespace-nowrap">灵契终焉</span>
            <span className="font-label text-[9px] text-primary-400 whitespace-nowrap">SPIRIT · PACT</span>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowFlow(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-route-line w-5 h-5 flex items-center justify-center"></i>
          </button>
          <button
            onClick={() => setShowCards(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-stack-line w-5 h-5 flex items-center justify-center"></i>
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
            title="桌面端"
          >
            <i className="ri-computer-line w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-6 flex flex-col">
        <div className="text-center mb-6 shrink-0">
          <span className="font-label text-[10px] text-primary-400">GAME LOBBY</span>
          <h1 className="font-heading text-2xl text-foreground-950 mt-2 mb-2">御灵者大厅</h1>
          <p className="text-xs text-foreground-700">
            选择你的战斗方式。迷雾之下,每一次同步指令都是一场心理博弈。
          </p>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          {modes.map((m) => (
            <div
              key={m.key}
              className={`rune-border rounded-lg p-4 flex items-center gap-4 ${m.ready ? '' : 'opacity-60'}`}
            >
              <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md bg-primary-500/15 border border-primary-500/40 text-primary-400">
                <i className={`${m.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading text-base text-foreground-950">{m.name}</h3>
                  {!m.ready && (
                    <span className="font-label text-[8px] px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-600">即将推出</span>
                  )}
                </div>
                <p className="text-xs text-foreground-700 leading-relaxed">{m.desc}</p>
              </div>
              {m.ready ? (
                <button
                  onClick={() => navigate('/play/battle/mobile')}
                  className="shrink-0 px-4 py-2 rounded-md text-xs font-label bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap"
                >
                  开始
                </button>
              ) : (
                <button
                  disabled
                  className="shrink-0 px-4 py-2 rounded-md text-xs font-label border border-background-300 text-foreground-600 cursor-not-allowed whitespace-nowrap"
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
