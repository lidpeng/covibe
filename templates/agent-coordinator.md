# Agent 智能分工模板 (Agent Coordinator)

## 设计理念

利用 AI Agent 的代码理解能力，结合团队成员画像，自动推荐任务分配方案。
不是取代人的判断，而是提供数据驱动的建议。

## 成员画像

### 画像结构

`.teamwork/profiles/{name}.json`：

```json
{
  "name": "Bob",
  "role": "后端开发",
  "skills": {
    "primary": ["python", "fastapi", "mysql"],
    "secondary": ["redis", "docker", "react"],
    "learning": ["kubernetes"]
  },
  "recent_modules": [
    {
      "path": "backend/app/api/",
      "last_touched": "2026-03-27",
      "commit_count": 15
    },
    {
      "path": "backend/app/services/agent_tools.py",
      "last_touched": "2026-03-25",
      "commit_count": 8
    }
  ],
  "preferences": {
    "work_style": "深度专注型，擅长复杂逻辑，不适合频繁切换",
    "preferred_task_size": "medium_to_large",
    "time_zone": "UTC+8",
    "available_hours": "10:00-19:00"
  },
  "current_load": {
    "active_tasks": 2,
    "estimated_hours_remaining": 8
  },
  "track_record": {
    "completed_tasks": 47,
    "avg_completion_rate": 0.92,
    "strong_areas": ["API 设计", "数据库优化"],
    "growth_areas": ["前端交互", "测试覆盖"]
  }
}
```

### 自动生成画像

Agent 可通过 git log 分析自动生成初始画像：

```bash
# 分析某成员最近 30 天的活跃模块
git log --author="Bob" --since="30 days ago" --name-only --pretty=format:"" | \
  sort | uniq -c | sort -rn | head -10

# 分析某成员的技术栈偏好（通过文件扩展名）
git log --author="Bob" --since="90 days ago" --name-only --pretty=format:"" | \
  grep -oE '\.[^.]+$' | sort | uniq -c | sort -rn

# 分析提交频率和时间分布
git log --author="Bob" --since="30 days ago" --format="%H %ai" | \
  awk '{print $2, $3}' | cut -d: -f1 | sort | uniq -c
```

## 分工算法

### 输入

```
task_description: string      # 任务描述
task_files: string[]          # 涉及文件（可选）
team_profiles: Profile[]      # 团队成员画像
codebase_structure: object    # 代码库结构
```

### 处理流程

```
1. 任务拆解
   - 分析任务描述 → 提取子任务
   - 分析文件依赖 → 确定模块边界
   - 识别子任务���依赖（串行/并行）

2. 技能需求分析
   对每个子任务：
   - 涉及哪些技术栈？（前端/后端/数据库/DevOps）
   - 涉及哪些模块？（路径匹配）
   - 难度评估（代码量/复杂度/风险）

3. 人员匹配打分
   对每个 (子任务, 成员) 组合：
   score = skill_match * 40      # 技能匹配（primary=1.0, secondary=0.6, learning=0.3）
         + module_familiarity * 30 # 模块熟悉度（git blame 占比）
         + load_balance * 20       # 负载均衡（当前负载越低分越高）
         + growth_opportunity * 10 # 成长机会（learning 技能加分）

4. 最优��配
   - 贪心算法：按子任务优先级排序，每次分配给最高分的可用成员
   - 约束：每人不超过 max_tasks_per_person
   - 平衡检查：确保无人空闲、无人过载

5. 依赖排序
   - 拓扑排序确定执行顺序
   - 标注可并行的子任务
   - 估算关键路径耗时
```

### 输出格式

```markdown
## 分工方案：{任务标题}
日期: {YYYY-MM-DD}
分析者: Harness Coordinator Agent

### 任务概要
{一句话描述}

### 子任务分配

| # | 子任务 | 分配给 | 匹配度 | 理由 | 依赖 | 估时 |
|---|--------|--------|--------|------|------|------|
| 1 | ... | ... | 95% | ... | 无 | 2h |
| 2 | ... | ... | 88% | ... | #1 | 4h |

### 执行时序

```
第 1 阶段 (并行)：
  Bob  → #1 后端 API
  Alice → #3 前端组件

第 2 阶段 (串行，依赖第 1 阶段)：
  Charlie → #2 数据库迁移

第 3 阶段 (并行)：
  Bob → #4 集成测试
  Alice → #5 UI 联调
```

### 风险提示
- {风险描述及缓解建议}

### 相关团队经验
- {自动注入匹配到的经验}

### 沟通建议
- {谁需要和谁对齐接口}
- {哪些决策需要全员讨论}
```

## 分工记录

### current.json

```json
{
  "task": "任务标题",
  "created": "2026-03-28T10:00:00Z",
  "created_by": "team-lead",
  "status": "active",
  "assignments": [
    {
      "subtask_id": 1,
      "subtask": "后端 API 开发",
      "assignee": "Bob",
      "status": "in_progress",
      "started": "2026-03-28T10:30:00Z",
      "estimated_hours": 4
    }
  ],
  "dependencies": [[2, 1], [4, 1]],
  "notes": ""
}
```

### 分工更新

任务进行中可以更新分工：
- 某人提前完成 → 重新分配空闲成员
- 某人遇到阻塞 → 调整依赖或换人
- 新增子任务 → 追加分配

每次更新记录变更原因，之前的方案归档到 `history/`。
