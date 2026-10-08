import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AutoCommandStyle, Piece } from '@/game/types';
import type { Battle } from '@/pages/play/hooks/useBattle';
import { LINEUP_SIZE } from '@/game/constants';
import BattleBoard, { type BattleBoardHandle } from './BattleBoard';
import CountdownRingFrame from './CountdownRingFrame';
import HandPanel from './HandPanel';
import MobilePieceRail from './MobilePieceRail';
import PieceInfoPanel from './PieceInfoPanel';
import BattleLog from './BattleLog';

type Tab = 'hand' | 'piece' | 'cmd' | 'log';

interface TabDef {
  id: Tab;
  label: string;
  icon: string;
  badge?: number;
}

const phaseLabel: Record<string, string> = {
  deploy: '部署阶段',
  card1: '抽卡阶段',
  command: '指令阶段',
  card2: '援救阶段',
  execute: '同步执行',
  gameover: '战斗结束',
};

const confirmLabel: Record<string, string> = {
  card1: '结束抽卡 · 下指令',
  command: '结束指令 · 用卡牌',
  card2: '结束 · 同步执行',
};

const AUTO_STYLES: { id: AutoCommandStyle; label: string; icon: string }[] = [
  { id: 'aggressive', label: '激进压上', icon: 'ri-fire-line' },
  { id: 'defensive', label: '保守防御', icon: 'ri-shield-line' },
  { id: 'focusLord', label: '集火灵主', icon: 'ri-focus-3-line' },
];

interface Props {
  b: Battle;
  visible: Set<string>;
  moveCells: Set<string>;
  rangeCells: Set<string>;
  targetPieceIds: Set<string>;
  pendingCardId: string | null;
  pendingCount: number;
  pendingNeed: number;
  pendingHint: string | null;
  paused: boolean;
  autoStyle: AutoCommandStyle;
  onAutoStyle: (s: AutoCommandStyle) => void;
  onCell: (x: number, y: number) => void;
  onPlayCard: (cardId: string) => void;
  onCancelCard: () => void;
  onPhaseTimeout: () => void;
  onOpenEnemyDeck: () => void;
  onReopenSummon: () => void;
  onToggleView: () => void;
}

/** 移动端(竖屏)对战界面:顶栏 + 大棋盘 + 底部可上滑抽屉(手牌 / 棋子 / 指令 / 日志) */
export default function MobileBattleView({
  b,
  visible,
  moveCells,
  rangeCells,
  targetPieceIds,
  pendingCardId,
  pendingCount,
  pendingNeed,
  pendingHint,
  paused,
  autoStyle,
  onAutoStyle,
  onCell,
  onPlayCard,
  onCancelCard,
  onPhaseTimeout,
  onOpenEnemyDeck,
  onReopenSummon,
  onToggleView,
}: Props) {
  const navigate = useNavigate();
  const { state } = b;
  const [tab, setTab] = useState<Tab>('hand');
  const [open, setOpen] = useState(true);
  const boardRef = useRef<BattleBoardHandle>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const isDeploy = state.phase === 'deploy';
  const isCommand = state.phase === 'command';
  const isExecute = state.phase === 'execute';
  const canPlay = state.phase === 'card1' || state.phase === 'card2';
  const canEnd = canPlay || isCommand;

  // 部署阶段无手牌,自动切到棋子页
  useEffect(() => {
    if (isDeploy && (tab === 'hand' || tab === 'cmd')) setTab('piece');
  }, [isDeploy, tab]);

  // 进入抽卡 / 援救阶段默认展示手牌
  useEffect(() => {
    if (state.phase === 'card1' || state.phase === 'card2') setTab('hand');
  }, [state.phase]);

  // 进入指令阶段,自动切到「指令」界面并展开抽屉
  useEffect(() => {
    if (state.phase === 'command') {
      setTab('cmd');
      setOpen(true);
    }
  }, [state.phase]);

  // 进入同步执行阶段,自动切到「日志」并展开抽屉,方便看结算过程
  useEffect(() => {
    if (state.phase === 'execute') {
      setTab('log');
      setOpen(true);
    }
  }, [state.phase]);

  // 阶段倒计时(部署 60s / 抽卡 120s / 指令 60s / 援救 40s)
  const countdown = isDeploy || canPlay || isCommand;
  // 本阶段总时长(用于倒计时进度环的比例)
  const phaseTotal = isDeploy ? 60 : state.phase === 'card1' ? 120 : isCommand ? 60 : 40;
  const [count, setCount] = useState(60);
  useEffect(() => {
    setCount(phaseTotal);
  }, [state.phase, state.turn, phaseTotal]);
  useEffect(() => {
    if (!countdown || b.busy || paused) return;
    const t = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(t);
          onPhaseTimeout();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [state.phase, state.turn, b.busy, countdown, paused, onPhaseTimeout]);
  const mm = String(Math.floor(count / 60)).padStart(2, '0');
  const ss = String(count % 60).padStart(2, '0');

  const mine = state.pieces.filter((p) => p.team === 'player');
  const reserve = mine.filter((p) => !p.placed);
  const deployReady = mine.length === LINEUP_SIZE && reserve.length === 0 && state.lineup.length === LINEUP_SIZE;
  const deployHint =
    mine.length < LINEUP_SIZE
      ? `还需召唤 ${LINEUP_SIZE - mine.length} 只`
      : reserve.length > 0
      ? `还需部署 ${reserve.length} 只`
      : '确认出战';

  const tabs: TabDef[] = isDeploy
    ? [
        { id: 'piece', label: '棋子', icon: 'ri-layout-grid-fill' },
        { id: 'log', label: '日志', icon: 'ri-file-list-3-line' },
      ]
    : [
        { id: 'hand', label: '手牌', icon: 'ri-hand-coin-line', badge: state.hand.length },
        ...(isCommand ? [{ id: 'cmd' as Tab, label: '指令', icon: 'ri-magic-line' }] : []),
        { id: 'log', label: '日志', icon: 'ri-file-list-3-line' },
      ];

  // 指令阶段:是否还有已规划的路径(决定清除 / 撤销按钮是否可用)
  const hasPlannedPaths = state.pieces.some(
    (p) => p.team === 'player' && p.placed && p.alive && !p.acted && p.path.length > 0,
  );

  // 指令阶段选中的己方棋子
  const commandPiece =
    isCommand && state.selectedId
      ? state.pieces.find(
          (p) => p.id === state.selectedId && p.team === 'player' && p.placed && p.alive,
        ) ?? null
      : null;

  // 指令阶段选中棋子后,自动切到「指令」并展开
  useEffect(() => {
    if (isCommand && commandPiece) {
      setTab('cmd');
      setOpen(true);
    }
  }, [isCommand, commandPiece]);

  // 阶段切换后,若当前标签已不属于本阶段(例如离开指令阶段后仍停在「指令」),回退到「手牌」
  const validTab: Tab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;


  const pickTab = (t: Tab) => {
    if (tab === t && open) {
      setOpen(false);
      return;
    }
    setTab(t);
    setOpen(true);
  };

  const content = (() => {
    if (validTab === 'hand') {
      return (
        <HandPanel
          state={state}
          className="h-full"
          orientation="horizontal"
          onPlayCard={onPlayCard}
          pendingCardId={pendingCardId}
          onCancel={onCancelCard}
        />
      );
    }
    if (validTab === 'piece') {
      return (
        <MobilePieceRail
          state={state}
          onSelect={b.select}
          onUnplace={b.unplace}
          onMakeLord={b.makeLord}
          onRandomize={b.randomize}
          onReopenSummon={onReopenSummon}
        />
      );
    }
    if (validTab === 'cmd') {
      return (
        <div className="relative h-full min-h-0 flex flex-col gap-2 overflow-y-auto">
          {commandPiece ? (
            <PieceInfoPanel
              piece={commandPiece}
              ap={state.ap}
              onClose={() => b.select(null)}
              onIssue={b.issue}
              compact
            />
          ) : (
          <>
          {/* 自动指令视图 */}
          <div>
            <div className="font-label text-[9px] text-foreground-600 mb-1">自动指令风格</div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-background-200/70 border border-background-300/50">
              {AUTO_STYLES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onAutoStyle(o.id)}
                  disabled={b.busy}
                  className={`flex-1 flex items-center justify-center gap-0.5 px-1 py-1 rounded-full font-label text-[10px] whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 ${
                    autoStyle === o.id ? 'bg-primary-500 text-background-50' : 'text-foreground-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => b.autoCommand(autoStyle)}
            disabled={b.busy}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-md font-label text-xs border border-accent-500/50 text-accent-300 hover:bg-accent-500/10 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-magic-line w-3.5 h-3.5 flex items-center justify-center"></i>
            一键自动指令
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => b.undoLastStep()}
              disabled={b.busy || !hasPlannedPaths}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md font-label text-[10px] border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-go-back-line w-3 h-3 flex items-center justify-center"></i>
              撤销
            </button>
            <button
              onClick={() => b.clearAllPaths()}
              disabled={b.busy || !hasPlannedPaths}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md font-label text-[10px] border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <i className="ri-eraser-line w-3 h-3 flex items-center justify-center"></i>
              清除
            </button>
            <button
              onClick={onOpenEnemyDeck}
              disabled={b.busy}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md font-label text-[10px] border border-secondary-500/50 text-secondary-300 hover:bg-secondary-500/10 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-eye-line w-3 h-3 flex items-center justify-center"></i>
              敌方牌组
            </button>
          </div>
          </>
          )}
        </div>
      );
    }
    return (
      <div className="h-full">
        <BattleLog log={state.log} />
      </div>
    );
  })();

  return (
    <div
      className="lg:hidden fixed inset-0 z-20 flex flex-col bg-background-50 text-foreground-900"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 顶栏:返回 + 阶段 + 倒计时 */}
      <header className="shrink-0 h-10 px-2 flex items-center gap-1 border-b border-background-200/60 bg-background-50/95 backdrop-blur">
        <button
          onClick={() => navigate('/')}
          aria-label="返回大厅"
          className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
        >
          <i className="ri-arrow-left-line text-base w-4 h-4 flex items-center justify-center"></i>
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-heading text-xs text-foreground-950 truncate">{phaseLabel[state.phase]}</div>
        </div>
        <button
          onClick={onToggleView}
          className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-700 hover:text-primary-300 cursor-pointer"
          title="切换桌面端"
        >
          <i className="ri-computer-line text-base w-4 h-4 flex items-center justify-center"></i>
        </button>
        {/* 视角缩放:从棋盘里移出来放到顶栏,避免遮挡棋子导致无法操作 */}
        <div className="shrink-0 flex items-center gap-0.5 rounded-full border border-background-300/60 bg-background-100/85 p-0.5">
          <button
            onClick={() => boardRef.current?.zoomOut()}
            aria-label="缩小棋盘"
            className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-600 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-subtract-line text-xs w-3 h-3 flex items-center justify-center"></i>
          </button>
          <button
            onClick={() => boardRef.current?.resetView()}
            aria-label="重置视角"
            className="min-w-6 h-5 px-0.5 flex items-center justify-center rounded-full font-label text-[8px] text-foreground-600 hover:text-primary-300 cursor-pointer tabular-nums"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            onClick={() => boardRef.current?.zoomIn()}
            aria-label="放大棋盘"
            className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-600 hover:text-primary-300 cursor-pointer"
          >
            <i className="ri-add-line text-xs w-3 h-3 flex items-center justify-center"></i>
          </button>
        </div>
        {countdown ? (
          <span className={`font-heading text-xs tabular-nums ${count <= 10 ? 'text-secondary-400' : 'text-foreground-900'}`}>
            {mm}:{ss}
          </span>
        ) : (
          <span className="w-8"></span>
        )}
      </header>

      {/* 棋盘区域 - 占据所有可用空间 */}
      <section className="relative flex-1 min-h-0">
        <BattleBoard
          state={state}
          visible={visible}
          selectedId={state.selectedId}
          moveCells={moveCells}
          rangeCells={rangeCells}
          targetPieceIds={targetPieceIds}
          events={b.events}
          onCellClick={onCell}
          ref={boardRef}
          onZoomChange={setZoomLevel}
        />
      </section>

      {/* 底部抽屉 */}
      <div className="shrink-0 border-t border-background-200/60 bg-background-100/95 backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="展开或收起面板"
          className="w-full h-4 flex items-center justify-center cursor-pointer"
        >
          <span className="w-10 h-1 rounded-full bg-background-400/70"></span>
        </button>

        <div className="px-2 pb-1.5 flex items-center gap-1.5">
          {/* 标签切换 */}
          <div className="flex-1 min-w-0 flex items-center gap-1 p-0.5 rounded-full bg-background-200/70 border border-background-300/50">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTab(t.id)}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1 py-1 rounded-full font-label text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                  validTab === t.id && open ? 'bg-primary-500 text-background-50' : 'text-foreground-600'
                }`}
              >
                <i className={`${t.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
                {t.label}
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <span
                    className={`font-heading text-[9px] px-1 rounded-full ${
                      validTab === t.id && open ? 'bg-background-50/25 text-background-50' : 'bg-background-300/70 text-foreground-700'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="展开或收起面板"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-foreground-500 hover:text-primary-300 cursor-pointer"
            >
              <i className={`ri-arrow-up-s-line text-sm w-4 h-4 flex items-center justify-center transition-transform ${open ? 'rotate-180' : ''}`}></i>
            </button>
          </div>

          {/* 当前阶段动作:与标签同行,不再单独占一行 */}
          {isExecute ? (
            <div className="shrink-0 flex items-center gap-1">
              <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-background-200/70 border border-background-300/50">
                <button
                  onClick={() => { if (b.speed !== 'normal') b.toggleSpeed(); }}
                  className={`px-2 py-1 rounded-full font-label text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                    b.speed === 'normal' ? 'bg-primary-500 text-background-50' : 'text-foreground-600'
                  }`}
                >
                  普通
                </button>
                <button
                  onClick={() => { if (b.speed !== 'fast') b.toggleSpeed(); }}
                  className={`px-2 py-1 rounded-full font-label text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                    b.speed === 'fast' ? 'bg-primary-500 text-background-50' : 'text-foreground-600'
                  }`}
                >
                  快进
                </button>
              </div>
              <button
                onClick={b.skipExecution}
                className="px-2.5 py-1.5 rounded-md font-label text-[11px] border border-secondary-500/50 text-secondary-300 hover:bg-secondary-500/10 cursor-pointer whitespace-nowrap"
              >
                跳过
              </button>
            </div>
          ) : isDeploy ? (
            <CountdownRingFrame remaining={count} total={phaseTotal} warnAt={10} radius={6} className="shrink-0">
            <button
              onClick={b.start}
              disabled={!deployReady}
              className="px-2.5 py-1.5 rounded-md font-label text-[11px] bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {deployHint}
            </button>
            </CountdownRingFrame>
          ) : canEnd ? (
            <CountdownRingFrame remaining={count} total={phaseTotal} warnAt={10} radius={6} className="shrink-0">
            <button
              onClick={b.advance}
              disabled={b.busy}
              className="px-2.5 py-1.5 rounded-md font-label text-[11px] bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {b.busy ? '结算中…' : confirmLabel[state.phase]}
            </button>
            </CountdownRingFrame>
          ) : null}
        </div>

        <div className={`overflow-hidden transition-all duration-300 ease-out ${open ? 'max-h-[44vh]' : 'max-h-0'}`}>
          <div className="h-[34vh] px-2 pb-2">{content}</div>
        </div>
      </div>
    </div>
  );
}