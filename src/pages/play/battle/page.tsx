import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBattle } from '@/pages/play/hooks/useBattle';
import { visibleKeys, legalMoves, at } from '@/game/engine';
import { key, inBounds, LINEUP_SIZE } from '@/game/constants';
import { CARDS_BY_ID } from '@/game/cards';
import type { Team, AutoCommandStyle } from '@/game/types';
import BattleBoard from '@/pages/play/components/BattleBoard';
import TurnHeader from '@/pages/play/components/TurnHeader';
import HandPanel from '@/pages/play/components/HandPanel';
import SummonDeckModal from '@/pages/play/components/SummonDeckModal';
import DeployRosterPanel from '@/pages/play/components/DeployRosterPanel';
import BattleLog from '@/pages/play/components/BattleLog';
import ResultOverlay from '@/pages/play/components/ResultOverlay';
import PieceInfoPanel from '@/pages/play/components/PieceInfoPanel';
import DrawReveal from '@/pages/play/components/DrawReveal';
import EnemyDeckModal from '@/pages/play/components/EnemyDeckModal';
import MobileBattleView from '@/pages/play/components/MobileBattleView';
import PhaseTransitionOverlay from '@/pages/play/components/PhaseTransitionOverlay';

interface Pending {
  cardId: string;
  pieceIds: string[];
  cell: { x: number; y: number } | null;
}

export default function BattlePage({ forceView: forceViewProp }: { forceView?: 'desktop' | 'mobile' }) {
  const navigate = useNavigate();
  const b = useBattle();
  const { state } = b;
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<Pending | null>(null);
  const [phaseEndNotice, setPhaseEndNotice] = useState(false);
  const [summonOpen, setSummonOpen] = useState(true);
  const [enemyDeckOpen, setEnemyDeckOpen] = useState(false);
  const [drawReveal, setDrawReveal] = useState<string | null>(null);
  const [autoStyle, setAutoStyle] = useState<AutoCommandStyle>('aggressive');
  const [forceView, setForceView] = useState<'desktop' | 'mobile' | null>(() => {
    if (forceViewProp) return forceViewProp;
    const v = searchParams.get('view');
    return v === 'desktop' || v === 'mobile' ? v : null;
  });
  const card1SeenRef = useRef(false);
  const noticeTimer = useRef<number | null>(null);
  const prevPhaseRef = useRef(state.phase);

  const toggleView = () => {
    const next = forceView === 'desktop' ? 'mobile' : 'desktop';
    setForceView(next);
    setSearchParams({ view: next }, { replace: true });
  };

  useEffect(() => {
    if (state.phase !== 'card1' && state.phase !== 'card2') setPending(null);
    setPhaseEndNotice(false);
    if (state.phase !== 'command') setEnemyDeckOpen(false);
    if (noticeTimer.current) { window.clearTimeout(noticeTimer.current); noticeTimer.current = null; }
  }, [state.phase]);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  // 进入部署阶段(开局 / 重开后)自动弹出召唤卡牌界面
  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      prevPhaseRef.current = state.phase;
      if (state.phase === 'deploy') setSummonOpen(true);
    }
  }, [state.phase]);

  // 进入抽卡阶段时,播放一次抽卡动画(开局发牌不触发)
  useEffect(() => {
    if (state.phase === 'card1') {
      if (!card1SeenRef.current && state.lastDrawnCardId) {
        card1SeenRef.current = true;
        setDrawReveal(state.lastDrawnCardId);
      }
    } else {
      card1SeenRef.current = false;
    }
  }, [state.phase, state.lastDrawnCardId]);

  const visible = useMemo(() => {
    const s = visibleKeys(state);
    state.vision.forEach((k) => s.add(k));
    return s;
  }, [state]);

  const selected = state.pieces.find((p) => p.id === state.selectedId) || null;

  const moveCells = useMemo(() => {
    if (!selected || !selected.alive || !selected.placed) return new Set<string>();
    if (state.phase === 'command') {
      if (selected.team !== 'player' || selected.acted) return new Set<string>();
      return legalMoves(state, selected);
    }
    if (state.phase === 'card1' || state.phase === 'card2') {
      return legalMoves(state, selected);
    }
    return new Set<string>();
  }, [state, selected]);

  const rangeCells = useMemo(() => {
    const set = new Set<string>();
    if (!selected || !selected.placed) return set;
    // 指令阶段:己方棋子显示攻击范围
    if (state.phase === 'command' && selected.team === 'player') {
      const r = selected.range;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = selected.x + dx;
          const ny = selected.y + dy;
          if (inBounds(nx, ny)) set.add(key(nx, ny));
        }
      }
      return set;
    }
    // 卡牌阶段:敌方棋子显示攻击范围
    if (selected.team !== 'player' && state.phase !== 'card1' && state.phase !== 'card2') return set;
    const r = selected.range;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = selected.x + dx;
        const ny = selected.y + dy;
        if (inBounds(nx, ny)) set.add(key(nx, ny));
      }
    }
    return set;
  }, [selected, state.phase]);

  const pendingCard = pending ? CARDS_BY_ID[pending.cardId] : null;

  const targetPieceIds = useMemo(() => {
    const set = new Set<string>();
    if (!pendingCard || (state.phase !== 'card1' && state.phase !== 'card2')) return set;
    const kind = pendingCard.target.kind;
    if (kind === 'cell') return set;

    let teams: Team[] = [];
    if (kind === 'enemy1' || kind === 'enemy2') teams = ['enemy'];
    else if (kind === 'ally1' || kind === 'ally2') teams = ['player'];
    else if (kind === 'enemyAlly') teams = pending!.pieceIds.length === 0 ? ['enemy'] : ['player'];

    for (const p of state.pieces) {
      if (!p.alive || !p.placed) continue;
      if (!teams.includes(p.team)) continue;
      if (pending!.pieceIds.includes(p.id)) continue;
      if (p.team === 'enemy' && !visible.has(key(p.x, p.y))) continue;
      set.add(p.id);
    }
    return set;
  }, [pending, pendingCard, state.pieces, state.phase, visible]);

  const pendingHint = useMemo(() => {
    if (!pendingCard) return null;
    switch (pendingCard.target.kind) {
      case 'enemy1': return '选择 1 个敌方目标';
      case 'enemy2': return '选择 2 个敌方目标';
      case 'ally1': return '选择 1 个己方目标';
      case 'ally2': return '选择 2 个己方目标';
      case 'enemyAlly': return pending!.pieceIds.length === 0 ? '先选择 1 个敌方目标' : '再选择 1 个己方目标';
      case 'cell': return '点击战场,选择 3×3 区域中心';
      default: return null;
    }
  }, [pendingCard, pending]);

  const handlePlayCard = (cardId: string) => {
    const card = CARDS_BY_ID[cardId];
    if (!card) return;
    if (card.target.kind === 'none') {
      b.playCard(cardId, { pieceIds: [] });
      return;
    }
    setPending({ cardId, pieceIds: [], cell: null });
  };

  const handleCell = (x: number, y: number) => {
    // 卡牌指向模式
    if (pending && pendingCard && (state.phase === 'card1' || state.phase === 'card2')) {
      if (pendingCard.target.kind === 'cell') {
        b.playCard(pending.cardId, { pieceIds: [], cell: { x, y } });
        setPending(null);
        return;
      }
      const occupant = at(state, x, y);
      if (occupant && targetPieceIds.has(occupant.id)) {
        const nextTargets = [...pending.pieceIds, occupant.id];
        if (nextTargets.length >= pendingCard.target.count) {
          b.playCard(pending.cardId, { pieceIds: nextTargets });
          setPending(null);
        } else {
          setPending({ ...pending, pieceIds: nextTargets });
        }
      }
      return;
    }

    if (state.phase === 'deploy') {
      const occupant = at(state, x, y);
      if (occupant && occupant.team === 'player') { b.select(occupant.id); return; }
      const sel = state.pieces.find((p) => p.id === state.selectedId);
      if (sel && sel.team === 'player') {
        if (!sel.placed) { b.place(sel.id, x, y); return; }
        b.redeploy(sel.id, x, y); return;
      }
      return;
    }

    if (state.phase === 'command' && !b.busy) {
      const sel = state.pieces.find((p) => p.id === state.selectedId);
      const occupant = at(state, x, y);
      
      // 选中己方棋子时，点击敌人设置为攻击目标，点击友方设置为治疗目标
      if (sel && sel.team === 'player' && sel.alive && sel.placed && !sel.acted) {
        if (occupant && occupant.team === 'enemy' && visible.has(key(x, y))) {
          b.issue(sel.id, { setAttackTarget: occupant.id });
          return;
        }
        if (occupant && occupant.team === 'player' && sel.heal > 0) {
          b.issue(sel.id, { setHealTarget: occupant.id });
          return;
        }
        if (moveCells.has(key(x, y))) {
          b.issue(sel.id, { waypoint: { x, y } });
          return;
        }
      }
      
      if (occupant) {
        if (occupant.team === 'enemy' && !visible.has(key(x, y))) { b.select(null); return; }
        b.select(occupant.id); return;
      }
      b.select(null);
    }

    if ((state.phase === 'card1' || state.phase === 'card2') && !b.busy) {
      const occupant = at(state, x, y);
      if (occupant) {
        if (occupant.team === 'enemy' && !visible.has(key(x, y))) { b.select(null); return; }
        b.select(occupant.id); return;
      }
      b.select(null);
    }
  };

  const handleEndPhase = () => {
    b.advance();
  };

  const handlePhaseTimeout = () => {
    setPhaseEndNotice(true);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    const phase = state.phase;
    noticeTimer.current = window.setTimeout(() => {
      setPhaseEndNotice(false);
      noticeTimer.current = null;
      // 部署阶段超时:自动补足阵容、随机布阵并直接出战
      if (phase === 'deploy') {
        if (state.lineup.length < LINEUP_SIZE) b.randomLineup();
        b.randomize();
        b.start();
        setSummonOpen(false);
        return;
      }
      b.advance();
    }, 1500);
  };

  const canCommand =
    state.phase === 'command' && !!selected && selected.team === 'player' && selected.placed && selected.alive;

  const infoPanel = null;

  const paused = (state.phase === 'deploy' && summonOpen) || (state.phase === 'command' && enemyDeckOpen);

  return (
    <>
    <div className={`h-screen overflow-hidden flex-col bg-background-50 text-foreground-900 ${forceView === 'mobile' ? 'hidden' : 'flex'}`}>
      <header className="shrink-0 z-40 bg-background-50/90 backdrop-blur-md border-b border-background-200/60">
        <div className="w-full px-6 md:px-10 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-foreground-700 hover:text-primary-300 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            返回大厅
          </button>
          <div className="font-heading text-base text-foreground-950">灵契终焉 · 单人演练</div>
          <div className="hidden sm:flex items-center gap-2 font-label text-[10px] text-secondary-300">
            <span className="w-2 h-2 rounded-full bg-secondary-400 flicker"></span>
            AI 对手
          </div>
          <button
            onClick={toggleView}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-label border border-primary-500/40 text-primary-300 hover:bg-primary-500/10 cursor-pointer whitespace-nowrap"
          >
            <i className={`${forceView === 'mobile' ? 'ri-computer-line' : 'ri-smartphone-line'} w-4 h-4 flex items-center justify-center`}></i>
            {forceView === 'mobile' ? '桌面端' : '移动端'}
          </button>
        </div>
      </header>

      <main className="w-full flex-1 min-h-0 px-4 md:px-6 py-3 md:py-4">
        <div className="flex gap-3 md:gap-4 h-full min-h-0">
          {/* 左侧 · 战斗日志竖栏:阶段栏与手牌 / 棋子框统一收在右侧 */}
          <aside className="relative w-52 md:w-72 xl:w-80 shrink-0 h-full min-h-0">
            <div className="absolute inset-0">
              <BattleLog log={state.log} />
            </div>

            {/* 棋子信息 / 指令面板:浮在战斗日志之上,固定在左下角 */}
            {infoPanel && (
              <div className="absolute left-2 right-2 bottom-2 z-30 max-h-[calc(100%-1rem)] overflow-y-auto rounded-lg">
                {infoPanel}
              </div>
            )}
          </aside>

          {/* 棋盘主区域:棋盘吃满整列高度,阶段栏与手牌 / 棋子框统一收在右侧 */}
          <div className="flex-1 min-w-0 min-h-0 flex gap-3">
            <section className="relative flex-1 min-w-0 min-h-0">
              <BattleBoard
                state={state}
                visible={visible}
                selectedId={state.selectedId}
                moveCells={moveCells}
                rangeCells={rangeCells}
                targetPieceIds={targetPieceIds}
                events={b.events}
                onCellClick={handleCell}
              />


            </section>

            {/* 右侧 · 阶段栏(上)+ 手牌 / 棋子框(下) */}
            <div className="w-80 xl:w-96 shrink-0 min-h-0 flex flex-col gap-3">
              <TurnHeader
                state={state}
                busy={b.busy}
                speed={b.speed}
                paused={(state.phase === 'deploy' && summonOpen) || (state.phase === 'command' && enemyDeckOpen)}
                onTimeout={handlePhaseTimeout}
                onEnd={handleEndPhase}
                onSkip={b.skipExecution}
                onToggleSpeed={b.toggleSpeed}
                onViewEnemyDeck={() => setEnemyDeckOpen(true)}
                onAutoCommand={() => b.autoCommand(autoStyle)}
                autoStyle={autoStyle}
                onAutoStyle={setAutoStyle}
              />

              {state.phase === 'deploy' ? (
                <DeployRosterPanel
                  state={state}
                  className="flex-1 min-h-0"
                  onSelect={b.select}
                  onUnplace={b.unplace}
                  onMakeLord={b.makeLord}
                  onRandomize={b.randomize}
                  onStart={b.start}
                  onReopenSummon={() => setSummonOpen(true)}
                />
              ) : (
                <HandPanel
                  state={state}
                  className="flex-1 min-h-0"
                  onPlayCard={handlePlayCard}
                  pendingCardId={pending?.cardId ?? null}
                  onCancel={() => setPending(null)}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      </div>

      {forceView !== 'desktop' && (
      <MobileBattleView
        b={b}
        visible={visible}
        moveCells={moveCells}
        rangeCells={rangeCells}
        targetPieceIds={targetPieceIds}
        pendingCardId={pending?.cardId ?? null}
        pendingCount={pending?.pieceIds.length ?? 0}
        pendingNeed={pendingCard?.target.count ?? 0}
        pendingHint={pendingHint}
        paused={paused}
        autoStyle={autoStyle}
        onAutoStyle={setAutoStyle}
        onCell={handleCell}
        onPlayCard={handlePlayCard}
        onCancelCard={() => setPending(null)}
        onPhaseTimeout={handlePhaseTimeout}
        onOpenEnemyDeck={() => setEnemyDeckOpen(true)}
        onReopenSummon={() => setSummonOpen(true)}
        onToggleView={toggleView}
      />
      )}

      <ResultOverlay state={state} onRestart={b.restart} onLobby={() => navigate('/')} />

      {/* 阶段切换过渡动画 */}
      <PhaseTransitionOverlay phase={state.phase} turn={state.turn} />

      {drawReveal &&
        createPortal(
          <DrawReveal cardId={drawReveal} deckLeft={state.deck.length} onDone={() => setDrawReveal(null)} />,
          document.body
        )}

      {enemyDeckOpen && state.phase === 'command' && (
        <EnemyDeckModal onClose={() => setEnemyDeckOpen(false)} />
      )}

      {state.phase === 'deploy' && summonOpen && (
        <SummonDeckModal
          state={state}
          onToggleLineup={b.toggleLineup}
          onRandomLineup={b.randomLineup}
          onConfirm={() => setSummonOpen(false)}
        />
      )}

      {phaseEndNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm"></div>
          <div className="relative rune-border rounded-lg w-full max-w-md p-6 bg-background-100">
            <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-accent-500/15 border border-accent-500/40 text-accent-300">
              <i className="ri-time-line text-2xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <h2 className="font-heading text-xl text-foreground-950 text-center mb-2">
              {state.phase === 'deploy'
                ? '部署阶段'
                : state.phase === 'command'
                ? '指令阶段'
                : state.phase === 'card1'
                ? '抽卡阶段'
                : '援救阶段'}{' '}
              结束
            </h2>
            <p className="text-sm text-foreground-700 text-center leading-relaxed">
              时间到，即将自动进入下一阶段…
            </p>
          </div>
        </div>
      )}
    </>
  );
}