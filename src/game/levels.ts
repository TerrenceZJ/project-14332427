import type { LevelPreset } from './engine';
import type { Phase } from './types';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right';

/** 引导步骤的完成条件:满足后自动进入下一步 */
export type TutorialWait =
  | { type: 'none' }        // 手动(点「知道了」继续)
  | { type: 'select' }      // 等待玩家选中一只棋子
  | { type: 'place' }       // 等待玩家放置一只棋子
  | { type: 'move' }        // 等待玩家规划移动路径
  | { type: 'confirm' }     // 等待玩家确认一条指令
  | { type: 'phase' };      // 等待阶段变化(如确认出战进入指令阶段)

export interface TutorialStep {
  id: string;
  /** 要高亮的 UI 元素的 data-tutorial 标记值;省略则显示居中的全屏气泡 */
  target?: string;
  title: string;
  body: string;
  placement?: TutorialPlacement;
  /** 该步骤所属阶段;仅在该阶段展示(省略则任意阶段) */
  phase?: Phase;
  /** 完成条件(默认 none:手动点「知道了」) */
  wait?: TutorialWait;
}

export interface TutorialLevel {
  id: number;
  name: string;
  subtitle: string;
  preset: LevelPreset;
  steps: TutorialStep[];
}

/** 新手教程关卡:从 1 只盾卫的最小战场开始,逐步介绍职业 / 模式 / 部署 / 移动 / 攻击 / 卡牌 / 结算 */
export const TUTORIAL_LEVELS: TutorialLevel[] = [
  {
    id: 0,
    name: '第 0 关 · 初识灵兽',
    subtitle: '单只盾卫，认识棋盘与三种模式',
    preset: {
      cols: 6,
      rows: 1,
      deployGap: 1,
      lineup: ['c_double'],
      lineupSize: 1,
      enemyLineup: ['c_flame'],
      skipCards: true,
      enemyHp: 1,
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '欢迎来到灵契终焉',
        body: '这是一场迷雾中的同步指令战棋：双方在同一回合下达指令，随后同时执行。这一关你只有一只盾卫，跟着引导逐步操作，先熟悉最基础的规则。',
        wait: { type: 'none' },
      },
      {
        id: 'select-guardian',
        phase: 'deploy',
        target: 'piece-rail',
        title: '盾卫 · 铁壁护卫',
        body: '盾卫是队伍的坦克：血量最高(7点)、近战攻击、移动较慢(2格)。先点击下方的盾卫棋子，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-guardian',
        phase: 'deploy',
        target: 'board',
        title: '放置盾卫',
        body: '很好！现在点击棋盘左侧高亮的格子，把盾卫放上去。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '盾卫已就位！点这个「确认出战」按钮，正式进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'select',
        phase: 'command',
        target: 'board',
        title: '选中灵兽',
        body: '进入指令阶段。点击棋盘上的盾卫选中它，下方会弹出操作按钮。',
        wait: { type: 'select' },
      },
      {
        id: 'move',
        phase: 'command',
        target: 'board',
        title: '规划移动',
        body: '现在点击棋盘上高亮的格子，为盾卫规划移动路线。',
        wait: { type: 'move' },
      },
      {
        id: 'mode',
        phase: 'command',
        target: 'mode',
        title: '三种战斗模式',
        body: '在下方可以切换「攻击 / 防御 / 侦察」：攻击会攻击敌人；防御本回合受到的伤害-1；侦察视野扩大到2格但多耗1点行动点。这一关先保持攻击即可。',
        wait: { type: 'none' },
      },
      {
        id: 'confirm',
        phase: 'command',
        target: 'confirm',
        title: '确认指令',
        body: '点这个「确认」按钮，锁定盾卫的移动与攻击指令。',
        wait: { type: 'confirm' },
      },
      {
        id: 'end-turn',
        phase: 'command',
        target: 'end-card',
        title: '结束指令 · 战斗',
        body: '指令已就绪！点右下角的「结束指令 · 战斗」按钮，进入同步执行阶段，双方会同时行动。盾卫靠近敌方战士后会自动攻击，敌方只有 1 点血，一击即可消灭。',
        wait: { type: 'phase' },
      },
    ],
  },
  {
    id: 1,
    name: '第 1 关 · 协同作战',
    subtitle: '三只灵兽，学习移动与攻击配合',
    preset: {
      cols: 8,
      rows: 5,
      deployGap: 1,
      lineup: ['c_double', 'c_flame', 'c_arrow'],
      lineupSize: 3,
      enemyLineup: ['c_flame', 'c_double'],
    },
    steps: [
      {
        id: 'command',
        phase: 'command',
        target: 'command',
        title: '指令阶段',
        body: '进入指令阶段后，你可以为每只灵兽分别下达指令：移动到某个格子，或切换攻击/防御/侦察姿态。',
      },
      {
        id: 'piece-select',
        phase: 'command',
        target: 'board',
        title: '选中灵兽',
        body: '点击一只灵兽选中它，棋盘上会高亮它可以移动的范围。',
      },
      {
        id: 'move',
        phase: 'command',
        target: 'board',
        title: '规划移动',
        body: '点击高亮格，为灵兽规划移动路线。不同职业移动力不同：战士3格、盾卫2格、弓箭4格。',
      },
      {
        id: 'attack',
        phase: 'command',
        target: 'board',
        title: '发起攻击',
        body: '进入射程后灵兽会自动攻击最近的敌人。让近战顶前、远程在后输出，配合更高效。',
      },
    ],
  },
  {
    id: 2,
    name: '第 2 关 · 卡牌之力',
    subtitle: '学习抽卡、用卡与结算',
    preset: {
      cols: 10,
      rows: 6,
      deployGap: 2,
      lineup: ['c_flame', 'c_double', 'c_arrow', 'c_knock2', 'c_swap'],
      enemyLineup: ['c_heal', 'c_double', 'c_flame'],
    },
    steps: [
      {
        id: 'hand',
        phase: 'card1',
        target: 'hand',
        title: '手牌',
        body: '每回合开始会抽一张卡牌加入手牌。卡牌分为攻击、辅助、特殊三类，使用需要消耗行动点。',
      },
      {
        id: 'card-use',
        phase: 'card1',
        target: 'hand',
        title: '使用卡牌',
        body: '点击一张手牌查看详情，再点击「使用」发动它的效果。',
      },
      {
        id: 'end-card',
        phase: 'card1',
        target: 'end-card',
        title: '结束抽卡',
        body: '用完卡牌后，点这里结束抽卡阶段，进入指令阶段。',
      },
      {
        id: 'finish',
        title: '祝你顺利',
        body: '消灭敌方灵主即可获胜。你已经了解了核心玩法，去挑战更强大的对手吧！',
      },
    ],
  },
];
