/**
 * covibe profile-gen — 从 git log 自动生成成员画像
 */
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function shellEscape(s) { return "'" + s.replace(/'/g, "'\\''") + "'"; }

export async function profileGen(cwd, args) {
  const name = args[0] || execSync('git config user.name', { cwd, encoding: 'utf8' }).trim();
  if (!name) { console.log('用法: covibe profile-gen [名字]（默认用 git config user.name）'); return; }

  console.log(`🔍 分析 ${name} 的 git 历史...\n`);

  // 1. 最活跃的模块（最近 90 天）
  let recentModules = [];
  try {
    const raw = execSync(
      `git log --author=${shellEscape(name)} --since="90 days ago" --name-only --pretty=format:"" -- . | grep -v '^$' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -8`,
      { cwd, encoding: 'utf8' }
    ).trim();
    recentModules = raw.split('\n').filter(Boolean).map(line => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      return match ? { path: match[2], commit_count: parseInt(match[1]) } : null;
    }).filter(Boolean);
  } catch {}

  // 2. 技能推断（通过文件扩展名）
  let skillMap = {};
  try {
    const raw = execSync(
      `git log --author=${shellEscape(name)} --since="90 days ago" --name-only --pretty=format:"" -- . | grep -v '^$' | grep -oE '\\.[^.]+$' | sort | uniq -c | sort -rn`,
      { cwd, encoding: 'utf8' }
    ).trim();
    for (const line of raw.split('\n').filter(Boolean)) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) skillMap[match[2]] = parseInt(match[1]);
    }
  } catch {}

  const extToSkill = {
    '.py': 'python', '.ts': 'typescript', '.tsx': 'react', '.js': 'javascript',
    '.jsx': 'react', '.vue': 'vue', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.sql': 'sql', '.css': 'css', '.scss': 'css', '.html': 'html',
    '.sh': 'shell', '.yml': 'devops', '.yaml': 'devops', '.dockerfile': 'docker',
    '.md': 'documentation',
  };

  const skills = {};
  for (const [ext, count] of Object.entries(skillMap)) {
    const skill = extToSkill[ext];
    if (skill) skills[skill] = (skills[skill] || 0) + count;
  }
  const sorted = Object.entries(skills).sort((a, b) => b[1] - a[1]);
  const primary = sorted.slice(0, 3).map(([s]) => s);
  const secondary = sorted.slice(3, 6).map(([s]) => s);

  // 3. 提交频率
  let totalCommits = 0;
  try {
    totalCommits = parseInt(execSync(
      `git log --author=${shellEscape(name)} --since="90 days ago" --oneline | wc -l`,
      { cwd, encoding: 'utf8' }
    ).trim());
  } catch {}

  // 4. 工作时间分布
  let peakHour = '未知';
  try {
    const raw = execSync(
      `git log --author=${shellEscape(name)} --since="30 days ago" --format="%H" | sort | uniq -c | sort -rn | head -1`,
      { cwd, encoding: 'utf8' }
    ).trim();
    const match = raw.match(/^\s*\d+\s+(\d+)/);
    if (match) peakHour = `${match[1]}:00`;
  } catch {}

  // 5. 生成画像
  const profile = {
    name,
    role: primary[0] === 'react' || primary[0] === 'vue' ? '前端开发' :
          primary[0] === 'python' || primary[0] === 'go' ? '后端开发' : '全栈开发',
    skills: { primary, secondary },
    recent_modules: recentModules.slice(0, 5),
    stats: {
      commits_90d: totalCommits,
      peak_hour: peakHour,
    },
    preferences: {},
    current_load: { active_tasks: 0 },
    generated: new Date().toISOString().slice(0, 10),
    auto_generated: true,
  };

  // 保存
  const profileDir = join(cwd, '.teamwork/profiles');
  mkdirSync(profileDir, { recursive: true });
  const fileName = name.toLowerCase().replace(/\s+/g, '_') + '.json';
  writeFileSync(join(profileDir, fileName), JSON.stringify(profile, null, 2));

  // 输出
  console.log(`  👤 ${name}`);
  console.log(`  🎭 角色: ${profile.role}`);
  console.log(`  🎯 主要技能: ${primary.join(', ') || '未检测到'}`);
  console.log(`  🎸 次要技能: ${secondary.join(', ') || '无'}`);
  console.log(`  📊 最近 90 天: ${totalCommits} 次提交`);
  console.log(`  ⏰ 高峰时间: ${peakHour}`);
  if (recentModules.length > 0) {
    console.log(`  📁 活跃模块:`);
    for (const m of recentModules.slice(0, 4)) {
      console.log(`     ${m.path} (${m.commit_count} commits)`);
    }
  }
  console.log(`\n  ✅ 画像已保存: .teamwork/profiles/${fileName}`);
}
