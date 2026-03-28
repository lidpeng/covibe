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
  covibe v2.0.0
  为 AI Agent 构建结构化工作环境的通用范式

  用法:
    covibe init              自动探测技术栈，一键生成完整 harness
    covibe audit             审计 harness 健康度（100 分制）
    covibe team init         初始化团队协作层
    covibe team onboard      新成员引导
    covibe sync start        启动实时同步服务器
    covibe sync status       查看团队同步状态
    covibe experience add    添加团队经验
    covibe experience list   查看经验列表
    covibe coordinate        Agent 智能分工（输出建议）
    covibe template <type>   输出模板内容

  模板类型:
    claude-md    CLAUDE.md 宪法模板
    skill        Skill 开发模板
    hooks        Hooks 模式库
    workflow     开发工作流模板
    audit        审计检查清单
    team         团队协作配置
    experience   共享经验板
    coordinator  Agent 分工协调
    sync         实时同步文档

  选项:
    --help, -h   显示帮助
    --version    显示版本
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
        const { audit } = await import(resolve(ROOT, 'lib/audit.mjs'));
        await audit(process.cwd(), args);
        break;
      }
      case 'team': {
        const subCmd = args[0];
        const { team } = await import(resolve(ROOT, 'lib/team.mjs'));
        await team(process.cwd(), subCmd, args.slice(1));
        break;
      }
      case 'sync': {
        const subCmd = args[0] || 'start';
        if (subCmd === 'start') {
          const { fork } = await import('child_process');
          const serverPath = resolve(ROOT, 'scripts/sync-server.mjs');
          const child = fork(serverPath, args.slice(1), { stdio: 'inherit' });
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
