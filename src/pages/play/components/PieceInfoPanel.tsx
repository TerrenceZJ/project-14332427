import type { Piece, Mode, Pt } from '@/game/types';
import { BEASTS } from '@/game/beasts';

interface CommandPatch {
  waypoint?: Pt;
  clearPath?: boolean;
  confirm?: boolean;
  mode?: Mode;
  undoStep?: boolean;
}

interface Props {
  piece: Piece;
  onClose: () => void;
  /** 当前剩余行动点 */
  ap: number;
  /** 提供时显示指令操作(指令阶段的己方棋子) */
  onIssue?: (id: string, patch: CommandPatch) => void;
  /** 紧凑布局(移动端底部抽屉,尽量免滚动) */
  compact?: boolean;
}

export default function PieceInfoPanel({ piece, onClose, onIssue, ap, compact = false }: Props) {
  const def = BEASTS[piece.type];
  const isPlayer = piece.team === 'player';
  const hpPct = Math.max(0, Math.min(1, piece.hp / piece.maxHp));

  const showCommand = !!onIssue && isPlayer;
  const hasPath = piece.path.length > 0;

  // 侦察姿态额外多消耗 1 点行动点
  const confirmCost = piece.mode === 'scout' ? 2 : 1;
  const canAfford = ap >= confirmCost;

  const actedText =
    piece.mode === 'defend'
      ? hasPath
        ? `移动 ${piece.path.length} 格后防御`
        : '原地防御'
      : piece.mode === 'scout'
      ? hasPath
        ? `侦察移动 ${piece.path.length} 格`
        : '原地侦察'
      : hasPath
      ? `移动 ${piece.path.length} 格后攻击`
      : '原地攻击';

  return (
    <div className={`rune-border rounded-lg ${compact ? 'p-2' : 'p-3'}`}>
      {/* 头部 */}
      <div className={`flex items-start justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2.5'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} shrink-0 flex items-center justify-center rounded-md border ${
              isPlayer ? 'bg-accent-500/15 border-accent-500/40 text-accent-300' : 'bg-secondary-500/15 border-secondary-500/40 text-secondary-300'
            }`}
          >
            <i className={`${def.icon} ${compact ? 'text-sm' : 'text-base'} w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-sm text-foreground-950 truncate">{def.name}</span>
              {piece.isLord && piece.lordRevealed && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 font-label whitespace-nowrap">灵主</span>
              )}
            </div>
            <div className="text-[10px] text-foreground-600 truncate">
              {isPlayer ? '己方灵兽' : '敌方情报'} · {def.role}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:text-primary-300 hover:border-primary-400 cursor-pointer"
        >
          <i className="ri-close-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </button>
      </div>

      {/* 血量 + 属性 */}
      {compact ? (
        <div className="mb-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label text-[9px] text-foreground-600 whitespace-nowrap">
              血量 {piece.hp}/{piece.maxHp}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
              <div
                className={`h-full transition-all ${hpPct > 0.5 ? 'bg-accent-400' : hpPct > 0.25 ? 'bg-primary-400' : 'bg-secondary-400'}`}
                style={{ width: `${hpPct * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <Stat compact icon="ri-sword-line" label="攻击" value={String(piece.atk + piece.bonusAtk)} />
            <Stat compact icon="ri-run-line" label="移动" value={String(piece.move + piece.bonusMove)} />
            <Stat compact icon="ri-focus-3-line" label="范围" value={String(piece.range)} />
            <Stat compact icon="ri-heart-pulse-line" label="治疗" value={piece.heal > 0 ? String(piece.heal) : '—'} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1 mb-2.5">
          <div className="col-span-4 rounded-md bg-background-100 border border-background-200 px-2 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label text-[10px] text-foreground-600">血量</span>
              <span className="font-heading text-xs text-foreground-950">
                {piece.hp}/{piece.maxHp}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-background-200 overflow-hidden">
              <div
                className={`h-full transition-all ${hpPct > 0.5 ? 'bg-accent-400' : hpPct > 0.25 ? 'bg-primary-400' : 'bg-secondary-400'}`}
                style={{ width: `${hpPct * 100}%` }}
              ></div>
            </div>
          </div>

          <Stat icon="ri-sword-line" label="攻击" value={String(piece.atk + piece.bonusAtk)} />
          <Stat icon="ri-run-line" label="移动" value={String(piece.move + piece.bonusMove)} />
          <Stat icon="ri-focus-3-line" label="范围" value={String(piece.range)} />
          <Stat icon="ri-heart-pulse-line" label="治疗" value={piece.heal > 0 ? String(piece.heal) : '—'} />
        </div>
      )}

      {/* 敌方:技能说明 */}
      {!isPlayer && (
        <div className={`rounded-md bg-background-100 border border-background-200 px-2.5 ${compact ? 'py-1 mb-1.5' : 'py-1.5 mb-2.5'}`}>
          <div className="flex items-center gap-1.5">
            <i className="ri-sparkling-2-fill text-accent-300 w-3 h-3 flex items-center justify-center"></i>
            <span className="font-label text-[10px] text-foreground-600">技能</span>
          </div>
          <div className="font-heading text-xs text-accent-300 mt-0.5">{def.skill}</div>
        </div>
      )}

      {/* 状态 */}
      {(piece.mode !== 'attack' || piece.stunned > 0 || piece.blockHits > 0 || piece.bonusMove > 0 || piece.dmgReduction > 0) && (
        <div className={`flex flex-wrap gap-1 ${compact ? 'mb-1.5' : 'mb-2.5'}`}>
          {piece.mode === 'defend' && <Tag text="防御中" />}
          {piece.mode === 'scout' && <Tag text="侦察中" />}
          {piece.stunned > 0 && <Tag text={`封锁 ${piece.stunned} 回合`} />}
          {piece.blockHits > 0 && <Tag text={`格挡 ${piece.blockHits} 次`} />}
          {piece.dmgReduction > 0 && <Tag text={`减伤 ${piece.dmgReduction}`} />}
          {piece.bonusMove > 0 && <Tag text={`移速 +${piece.bonusMove}`} />}
        </div>
      )}

      {/* 指令操作 */}
      {showCommand && (
        <div className={`border-t border-background-300/60 ${compact ? 'pt-1.5' : 'pt-2.5'}`}>
          {piece.acted ? (
            <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 border ${isPlayer ? 'bg-accent-500/10 border-accent-500/40' : 'bg-secondary-500/10 border-secondary-500/40'}`}>
              <i className={`ri-checkbox-circle-fill w-4 h-4 flex items-center justify-center ${isPlayer ? 'text-accent-300' : 'text-secondary-300'}`}></i>
              <span className="font-heading text-xs text-foreground-950">已下令 · {actedText}</span>
            </div>
          ) : (
            <>
              {/* 行动模式 */}
              <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-2'}`}>
                <span className="font-label text-[10px] text-foreground-600">指令</span>
                <div className="inline-flex items-center gap-1 px-1 py-1 rounded-full bg-background-200/70 border border-background-300/50">
                  {(['attack', 'defend', 'scout'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => onIssue!(piece.id, { mode: m })}
                      className={`px-2 py-0.5 rounded-full font-label text-[10px] whitespace-nowrap cursor-pointer transition-colors ${
                        piece.mode === m ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:text-foreground-900'
                      }`}
                    >
                      {m === 'attack' ? '攻击' : m === 'defend' ? '防御' : '侦察'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 路径状态 / 行动点消耗 */}
              <div className={`flex items-center gap-2 ${compact ? 'flex-nowrap mb-1.5' : 'flex-wrap gap-y-0.5 mb-2'}`}>
                <span className={`flex items-center gap-1.5 ${compact ? 'flex-1 min-w-0' : ''}`}>
                  <i className={`${piece.mode === 'defend' ? 'ri-shield-line' : piece.mode === 'scout' ? 'ri-radar-line' : 'ri-route-line'} text-foreground-600 w-3.5 h-3.5 flex items-center justify-center shrink-0`}></i>
                  <span className={`text-[11px] ${compact ? 'truncate' : ''} ${hasPath ? 'text-accent-300 font-heading' : 'text-foreground-600'}`}>
                    {piece.mode === 'defend'
                      ? hasPath
                        ? `待确认 · ${piece.path.length} 格 · 移动后防御`
                        : '点高亮格移动(留空原地防御)'
                      : hasPath
                      ? `待确认 · ${piece.path.length} 格${piece.mode === 'scout' ? ' · 移动后侦察' : ''}`
                      : piece.mode === 'scout'
                      ? '点高亮格移动(留空原地侦察)'
                      : '点高亮格规划路径(留空原地攻击)'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <i className={`ri-flashlight-line w-3.5 h-3.5 flex items-center justify-center ${canAfford ? 'text-primary-300' : 'text-secondary-300'}`}></i>
                  <span className={`text-[11px] whitespace-nowrap ${canAfford ? 'text-foreground-600' : 'text-secondary-300'}`}>
                    消耗 <span className={`font-heading ${canAfford ? 'text-foreground-950' : 'text-secondary-300'}`}>{confirmCost}</span> 行动点{piece.mode === 'scout' ? '(侦察 +1)' : ''}
                    {!canAfford && ` · 不足(现有 ${ap})`}
                  </span>
                </span>
              </div>

              {/* 攻击/治疗目标指示 */}
              {piece.mode === 'attack' && piece.atk > 0 && (
                <div className={`text-[11px] ${piece.attackTarget ? 'text-accent-300' : 'text-foreground-500'} mb-1.5`}>
                  <i className={`${piece.attackTarget ? 'ri-checkbox-circle-fill' : 'ri-arrow-right-s-line'} w-3.5 h-3.5 flex items-center justify-center shrink-0 inline-flex mr-1`}></i>
                  {piece.attackTarget ? '已锁定攻击目标' : '将自动攻击附近敌人'}
                </div>
              )}
              {piece.heal > 0 && (
                <div className={`text-[11px] ${piece.healTarget ? 'text-accent-300' : 'text-foreground-500'} mb-1.5`}>
                  <i className={`${piece.healTarget ? 'ri-checkbox-circle-fill' : 'ri-arrow-right-s-line'} w-3.5 h-3.5 flex items-center justify-center shrink-0 inline-flex mr-1`}></i>
                  {piece.healTarget ? '已锁定治疗目标' : '将自动治疗受伤友军'}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onIssue!(piece.id, { undoStep: true })}
                  disabled={!hasPath}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-md text-xs border border-background-300 text-foreground-700 hover:border-primary-400 hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${compact ? 'px-2 py-1.5' : 'px-2 py-2'}`}
                >
                  <i className="ri-arrow-go-back-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  后退一步
                </button>
                <button
                  onClick={() => onIssue!(piece.id, { clearPath: true })}
                  disabled={!hasPath}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-md text-xs border border-background-300 text-foreground-700 hover:border-secondary-400 hover:text-secondary-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${compact ? 'px-2 py-1.5' : 'px-2 py-2'}`}
                >
                  <i className="ri-eraser-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  清空
                </button>
                <button
                  onClick={() => onIssue!(piece.id, { confirm: true })}
                  disabled={!canAfford}
                  className={`flex-[1.4] flex items-center justify-center gap-1 rounded-md text-xs bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${compact ? 'px-2 py-1.5' : 'px-2 py-2'}`}
                >
                  <i className="ri-check-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  {hasPath ? '确认移动' : '确认指令'}
                  <span className="text-[10px] opacity-80">· {confirmCost} 点</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, compact }: { icon: string; label: string; value: string; compact?: boolean }) {
  if (compact) {
    return (
      <div
        title={label}
        className="rounded-md bg-background-100 border border-background-200 px-1 py-1 flex items-center justify-center gap-1"
      >
        <i className={`${icon} text-secondary-300 w-3 h-3 flex items-center justify-center`}></i>
        <span className="font-heading text-[11px] text-foreground-950 whitespace-nowrap">{value}</span>
      </div>
    );
  }
  return (
    <div className="rounded-md bg-background-100 border border-background-200 px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <i className={`${icon} text-secondary-300 w-3 h-3 flex items-center justify-center`}></i>
        <span className="font-label text-[9px] text-foreground-600 whitespace-nowrap">{label}</span>
      </div>
      <div className="font-heading text-xs text-foreground-950">{value}</div>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/30 text-secondary-300 whitespace-nowrap">
      {text}
    </span>
  );
}