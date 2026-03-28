/**
 * covibe board — 共同任务看板
 * 
 * 团队共享的轻量看板，每个人都可以添加 todo，
 * 实时同步每个人的 vibe coding 进度。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BOARD_FILE = '.teamwork/board.json';

const VIBES = ['🎸', '🎹', '🎵', '🎧', '🎷', '🎺', '🥁', '🎻', '🎤', '🪗'];
const randomVibe = () => VIBES[Math.floor(Math.random() * VIBES.length)];

const STATUS_DISPLAY = {
  todo: '📋 待办',
  vibing: '🎵 vibing',
  done: '✅ 完成',
  blocked: '🚧 阻塞',
};

function loadBoard(cwd) {
  const p = join(cwd, BOARD_FILE);
  if (!existsSync(p)) return { version: '1.0', tasks: [], id_counter: 0 };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn('board: failed to parse board file:', e.message); return { version: '1.0', tasks: [], id_counter: 0 }; }
}

function saveBoard(cwd, board) {
  const p = join(cwd, BOARD_FILE);
  mkdirSync(join(cwd, '.teamwork'), { recursive: true });
  writeFileSync(p, JSON.stringify(board, null, 2));
}

async function broadcastBoard(action, task) {
  const server = process.env.HARNESS_SYNC_SERVER;
  const token = process.env.HARNESS_SYNC_TOKEN || '';
  if (!server) return;
  try {
    await fetch(`${server}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Covibe-Token': token },
      body: JSON.stringify({ type: 'board', action, task, name: task.assignee || task.author })
    });
  } catch (e) { console.warn('board: failed to broadcast:', e.message); }
}

export async function board(cwd, subCmd, args) {
  switch (subCmd) {
    case 'add': return boardAdd(cwd, args);
    case 'list': case 'ls': case undefined: return boardList(cwd, args);
    case 'vibe': case 'start': return boardVibe(cwd, args);
    case 'done': return boardDone(cwd, args);
    case 'block': return boardBlock(cwd, args);
    case 'drop': case 'rm': return boardDrop(cwd, args);
    case 'assign': return boardAssign(cwd, args);
    default:
      console.log(`
  ${randomVibe()} covibe board — 共同任务看板

  用法:
    covibe board                   查看看板
    covibe board add "任务描述"     添加任务
    covibe board vibe <id>         开始 vibing（标记进行中）
    covibe board done <id>         完成任务
    covibe board block <id>        标记阻塞
    covibe board assign <id> <人>  分配任务
    covibe board drop <id>         删除任务
      `);
  }
}

async function boardAdd(cwd, args) {
  const content = args.filter(a => !a.startsWith('--')).join(' ');
  if (!content) { console.log('用法: covibe board add "任务描述"'); return; }

  const author = process.env.HARNESS_SYNC_USER || 'anonymous';
  const board = loadBoard(cwd);
  board.id_counter = (board.id_counter || 0) + 1;
  const task = {
    id: board.id_counter,
    content,
    status: 'todo',
    author,
    assignee: null,
    created: new Date().toISOString().slice(0, 16),
    updated: null,
  };
  board.tasks.push(task);
  saveBoard(cwd, board);
  await broadcastBoard('add', task);
  console.log(`${randomVibe()} 任务 #${task.id} 已添加到看板: ${content}`);
}

async function boardList(cwd) {
  const board = loadBoard(cwd);
  if (board.tasks.length === 0) {
    console.log(`\n  ${randomVibe()} 看板是空的～ 用 covibe board add "任务" 添加第一个任务吧！\n`);
    return;
  }

  // 按状态分组
  const groups = { todo: [], vibing: [], blocked: [], done: [] };
  for (const t of board.tasks) {
    (groups[t.status] || groups.todo).push(t);
  }

  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║  ${randomVibe()} covibe 共同任务看板            ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  for (const [status, tasks] of Object.entries(groups)) {
    if (tasks.length === 0) continue;
    console.log(`  ${STATUS_DISPLAY[status]} (${tasks.length})`);
    console.log(`  ${'─'.repeat(36)}`);
    for (const t of tasks) {
      const assignee = t.assignee ? ` → ${t.assignee}` : '';
      const author = t.author ? ` (by ${t.author})` : '';
      console.log(`  #${String(t.id).padStart(2)}  ${t.content}${assignee}${author}`);
    }
    console.log('');
  }

  // 团队 vibing 状态
  const vibing = groups.vibing;
  if (vibing.length > 0) {
    console.log(`  🎶 正在 vibing:`);
    for (const t of vibing) {
      console.log(`     ${t.assignee || t.author} → #${t.id} ${t.content}`);
    }
    console.log('');
  }
}

async function boardVibe(cwd, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id) || id <= 0) { console.log('用法: covibe board vibe <id>'); return; }
  const user = process.env.HARNESS_SYNC_USER || 'anonymous';
  const board = loadBoard(cwd);
  const task = board.tasks.find(t => t.id === id);
  if (!task) { console.log(`任务 #${id} 不存在`); return; }
  task.status = 'vibing';
  task.assignee = task.assignee || user;
  task.updated = new Date().toISOString().slice(0, 16);
  saveBoard(cwd, board);
  await broadcastBoard('vibe', task);
  console.log(`🎵 ${user} 开始 vibing #${id}: ${task.content}`);
}

async function boardDone(cwd, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id) || id <= 0) { console.log('用法: covibe board done <id>'); return; }
  const user = process.env.HARNESS_SYNC_USER || 'anonymous';
  const board = loadBoard(cwd);
  const task = board.tasks.find(t => t.id === id);
  if (!task) { console.log(`任务 #${id} 不存在`); return; }
  task.status = 'done';
  task.updated = new Date().toISOString().slice(0, 16);
  saveBoard(cwd, board);
  await broadcastBoard('done', task);
  console.log(`✅ #${id} 完成！${task.content} — nice vibes, ${user}! 🎉`);
}

async function boardBlock(cwd, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id) || id <= 0) { console.log('用法: covibe board block <id>'); return; }
  const board = loadBoard(cwd);
  const task = board.tasks.find(t => t.id === id);
  if (!task) { console.log(`任务 #${id} 不存在`); return; }
  task.status = 'blocked';
  task.updated = new Date().toISOString().slice(0, 16);
  saveBoard(cwd, board);
  await broadcastBoard('block', task);
  console.log(`🚧 #${id} 被阻塞了: ${task.content} — 需要帮忙吗？`);
}

async function boardDrop(cwd, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id) || id <= 0) { console.log('用法: covibe board drop <id>'); return; }
  const board = loadBoard(cwd);
  const idx = board.tasks.findIndex(t => t.id === id);
  if (idx < 0) { console.log(`任务 #${id} 不存在`); return; }
  const removed = board.tasks.splice(idx, 1)[0];
  saveBoard(cwd, board);
  console.log(`🗑️  #${id} 已从看板移除: ${removed.content}`);
}

async function boardAssign(cwd, args) {
  const id = parseInt(args[0], 10);
  const assignee = args[1];
  if (isNaN(id) || id <= 0 || !assignee) { console.log('用法: covibe board assign <id> <人名>'); return; }
  const board = loadBoard(cwd);
  const task = board.tasks.find(t => t.id === id);
  if (!task) { console.log(`任务 #${id} 不存在`); return; }
  task.assignee = assignee;
  task.updated = new Date().toISOString().slice(0, 16);
  saveBoard(cwd, board);
  await broadcastBoard('assign', task);
  console.log(`🎯 #${id} 分配给 ${assignee}: ${task.content}`);
}
