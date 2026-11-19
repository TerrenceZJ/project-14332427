import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useBattle } from '@/pages/play/hooks/useBattle';
import { visibleKeys, legalMoves, at, createGame, createLevelGame } from '@/game/engine';
import { key, inBounds, cellName, dist, canAttack, blocksLine, COLS, ROWS, DEPLOY_GAP, LINEUP_SIZE } from '@/game/constants';
import { CARDS_BY_ID } from '@/game/cards';
import { BEASTS } from '@/game/beasts';
import { TUTORIAL_LEVELS } from '@/game/levels';
import type { Team, AutoCommandStyle } from '@/game/types';
import MobileBattleView from '@/pages/play/components/MobileBattleView';
import ResultOverlay from '@/pages/play/components/ResultOverlay';
import SummonDeckModal from '@/pages/play/components/SummonDeckModal';
import DrawReveal from '@/pages/play/components/DrawReveal';
import EnemyDeckModal from '@/pages/play/components/EnemyDeckModal';
import PhaseTransitionOverlay from '@/pages/play/components/PhaseTransitionOverlay';
import EnemySkillToast from '@/pages/play/components/EnemySkillToast';
import TutorialOverlay from '@/pages/play/components/TutorialOverlay';

interface Pending {
  cardId: string;
  pieceIds: string[];
  cell: { x: number; y: number } | null;
}

/** 棋子指令向导:点击己方棋子后,引导玩家选择攻击/治疗时机与目标/移动 */
interface PieceCmd {
  pieceId: string;
  /** null = 尚未选择攻击时机(弹出选择框);'first' = 先攻击再移动;'after' = 先移动再攻击 */
  order: 'first' | 'after' | null;
  /** 已锁定的攻击目标(先攻击流程先选目标,先移动流程先规划移动后选目标) */
  targetId: string | null;
}

export default function BattlePage({ skillMode = false }: { skillMode?: boolean }) {
  const navigate = useNavigate();
  const { levelId } = useParams();
  const level = levelId != null ? TUTORIAL_LEVELS.find((l) => l.id === Number(levelId)) : undefined;
  const createInitial = useMemo(() => {
    if (level) return () => createLevelGame(level.preset);
    return () => createGame(COLS, ROWS, DEPLOY_GAP, LINEUP_SIZE, skillMode);
  }, [level, skillMode]);
  const b = useBattle(createInitial);
  const { state } = b;
  const [tutorialStep, setTutorialStep] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [phaseEndNotice, setPhaseEndNotice] = useState(false);
  const [summonOpen, setSummonOpen] = useState(!level);
  const [enemyDeckOpen, setEnemyDeckOpen] = useState(false);
  const [drawReveal, setDrawReveal] = useState<string | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{ pieceId: string; x: number; y: number } | null>(null);
  const [pieceCmd, setPieceCmd] = useState<PieceCmd | null>(null);
  const [selectTick, setSelectTick] = useState(0);
  const [confirmPlay, setConfirmPlay] = useState<Pending | null>(null);
  const [skillCasterId, setSkillCasterId] = useState<string | null>(null);
  const [autoStyle, setAutoStyle] = useState<AutoCommandStyle>('aggressive');
  const [endCommandConfirm, setEndCommandConfirm] = useState(false);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const card1SeenRef = useRef(false);
  const noticeTimer = useRef<number | null>(null);
  const drawRevealTimer = useRef<number | null>(null);
  const actionHintTimer = useRef<number | null>(null);
  const prevPhaseRef = useRef(state.phase);
  const lastMoveClickRef = useRef<{ pieceId: string; x: number; y: number; time: number } | null>(null);

  const showActionHint = (msg: string) => {
    setActionHint(msg);
    if (actionHintTimer.current) window.clearTimeout(actionHintTimer.current);
    actionHintTimer.current = window.setTimeout(() => {
      setActionHint(null);
      actionHintTimer.current = null;
    }, 1800);
  };

  useEffect(() => {
    if (state.phase !== 'command') setPending(null);
    if (state.phase !== 'command') setDrawReveal(null);
    setPhaseEndNotice(false);
    setMoveConfirm(null);
    setPieceCmd(null);
    setConfirmPlay(null);
    setSkillCasterId(null);
    if (state.phase !== 'command') setEnemyDeckOpen(false);
    if (noticeTimer.current) { window.clearTimeout(noticeTimer.current); noticeTimer.current = null; }
  }, [state.phase]);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (drawRevealTimer.current) window.clearTimeout(drawRevealTimer.current);
    if (actionHintTimer.current) window.clearTimeout(actionHintTimer.current);
  }, []);

  // 指令向导:棋子已下令 / 不再可选 / 被切换选中时,自动结束向导
  useEffect(() => {
    if (!pieceCmd) return;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    if (!p || !p.alive || !p.placed || p.acted || state.selectedId !== pieceCmd.pieceId) {
      setPieceCmd(null);
    }
  }, [pieceCmd, state.pieces, state.selectedId]);

  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      prevPhaseRef.current = state.phase;
      if (state.phase === 'deploy') {
        // 教程关的阵容已预设,不弹出选卡界面;仅常规对局打开
        if (!level) setSummonOpen(true);
        // 重新开始:从头播放引导步骤
        setTutorialStep(0);
      }
    }
  }, [state.phase, level]);

  useEffect(() => {
    if (state.phase === 'command') {
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
    return new Set<string>();
  }, [state, selected]);

  // 选中敌方棋子时显示的射程格子(红色)
  const enemyRangeCells = useMemo(() => {
    const set = new Set<string>();
    if (!selected || !selected.alive || !selected.placed) return set;
    if (state.phase !== 'command' || selected.team !== 'enemy') return set;
    const r = selected.range;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!canAttack(selected.type, selected.range, dx, dy)) continue;
        const nx = selected.x + dx;
        const ny = selected.y + dy;
        if (!inBounds(nx, ny, state.cols, state.rows)) continue;
        // 障碍物阻挡远程攻击:被挡住的射程格不再高亮
        if (blocksLine(state.obstacles, selected.x, selected.y, nx, ny)) continue;
        set.add(key(nx, ny));
      }
    }
    return set;
  }, [selected, state.phase, state.cols, state.rows, state.obstacles]);

  // 指令向导:高亮可选中的敌方目标(先攻击流程基于原位,先移动流程基于移动后落点)
  const attackTargetIds = useMemo(() => {
    const set = new Set<string>();
    if (!pieceCmd || pieceCmd.order === null) return set;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    if (!p || !p.alive || !p.placed || p.acted || p.atk <= 0) return set;
    const ax = pieceCmd.order === 'first' ? p.x : p.path.length ? p.path[p.path.length - 1].x : p.x;
    const ay = pieceCmd.order === 'first' ? p.y : p.path.length ? p.path[p.path.length - 1].y : p.y;
    for (const o of state.pieces) {
      if (o.team !== 'enemy' || !o.alive || !o.placed) continue;
      if (!visible.has(key(o.x, o.y))) continue;
      if (!canAttack(p.type, p.range, o.x - ax, o.y - ay)) continue;
      if (blocksLine(state.obstacles, ax, ay, o.x, o.y)) continue;
      set.add(o.id);
    }
    return set;
  }, [pieceCmd, state.pieces, state.obstacles, visible]);

  // 指令向导:高亮可选中的己方治疗目标(先治疗流程基于原位,先移动流程基于移动后落点)
  const healTargetIds = useMemo(() => {
    const set = new Set<string>();
    if (!pieceCmd || pieceCmd.order === null) return set;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    if (!p || !p.alive || !p.placed || p.acted || p.heal <= 0) return set;
    const ax = pieceCmd.order === 'first' ? p.x : p.path.length ? p.path[p.path.length - 1].x : p.x;
    const ay = pieceCmd.order === 'first' ? p.y : p.path.length ? p.path[p.path.length - 1].y : p.y;
    for (const o of state.pieces) {
      if (o.team !== 'player' || !o.alive || !o.placed || o.id === p.id) continue;
      if (dist(ax, ay, o.x, o.y) > p.range) continue;
      set.add(o.id);
    }
    return set;
  }, [pieceCmd, state.pieces]);

  // 指令向导:选中棋子的攻击范围格子(先攻击流程锁定目标前 / 先移动流程规划移动后显示)
  const wizardAttackCells = useMemo(() => {
    const set = new Set<string>();
    if (!pieceCmd || pieceCmd.order === null) return set;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    if (!p || !p.alive || !p.placed || p.acted || p.atk <= 0) return set;
    const visible = pieceCmd.order === 'first' ? !pieceCmd.targetId : p.path.length > 0;
    if (!visible) return set;
    const ax = pieceCmd.order === 'first' ? p.x : p.path[p.path.length - 1].x;
    const ay = pieceCmd.order === 'first' ? p.y : p.path[p.path.length - 1].y;
    const r = p.range;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!canAttack(p.type, p.range, dx, dy)) continue;
        const nx = ax + dx;
        const ny = ay + dy;
        if (!inBounds(nx, ny, state.cols, state.rows)) continue;
        if (blocksLine(state.obstacles, ax, ay, nx, ny)) continue;
        set.add(key(nx, ny));
      }
    }
    return set;
  }, [pieceCmd, state.pieces, state.obstacles, state.cols, state.rows]);

  // 指令向导进行时,可移动范围仅在「先攻击/治疗流程选完目标后」或「先移动流程」显示
  const wizardMoveCells = useMemo(() => {
    if (!pieceCmd) return moveCells;
    if (pieceCmd.order === 'first' && !pieceCmd.targetId) return new Set<string>();
    return moveCells;
  }, [pieceCmd, moveCells]);

  const pendingCard = pending ? CARDS_BY_ID[pending.cardId] : null;

  // 已选中的卡牌目标(选中后以金色边框标记)
  const selectedTargetIds = useMemo(() => new Set(pending?.pieceIds ?? []), [pending]);

  // 可选目标(蓝色边框提示),同时用于判断点击是否有效
  const targetPieceIds = useMemo(() => {
    const set = new Set<string>();
    if (!pendingCard || (state.phase !== 'command')) return set;
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
      case 'enemy2': return '选择 1-2 个敌方目标';
      case 'ally1': return '选择 1 个己方目标';
      case 'ally2': return '选择 2 个己方目标';
      case 'enemyAlly': return pending!.pieceIds.length === 0 ? '先选择敌方目标' : '再选择己方目标';
      case 'cell': return pending!.cell ? '已选区域,点击发动' : '点击战场,选择 3×3 区域中心';
      default: return null;
    }
  }, [pendingCard, pending]);

  // 发动卡牌所需的最少目标数:敌方 2 目标卡(双击破阵 / 异位祈祷)选 1 个即可发动
  const pendingMin = pendingCard
    ? pendingCard.target.kind === 'enemy2' ? 1 : Math.max(1, pendingCard.target.count)
    : 1;

  // 当前选中的卡牌是否已满足发动条件(区域卡需选定中心格,目标卡需选满目标)
  const pendingReady = pending && pendingCard
    ? pendingCard.target.kind === 'cell' ? !!pending.cell : pending.pieceIds.length >= pendingMin
    : false;

  // 区域卡预览中心(仅区域卡选中后显示 3×3 范围)
  const previewCell = pending && pendingCard?.target.kind === 'cell' ? pending.cell : null;

  // 指令向导的顶部提示文案
  const pieceCmdHint = useMemo(() => {
    if (!pieceCmd || pieceCmd.order === null) return null;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    const name = p ? BEASTS[p.type].name : '灵兽';
    const isHealer = !!p && p.heal > 0 && p.atk <= 0;
    const act = isHealer ? '治疗' : '攻击';
    if (pieceCmd.order === 'first' && !pieceCmd.targetId) return `${name}：先${act} — 请点击${isHealer ? '己方棋子' : '敌方棋子'}锁定目标`;
    if (pieceCmd.order === 'first' && pieceCmd.targetId) return `${name}：已锁定目标 — 请点击高亮格子规划移动`;
    if (pieceCmd.order === 'after' && !pieceCmd.targetId) return `${name}：先移动 — 请规划路线，再点击${isHealer ? '己方棋子' : '敌方棋子'}${act}`;
    return `${name}：已锁定目标，确认移动即可`;
  }, [pieceCmd, state.pieces]);

  const handlePlayCard = (cardId: string) => {
    const card = CARDS_BY_ID[cardId];
    if (!card) return;
    if (card.target.kind === 'none') {
      b.playCard(cardId, { pieceIds: [] });
      return;
    }
    setPieceCmd(null);
    setSkillCasterId(null);
    setPending({ cardId, pieceIds: [], cell: null });
  };

  const handlePlaySkill = (pieceId: string) => {
    const p = state.pieces.find((q) => q.id === pieceId);
    if (!p || !p.skill) return;
    const card = CARDS_BY_ID[p.skill];
    if (!card) return;
    if (card.target.kind === 'none') {
      b.castSkill(pieceId, { pieceIds: [] });
      return;
    }
    setPieceCmd(null);
    setSkillCasterId(pieceId);
    setPending({ cardId: p.skill, pieceIds: [], cell: null });
  };

  const handleCell = (x: number, y: number) => {
    if (pending && pendingCard && (state.phase === 'command')) {
      if (pendingCard.target.kind === 'cell') {
        setPending({ ...pending, cell: { x, y } });
        return;
      }
      const occupant = at(state, x, y);
      // 已移动的棋子选中其移动后位置(路径终点);原位置残影不可选
      const moved = state.pieces.find(
        (p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0 &&
          p.path[p.path.length - 1].x === x && p.path[p.path.length - 1].y === y,
      );
      const target = moved ?? (occupant && !(occupant.team === 'player' && occupant.path.length > 0) ? occupant : null);
      if (target) {
        const already = pending.pieceIds.includes(target.id);
        if (already) {
          setPending({ ...pending, pieceIds: pending.pieceIds.filter((id) => id !== target.id) });
          return;
        }
        if (targetPieceIds.has(target.id)) {
          const nextTargets = [...pending.pieceIds, target.id];
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
      // 移动后的"新位置棋子":路径终点落在 (x,y) 的己方棋子
      const movedPiece = state.pieces.find(
        (p) => p.team === 'player' && p.alive && p.placed && p.path.length > 0 &&
          p.path[p.path.length - 1].x === x && p.path[p.path.length - 1].y === y,
      );

      // 指令向导:已选择攻击/治疗时机后,引导锁定目标 / 规划移动
      if (pieceCmd && pieceCmd.order !== null) {
        const cmdPiece = state.pieces.find((p) => p.id === pieceCmd.pieceId);
        if (cmdPiece && cmdPiece.team === 'player' && cmdPiece.alive && cmdPiece.placed && !cmdPiece.acted) {
          const isHealer = cmdPiece.heal > 0 && cmdPiece.atk <= 0;
          // 先攻击/治疗流程:先锁定目标;先移动流程:随时可锁定目标
          const canTarget = pieceCmd.order === 'first' ? !pieceCmd.targetId : true;
          if (canTarget) {
            if (isHealer) {
              const ally = occupant && occupant.team === 'player' && occupant.id !== cmdPiece.id ? occupant : null;
              if (ally && healTargetIds.has(ally.id)) {
                b.issue(cmdPiece.id, { setHealTarget: ally.id });
                setPieceCmd({ ...pieceCmd, targetId: ally.id });
                return;
              }
            } else {
              const enemy = occupant && occupant.team === 'enemy' ? occupant : null;
              if (enemy && visible.has(key(x, y)) && attackTargetIds.has(enemy.id)) {
                b.issue(cmdPiece.id, { setAttackTarget: enemy.id });
                setPieceCmd({ ...pieceCmd, targetId: enemy.id });
                return;
              }
            }
          }
          // 先移动流程:随时规划移动;先攻击/治疗流程:锁定目标后再规划移动
          const canMove = pieceCmd.order === 'first' ? !!pieceCmd.targetId : true;
          if (canMove && moveCells.has(key(x, y))) {
            const now = Date.now();
            const last = lastMoveClickRef.current;
            const isDouble = !!last && last.pieceId === cmdPiece.id && last.x === x && last.y === y && now - last.time < 400;
            if (isDouble) {
              lastMoveClickRef.current = null;
              setMoveConfirm({ pieceId: cmdPiece.id, x, y });
            } else {
              lastMoveClickRef.current = { pieceId: cmdPiece.id, x, y, time: now };
              b.issue(cmdPiece.id, { waypoint: { x, y } });
            }
            return;
          }
          return;
        }
        setPieceCmd(null);
        return;
      }

      if (sel && sel.team === 'player' && sel.alive && sel.placed && !sel.acted) {
        // 点击移动后的新位置棋子(路径终点):单击展示信息,双击确认移动
        if (movedPiece && movedPiece.id === sel.id) {
          const now = Date.now();
          const last = lastMoveClickRef.current;
          const isDouble = !!last && last.pieceId === sel.id && last.x === x && last.y === y && now - last.time < 400;
          if (isDouble) {
            lastMoveClickRef.current = null;
            setMoveConfirm({ pieceId: sel.id, x, y });
          } else {
            lastMoveClickRef.current = { pieceId: sel.id, x, y, time: now };
            b.select(sel.id);
            setSelectTick((t) => t + 1);
          }
          return;
        }
        if (moveCells.has(key(x, y))) {
          const now = Date.now();
          const last = lastMoveClickRef.current;
          const isDouble = !!last && last.pieceId === sel.id && last.x === x && last.y === y && now - last.time < 400;
          if (isDouble) {
            lastMoveClickRef.current = null;
            setMoveConfirm({ pieceId: sel.id, x, y });
          } else {
            lastMoveClickRef.current = { pieceId: sel.id, x, y, time: now };
            b.issue(sel.id, { waypoint: { x, y } });
          }
          return;
        }
      }

      // 点击移动后的新位置棋子(非当前选中,如已确认棋子):选中并展示信息
      if (movedPiece) {
        b.select(movedPiece.id);
        setSelectTick((t) => t + 1);
        return;
      }

      // 点击原地残影(已有路径的己方棋子原位置):不响应
      if (occupant && occupant.team === 'player' && occupant.path.length > 0) {
        return;
      }

      if (occupant) {
        if (occupant.team === 'enemy' && !visible.has(key(x, y))) { b.select(null); return; }

        // 点击己方棋子:选中;攻击型/治疗型棋子直接弹出时机向导
        if (occupant.team === 'player') {
          if (sel && sel.team === 'player' && !sel.acted && sel.path.length > 0) {
            b.issue(sel.id, { clearPath: true });
          }
          b.select(occupant.id);
          if (!occupant.acted && (occupant.atk > 0 || occupant.heal > 0)) {
            setPending(null);
            setConfirmPlay(null);
            setPieceCmd({ pieceId: occupant.id, order: null, targetId: null });
          } else {
            setSelectTick((t) => t + 1);
          }
          return;
        }

        // 点击敌方棋子:选中查看情报
        b.select(occupant.id);
        return;
      }

      // 点击范围外空格:取消当前棋子的移动草稿,棋子回到原位(还原操作)
      if (sel && sel.team === 'player' && !sel.acted && sel.path.length > 0) {
        b.issue(sel.id, { clearPath: true });
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
        if (state.lineup.length < state.lineupSize) b.randomLineup();
        b.randomize();
        b.start();
        setSummonOpen(false);
        return;
      }
      b.advance();
    }, 1500);
  };

  // 指令阶段结束:若仍有剩余行动点,先弹窗提醒(教程关卡不拦截,直接推进)
  const handleEndPhase = () => {
    if (state.phase === 'command' && state.ap > 0 && level?.id !== 0 && !state.skillMode) {
      setEndCommandConfirm(true);
      return;
    }
    b.advance();
  };

  // 还有多少只己方灵兽尚未确认指令(未 acted)
  const unconfirmedPieces = state.phase === 'command'
    ? state.pieces.filter((p) => p.team === 'player' && p.placed && p.alive && !p.acted).length
    : 0;

  const paused = (state.phase === 'deploy' && summonOpen) || (state.phase === 'command' && enemyDeckOpen);

  const moveConfirmPiece = moveConfirm ? state.pieces.find((p) => p.id === moveConfirm.pieceId) : null;

  const confirmMove = () => {
    if (!moveConfirm) return;
    b.issue(moveConfirm.pieceId, { confirm: true });
    b.select(null);
    setMoveConfirm(null);
  };

  const cmdPiece = pieceCmd ? state.pieces.find((p) => p.id === pieceCmd.pieceId) : null;
  const isCmdHealer = !!cmdPiece && cmdPiece.heal > 0 && cmdPiece.atk <= 0;

  const choosePieceOrder = (order: 'first' | 'after') => {
    if (!pieceCmd) return;
    const p = state.pieces.find((q) => q.id === pieceCmd.pieceId);
    const isHealer = !!p && p.heal > 0 && p.atk <= 0;
    b.issue(pieceCmd.pieceId, isHealer ? { healOrder: order } : { attackOrder: order });
    setPieceCmd({ pieceId: pieceCmd.pieceId, order, targetId: null });
  };

  const cancelPieceCmd = () => {
    if (pieceCmd) b.issue(pieceCmd.pieceId, { clearPath: true });
    setPieceCmd(null);
    b.select(null);
  };

  const confirmCard = confirmPlay ? CARDS_BY_ID[confirmPlay.cardId] : null;
  const confirmTargetPieces = confirmPlay
    ? confirmPlay.pieceIds.map((id) => state.pieces.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  const confirmPlayCard = () => {
    if (!confirmPlay) return;
    if (skillCasterId) {
      b.castSkill(skillCasterId, { pieceIds: confirmPlay.pieceIds, cell: confirmPlay.cell ?? undefined });
      setSkillCasterId(null);
    } else {
      b.playCard(confirmPlay.cardId, { pieceIds: confirmPlay.pieceIds, cell: confirmPlay.cell ?? undefined });
    }
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

  const tutorialSteps = useMemo(() => level?.steps ?? [], [level]);
  // 从当前进度向后查找第一条属于当前阶段的引导步骤(引导跨阶段自动衔接)
  const activeStepIndex = useMemo(() => {
    for (let i = tutorialStep; i < tutorialSteps.length; i++) {
      const st = tutorialSteps[i];
      if (!st.phase || st.phase === state.phase) return i;
    }
    return -1;
  }, [tutorialSteps, tutorialStep, state.phase]);
  const currentStep = activeStepIndex >= 0 ? tutorialSteps[activeStepIndex] : null;

  // 交互式引导:监听关键状态变化,满足当前步骤的完成条件时自动推进
  const prevKeyRef = useRef({
    selectedId: state.selectedId,
    placed: state.pieces.filter((p) => p.team === 'player' && p.placed).length,
    moveLen: state.pieces.filter((p) => p.team === 'player').reduce((n, p) => n + p.path.length, 0),
    acted: state.pieces.filter((p) => p.team === 'player' && p.acted).length,
    targetCount: state.pieces.filter((p) => p.team === 'player' && p.attackTarget).length,
    healCount: state.pieces.filter((p) => p.team === 'player' && p.healTarget).length,
    phase: state.phase,
  });

  useEffect(() => {
    const prev = prevKeyRef.current;
    const cur = {
      selectedId: state.selectedId,
      placed: state.pieces.filter((p) => p.team === 'player' && p.placed).length,
      moveLen: state.pieces.filter((p) => p.team === 'player').reduce((n, p) => n + p.path.length, 0),
      acted: state.pieces.filter((p) => p.team === 'player' && p.acted).length,
      targetCount: state.pieces.filter((p) => p.team === 'player' && p.attackTarget).length,
      healCount: state.pieces.filter((p) => p.team === 'player' && p.healTarget).length,
      phase: state.phase,
    };
    prevKeyRef.current = cur;

    if (activeStepIndex < 0) return;
    const step = tutorialSteps[activeStepIndex];
    if (!step.wait || step.wait.type === 'none') return;

    let done = false;
    switch (step.wait.type) {
      case 'select': done = !!cur.selectedId && cur.selectedId !== prev.selectedId; break;
      case 'place': done = cur.placed > prev.placed; break;
      case 'move': done = cur.moveLen > prev.moveLen; break;
      case 'target': done = cur.targetCount > prev.targetCount; break;
      case 'heal': done = cur.healCount > prev.healCount; break;
      case 'confirm': done = cur.acted > prev.acted; break;
      case 'phase': done = cur.phase !== prev.phase; break;
      default: break;
    }
    if (done) setTutorialStep(activeStepIndex + 1);
  }, [state, activeStepIndex, tutorialSteps]);

  return (
    <>
      <MobileBattleView
        b={b}
        visible={visible}
        moveCells={wizardMoveCells}
        enemyRangeCells={enemyRangeCells}
        attackRangeCells={wizardAttackCells}
        selectTick={selectTick}
        targetPieceIds={targetPieceIds}
        selectedTargetIds={selectedTargetIds}
        attackTargetIds={attackTargetIds}
        healTargetIds={healTargetIds}
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
        onCastSkill={handlePlaySkill}
        onConfirmCard={confirmPendingCard}
        onCancelCard={() => { setPending(null); setConfirmPlay(null); setSkillCasterId(null); }}
        onPhaseTimeout={handlePhaseTimeout}
        onAdvance={handleEndPhase}
        onOpenEnemyDeck={() => setEnemyDeckOpen(true)}
        onReopenSummon={() => setSummonOpen(true)}
        intro={level?.id === 0}
      />

      <ResultOverlay state={state} onRestart={b.restart} onLobby={() => navigate('/')} />
      <PhaseTransitionOverlay phase={state.phase} turn={state.turn} />
      <EnemySkillToast log={state.log} />

      {actionHint &&
        createPortal(
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[95] pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-background-950/85 border border-primary-500/60 shadow-lg">
              <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-primary-500/20 text-primary-300">
                <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center"></i>
              </span>
              <span className="font-label text-[12px] text-foreground-50 whitespace-nowrap">{actionHint}</span>
            </div>
          </div>,
          document.body
        )}

      {pieceCmdHint &&
        createPortal(
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-background-950/85 border border-accent-500/60 shadow-lg">
              <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">
                <i className="ri-crosshair-2-line w-4 h-4 flex items-center justify-center"></i>
              </span>
              <span className="font-label text-[12px] text-foreground-50 whitespace-nowrap">{pieceCmdHint}</span>
            </div>
            <button
              onClick={cancelPieceCmd}
              className="pointer-events-auto font-label text-[11px] px-3 py-2 rounded-full bg-secondary-500/90 text-background-50 cursor-pointer whitespace-nowrap"
            >
              取消
            </button>
          </div>,
          document.body
        )}

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

      {pieceCmd && pieceCmd.order === null && cmdPiece && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={cancelPieceCmd}></div>
          <div className="relative rune-border rounded-lg w-full max-w-xs p-5 bg-background-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-full bg-primary-500/15 border border-primary-500/40 text-primary-300">
                <i className={`${BEASTS[cmdPiece.type].icon} text-2xl w-6 h-6 flex items-center justify-center`}></i>
              </div>
              <h2 className="font-heading text-lg text-foreground-950">{BEASTS[cmdPiece.type].name} · 行动指令</h2>
              <p className="text-xs text-foreground-600 mt-1">请选择执行阶段的{isCmdHealer ? '治疗' : '攻击'}时机。</p>
              {state.skillMode && cmdPiece.skill && (() => {
                const sk = CARDS_BY_ID[cmdPiece.skill];
                if (!sk) return null;
                return (
                  <div className="mt-2 text-left rounded-md border border-accent-500/30 bg-accent-500/5 px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <i className="ri-magic-line w-3.5 h-3.5 flex items-center justify-center text-accent-300"></i>
                      <span className="font-heading text-xs text-accent-300">{sk.name}</span>
                      <span className="ml-auto font-heading text-[10px] text-foreground-600 tabular-nums shrink-0">
                        {cmdPiece.skillCd > 0 ? `冷却 ${cmdPiece.skillCd} 回合` : cmdPiece.usedSkill ? '本回合已用' : '就绪'}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-700 leading-relaxed mt-1">{sk.desc}</p>
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-col gap-2 mt-3">
              <button
                onClick={() => choosePieceOrder('first')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
              >
                <i className={isCmdHealer ? 'ri-heart-pulse-line w-4 h-4 flex items-center justify-center' : 'ri-sword-line w-4 h-4 flex items-center justify-center'}></i>
                先{isCmdHealer ? '治疗' : '攻击'}，再移动
              </button>
              <button
                onClick={() => choosePieceOrder('after')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-accent-500 text-background-50 hover:bg-accent-600 cursor-pointer"
              >
                <i className="ri-run-line w-4 h-4 flex items-center justify-center"></i>
                先移动，再{isCmdHealer ? '治疗' : '攻击'}
              </button>
              <button
                onClick={cancelPieceCmd}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-label text-sm border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {moveConfirm && moveConfirmPiece && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={() => setMoveConfirm(null)}></div>
          <div className="relative rune-border rounded-lg w-full max-w-xs p-5 bg-background-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-full bg-primary-500/15 border border-primary-500/40 text-primary-300">
                <i className={`${BEASTS[moveConfirmPiece.type].icon} text-2xl w-6 h-6 flex items-center justify-center`}></i>
              </div>
              <h2 className="font-heading text-lg text-foreground-950">是否移动到 {cellName(moveConfirm.x, moveConfirm.y)}？</h2>
              <p className="text-xs text-foreground-600 mt-1">确认后 {BEASTS[moveConfirmPiece.type].name} 将移动到此格，并消耗 1 点行动点。</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmMove}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
              >
                <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                确认移动（-1 行动点）
              </button>
              <button
                onClick={() => setMoveConfirm(null)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-label text-sm border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              >
                <i className="ri-arrow-go-back-line w-4 h-4 flex items-center justify-center"></i>
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

      {endCommandConfirm && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={() => setEndCommandConfirm(false)}></div>
          <div className="relative rune-border rounded-lg w-full max-w-xs p-5 bg-background-100">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-full bg-primary-500/15 border border-primary-500/40 text-primary-300">
                <i className="ri-alert-line text-2xl w-6 h-6 flex items-center justify-center"></i>
              </div>
              <h2 className="font-heading text-lg text-foreground-950">结束指令确认</h2>
              <div className="text-xs text-foreground-600 mt-1 leading-relaxed">
                {state.ap > 0 && <p>还有 {state.ap} 点行动点未使用。</p>}
                {unconfirmedPieces > 0 && <p>还有 {unconfirmedPieces} 只灵兽未确认操作。</p>}
                <p>是否确认进入下一步？</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setEndCommandConfirm(false); b.advance(); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-label text-sm bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
              >
                <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
                确认进入下一步
              </button>
              <button
                onClick={() => setEndCommandConfirm(false)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-label text-sm border border-background-300 text-foreground-700 hover:text-foreground-950 hover:border-background-400 cursor-pointer"
              >
                <i className="ri-arrow-go-back-line w-4 h-4 flex items-center justify-center"></i>
                继续操作
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep && (
        <TutorialOverlay
          step={currentStep}
          stepIndex={activeStepIndex}
          totalSteps={tutorialSteps.length}
          onNext={() => setTutorialStep(activeStepIndex + 1)}
          onSkip={() => setTutorialStep(tutorialSteps.length)}
        />
      )}
    </>
  );
}
