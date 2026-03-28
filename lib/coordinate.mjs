/**
 * harness coordinate — Agent 智能分工建议
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function coordinate(cwd, args) {
  const task = args.join(' ');
  if (!task) {
    console.log('用法: harness coordinate "任务描述"');
    console.log('  需要先在 .teamwork/profiles/ 中创建成员画像');
    return;
  }

  // 加载成员画像
  const profileDir = join(cwd, '.teamwork/profiles');
  if (!existsSync(profileDir)) {
    console.log('⚠️ 未找到成员画像。请先运行 harness team init，然后在 .teamwork/profiles/ 创建画像。');
    return;
  }

  const profiles = [];
  for (const f of readdirSync(profileDir).filter(f => f.endsWith('.json'))) {
    try { profiles.push(JSON.parse(readFileSync(join(profileDir, f), 'utf8'))); } catch (e) { console.warn(`coordinate: failed to parse profile ${f}:`, e.message); }
  }

  if (profiles.length === 0) {
    console.log('⚠️ 没有成员画像。请在 .teamwork/profiles/ 中添加 JSON 文件。');
    console.log('  格式: { "name": "Bob", "role": "后端", "skills": { "primary": ["python"], "secondary": ["react"] } }');
    return;
  }

  console.log(`\n## 分工建议：${task}\n`);
  console.log(`**团队成员** (${profiles.length} 人):\n`);

  for (const p of profiles) {
    const rawSkills = p.skills?.primary || p.skills;
    const skills = Array.isArray(rawSkills) ? rawSkills
      : (rawSkills && typeof rawSkills === 'object') ? Object.values(rawSkills).flat()
      : (typeof rawSkills === 'string') ? [rawSkills]
      : [];
    const skillStr = skills.join(', ') || '无';
    const load = p.current_load?.active_tasks ?? p.current_load ?? '?';
    console.log(`  - **${p.name}** (${p.role}) — 技能: ${skillStr} | 当前负载: ${load} 任务`);
  }

  console.log(`\n**分工建议**:\n`);
  console.log(`  请将以上信息连同任务描述提供给 Claude Code，`);
  console.log(`  使用 /harness coordinate 命令或直接在对话中要求 Agent 分析并给出分工方案。`);
  console.log(`\n  Agent 会根据：`);
  console.log(`    1. 成员技能匹配度`);
  console.log(`    2. git blame 分析模块熟悉度`);
  console.log(`    3. 当前负载均衡`);
  console.log(`    4. 团队经验板相关经验`);
  console.log(`  生成详细的子任务分配方案。\n`);

  // 注入相关经验
  const expBase = join(cwd, '.teamwork/experiences');
  if (existsSync(expBase)) {
    const all = [];
    const cats = readdirSync(expBase).filter(f => !f.endsWith('.json'));
    for (const cat of cats) {
      const catDir = join(expBase, cat);
      if (!existsSync(catDir)) continue;
      for (const f of readdirSync(catDir).filter(f => f.endsWith('.json'))) {
        try { all.push(JSON.parse(readFileSync(join(catDir, f), 'utf8'))); } catch (e) { console.warn(`coordinate: failed to parse experience ${f}:`, e.message); }
      }
    }
    if (all.length > 0) {
      console.log('**相关团队经验**:\n');
      for (const exp of all.slice(0, 3)) {
        console.log(`  - [${exp.category}] ${exp.content}`);
      }
    }
  }
}
