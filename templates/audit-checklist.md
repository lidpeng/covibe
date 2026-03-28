# Harness 审计检查清单 (Audit Checklist)

## 评分规则

- **必须项** (MUST): 缺失 = FAIL，扣 15 分
- **推荐项** (SHOULD): 缺失 = WARN，扣 8 分
- **可选项** (MAY): 缺失 = INFO，扣 3 分
- 满分 100 分

## 评级标准

| 分数 | 等级 | 含义 |
|------|------|------|
| 90-100 | 健康 (HEALTHY) | Harness 完善，可高效协作 |
| 70-89 | 良好 (GOOD) | 基本可用，有改进空间 |
| 50-69 | 需改进 (NEEDS WORK) | 关键组件缺失，影响效率 |
| <50 | 危险 (CRITICAL) | Harness 严重不足，建议重建 |

---

## 检查项

### 一、知识轴 (Knowledge) — 40 分

#### K1. CLAUDE.md 存在 [MUST, 15分]
- [ ] 项目根目录有 `CLAUDE.md` 或 `.claude/CLAUDE.md`
- 检查方法: `ls CLAUDE.md .claude/CLAUDE.md 2>/dev/null`

#### K2. CLAUDE.md 结构化 [MUST, 15分]
- [ ] 包含技术栈信息
- [ ] 包含构建/运行命令
- [ ] 包含项目结构描述
- [ ] 包含开发约定
- 检查方法: 读取 CLAUDE.md，检查是否有对应章节标题

#### K3. 构建命令可执行 [MUST, 15分]
- [ ] 文档化的构建命令在当前环境下可执行
- [ ] 测试命令在当前环境下可执行
- 检查方法: 尝试运行命令（dry-run 模式）

#### K4. 项目结构准确 [SHOULD, 8分]
- [ ] CLAUDE.md 中的目录结构与实际一致
- [ ] 关键文件路径正确
- 检查方法: 对比 CLAUDE.md 描述与 `ls` 输出

#### K5. 知识库存在 [MAY, 3分]
- [ ] 有 `docs/` 或类似知识目录
- [ ] 有文档命名规范
- 检查方法: `ls docs/ 2>/dev/null`

### 二、工具轴 (Tools) — 25 分

#### T1. 开发工作流 Skill [SHOULD, 8分]
- [ ] `.claude/skills/` 下有开发工作流 skill
- [ ] Skill 包含 Plan → Implement → Verify → Fix 循环
- 检查方法: `ls .claude/skills/ 2>/dev/null`

#### T2. 测试命令文档化 [MUST, 15分]
- [ ] 有明确的测试运行命令
- [ ] 有冒烟测试或快速验证脚本
- 检查方法: 检查 CLAUDE.md 中是否有测试命令

#### T3. MCP 配置 [MAY, 3分]
- [ ] 如项目需要额外工具，有 MCP 配置
- 检查方法: 检查是否有 MCP 相关配置文件

### 三、权限轴 (Permissions) — 15 分

#### P1. settings.local.json [SHOULD, 8分]
- [ ] `.claude/settings.local.json` 存在
- [ ] 配置了合理的 allowedTools
- 检查方法: `cat .claude/settings.local.json 2>/dev/null`

#### P2. 敏感操作守卫 [SHOULD, 8分]
- [ ] 有 hooks 或 CLAUDE.md 规则保护危险操作
- [ ] git push、数据库操作等有守卫
- 检查方法: 检查 settings.json 中的 hooks 配置和 CLAUDE.md 中的安全规则

### 四、记忆轴 (Memory) — 10 分

#### M1. 项目记忆 [MAY, 3分]
- [ ] `.omc/project-memory.json` 或类似记忆文件存在
- 检查方法: `ls .omc/project-memory.json 2>/dev/null`

#### M2. 全局记忆有项目条目 [MAY, 3分]
- [ ] `~/.claude/projects/` 下有当前项目的记忆
- 检查方法: 检查全局记忆目录

### 五、质量轴 (Quality) — 10 分

#### Q1. 质量门禁规则 [MUST, 15分]
- [ ] CLAUDE.md 中有明确的质量红线
- [ ] 有验证流程描述
- 检查方法: 检查 CLAUDE.md 中是否有"质量"、"红线"、"验证"相关内容

#### Q2. 验证自动化 [SHOULD, 8分]
- [ ] 有自动化验证脚本（smoke test 等）
- [ ] 工作流 skill 中有验证步骤
- 检查方法: 检查是否有 smoke-test.sh 或类似脚本

---

## 审计报告模板

```markdown
## Harness Audit Report

**项目**: {项目名}
**日期**: {YYYY-MM-DD}
**总分**: {X}/100 ({等级})

### 检查结果

| # | 维度 | 检查项 | 状态 | 得分 | 备注 |
|---|------|--------|------|------|------|
| K1 | 知识 | CLAUDE.md 存在 | PASS/FAIL | /15 | |
| K2 | 知识 | CLAUDE.md 结构化 | PASS/FAIL | /15 | |
| K3 | 知识 | 构建命令可执行 | PASS/FAIL | /15 | |
| K4 | 知识 | 项目结构准确 | PASS/WARN | /8 | |
| K5 | 知识 | 知识库存在 | PASS/INFO | /3 | |
| T1 | 工具 | 工作流 Skill | PASS/WARN | /8 | |
| T2 | 工具 | 测试命令文档化 | PASS/FAIL | /15 | |
| T3 | 工具 | MCP 配置 | PASS/INFO | /3 | |
| P1 | 权限 | settings.local.json | PASS/WARN | /8 | |
| P2 | 权限 | 敏感操作守卫 | PASS/WARN | /8 | |
| M1 | 记忆 | 项目记忆 | PASS/INFO | /3 | |
| M2 | 记忆 | 全局记忆条目 | PASS/INFO | /3 | |
| Q1 | 质量 | 质量门禁规则 | PASS/FAIL | /15 | |
| Q2 | 质量 | 验证自动化 | PASS/WARN | /8 | |

### 改进建议（按优先级）
1. [CRITICAL] {必须项缺失的修复建议}
2. [RECOMMENDED] {推荐项的改进建议}
3. [OPTIONAL] {可选项的增强建议}
```
