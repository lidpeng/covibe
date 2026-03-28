/**
 * harness experience — 共享经验板
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export async function experience(cwd, subCmd, args) {
  switch (subCmd) {
    case 'add': return addExperience(cwd, args);
    case 'list': return listExperiences(cwd, args);
    case 'upvote': return upvoteExperience(cwd, args);
    case 'archive': return archiveStale(cwd, args);
    case 'inject': return injectExperiences(cwd, args);
    default:
      console.log('用法: harness experience [add|list|inject]');
      console.log('  add "经验内容" --category <类别> --author <作者> --tags <tag1,tag2>');
      console.log('  list [--category <类别>] [--tag <标签>]');
      console.log('  inject [--limit <数量>]');
  }
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      result._content = result._content || args[i];
    }
  }
  return result;
}

async function addExperience(cwd, args) {
  const opts = parseArgs(args);
  const content = opts._content;
  if (!content) { console.log('用法: harness experience add "经验内容" --category db --author alice'); return; }

  const category = opts.category || 'general';
  const author = opts.author || process.env.HARNESS_SYNC_USER || 'anonymous';
  const tags = opts.tags ? opts.tags.split(',') : [];

  const expDir = join(cwd, '.teamwork/experiences', category);
  mkdirSync(expDir, { recursive: true });

  const id = `exp_${Date.now()}`;
  const record = {
    id, content, category, author, tags,
    source_task: opts.task || '',
    created: new Date().toISOString().slice(0, 10),
    upvotes: 0
  };

  writeFileSync(join(expDir, `${id}.json`), JSON.stringify(record, null, 2));

  // 更新索引
  const indexPath = join(cwd, '.teamwork/experiences/index.json');
  let index = { version: '1.0', total_count: 0, categories: {} };
  if (existsSync(indexPath)) {
    try { index = JSON.parse(readFileSync(indexPath, 'utf8')); } catch (e) { console.warn('experience: failed to parse index file:', e.message); }
  }
  index.total_count = (index.total_count || 0) + 1;
  if (!index.categories[category]) index.categories[category] = { count: 0 };
  index.categories[category].count++;
  index.last_updated = new Date().toISOString();
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`💡 经验已添加: [${category}/${author}] ${content}`);

  // 广播到 sync server
  const server = process.env.HARNESS_SYNC_SERVER;
  if (server) {
    try {
      await fetch(`${server}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'experience', name: author, content, category, tags })
      });
      console.log('   已广播到团队');
    } catch (e) { console.warn('experience: failed to broadcast:', e.message); }
  }
}

async function listExperiences(cwd, args) {
  const opts = parseArgs(args);
  const expBase = join(cwd, '.teamwork/experiences');
  if (!existsSync(expBase)) { console.log('暂无经验记录。运行 harness team init 初始化。'); return; }

  const categories = opts.category ? [opts.category] : readdirSync(expBase).filter(f => !f.endsWith('.json'));
  let count = 0;

  for (const cat of categories) {
    const catDir = join(expBase, cat);
    if (!existsSync(catDir)) continue;
    const files = readdirSync(catDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    console.log(`\n## ${cat} (${files.length})\n`);
    for (const f of files) {
      try {
        const exp = JSON.parse(readFileSync(join(catDir, f), 'utf8'));
        if (opts.tag && !exp.tags?.includes(opts.tag)) continue;
        const upvote = exp.upvotes ? ` 👍${exp.upvotes}` : '';
        console.log(`  - [${exp.author}] ${exp.content}${upvote}`);
        count++;
      } catch (e) { console.warn(`experience: failed to parse ${f}:`, e.message); }
    }
  }

  if (count === 0) console.log('暂无匹配的经验记录。');
}

async function injectExperiences(cwd, args) {
  const opts = parseArgs(args);
  const limit = parseInt(opts.limit || '5', 10) || 5;
  const expBase = join(cwd, '.teamwork/experiences');
  if (!existsSync(expBase)) return;

  const all = [];
  const categories = readdirSync(expBase).filter(f => !f.endsWith('.json'));
  for (const cat of categories) {
    const catDir = join(expBase, cat);
    if (!existsSync(catDir)) continue;
    for (const f of readdirSync(catDir).filter(f => f.endsWith('.json'))) {
      try { all.push(JSON.parse(readFileSync(join(catDir, f), 'utf8'))); } catch (e) { console.warn(`experience: failed to parse ${f}:`, e.message); }
    }
  }

  // 按 upvotes + recency 排序
  all.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || b.created?.localeCompare(a.created));
  const top = all.slice(0, limit);

  if (top.length > 0) {
    console.log('## 团队经验（供参考）\n');
    for (const exp of top) {
      const upvote = exp.upvotes ? ` 👍${exp.upvotes}` : '';
      console.log(`- [${exp.category}/${exp.author}] ${exp.content}${upvote}`);
    }
  }
}

async function upvoteExperience(cwd, args) {
  const id = args.filter(a => !a.startsWith('--'))[0];
  if (!id) { console.log('用法: covibe experience upvote <经验ID>'); return; }

  const expBase = join(cwd, '.teamwork/experiences');
  const { readdirSync } = await import('fs');
  const categories = readdirSync(expBase).filter(f => !f.endsWith('.json'));

  for (const cat of categories) {
    const catDir = join(expBase, cat);
    if (!existsSync(catDir)) continue;
    const files = readdirSync(catDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const path = join(catDir, f);
      try {
        const exp = JSON.parse(readFileSync(path, 'utf8'));
        if (exp.id === id) {
          const voter = process.env.HARNESS_SYNC_USER || 'anonymous';
          exp.upvotes = (exp.upvotes || 0) + 1;
          if (!exp.upvoted_by) exp.upvoted_by = [];
          if (!exp.upvoted_by.includes(voter)) exp.upvoted_by.push(voter);
          writeFileSync(path, JSON.stringify(exp, null, 2));
          console.log(`👍 已点赞 [${cat}] ${exp.content} (${exp.upvotes} 票)`);
          return;
        }
      } catch (e) { console.warn(`experience: failed to process ${f}:`, e.message); }
    }
  }
  console.log(`未找到经验 ${id}`);
}

async function archiveStale(cwd, args) {
  const months = Math.max(1, parseInt(args[0] || '6', 10)) || 6;
  const expBase = join(cwd, '.teamwork/experiences');
  const archiveDir = join(expBase, '.archive');
  mkdirSync(archiveDir, { recursive: true });

  const { readdirSync, renameSync } = await import('fs');
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  let archived = 0;

  const categories = readdirSync(expBase).filter(f => !f.endsWith('.json') && f !== '.archive');
  for (const cat of categories) {
    const catDir = join(expBase, cat);
    if (!existsSync(catDir)) continue;
    for (const f of readdirSync(catDir).filter(f => f.endsWith('.json'))) {
      try {
        const exp = JSON.parse(readFileSync(join(catDir, f), 'utf8'));
        const created = new Date(exp.created);
        if (created < cutoff && (exp.upvotes || 0) === 0) {
          mkdirSync(join(archiveDir, cat), { recursive: true });
          renameSync(join(catDir, f), join(archiveDir, cat, f));
          archived++;
        }
      } catch (e) { console.warn(`experience: failed to archive ${f}:`, e.message); }
    }
  }
  console.log(`🗃️  已归档 ${archived} 条过期经验（${months} 个月内无人点赞）`);
}
