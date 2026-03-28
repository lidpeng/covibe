/**
 * covibe 可爱元素库
 * 让每一次交互都带有温度 ～
 */

// ── Logo ──
export const LOGO = `
   ██████╗ ██████╗ ██╗   ██╗██╗██████╗ ███████╗
  ██╔════╝██╔═══██╗██║   ██║██║██╔══██╗██╔════╝
  ██║     ██║   ██║██║   ██║██║██████╔╝█████╗
  ██║     ██║   ██║╚██╗ ██╔╝██║██╔══██╗██╔══╝
  ╚██████╗╚██████╔╝ ╚████╔╝ ██║██████╔╝███████╗
   ╚═════╝ ╚═════╝   ╚═══╝  ╚═╝╚═════╝ ╚══════╝
`;

export const MINI_LOGO = `🎵 covibe — 一起 vibe!`;

// ── Vibe 猫 (4 行高，日系风格) ──
// 灵感来源：clawd-on-desk 的动态小人概念，ASCII 终端化
export const VIBE_CAT = {
  idle: [
    `  ／l、    `,
    ` (ﾟ､ ｡ ７  `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  vibing: [
    `  ／l、♪   `,
    ` (ﾟ▽ｏ ７  `,
    `  l  ~ヽ♫  `,
    `  じしf_,)ノ`,
  ],
  thinking: [
    `  ／l、 ?  `,
    ` (ﾟ-ｏ ７  `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  done: [
    `  ／l、 ✓  `,
    ` (ﾟ▽ﾟ ７  `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  blocked: [
    `  ／l、 ！ `,
    ` (ﾟ;ω; ７  `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  sleep: [
    `  ／l、zzZ `,
    ` (- ω - ７ `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  review: [
    `  ／l、 👀 `,
    ` (ﾟ_ﾟ ７   `,
    `  l  ~ヽ   `,
    `  じしf_,)ノ`,
  ],
  celebrate: [
    ` \\／l、／  `,
    `  (ﾟ▽ﾟ)   `,
    `  ⊂  つ   `,
    `   しーＪ  `,
  ],
};

// 渲染猫 + 消息
export function renderCat(state = 'idle', message = '') {
  const cat = VIBE_CAT[state] || VIBE_CAT.idle;
  const lines = cat.map(l => `  ${l}`);
  if (message) lines.push(`  💬 ${message}`);
  return lines.join('\n');
}

// 渲染团队成员状态（多只猫并排）
export function renderTeamCats(members) {
  if (members.length === 0) return '  还没有人上线哦～ 🎵';
  const maxLines = 4;
  const result = [];
  for (let line = 0; line < maxLines; line++) {
    const parts = members.map(m => {
      const cat = VIBE_CAT[m.status] || VIBE_CAT.idle;
      return cat[line] || '              ';
    });
    result.push('  ' + parts.join('  │  '));
  }
  // 名字行
  const names = members.map(m => {
    const status = { idle: '💤', vibing: '🎵', done: '✅', blocked: '🚧', sleep: '😴', thinking: '🤔', review: '👀' };
    const emoji = status[m.status] || '🎵';
    return `${emoji} ${m.name}`.padEnd(14);
  });
  result.push('  ' + names.join('  │  '));
  return result.join('\n');
}

// ── Emoji 集合 ──
export const VIBES = ['🎸', '🎹', '🎵', '🎧', '🎷', '🎺', '🥁', '🎻', '🎤', '🪗', '🎶', '🎼'];
export const MOODS = ['✨', '🌟', '💫', '⚡', '🔥', '💪', '🚀', '🎯', '🌈', '🦄'];

export const randomVibe = () => VIBES[Math.floor(Math.random() * VIBES.length)];
export const randomMood = () => MOODS[Math.floor(Math.random() * MOODS.length)];

// ── 随机话术 ──
export const WELCOME_MESSAGES = [
  '欢迎加入！让我们一起 vibe 🎵',
  '新队友来啦！准备好一起写代码了吗？🎸',
  '又多了一个 vibe coder！团队更强了 💪',
  'Welcome aboard! Let\'s co-vibe! 🎹',
  '新成员到！开始我们的 jam session 🎶',
];

export const CELEBRATION = [
  'Nice vibes! 🎉',
  'Groovy! 任务完成 🎸',
  '太强了！又搞定一个 💪',
  'Smooth like jazz 🎷',
  'Rock on! 🤘',
  '完美演奏！🎹',
  'Drop the mic! 🎤',
];

export const EXP_ENCOURAGEMENT = [
  '这个经验很有用！团队感谢你 🙏',
  '好经验！以后谁踩坑都能看到了 💡',
  '知识就是力量！已记录 📝',
  '团队智慧 +1 🧠',
];

export const AUDIT_GRADES = {
  HEALTHY:    { emoji: '🌟', text: '状态极佳！你的 AI 工作环境很 groovy', vibe: '完美演奏' },
  GOOD:       { emoji: '🎵', text: '不错不错，再调调音就更好了', vibe: '节奏感很好' },
  NEEDS_WORK: { emoji: '🎸', text: '需要调音了！几个关键配置缺失', vibe: '有些走调' },
  CRITICAL:   { emoji: '🔇', text: '静音状态...建议跑一下 covibe init', vibe: '还没开始演奏' },
};

export const CONFLICT_MESSAGES = [
  name => `🎵 ${name} 正在这个文件上 solo，要不等 ta 演完？`,
  name => `🎸 ${name} 也在改这里哦～建议先对个节奏再开始`,
  name => `🎹 注意！${name} 正在同一个文件上 vibing，小心别打乱节拍`,
];

export const randomConflict = (name) => CONFLICT_MESSAGES[Math.floor(Math.random() * CONFLICT_MESSAGES.length)](name);
export const randomWelcome = () => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
export const randomCelebration = () => CELEBRATION[Math.floor(Math.random() * CELEBRATION.length)];
export const randomEncouragement = () => EXP_ENCOURAGEMENT[Math.floor(Math.random() * EXP_ENCOURAGEMENT.length)];
