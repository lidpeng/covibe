/**
 * harness audit — 审计 harness 健康度（100 分制）
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { detect } from './detect.mjs';

const CHECKS = [
  { id: 'K1', dim: '知识', name: 'CLAUDE.md 存在', weight: 15, level: 'MUST',
    check: (cwd) => existsSync(join(cwd, 'CLAUDE.md')) || existsSync(join(cwd, '.claude/CLAUDE.md')) },
  { id: 'K2', dim: '知识', name: 'CLAUDE.md 结构化', weight: 15, level: 'MUST',
    check: (cwd) => {
      for (const p of ['CLAUDE.md', '.claude/CLAUDE.md']) {
        if (existsSync(join(cwd, p))) {
          const c = readFileSync(join(cwd, p), 'utf8');
          return c.includes('#') && (c.includes('技术栈') || c.includes('Tech') || c.includes('Stack') || c.includes('构建'));
        }
      }
      return false;
    }},
  { id: 'K3', dim: '知识', name: '构建命令文档化', weight: 15, level: 'MUST',
    check: (cwd) => {
      for (const p of ['CLAUDE.md', '.claude/CLAUDE.md']) {
        if (existsSync(join(cwd, p))) {
          const c = readFileSync(join(cwd, p), 'utf8');
          return c.includes('```bash') || c.includes('npm ') || c.includes('python') || c.includes('cargo');
        }
      }
      return false;
    }},
  { id: 'K4', dim: '知识', name: '项目结构文档化', weight: 8, level: 'SHOULD',
    check: (cwd) => {
      for (const p of ['CLAUDE.md', '.claude/CLAUDE.md']) {
        if (existsSync(join(cwd, p))) {
          const c = readFileSync(join(cwd, p), 'utf8');
          return c.includes('├──') || c.includes('结构') || c.includes('Structure');
        }
      }
      return false;
    }},
  { id: 'K5', dim: '知识', name: '知识库存在', weight: 3, level: 'MAY',
    check: (cwd) => existsSync(join(cwd, 'docs')) },
  { id: 'T1', dim: '工具', name: '开发工作流 Skill', weight: 8, level: 'SHOULD',
    check: (cwd) => {
      const sd = join(cwd, '.claude/skills');
      if (!existsSync(sd)) return false;
      try { return readdirSync(sd).some(f => f.endsWith('.md')); } catch { return false; }
    }},
  { id: 'T2', dim: '工具', name: '测试命令可执行', weight: 15, level: 'MUST',
    check: (cwd) => {
      const info = detect(cwd);
      return !!(info.commands.test || info.commands.smokeTest);
    }},
  { id: 'T3', dim: '工具', name: 'MCP 配置', weight: 3, level: 'MAY',
    check: () => false }, // 需要具体检查 MCP
  { id: 'P1', dim: '权限', name: 'settings.local.json', weight: 8, level: 'SHOULD',
    check: (cwd) => existsSync(join(cwd, '.claude/settings.local.json')) },
  { id: 'P2', dim: '权限', name: '敏感操作有守卫', weight: 8, level: 'SHOULD',
    check: (cwd) => {
      // 检查 CLAUDE.md 或 settings.json 中是否有安全规则
      for (const p of ['CLAUDE.md', '.claude/settings.json']) {
        if (existsSync(join(cwd, p))) {
          const c = readFileSync(join(cwd, p), 'utf8');
          if (c.includes('force push') || c.includes('hooks') || c.includes('危险') || c.includes('blocked')) return true;
        }
      }
      return false;
    }},
  { id: 'M1', dim: '记忆', name: '项目记忆', weight: 3, level: 'MAY',
    check: (cwd) => existsSync(join(cwd, '.omc/project-memory.json')) || existsSync(join(cwd, '.teamwork')) },
  { id: 'Q1', dim: '质量', name: '质量门禁规则', weight: 15, level: 'MUST',
    check: (cwd) => {
      for (const p of ['CLAUDE.md', '.claude/CLAUDE.md']) {
        if (existsSync(join(cwd, p))) {
          const c = readFileSync(join(cwd, p), 'utf8');
          return c.includes('质量') || c.includes('红线') || c.includes('禁止') || c.includes('Quality');
        }
      }
      return false;
    }},
  { id: 'Q2', dim: '质量', name: '验证自动化', weight: 8, level: 'SHOULD',
    check: (cwd) => existsSync(join(cwd, 'scripts/smoke-test.sh')) ||
      existsSync(join(cwd, '.github/workflows')) || existsSync(join(cwd, '.gitlab-ci.yml')) },
  // v2 新增
  { id: 'TM1', dim: '团队', name: '团队配置', weight: 5, level: 'MAY',
    check: (cwd) => existsSync(join(cwd, '.claude/harness.team.json')) || existsSync(join(cwd, '.teamwork/experiences')) },
];

export async function audit(cwd, args) {
  console.log(`\n## Harness Audit Report\n`);
  console.log(`**项目**: ${cwd.split('/').pop()}`);
  console.log(`**日期**: ${new Date().toISOString().slice(0, 10)}\n`);

  let totalScore = 0;
  let maxScore = 0;
  const results = [];

  for (const check of CHECKS) {
    maxScore += check.weight;
    const passed = check.check(cwd);
    const score = passed ? check.weight : 0;
    totalScore += score;
    const status = passed ? '✅ PASS' : (check.level === 'MUST' ? '❌ FAIL' : check.level === 'SHOULD' ? '⚠️ WARN' : 'ℹ️ INFO');
    results.push({ ...check, passed, score, status });
  }

  // 评级
  const pct = Math.round((totalScore / maxScore) * 100);
  let grade, gradeEmoji;
  if (pct >= 90) { grade = 'HEALTHY'; gradeEmoji = '🟢'; }
  else if (pct >= 70) { grade = 'GOOD'; gradeEmoji = '🟡'; }
  else if (pct >= 50) { grade = 'NEEDS WORK'; gradeEmoji = '🟠'; }
  else { grade = 'CRITICAL'; gradeEmoji = '🔴'; }

  console.log(`### 总分: ${totalScore}/${maxScore} (${pct}%) ${gradeEmoji} ${grade}\n`);
  console.log(`| # | 维度 | 检查项 | 级别 | 状态 | 得分 |`);
  console.log(`|---|------|--------|------|------|------|`);

  for (const r of results) {
    console.log(`| ${r.id} | ${r.dim} | ${r.name} | ${r.level} | ${r.status} | ${r.score}/${r.weight} |`);
  }

  // 改进建议
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log(`\n### 改进建议\n`);
    let i = 1;
    for (const f of failures.filter(r => r.level === 'MUST')) {
      console.log(`${i++}. [CRITICAL] ${f.name} — 运行 \`harness init\` 可自动修复`);
    }
    for (const f of failures.filter(r => r.level === 'SHOULD')) {
      console.log(`${i++}. [RECOMMENDED] ${f.name}`);
    }
    for (const f of failures.filter(r => r.level === 'MAY')) {
      console.log(`${i++}. [OPTIONAL] ${f.name}`);
    }
  }

  console.log('');
  return { score: totalScore, max: maxScore, pct, grade };
}
