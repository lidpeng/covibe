/**
 * harness init — 自动探测 + 一键生成完整 harness
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detect } from './detect.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, '..', 'templates');

export async function init(cwd, args) {
  console.log('🔍 探测项目技术栈...\n');
  const info = detect(cwd);

  // 输出探测结果
  console.log(`  类型:     ${info.type}`);
  console.log(`  语言:     ${info.language || '未识别'}`);
  console.log(`  框架:     ${info.frameworks.join(', ') || '无'}`);
  console.log(`  结构:     ${info.structure}`);
  console.log(`  Docker:   ${info.hasDocker ? '✓' : '✗'}`);
  console.log(`  CI/CD:    ${info.hasCI ? '✓' : '✗'}`);
  console.log(`  已有 CLAUDE.md: ${info.existing.claudeMd ? '✓ (增强模式)' : '✗ (新建模式)'}`);
  console.log('');

  // 生成 CLAUDE.md
  if (info.existing.claudeMd) {
    console.log('📄 已有 CLAUDE.md，进入增强模式...');
    enhanceClaudeMd(cwd, info);
  } else {
    console.log('📄 生成 CLAUDE.md...');
    generateClaudeMd(cwd, info);
  }

  // 创建 .claude 目录
  const claudeDir = join(cwd, '.claude');
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });

  // 生成 settings.local.json
  const localSettings = join(claudeDir, 'settings.local.json');
  if (!existsSync(localSettings)) {
    writeFileSync(localSettings, JSON.stringify({}, null, 2));
    console.log('🔧 创建了 .claude/settings.local.json');
  }

  // 确保 .gitignore 包含个人文件
  ensureGitignore(cwd);

  // 生成开发工作流 skill
  const skillDir = join(claudeDir, 'skills');
  if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
  generateWorkflowSkill(cwd, info, skillDir);

  // 注册全局 sync hook（项目级 hooks 不生效，必须放全局）
  registerGlobalSyncHook(cwd);

  console.log('\n✅ Harness 初始化完成！');
  console.log('   运行 harness audit 检查健康度');
}

function generateClaudeMd(cwd, info) {
  const projectName = cwd.split('/').pop();
  const frameworksStr = info.frameworks.length > 0 ? info.frameworks.join(', ') : info.language || 'Unknown';
  const cmds = info.commands;

  let content = `# ${projectName}

> **语言约定**: 中文

## 角色与使命

你是 ${projectName} 的 AI 开发助手。

## 操作原则

### 执行风格
- **默认全速执行**：收到任务直接开干，不需要反复确认
- **只在以下情况暂停**：高风险操作、架构方向不确定、需求有歧义
- **不要擅自扩大范围**：只做明确要求的事

### 调试规则
- **先复现再修**：修 bug 前必须先看到实际报错
- **两次不对就换方向**：一个方向尝试 2 次仍不对，停下来重新审视
- **最小化修改**：每次只改一处，验证后再改下一处

## 技术栈

- **类型**: ${info.type}
- **语言**: ${info.language || '未识别'}
- **框架**: ${frameworksStr}
- **构建工具**: ${info.buildTool || '无'}
${info.hasDocker ? '- **容器**: Docker' : ''}

## 构建与运行

\`\`\`bash
${cmds.dev ? `# 开发\n${cmds.dev}\n` : ''}${cmds.build ? `# 构建\n${cmds.build}\n` : ''}${cmds.test ? `# 测试\n${cmds.test}\n` : ''}${cmds.lint ? `# Lint\n${cmds.lint}\n` : ''}${cmds.smokeTest ? `# 冒烟测试\n${cmds.smokeTest}\n` : ''}\`\`\`

## 质量门禁

- **禁止交付半成品功能**：每个功能必须端到端可用
- **禁止接入假数据**：数据必须来自真实 API
- 改动后运行测试验证

## Git 规范

- commit message: 语义化前缀 + 中文描述（feat/fix/docs/chore/refactor/test）
- 每个子任务完成后立即 commit
- 不自动 push
`;

  writeFileSync(join(cwd, 'CLAUDE.md'), content);
  console.log('   ✓ CLAUDE.md 已生成');
}

function enhanceClaudeMd(cwd, info) {
  const existing = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8');
  const missing = [];

  if (!existing.includes('技术栈') && !existing.includes('Tech Stack')) {
    missing.push('技术栈章节');
  }
  if (!existing.includes('构建') && !existing.includes('Build') && !existing.includes('bash')) {
    missing.push('构建命令章节');
  }
  if (!existing.includes('质量') && !existing.includes('Quality')) {
    missing.push('质量门禁章节');
  }

  if (missing.length === 0) {
    console.log('   ✓ CLAUDE.md 已完整，无需增强');
  } else {
    console.log(`   ⚠ CLAUDE.md 缺少: ${missing.join(', ')}`);
    console.log('   建议: 运行 harness template claude-md 查看完整模板并手动补充');
  }
}

function ensureGitignore(cwd) {
  const gi = join(cwd, '.gitignore');
  const entries = ['.claude/settings.local.json', '.teamwork/drafts/'];
  let content = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  let added = false;

  for (const entry of entries) {
    if (!content.includes(entry)) {
      content += `\n${entry}`;
      added = true;
    }
  }

  if (added) {
    writeFileSync(gi, content);
    console.log('📝 更新了 .gitignore');
  }
}

function generateWorkflowSkill(cwd, info, skillDir) {
  const projectName = cwd.split('/').pop();
  const cmds = info.commands;
  const testCmd = cmds.smokeTest || cmds.test || '# 无检测到的测试命令';

  const skill = `# ${projectName} 自动化开发工作流

当用户提出需求时，按以下流程执行。

## 触发条件
用户描述了功能需求、Bug 修复或改进请求。

## 执行流程

### Phase 1: 规划（30s 内）
1. 分析需求影响范围
2. 用 TodoWrite 列出步骤（3-7 步）
3. >5 文件变更先用 EnterPlanMode 确认

### Phase 2: 实现
对每个子任务：
1. 读取代码 → 编写改动 → 标记完成
2. 完成一个可测试单元后立即 commit

### Phase 3: 验证
\`\`\`bash
${testCmd}
\`\`\`

### Phase 4: 修复循环（最多 3 轮）
问题则修复 → 重跑验证 → 3 轮后报告

### Phase 5: 收尾
确认全部完成 → 最终 commit → 输出摘要

## 原则
- 不交付半成品
- 不用假数据
- 原子性提交
- 最小改动
`;

  const skillPath = join(skillDir, `${projectName}-dev.md`);
  if (!existsSync(skillPath)) {
    writeFileSync(skillPath, skill);
    console.log(`🔧 生成了工作流 skill: .claude/skills/${projectName}-dev.md`);
  }
}

function registerGlobalSyncHook(cwd) {
  const homedir = process.env.HOME || process.env.USERPROFILE;
  const globalSettings = join(homedir, '.claude', 'settings.json');
  const hookScript = join(cwd, 'scripts', 'sync-edit-hook.sh');

  // 确保 hook 脚本存在
  const scriptDir = join(cwd, 'scripts');
  if (!existsSync(scriptDir)) mkdirSync(scriptDir, { recursive: true });
  if (!existsSync(hookScript)) {
    writeFileSync(hookScript, `#!/bin/bash
# covibe sync hook: report file edits to sync server
FILE=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$FILE" ] && exit 0
NAME="\${HARNESS_SYNC_USER:-$(process.env.USER || 'unknown')}"
curl -s -X POST http://localhost:3456/broadcast \\
  -H 'Content-Type: application/json' \\
  -d "{\\"type\\":\\"editing\\",\\"name\\":\\"$NAME\\",\\"file\\":\\"$FILE\\"}" \\
  >/dev/null 2>&1 &
exit 0
`);
    chmodSync(hookScript, 0o755);
  }

  // 读取全局 settings
  let settings = {};
  if (existsSync(globalSettings)) {
    try { settings = JSON.parse(readFileSync(globalSettings, 'utf8')); } catch {}
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  // 检查是否已注册
  const hookCmd = `bash ${hookScript}`;
  const alreadyRegistered = settings.hooks.PostToolUse.some(group =>
    group.matcher === 'Edit|Write' &&
    group.hooks?.some(h => h.command?.includes('sync-edit-hook'))
  );

  if (!alreadyRegistered) {
    settings.hooks.PostToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{
        type: 'command',
        command: hookCmd,
        timeout: 3
      }]
    });
    writeFileSync(globalSettings, JSON.stringify(settings, null, 2));
    console.log('🔗 注册了全局 sync hook（~/.claude/settings.json）');
    console.log('   ⚠️  需要重启 Claude Code 会话生效');
  } else {
    console.log('🔗 全局 sync hook 已存在，跳过');
  }
}
