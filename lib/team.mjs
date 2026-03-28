/**
 * harness team — 团队协作层管理
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateToken() {
  return 'cv_' + randomBytes(16).toString('hex');
}

export async function team(cwd, subCmd, args) {
  switch (subCmd) {
    case 'init': return teamInit(cwd, args);
    case 'onboard': return teamOnboard(cwd, args);
    case 'sync': return teamSync(cwd, args);
    default:
      console.log('用法: harness team [init|onboard|sync]');
  }
}

async function teamInit(cwd, args) {
  console.log('🤝 初始化团队协作层...\n');

  // 创建目录结构
  const dirs = [
    '.teamwork/experiences', '.teamwork/decisions',
    '.teamwork/coordination/history', '.teamwork/profiles', '.teamwork/drafts', '.teamwork/live'
  ];
  for (const d of dirs) {
    const p = join(cwd, d);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
  console.log('  ✓ 创建了 .teamwork/ 目录结构');

  // 生成 harness.team.json
  const teamFile = join(cwd, '.claude/harness.team.json');
  if (!existsSync(teamFile)) {
    const teamConfig = {
      version: '2.0',
      team: { name: cwd.split('/').pop() + ' Team', language: 'zh-CN', members: [] },
      enforced: {
        quality_gates: ['no_half_finished_features', 'no_fake_data', 'tests_must_pass'],
        commit_style: 'semantic_zh',
        blocked_operations: ['git push --force', 'git reset --hard'],
      },
      personal_overrides_allowed: ['execution_style', 'editor_preferences', 'model_routing'],
      onboarding: {
        setup_script: 'scripts/setup-dev.sh',
        required_checks: ['claude_md_read', 'dev_env_running', 'smoke_test_pass'],
        welcome_message: '欢迎加入团队！请先运行 scripts/setup-dev.sh，然后阅读 CLAUDE.md。'
      },
      experience_board: { enabled: true, path: '.teamwork/experiences/', auto_inject_limit: 5 },
      coordination: { enabled: true, profiles_path: '.teamwork/profiles/', max_tasks_per_person: 5 },
      sync: { token: generateToken(), port: 3456 }
    };
    mkdirSync(dirname(teamFile), { recursive: true });
    writeFileSync(teamFile, JSON.stringify(teamConfig, null, 2));
    console.log('  ✓ 生成了 .claude/harness.team.json');
  }

  // 经验板索引
  const indexFile = join(cwd, '.teamwork/experiences/index.json');
  if (!existsSync(indexFile)) {
    writeFileSync(indexFile, JSON.stringify({
      version: '1.0', total_count: 0,
      categories: {
        frontend: { count: 0 }, backend: { count: 0 }, db: { count: 0 },
        deploy: { count: 0 }, debug: { count: 0 }, performance: { count: 0 }, security: { count: 0 }
      }
    }, null, 2));
    console.log('  ✓ 初始化了经验板索引');
  }

  // 生成 setup-dev.sh
  const setupScript = join(cwd, 'scripts/setup-dev.sh');
  if (!existsSync(setupScript)) {
    mkdirSync(dirname(setupScript), { recursive: true });
    const tmpl = readFileSync(resolve(__dirname, '..', 'templates', 'harness-team.md'), 'utf8');
    // 提取 setup-dev.sh 模板中的脚本
    const match = tmpl.match(/```bash\n(#!\/usr\/bin\/env bash[\s\S]*?)```/);
    if (match) {
      writeFileSync(setupScript, match[1]);
      const { chmodSync } = await import('fs');
      chmodSync(setupScript, 0o755);
      console.log('  ✓ 生成了 scripts/setup-dev.sh');
    }
  }

  // 自动配置 Claude Code hooks（让 AI 能看到同步信息）
  const settingsFile = join(cwd, '.claude/settings.json');
  let settings = {};
  if (existsSync(settingsFile)) {
    try { settings = JSON.parse(readFileSync(settingsFile, 'utf8')); } catch {}
  }
  if (!settings.hooks) settings.hooks = {};

  const needsHooks = !JSON.stringify(settings.hooks).includes('sync-hook');

  if (needsHooks) {
    // PreToolUse:Edit — 编辑前检查是否有人在改同一个文件
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
    settings.hooks.PreToolUse.push({
      matcher: 'Edit',
      hooks: [{ type: 'command', command: 'bash -c \'FILE="${TOOL_INPUT_FILE_PATH:-}"; if [ -n "$FILE" ]; then curl -s -H "X-Covibe-Token: ${HARNESS_SYNC_TOKEN:-}" "${HARNESS_SYNC_SERVER:-http://localhost:3456}/status" 2>/dev/null | node -e "const d=JSON.parse(require(\\\"fs\\\").readFileSync(0,\\\"utf8\\\"));const e=d.active_edits?.[\\\"$FILE\\\"]; if(e && e.editor!==\\\"${HARNESS_SYNC_USER:-}\\\") console.log(\\\"⚠️ \\\"+e.editor+\\\" 正在编辑 \\\"+\\\"$FILE\\\"+\\\"，注意协调避免冲突！\\\");" 2>/dev/null; fi\'' }]
    });

    // PostToolUse:Edit — 编辑后广播状态
    if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
    settings.hooks.PostToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: 'bash -c \'FILE="${TOOL_INPUT_FILE_PATH:-}"; if [ -n "$FILE" ]; then curl -s -X POST "${HARNESS_SYNC_SERVER:-http://localhost:3456}/broadcast" -H "Content-Type: application/json" -H "X-Covibe-Token: ${HARNESS_SYNC_TOKEN:-}" -d "{\\\"type\\\":\\\"editing\\\",\\\"name\\\":\\\"${HARNESS_SYNC_USER:-$(whoami)}\\\",\\\"file\\\":\\\"$FILE\\\"}" > /dev/null 2>&1 || true; fi\'' }]
    });

    if (existsSync(settingsFile)) {
      copyFileSync(settingsFile, settingsFile + '.backup');
    }
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    console.log('  ✓ 配置了 Claude Code hooks（AI 编辑文件时自动同步+冲突检测）');
  }

  // 更新 .gitignore
  const gi = join(cwd, '.gitignore');
  let content = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const entries = ['.teamwork/drafts/', '.teamwork/live/'];
  let changed = false;
  for (const e of entries) {
    if (!content.includes(e)) { content += `\n${e}`; changed = true; }
  }
  if (changed) { writeFileSync(gi, content); console.log('  ✓ 更新了 .gitignore'); }

  // 输出 sync token
  const cfg = JSON.parse(readFileSync(teamFile, 'utf8'));
  const token = cfg.sync?.token;
  if (token) {
    console.log(`  🔑 Sync Token: ${token}`);
    console.log('     (已写入 harness.team.json，git push 后同事自动获得)');
  }

  console.log('\n✅ 团队协作层初始化完成！');
  console.log('   每个成员运行 covibe team onboard 完成入驻');
}

async function teamOnboard(cwd, args) {
  console.log('👋 新成员入驻向导\n');

  const teamFile = join(cwd, '.claude/harness.team.json');
  if (!existsSync(teamFile)) {
    console.log('⚠️ 团队未初始化，请先运行 harness team init');
    return;
  }

  const config = JSON.parse(readFileSync(teamFile, 'utf8'));
  console.log(config.onboarding?.welcome_message || '欢迎加入！');
  console.log('\n请完成以下步骤：');
  console.log('  1. 运行 scripts/setup-dev.sh 安装开发环境');
  console.log('  2. 阅读 CLAUDE.md 了解项目规范');
  console.log('  3. 在 .teamwork/profiles/ 创建个人画像');
  console.log('  4. 运行 harness audit 检查环境健康度');
  console.log('  5. 配置环境变量 HARNESS_SYNC_SERVER 和 HARNESS_SYNC_USER');
}

async function teamSync(cwd, args) {
  const teamFile = join(cwd, '.claude/harness.team.json');
  if (!existsSync(teamFile)) {
    console.log('⚠️ 团队未初始化');
    return;
  }

  const config = JSON.parse(readFileSync(teamFile, 'utf8'));
  const localFile = join(cwd, '.claude/settings.local.json');
  const local = existsSync(localFile) ? JSON.parse(readFileSync(localFile, 'utf8')) : {};

  console.log('🔄 同步团队配置...\n');
  console.log(`  团队: ${config.team?.name}`);
  console.log(`  enforced 规则: ${config.enforced?.quality_gates?.length || 0} 条`);

  // 检查本地是否违反 enforced 规则
  const blocked = config.enforced?.blocked_operations || [];
  const localAllowed = local.allowedTools || [];
  const violations = localAllowed.filter(t => blocked.some(b => t.includes(b)));
  if (violations.length > 0) {
    console.log(`\n  ⚠️ 本地配置违反团队规则:`);
    for (const v of violations) console.log(`     - ${v}`);
    console.log('  建议: 从 settings.local.json 中移除以上配置');
  } else {
    console.log('\n  ✅ 本地配置与团队规范一致');
  }
}
