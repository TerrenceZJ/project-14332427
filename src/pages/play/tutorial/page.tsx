import { useNavigate } from 'react-router-dom';
import { TUTORIAL_LEVELS } from '@/game/levels';

/** 新手教程:关卡选择页(伪装成 PVE 关卡) */
export default function TutorialPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background-50 text-foreground-900">
      <header className="shrink-0 w-full px-4 h-14 flex items-center gap-3 border-b border-background-200/60">
        <button
          onClick={() => navigate('/')}
          aria-label="返回大厅"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
        >
          <i className="ri-arrow-left-line text-base w-4 h-4 flex items-center justify-center"></i>
        </button>
        <div className="flex flex-col leading-tight">
          <span className="font-heading text-sm text-foreground-950">新手训练营</span>
          <span className="font-label text-[9px] text-primary-400">TUTORIAL</span>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-6 flex flex-col">
        <div className="text-center mb-6 shrink-0">
          <span className="font-label text-[10px] text-primary-400">TRAINING CAMP</span>
          <h1 className="font-heading text-2xl text-foreground-950 mt-2 mb-2">御灵新手训练</h1>
          <p className="text-xs text-foreground-700">
            从最小的战场开始，逐步掌握职业、部署、移动、攻击与卡牌。完成全部关卡即可出师。
          </p>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          {TUTORIAL_LEVELS.map((lv, i) => (
            <button
              key={lv.id}
              onClick={() => navigate(`/play/tutorial/${lv.id}`)}
              className="rune-border rounded-lg p-4 flex items-center gap-4 text-left cursor-pointer hover:border-primary-400 transition-colors"
            >
              <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md bg-primary-500/15 border border-primary-500/40 text-primary-400">
                <span className="font-heading text-lg">{lv.id}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading text-base text-foreground-950">{lv.name}</h3>
                  {i === 0 && (
                    <span className="font-label text-[8px] px-1.5 py-0.5 rounded-full bg-primary-500/15 text-primary-300">推荐开始</span>
                  )}
                </div>
                <p className="text-xs text-foreground-700 leading-relaxed">{lv.subtitle}</p>
              </div>
              <i className="ri-arrow-right-s-line text-foreground-500 w-5 h-5 flex items-center justify-center"></i>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
