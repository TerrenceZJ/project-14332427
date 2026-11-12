import type { LevelPreset } from './engine';
import type { Phase } from './types';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right';

/** 引导步骤的完成条件:满足后自动进入下一步 */
export type TutorialWait =
  | { type: 'none' }        // 手动(点「知道了」继续)
  | { type: 'select' }      // 等待玩家选中一只棋子
  | { type: 'place' }       // 等待玩家放置一只棋子
  | { type: 'move' }        // 等待玩家规划移动路径
  | { type: 'target' }      // 等待玩家锁定一个攻击目标
  | { type: 'heal' }        // 等待玩家锁定一个治疗目标
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
    subtitle: '单只盾卫，认识棋盘与战斗模式',
    preset: {
      cols: 6,
      rows: 1,
      deployGap: 1,
      lineup: ['c_double'],
      lineupSize: 1,
      enemyLineup: ['c_flame'],
      skipCards: true,
      lordBattle: false,
      enemyHp: 1,
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '欢迎来到灵契终焉',
        body: '双方在同一回合下达指令，随后同时执行。这一关你只有一只盾卫，跟着引导操作即可。',
        wait: { type: 'none' },
      },
      {
        id: 'no-deploy',
        phase: 'deploy',
        target: 'no-deploy',
        title: '初始不可放置',
        body: '棋盘中间被锁定的缓冲带是「初始不可放置」——部署阶段这里不能放棋子，只能放在左侧己方区域。',
        wait: { type: 'none' },
      },
      {
        id: 'zones',
        phase: 'deploy',
        target: 'board',
        title: '己方区域 · 敌方区域',
        body: '战场以中线为界：左侧（绿色）是己方区域，右侧是敌方区域。盾卫只能部署在己方区域。',
        wait: { type: 'none' },
      },
      {
        id: 'fog',
        phase: 'deploy',
        target: 'enemy-zone',
        title: '迷雾 · 敌方区域',
        body: '敌方区域被迷雾笼罩，看不到敌方布阵。灵兽前进揭开视野，才能看清敌情。',
        wait: { type: 'none' },
      },
      {
        id: 'select-guardian',
        phase: 'deploy',
        target: 'piece-rail',
        title: '盾卫 · 铁壁护卫',
        body: '盾卫是坦克：血最厚、近战、移动较慢。点击下方盾卫选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-guardian',
        phase: 'deploy',
        target: 'board',
        title: '放置盾卫',
        body: '点击棋盘左侧高亮的格子，把盾卫放上去。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '点「确认出战」进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'select',
        phase: 'command',
        target: 'board',
        title: '选中灵兽',
        body: '点击棋盘上的盾卫选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'move',
        phase: 'command',
        target: 'board',
        title: '规划移动',
        body: '点击高亮的格子，规划移动路线。',
        wait: { type: 'move' },
      },
      {
        id: 'mode',
        phase: 'command',
        target: 'mode',
        title: '两种战斗模式',
        body: '可切换「攻击 / 防御」，防御本回合受伤-1。本关保持攻击即可。',
        wait: { type: 'none' },
      },
      {
        id: 'confirm',
        phase: 'command',
        target: 'confirm',
        title: '确认指令',
        body: '点「确认」锁定移动指令。',
        wait: { type: 'confirm' },
      },
      {
        id: 'end-turn',
        phase: 'command',
        target: 'end-card',
        title: '结束指令 · 战斗',
        body: '点「结束指令 · 战斗」，双方同时行动。盾卫将向敌方推进。',
        wait: { type: 'phase' },
      },
      {
        id: 'attack-select',
        phase: 'command',
        target: 'board',
        title: '手动攻击 · 选中盾卫',
        body: '灵兽不会自动攻击。点击盾卫选中它，手动发起攻击。',
        wait: { type: 'select' },
      },
      {
        id: 'attack-target',
        phase: 'command',
        target: 'board',
        title: '锁定敌方目标',
        body: '点击敌方战士，锁定为攻击目标。',
        wait: { type: 'target' },
      },
      {
        id: 'attack-confirm',
        phase: 'command',
        target: 'confirm',
        title: '确认攻击指令',
        body: '点「确认」完成攻击指令。',
        wait: { type: 'confirm' },
      },
      {
        id: 'attack-end',
        phase: 'command',
        target: 'end-card',
        title: '结束指令 · 战斗',
        body: '点「结束指令 · 战斗」发起攻击——敌方只有 1 点血，一击消灭。',
        wait: { type: 'phase' },
      },
    ],
  },
  {
    id: 1,
    name: '第 1 关 · 双将协同',
    subtitle: '坦克与战士，认识信息栏与战斗日志',
    preset: {
      cols: 6,
      rows: 2,
      deployGap: 1,
      lineup: ['c_double', 'c_flame'],
      lineupSize: 2,
      enemyLineup: ['c_flame', 'c_double'],
      enemyHp: 1,
      enemyLord: 'c_flame',
      skipCards: true,
      prePlaced: [{ cardId: 'c_double', x: 0, y: 0 }],
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '第 1 关 · 双将协同',
        body: '这关你有两只灵兽：坦克已摆在棋盘上，你只需亲手把战士放上场。',
        wait: { type: 'none' },
      },
      {
        id: 'tank-placed',
        phase: 'deploy',
        target: 'board',
        title: '坦克已就位',
        body: '左上角的盾卫已就位，负责前排顶伤害。',
        wait: { type: 'none' },
      },
      {
        id: 'warrior-intro',
        phase: 'deploy',
        target: 'piece-rail',
        title: '新棋子 · 战士',
        body: '下方待部署的是「战士」：比坦克更灵活的输出担当。',
        wait: { type: 'none' },
      },
      {
        id: 'select-warrior',
        phase: 'deploy',
        target: 'piece-rail',
        title: '选中战士',
        body: '点击战士棋子，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-warrior',
        phase: 'deploy',
        target: 'board',
        title: '放置战士',
        body: '点击左侧高亮格子，部署到坦克旁边。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '点「确认出战」进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'lord',
        phase: 'command',
        target: 'board',
        title: '灵主 · 胜负关键',
        body: '头顶标着「主」字的是「灵主」。消灭敌方灵主即可获胜；灵主首次阵亡会以 1 点血重生并获得 1 回合无敌护盾。',
        wait: { type: 'none' },
      },
      {
        id: 'status-bar',
        phase: 'command',
        target: 'status-bar',
        title: '顶部信息栏',
        body: '顶部信息栏实时显示回合、行动点、双方存活数和剩余卡牌数。',
        wait: { type: 'none' },
      },
      {
        id: 'log-tab',
        phase: 'command',
        target: 'log-tab',
        title: '战斗日志',
        body: '「日志」记录战斗中的每个事件：蓝色己方、红色敌方，可按「全部 / 伤害 / 状态 / 卡牌」分类查看。',
        wait: { type: 'none' },
      },
      {
        id: 'auto-command',
        phase: 'command',
        target: 'auto-command',
        title: '一键自动指令',
        body: '点「一键自动指令」，AI 按所选风格自动规划（还需点「确认」才生效）。风格：激进压上、保守防御、集火灵主。',
        wait: { type: 'none' },
      },
    ],
  },
  {
    id: 2,
    name: '第 2 关 · 远程火力',
    subtitle: '新增弓箭手，认识远程点杀',
    preset: {
      cols: 8,
      rows: 4,
      deployGap: 1,
      lineup: ['c_double', 'c_flame', 'c_arrow'],
      lineupSize: 3,
      enemyLineup: ['c_flame', 'c_double', 'c_arrow'],
      enemyHp: 1,
      enemyLord: 'c_flame',
      skipCards: true,
      prePlaced: [
        { cardId: 'c_double', x: 2, y: 0 },
        { cardId: 'c_flame', x: 2, y: 1 },
      ],
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '第 2 关 · 远程火力',
        body: '这一关新增远程职业「弓箭手」。盾卫和战士已经就位，你只需把弓箭手放上场。',
        wait: { type: 'none' },
      },
      {
        id: 'front-line',
        phase: 'deploy',
        target: 'board',
        title: '前排已就位',
        body: '盾卫和战士已经部署在前排，负责顶伤害与近战输出。',
        wait: { type: 'none' },
      },
      {
        id: 'archer-intro',
        phase: 'deploy',
        target: 'piece-rail',
        title: '新棋子 · 弓箭手',
        body: '弓箭手是远程点杀单位：沿上下左右直线可达 3 格、移动 4 格，能隔着前排远程狙杀敌人，是队伍里的输出核心。',
        wait: { type: 'none' },
      },
      {
        id: 'select-archer',
        phase: 'deploy',
        target: 'piece-rail',
        title: '选中弓箭手',
        body: '点击下方弓箭手，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-archer',
        phase: 'deploy',
        target: 'board',
        title: '放置弓箭手 · 站后排',
        body: '弓箭手身板脆、近身有盲区，要放在盾卫和战士的身后，躲在安全距离输出。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '点「确认出战」进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'archer-range',
        phase: 'command',
        target: 'board',
        title: '远程点杀 · 3 格射程',
        body: '弓箭手沿上下左右直线可打 3 格，能隔着前排远程点杀敌人。选中弓箭手即可看到高亮的攻击范围，记得手动锁定目标。',
        wait: { type: 'none' },
      },
      {
        id: 'archer-blind',
        phase: 'command',
        target: 'board',
        title: '近身盲区 · 斜向打不到',
        body: '注意：弓箭手斜向打不到，紧邻 1 格也是盲区。要让盾卫、战士顶在前排，与敌人保持距离，弓箭手才能安全输出。',
        wait: { type: 'none' },
      },
    ],
  },
  {
    id: 3,
    name: '第 3 关 · 法术控场',
    subtitle: '新增法师，认识远程控场',
    preset: {
      cols: 10,
      rows: 6,
      deployGap: 1,
      lineup: ['c_double', 'c_flame', 'c_arrow', 'c_knock2'],
      lineupSize: 4,
      enemyLineup: ['c_flame', 'c_double', 'c_arrow', 'c_knock2'],
      enemyHp: 1,
      enemyLord: 'c_flame',
      skipCards: true,
      prePlaced: [
        { cardId: 'c_double', x: 0, y: 0 },
        { cardId: 'c_flame', x: 0, y: 1 },
        { cardId: 'c_arrow', x: 0, y: 2 },
      ],
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '第 3 关 · 法术控场',
        body: '这一关新增远程控场职业「法师」。盾卫、战士和弓箭手已经就位，你只需把法师放上场。',
        wait: { type: 'none' },
      },
      {
        id: 'allies-placed',
        phase: 'deploy',
        target: 'board',
        title: '阵容已就位',
        body: '盾卫、战士和弓箭手已经部署在左侧，组成前排与远程输出。',
        wait: { type: 'none' },
      },
      {
        id: 'mage-intro',
        phase: 'deploy',
        target: 'piece-rail',
        title: '新棋子 · 法师',
        body: '法师是远程控场单位：射程 2 格、移动 4 格，可用法术远程压制并扰乱敌人。',
        wait: { type: 'none' },
      },
      {
        id: 'select-mage',
        phase: 'deploy',
        target: 'piece-rail',
        title: '选中法师',
        body: '点击下方法师，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-mage',
        phase: 'deploy',
        target: 'board',
        title: '放置法师',
        body: '点击左侧高亮格子，把法师放到队友的旁边。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '点「确认出战」进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'mage-skill',
        phase: 'command',
        target: 'board',
        title: '法术控场',
        body: '法师与弓箭手一样是远程单位，射程 2 格。后续关卡会学到它的击退、陷阵等控制卡牌。',
        wait: { type: 'none' },
      },
    ],
  },
  {
    id: 4,
    name: '第 4 关 · 治愈之光',
    subtitle: '新增牧师，认识治疗支援',
    preset: {
      cols: 12,
      rows: 8,
      deployGap: 1,
      lineup: ['c_double', 'c_flame', 'c_arrow', 'c_knock2', 'c_swap'],
      lineupSize: 5,
      enemyLineup: ['c_flame', 'c_double', 'c_arrow', 'c_knock2', 'c_swap'],
      enemyHp: 1,
      enemyLord: 'c_flame',
      skipCards: true,
      prePlaced: [
        { cardId: 'c_double', x: 0, y: 0 },
        { cardId: 'c_flame', x: 0, y: 1 },
        { cardId: 'c_arrow', x: 0, y: 2 },
        { cardId: 'c_knock2', x: 0, y: 3 },
      ],
    },
    steps: [
      {
        id: 'welcome',
        phase: 'deploy',
        title: '第 4 关 · 治愈之光',
        body: '这一关新增支援职业「牧师」。盾卫、战士、弓箭手和法师已经就位，你只需把牧师放上场。',
        wait: { type: 'none' },
      },
      {
        id: 'allies-placed',
        phase: 'deploy',
        target: 'board',
        title: '阵容已就位',
        body: '盾卫、战士、弓箭手和法师已经部署在左侧，组成前排与远程输出。',
        wait: { type: 'none' },
      },
      {
        id: 'priest-intro',
        phase: 'deploy',
        target: 'piece-rail',
        title: '新棋子 · 牧师',
        body: '牧师是纯支援单位：没有攻击力，但能为队友治疗，回复 1 点血量。',
        wait: { type: 'none' },
      },
      {
        id: 'select-priest',
        phase: 'deploy',
        target: 'piece-rail',
        title: '选中牧师',
        body: '点击下方牧师，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'place-priest',
        phase: 'deploy',
        target: 'board',
        title: '放置牧师',
        body: '点击左侧高亮格子，把牧师放到队友的旁边。',
        wait: { type: 'place' },
      },
      {
        id: 'deploy-start',
        phase: 'deploy',
        target: 'deploy-start',
        title: '确认出战',
        body: '点「确认出战」进入战斗。',
        wait: { type: 'phase' },
      },
      {
        id: 'priest-select',
        phase: 'command',
        target: 'board',
        title: '选中牧师',
        body: '点击棋盘上的牧师，选中它。',
        wait: { type: 'select' },
      },
      {
        id: 'priest-heal',
        phase: 'command',
        target: 'board',
        title: '治疗队友',
        body: '点击一个己方队友，再选「治疗」，为它回复 1 点血量。',
        wait: { type: 'heal' },
      },
    ],
  },
  {
    id: 5,
    name: '第 5 关 · 卡牌之力',
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
        body: '每回合抽一张卡牌加入手牌。卡牌分攻击、辅助、特殊三类，使用需消耗行动点。',
      },
      {
        id: 'card-use',
        phase: 'card1',
        target: 'hand',
        title: '使用卡牌',
        body: '点击手牌查看详情，再点「使用」发动效果。',
      },
      {
        id: 'end-card',
        phase: 'card1',
        target: 'end-card',
        title: '结束抽卡',
        body: '用完卡牌后点这里，进入指令阶段。',
      },
      {
        id: 'finish',
        title: '祝你顺利',
        body: '消灭敌方灵主即可获胜。去挑战更强的对手吧！',
      },
    ],
  },
];
