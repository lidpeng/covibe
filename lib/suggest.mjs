/**
 * covibe suggest — 团队建议系统
 * 
 * 任何人可以给队友发建议，接收方的 AI 判断是否相关，
 * 由接收者决定是否采纳。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const SUGGEST_DIR = '.teamwork/suggestions';

export async function suggest(cwd, subCmd, args) {
  switch (subCmd) {
    case 'send': return sendSuggestion(cwd, args);
    case 'list': case 'inbox': return listSuggestions(cwd, args);
    case 'accept': return respondSuggestion(cwd, args, 'accepted');
    case 'skip': return respondSuggestion(cwd, args, 'skipped');
    case undefined: return listSuggestions(cwd, args);
    default:
      console.log(`
  🎵 covibe suggest — 团队建议系统

  给队友的工作提供建议，接收方 AI 判断是否相关。

  用法:
    covibe suggest send <对方名字> "建议内容"    发送建议
    covibe suggest inbox                        查看收到的建议
    covibe suggest accept <id>                  采纳建议
    covibe suggest skip <id>                    跳过建议
      `);
  }
}

async function sendSuggestion(cwd, args) {
  const recipient = args[0];
  const content = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
  if (!recipient || !content) {
    console.log('用法: covibe suggest send <对方名字> "建议内容"');
    return;
  }

  const sender = process.env.HARNESS_SYNC_USER || 'anonymous';
  const dir = join(cwd, SUGGEST_DIR, recipient.toLowerCase());
  mkdirSync(dir, { recursive: true });

  const id = `sug_${Date.now()}`;
  const suggestion = {
    id,
    from: sender,
    to: recipient,
    content,
    context: args.find(a => a.startsWith('--file='))?.slice(7) || null,
    created: new Date().toISOString(),
    status: 'pending', // pending → accepted / skipped
    response: null,
  };

  writeFileSync(join(dir, `${id}.json`), JSON.stringify(suggestion, null, 2));
  console.log(`💌 建议已发送给 ${recipient}: "${content}"`);

  // 广播到 sync server
  const server = process.env.HARNESS_SYNC_SERVER;
  const token = process.env.HARNESS_SYNC_TOKEN || '';
  if (server) {
    try {
      await fetch(`${server}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Covibe-Token': token },
        body: JSON.stringify({
          type: 'suggestion',
          from: sender,
          to: recipient,
          content,
          id,
        })
      });
      console.log('   已通过 sync 实时通知对方');
    } catch {}
  }
}

async function listSuggestions(cwd, args) {
  const me = (process.env.HARNESS_SYNC_USER || 'anonymous').toLowerCase();
  const dir = join(cwd, SUGGEST_DIR, me);
  if (!existsSync(dir)) {
    console.log('📭 没有收到建议。你的队友还没给你发过建议哦～');
    return;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('📭 没有收到建议。');
    return;
  }

  const pending = [];
  const handled = [];

  for (const f of files) {
    try {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (s.status === 'pending') pending.push(s);
      else handled.push(s);
    } catch {}
  }

  if (pending.length > 0) {
    console.log(`\n  📬 待处理的建议 (${pending.length})\n`);
    for (const s of pending) {
      console.log(`  #${s.id.slice(-6)}  💬 ${s.from}: "${s.content}"`);
      console.log(`         ${new Date(s.created).toLocaleString('zh-CN')}`);
      if (s.context) console.log(`         📁 相关文件: ${s.context}`);
      console.log('');
    }
    console.log(`  接收: covibe suggest accept <id后6位>`);
    console.log(`  跳过: covibe suggest skip <id后6位>`);
  } else {
    console.log('  ✅ 所有建议都已处理');
  }

  if (handled.length > 0) {
    console.log(`\n  📋 已处理 (${handled.length})\n`);
    for (const s of handled.slice(-5)) {
      const icon = s.status === 'accepted' ? '✅' : '⏭️';
      console.log(`  ${icon} ${s.from}: "${s.content}" → ${s.status}`);
    }
  }
}

async function respondSuggestion(cwd, args, status) {
  const idFragment = args[0];
  if (!idFragment) {
    console.log(`用法: covibe suggest ${status === 'accepted' ? 'accept' : 'skip'} <id后6位>`);
    return;
  }

  const me = (process.env.HARNESS_SYNC_USER || 'anonymous').toLowerCase();
  const dir = join(cwd, SUGGEST_DIR, me);
  if (!existsSync(dir)) { console.log('未找到建议'); return; }

  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const path = join(dir, f);
      const s = JSON.parse(readFileSync(path, 'utf8'));
      if (s.id.endsWith(idFragment) && s.status === 'pending') {
        s.status = status;
        s.responded_at = new Date().toISOString();
        writeFileSync(path, JSON.stringify(s, null, 2));

        if (status === 'accepted') {
          console.log(`✅ 已采纳 ${s.from} 的建议: "${s.content}"`);
          console.log(`   AI 会在后续工作中参考这条建议。`);
        } else {
          console.log(`⏭️ 已跳过 ${s.from} 的建议: "${s.content}"`);
        }

        // 广播回执
        const server = process.env.HARNESS_SYNC_SERVER;
        const token = process.env.HARNESS_SYNC_TOKEN || '';
        if (server) {
          try {
            await fetch(`${server}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Covibe-Token': token },
              body: JSON.stringify({
                type: 'suggestion_response',
                from: me,
                to: s.from,
                suggestion_id: s.id,
                status,
                content: s.content,
              })
            });
          } catch {}
        }
        return;
      }
    } catch {}
  }
  console.log(`未找到 ID 包含 "${idFragment}" 的待处理建议`);
}
