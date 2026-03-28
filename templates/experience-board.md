# 共享经验板模板 (Shared Experience Board)

## 设计理念

零基建的团队经验复用系统。不需要向量数据库，纯 JSON + Markdown，随 Git 分发。

核心假设：团队经验通常不超过几百条，暴力匹配 tag + category 已经足够。

## 数据结构

### index.json — 经验索引

```json
{
  "version": "1.0",
  "total_count": 0,
  "categories": {
    "frontend": { "count": 0, "description": "前端开发经验" },
    "backend": { "count": 0, "description": "后端开发经验" },
    "db": { "count": 0, "description": "数据库经验" },
    "deploy": { "count": 0, "description": "部署运维经验" },
    "debug": { "count": 0, "description": "调试排错经验" },
    "performance": { "count": 0, "description": "性能优化经验" },
    "security": { "count": 0, "description": "安全相关经验" },
    "workflow": { "count": 0, "description": "工作流程经验" },
    "tool": { "count": 0, "description": "工具使用经验" }
  },
  "last_updated": ""
}
```

### 单条经验记录

`.teamwork/experiences/{category}/{id}.json`：

```json
{
  "id": "exp_{timestamp}_{seq}",
  "content": "经验描述（一句话，清晰可执行）",
  "detail": "详细说明（可选，Markdown 格式）",
  "category": "db",
  "tags": ["mysql", "migration", "alter-table"],
  "author": "alice",
  "source_task": "来源任务描述",
  "created": "2026-03-28",
  "upvotes": 0,
  "upvoted_by": [],
  "applicable_to": {
    "file_patterns": ["**/migrations/**", "**/models/**"],
    "tech_tags": ["mysql", "sqlalchemy"]
  }
}
```

### 经验匹配算法

```
输入：当前任务描述 + 涉及文件路径

匹配步骤：
1. 提取任务关键词 → 匹配 tags
2. 提取文件路径 → 匹配 applicable_to.file_patterns
3. 提取技术栈标签 → 匹配 applicable_to.tech_tags
4. 计算综合得分 = tag_match * 3 + path_match * 2 + tech_match * 1 + upvotes * 0.5
5. 按得分降序排列，取 top-N
```

## 经验生命周期

```
发现经验 → add → 团队可见 → upvote → 优先级提升
                                    → 6个月无 upvote → 标记为 stale
                                    → archive → 移入 .archive/
```

## 经验质量标准

好的经验：
- 一句话说清楚要干什么
- 包含具体的技术细节（命令、参数、配置值）
- 标注适用场景（什么时候该用、什么时候不该用）

坏的经验：
- "注意性能" ← 太模糊
- "数据库要小心" ← 没有可操作建议
- 整段代码 ← 应该放在文档里而非经验板

## 自动注入时机

| 场景 | 触发 | 注入方式 |
|------|------|---------|
| 开始新任务 | 用户描述任务 | 匹配相关经验，显示在回复开头 |
| 编辑特定文件 | PostToolUse:Edit | 匹配文件路径相关经验 |
| 新人首次开发 | onboard 完成后 | 注入该模块 top-10 经验 |
| git pull 后 | post-pull | 注入新增的团队经验 |

## 与 TeamVibe 决策记录的区别

| | 经验板 | 决策记录 |
|---|--------|---------|
| **记录什么** | 可复用的技术经验 | 一次性的业务决策 |
| **生命周期** | 长期有效 | 可能被 supersede |
| **冲突检测** | 不需要 | 核心功能 |
| **谁写** | 任何人 | commit 时自动生成 |
| **保护级别** | 建议参考 | 人工决策需沟通后才能推翻 |

两者互补：经验板管"怎么做"，决策记录管"为什么这样做"。
