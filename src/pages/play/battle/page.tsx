import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useBattle } from '@/pages/play/hooks/useBattle';
import { visibleKeys, legalMoves, at } from '@/game/engine';
import { key, inBounds, cellName, LINEUP_SIZE } from '@/game/constants';
import { CARDS_BY_ID } from '@/game/cards';
import { BEASTS } from '@/game/beasts';
import type { Team, AutoCommandStyle } from '@/game/types';
import MobileBattleView from '@/pages/play/components/MobileBattleView';
import ResultOverlay from '@/pages/play/components/ResultOverlay';
import SummonDeckModal from '@/pages/play/components/SummonDeckModal';
import DrawReveal from '@/pages/play/components/DrawReveal';
import EnemyDeckModal from '@/pages/play/components/EnemyDeckModal';
import PhaseTransitionOverlay from '@/pages/play/components/PhaseTransitionOverlay';

interface Pending {
  cardId: string;
  pieceIds: string[];
  cell: { x: number; y: number } | null;
}

interface HealChoice {
  x: number;
  y: number;
  pieceId: string;
}

export default function BattlePage() {
  const navigate = useNavigate();
  const b = useBattle();
  const { state } = b;
  const [pending, setPending] = useState<Pending | null>(null);
  const [phaseEndNotice, setPhaseEndNotice] = useState(false);
  const [summonOpen, setSummonOpen] = useState(true);
  const [enemyDeckOpen, setEnemyDeckOpen] = useState(false);
  const [drawReveal, setDrawReveal] = useState<string | null>(null);
  const [healChoice, setHealChoice] = useState<HealChoice | null>(null);
  const [confirmPlay, setConfirmPlay] = useState<Pending | null>(null);
  const [autoStyle, setAutoStyle] = useState<AutoCommandStyle>('aggressive');
  const card1SeenRef = useRef(false);
  const noticeTimer = useRef<number | null>(null);
  const drawRevealTimer = useRef<number | null>(null);
  const prevPhaseRef = useRef(state.phase);

  useEffect(() => {
    if (state.phase !== 'card1') setPending(null);
    setPhaseEndNotice(false);
    setHealChoice(null);
    setConfirmPlay(null);
    if (state.phase !== 'command') setEnemyDeckOpen(false);
    if (noticeTimer.current) { window.clearTimeout(noticeTimer.current); noticeTimer.current = null; }
  }, [state.phase]);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (drawRevealTimer.current) window.clearTimeout(drawRevealTimer.current);
  }, []);

  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      prevPhaseRef.current = state.phase;
      if (state.phase === 'deploy') setSummonOpen(true);
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'card1') {
      if (!card1SeenRef.current && state.lastDrawnCardId) {
        card1SeenRef.current = true;
        const id = state.lastDrawnCardId;
        drawRevealTimer.current = window.setTimeout(() => {
          setDrawReveal(id);
          drawRevealTimer.current = null;
        }, 1200);
      }
    } else {
      card1SeenRef.current = false;
      if (drawRevealTimer.current) {
        window.clearTimeout(drawRevealTimer.current);
        drawRevealTimer.current = null;
      }
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
    if (state.phase === 'card1') {
      return legalMoves(state, selected);
    }
    return new Set<string>();
  }, [state, selected]);

  const rangeCells = useMemo(() => {
    const set = new Set<string>();
    if (!selected || !selected.placed) return set;
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
    if (selected.team !== 'player' && state.phase !== 'card1') return set;
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

  // 已选中的卡牌目标(选中后以金色边框标记)
  const selectedTargetIds = useMemo(() => new Set(pending?.pieceIds ?? []), [pending]);

  // 可选目标(蓝色边框提示),同时用于判断点击是否有效
  const targetPieceIds = useMemo(() => {
    const set = new Set<string>();
    if (!pendingCard || (state.phase !== 'card1')) return set;
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
      case 'enemy2': return '选择敌方目标(1~2 个)';
      case 'ally1': return '选择 1 个己方目标';
      case 'ally2': return '选择己方目标(1~2 个)';
      case 'enemyAlly': return pending!.pieceIds.length === 0 ? '先选择敌方目标' : '再选择己方目标';
      case 'cell': return pending!.cell ? '已选区域,点击发动' : '点击战场,选择 3×3 区域中心';
      default: return null;
    }
  }, [pendingCard, pending]);

  // 发动卡牌所需的最少目标数(穿云箭雨必须选满敌方+己方两个目标)
  const pendingMin = pendingCard?.target.kind === 'enemyAlly' ? 2 : 1;

  // 当前选中的卡牌是否已满足发动条件(区域卡需选定中心格,目标卡需选满目标)
  const pendingReady = pending && pendingCard
    ? pendingCard.target.kind === 'cell' ? !!pending.cell : pending.pieceIds.length >= pendingMin
    : false;

  // 区域卡预览中心(仅区域卡选中后显示 3×3 范围)
  const previewCell = pending && pendingCard?.target.kind === 'cell' ? pending.cell : null;

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
    if (pending && pendingCard && (state.phase === 'card1')) {
      if (pendingCard.target.kind === 'cell') {
        setPending({ ...pending, cell: { x, y } });
        return;
      }
      const occupant = at(state, x, y);
      if (occupant) {
        const already = pending.pieceIds.includes(occupant.id);
        if (already) {
          setPending({ ...pending, pieceIds: pending.pieceIds.filter((id) => id !== occupant.id) });
          return;
        }
        if (targetPieceIds.has(occupant.id)) {
          const nextTargets = [...pending.pieceIds, occupant.id];
          if (nextTargets.length > pendingCard.target.count) return;
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

      if (sel && sel.team === 'player' && sel.alive && sel.placed && !sel.acted) {
        if (occupant && occupant.team === 'player' && occupant.id !== sel.id && sel.heal > 0) {
          setHealChoice({ x, y, pieceId: occupant.id });
          return;
        }
        if (moveCells.has(key(x, y))) {
          b.issue(sel.id, { waypoint: { x, y } });
          return;
        }
        if (occupant && occupant.team === 'enemy' && visible.has(key(x, y)) && sel.atk > 0) {
          b.issue(sel.id, { setAttackTarget: occupant.id });
          return;
        }
      }

      if (occupant) {
        if (occupant.team === 'enemy' && !visible.has(key(x, y))) { b.select(null); return; }
        b.select(occupant.id); return;
      }
      b.select(null);
    }

    if ((state.phase === 'card1') && !b.busy) {
      const occupant = at(state, x, y);
      if (occupant) {
        if (occupant.team === 'enemy' && !visible.has(key(x, y))) { b.select(null); return; }
        b.select(occupant.id); return;
      }
      b.select(null);
    }
  };

  const handlePhaseTimeout = () => {
    setPhaseEndNotice(true);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    const phase = state.phase;
    noticeTimer.current = window.setTimeout(() => {
      setPhaseEndNotice(false);
      noticeTimer.current = null;
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

  const paused = (state.phase === 'deploy' && summonOpen) || (state.phase === 'command' && enemyDeckOpen);

  const choiceTarget = healChoice ? state.pieces.find((p) => p.id === healChoice.pieceId) : null;
  const choiceCanMove = healChoice ? moveCells.has(key(healChoice.x, healChoice.y)) : false;

  const confirmHealChoice = () => {
    if (!healChoice) return;
    const sel = state.pieces.find((p) => p.id === state.selectedId);
    if (sel) b.issue(sel.id, { setHealTarget: healChoice.pieceId });
    setHealChoice(null);
  };

  const confirmMoveChoice = () => {
    if (!healChoice) return;
    const sel = state.pieces.find((p) => p.id === state.selectedId);
    if (sel) b.issue(sel.id, { waypoint: { x: healChoice.x, y: healChoice.y } });
    setHealChoice(null);
  };

  const confirmCard = confirmPlay ? CARDS_BY_ID[confirmPlay.cardId] : null;
  const confirmTargetPieces = confirmPlay
    ? confirmPlay.pieceIds.map((id) => state.pieces.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  const confirmPlayCard = () => {
    if (!confirmPlay) return;
    b.playCard(confirmPlay.cardId, { pieceIds: confirmPlay.pieceIds, cell: confirmPlay.cell ?? undefined });
    setConfirmPlay(null);
    setPending(null);
  };

  const cancelPlayCard = () => {
    setConfirmPlay(null);
  };

  const confirmPendingCard = () => {
    if (!pending || !pendingCard) return;
    if (pendingCard.target.kind === 'cell') {
      if (!pending.cell) return;
    } else if (pending.pieceIds.length < pendingMin) {
      return;
    }
    setConfirmPlay({ cardId: pending.cardId, pieceIds: pending.pieceIds, cell: pending.cell });
  };

  return (
    <>
      <MobileBattleView
        b={b}
        visible={visible}
        moveCells={moveCells}
        rangeCells={rangeCells}
        targetPieceIds={targetPieceIds}
        selectedTargetIds={selectedTargetIds}
        pendingCardId={pending?.cardId ?? null}
        pendingCount={pending?.pieceIds.length ?? 0}
        pendingNeed={pendingCard?.target.count ?? 0}
        pendingReady={pendingReady}
        previewCell={previewCell}
        pendingHint={pendingHint}
        paused={paused}
        autoStyle={autoStyle}
        onAutoStyle={setAutoStyle}
        onCell={handleCell}
        onPlayCard={handlePlayCard}
        onConfirmCard={confirmPendingCard}
        onCancelCard={() => { setPending(null); setConfirmPlay(null); }}
        onPhaseTimeout={handlePhaseTimeout}
        onOpenEnemyDeck={() => setEnemyDeckOpen(true)}
        onReopenSummon={() => setSummonOpen(true)}
      />

      <ResultOverlay state={state} onRestart={b.restart} onLobby={() => navigate('/')} />
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

      {healChoice && choiceTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={() => setHealChoice(null)}></div>
          <div className="relative rune-border rounded-lg w-full max-w-xs p-5 bg-background-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-full bg-accent-500/15 border border-accent-500/40 text-accent-300">
                <i className={`${BEASTS[choiceTarget.type].icon} text-2xl w-6 h-6 flex items-center justify-center`}></i>
              </div>
              <h2 className="font-heading text-lg text-foreground-950">{BEASTS[choiceTarget.type].name}</h2>
              <p className="text-xs text-foreground-600 mt-1">选择对该己方棋子的操作</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmHealChoice}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-accent-500 text-background-50 hover:bg-accent-600 cursor-pointer"
              >
                <i className="ri-heart-pulse-line w-4 h-4 flex items-center justify-center"></i>
                治疗
              </button>
              <button
                onClick={confirmMoveChoice}
                disabled={!choiceCanMove}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-run-line w-4 h-4 flex items-center justify-center"></i>
                移动到此格
              </button>
              <button
                onClick={() => setHealChoice(null)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-label text-sm border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPlay && confirmCard && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={cancelPlayCard}></div>
          <div className="relative rune-border rounded-lg w-full max-w-xs p-5 bg-background-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-full bg-primary-500/15 border border-primary-500/40 text-primary-300">
                <i className={`${confirmCard.icon} text-2xl w-6 h-6 flex items-center justify-center`}></i>
              </div>
              <h2 className="font-heading text-lg text-foreground-950">确认使用【{confirmCard.name}】?</h2>
              <p className="text-xs text-foreground-600 mt-1">
                {confirmCard.target.kind === 'cell'
                  ? `目标区域中心:${confirmPlay.cell ? cellName(confirmPlay.cell.x, confirmPlay.cell.y) : '—'}`
                  : confirmTargetPieces.length > 0
                  ? `目标:${confirmTargetPieces.map((p) => BEASTS[p.type].name).join('、')}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmPlayCard}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
              >
                <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                确认使用
              </button>
              <button
                onClick={cancelPlayCard}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-label text-sm border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              >
                返回
              </button>
            </div>
          </div>
        </div>
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
                : '抽卡阶段'}{' '}
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
