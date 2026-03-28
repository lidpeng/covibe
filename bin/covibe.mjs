#!/usr/bin/env node
/**
 * Harness Engineering CLI
 * 为 AI Agent 构建结构化工作环境的通用范式
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const [,, command, ...args] = process.argv;

const HELP = `
  🎵 covibe v2.0.0 — Co-Vibe, 一起 vibe coding!

  用法:
    covibe init              🔍 自动探测技术栈，一键生成 AI 工作环境
    covibe audit             📊 审计健康度（100 分制）
    covibe board             📋 共同任务看板
    covibe board add "任务"  📌 添加任务到看板
    covibe board vibe <id>   🎵 开始 vibing 一个任务
    covibe board done <id>   ✅ 完成任务
    covibe team init         🤝 初始化团队协作层
    covibe team onboard      👋 新成员引导
    covibe sync start        🔗 启动实时同步服务器
    covibe sync status       👀 查看谁在线、谁在改什么
    covibe experience add    💡 添加团队经验
    covibe experience list   📚 查看经验列表
    covibe coordinate "任务" 🎯 Agent 智能分工
    covibe template <type>   📄 输出模板内容

  模板: claude-md, skill, hooks, workflow, audit,
        team, experience, coordinator, sync

  选项:
    --help, -h   显示帮助
    --version    显示版本

  Let's vibe together! 🎸
`;

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  if (command === '--version') {
    const pkg = await import(resolve(ROOT, 'package.json'), { with: { type: 'json' } });
    console.log(pkg.default.version);
    return;
  }

  try {
    switch (command) {
      case 'init': {
        const { init } = await import(resolve(ROOT, 'lib/init.mjs'));
        await init(process.cwd(), args);
        break;
      }
      case 'audit': {
        if (args[0] === '--fix') {
          const { auditFix } = await import(resolve(ROOT, 'lib/audit.mjs'));
          await auditFix(process.cwd());
        } else {
          const { audit } = await import(resolve(ROOT, 'lib/audit.mjs'));
          await audit(process.cwd(), args);
        }
        break;
      }
      case 'cross-ide': {
        const { crossIde } = await import(resolve(ROOT, 'lib/cross-ide.mjs'));
        await crossIde(process.cwd(), args);
        break;
      }
      case 'dashboard': {
        const { createServer } = await import('http');
        const { readFileSync: rf, existsSync: ex } = await import('fs');
        const { join: j, extname } = await import('path');
        const dashDir = resolve(ROOT, 'dashboard');
        const port = parseInt(args[0] || '3457');
        const mime = { '.html': 'text/html', '.gif': 'image/gif', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
        const srv = createServer((req, res) => {
          const pathname = new URL(req.url, `http://localhost:${port}`).pathname;
          const p = j(dashDir, pathname === '/' ? 'index.html' : pathname);
          if (!ex(p)) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': mime[extname(p)] || 'application/octet-stream' });
          res.end(rf(p));
        });
        const syncUser = process.env.HARNESS_SYNC_USER || '';
        const syncServer = process.env.HARNESS_SYNC_SERVER ? new URL(process.env.HARNESS_SYNC_SERVER).host : 'localhost:3456';
        const syncToken = process.env.HARNESS_SYNC_TOKEN || '';
        const qs = `server=${syncServer}${syncUser ? '&name=' + encodeURIComponent(syncUser) : ''}${syncToken ? '&token=' + encodeURIComponent(syncToken) : ''}`;
        srv.listen(port, () => {
          console.log(`\n  🎵 covibe Dashboard 已启动!\n`);
          console.log(`  📺 打开浏览器: http://localhost:${port}?${qs}`);
          if (syncUser) console.log(`  👤 当前身份: ${syncUser}`);
          else console.log(`  💡 设置身份: export HARNESS_SYNC_USER="你的名字"`);
          console.log(`\n  Ctrl+C 退出\n`);
        });
        break;
      }
      case 'team': {
        const subCmd = args[0];
        const { team } = await import(resolve(ROOT, 'lib/team.mjs'));
        await team(process.cwd(), subCmd, args.slice(1));
        break;
      }
      case 'board': {
        const { board } = await import(resolve(ROOT, 'lib/board.mjs'));
        await board(process.cwd(), args[0], args.slice(1));
        break;
      }
      case 'sync': {
        const subCmd = args[0] || 'start';
        if (subCmd === 'start') {
          const { fork } = await import('child_process');
          const { existsSync: ex, readFileSync: rf } = await import('fs');
          const serverPath = resolve(ROOT, 'scripts/sync-server.mjs');
          const extraArgs = [...args.slice(1)];
          // 自动从 harness.team.json 读取 token 和端口
          const teamCfg = resolve(process.cwd(), '.claude/harness.team.json');
          if (ex(teamCfg) && !extraArgs.includes('--token')) {
            try {
              const cfg = JSON.parse(rf(teamCfg, 'utf8'));
              if (cfg.sync?.token) extraArgs.push('--token', cfg.sync.token);
              if (cfg.sync?.port && !extraArgs.includes('--port')) extraArgs.push('--port', String(cfg.sync.port));
            } catch {}
          }
          const child = fork(serverPath, extraArgs, { stdio: 'inherit' });
          child.on('error', e => { console.error('启动失败:', e.message); process.exit(1); });
        } else if (subCmd === 'status') {
          const server = process.env.HARNESS_SYNC_SERVER || 'http://localhost:3456';
          try {
            const res = await fetch(`${server}/status`);
            const data = await res.json();
            console.log(`项目: ${data.project} | 在线: ${data.online}`);
            console.log(`成员: ${data.members?.join(', ') || '无'}`);
            const edits = data.active_edits || {};
            if (Object.keys(edits).length > 0) {
              console.log('当前编辑:');
              for (const [f, e] of Object.entries(edits)) {
                console.log(`  ${e.editor} → ${f}`);
              }
            }
          } catch {
            console.log(`Sync server 未运行（${server}）`);
          }
        }
        break;
      }
      case 'experience': {
        const { experience } = await import(resolve(ROOT, 'lib/experience.mjs'));
        await experience(process.cwd(), args[0], args.slice(1));
        break;
      }
      case 'coordinate': {
        const { coordinate } = await import(resolve(ROOT, 'lib/coordinate.mjs'));
        await coordinate(process.cwd(), args);
        break;
      }
      case 'profile-gen': {
        const { profileGen } = await import(resolve(ROOT, 'lib/profile-gen.mjs'));
        await profileGen(process.cwd(), args);
        break;
      }
      case 'suggest': {
        const { suggest } = await import(resolve(ROOT, 'lib/suggest.mjs'));
        await suggest(process.cwd(), args[0], args.slice(1));
        break;
      }
      case 'template': {
        const type = args[0];
        const map = {
          'claude-md': 'claude-md-constitution.md',
          'skill': 'skill-template.md',
          'hooks': 'hooks-catalog.md',
          'workflow': 'workflow-template.md',
          'audit': 'audit-checklist.md',
          'team': 'harness-team.md',
          'experience': 'experience-board.md',
          'coordinator': 'agent-coordinator.md',
          'sync': 'realtime-sync.md',
          'auto-detect': 'auto-detect.md',
        };
        const file = map[type];
        if (!file) {
          console.log(`未知模板: ${type}`);
          console.log(`可用模板: ${Object.keys(map).join(', ')}`);
          return;
        }
        const { readFileSync } = await import('fs');
        console.log(readFileSync(resolve(ROOT, 'templates', file), 'utf8'));
        break;
      }
      default:
        console.log(`未知命令: ${command}`);
        console.log(HELP);
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  }
}

main();
