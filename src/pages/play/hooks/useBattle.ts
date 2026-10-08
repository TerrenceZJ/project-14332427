import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, TurnEvent, TurnFrame, Mode, Pt, AutoCommandStyle } from '@/game/types';
import {
  createGame, placePiece, unplacePiece, setLord, autoDeploy, startBattle,
  command as cmd, selectPiece, executeTurn, beginNextTurn, advancePhase,
  playCard as playCardEngine, redeployPiece, toggleLineup as toggleLineupEngine,
  randomLineup as randomLineupEngine, autoCommand as autoCommandEngine,
} from '@/game/engine';

export interface CardTargets {
  pieceIds: string[];
  cell?: Pt;
}

export type PlaySpeed = 'normal' | 'fast';

export function useBattle() {
  const [state, setState] = useState<GameState>(() => createGame());
  const [events, setEvents] = useState<TurnEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>('normal');
  const timer = useRef<number | null>(null);
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  const speedRef = useRef<PlaySpeed>('normal');
  const framesRef = useRef<TurnFrame[]>([]);
  const indexRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const place = useCallback((id: string, x: number, y: number) => setState((s) => placePiece(s, id, x, y)), []);
  const unplace = useCallback((id: string) => setState((s) => unplacePiece(s, id)), []);
  const makeLord = useCallback((id: string) => setState((s) => setLord(s, id)), []);
  const redeploy = useCallback((id: string, x: number, y: number) => setState((s) => redeployPiece(s, id, x, y)), []);
  const randomize = useCallback(() => setState((s) => autoDeploy(s)), []);
  const toggleLineup = useCallback((cardId: string) => setState((s) => toggleLineupEngine(s, cardId)), []);
  const randomLineup = useCallback(() => setState((s) => randomLineupEngine(s)), []);
  const select = useCallback((id: string | null) => setState((s) => selectPiece(s, id)), []);

  const start = useCallback(() => {
    setState((s) => startBattle(s));
  }, []);

  const issue = useCallback((id: string, patch: { waypoint?: { x: number; y: number }; clearPath?: boolean; confirm?: boolean; mode?: Mode; undoStep?: boolean; setAttackTarget?: string; setHealTarget?: string }) => {
    setState((s) => cmd(s, id, patch));
  }, []);

  const playCard = useCallback((cardId: string, targets: CardTargets) => {
    setState((s) => playCardEngine(s, cardId, 'player', targets));
  }, []);

  /** 指令阶段:AI 代玩家为所有棋子自动下达指令(可指定风格) */
  const autoCommand = useCallback((style: AutoCommandStyle = 'aggressive') => {
    setState((s) => autoCommandEngine(s, style));
  }, []);

  /** 指令阶段:一键清除所有待行动棋子的规划路径 */
  const clearAllPaths = useCallback(() => {
    setState((s) => {
      let next = s;
      for (const p of s.pieces) {
        if (p.team === 'player' && p.placed && p.alive && !p.acted && p.path.length > 0) {
          next = cmd(next, p.id, { clearPath: true });
        }
      }
      return next;
    });
  }, []);

  /** 指令阶段:撤销「上一只」棋子的最后一段路径(优先当前选中,其次最后规划的那只) */
  const undoLastStep = useCallback(() => {
    setState((s) => {
      const candidates = s.pieces.filter(
        (p) => p.team === 'player' && p.placed && p.alive && !p.acted && p.path.length > 0,
      );
      if (candidates.length === 0) return s;
      const target = candidates.find((p) => p.id === s.selectedId) ?? candidates[candidates.length - 1];
      return cmd(s, target.id, { undoStep: true });
    });
  }, []);

  const toggleSpeed = useCallback(() => {
    setSpeed((s) => (s === 'normal' ? 'fast' : 'normal'));
  }, []);

  /** 执行动画播放完毕(或跳过后)的收尾 */
  const finishExecution = useCallback(() => {
    const last = framesRef.current[framesRef.current.length - 1];
    setEvents([]);
    setBusy(false);
    if (last && last.state.phase === 'execute') {
      setState((cur) => beginNextTurn(cur));
    }
  }, []);

  /** 一键跳过动画,直接跳到本回合结算结果 */
  const skipExecution = useCallback(() => {
    if (!busyRef.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    const last = framesRef.current[framesRef.current.length - 1];
    if (last) setState(last.state);
    finishExecution();
  }, [finishExecution]);

  /** 推进阶段:card1 → command → card2 → execute(逐帧动画) */
  const advance = useCallback(() => {
    const s = stateRef.current;
    if (busyRef.current) return;

    if (s.phase === 'card2') {
      if (timer.current) window.clearTimeout(timer.current);
      framesRef.current = executeTurn(s);
      indexRef.current = 0;
      setBusy(true);
      const play = () => {
        const frames = framesRef.current;
        const i = indexRef.current;
        if (i >= frames.length) {
          finishExecution();
          return;
        }
        const f = frames[i];
        setState(f.state);
        setEvents(f.events);
        indexRef.current = i + 1;
        const factor = speedRef.current === 'fast' ? 0.4 : 1;
        timer.current = window.setTimeout(play, f.delay * factor);
      };
      play();
    } else if (s.phase === 'card1' || s.phase === 'command') {
      setState((cur) => advancePhase(cur));
    }
  }, [finishExecution]);

  const restart = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setEvents([]);
    setBusy(false);
    framesRef.current = [];
    indexRef.current = 0;
    setState(createGame());
  }, []);

  return { state, events, busy, speed, place, unplace, makeLord, redeploy, randomize, toggleLineup, randomLineup, select, start, issue, playCard, autoCommand, clearAllPaths, undoLastStep, advance, toggleSpeed, skipExecution, restart };
}

/** 对战控制器的返回类型,供子组件复用 */
export type Battle = ReturnType<typeof useBattle>;