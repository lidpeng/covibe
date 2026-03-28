# CLAUDE.md - Covibe Project Guidelines

## Execution Style

- **默认全速执行** — 收到任务后直接执行，不需要反复确认
- **只在以下情况暂停询问**：高风险操作（删库、force push、生产配置）、架构方向不确定、需求有歧义
- **其他时候不要停** — 代码风格、文件位置、方案选择，自行判断，保证安全、高效、专业
- 优先选择最简单直接的方案，避免过度工程化

## Quality Red Lines

- **禁止半成品功能** — 每个功能必须端到端可用。有后端 API 就必须有实际执行逻辑；有前端页面就必须对接后端且真正能用。宁可功能少但完整，不要好看但不能用
- **禁止假数据** — 不要在前端硬编码假的浏览量、评论数、用户数。如果后端 API 还没有，要么先建 API，要么不显示。假数据比没数据更糟糕
- 如果某个功能因依赖/复杂度无法完成，明确标注哪些是占位，给出预计完成时间

## Git Workflow

- **每个功能/修复必须单独 commit**，不要把多个不相关的改动合并到一个 commit
- 每个子任务/功能变更完成后立即 `git commit`（无需用户确认）
- Commit message 格式：语义化前缀 + 简要中文描述
- Types: feat, fix, refactor, docs, test, chore, perf, ci, security
- 保持原子化提交，不要合并不相关的改动
- **不要自动 push** — push 需要用户明确指示

## Development Rules

- 修改代码前先读懂现有逻辑
- 所有 `JSON.parse` 必须有 try-catch 保护
- `parseInt()` 必须传入 radix 参数并校验 NaN
- 用户输入拼接到 shell 命令时必须转义（使用 shellEscape）
- HTTP 请求体必须限制大小
- 文件读写操作需要错误处理，不允许空 catch 块
- 环境变量用作 URL 时必须校验协议

## Security Checklist

- [ ] 无硬编码密钥（API keys, passwords, tokens）
- [ ] 所有用户输入已校验
- [ ] Shell 命令参数已转义
- [ ] HTTP 端点有认证保护
- [ ] 请求体有大小限制
- [ ] WebSocket 帧有大小限制
- [ ] 错误信息不泄露敏感数据

## Architecture

- **技术栈**: Node.js >= 18, ESM modules (.mjs)
- **CLI**: bin/covibe.mjs — 入口命令路由
- **核心库**: lib/*.mjs — 各功能模块（board, experience, team, etc.）
- **同步服务**: scripts/sync-server.mjs — WebSocket + REST 实时协作
- **Dashboard**: dashboard/index.html — 单文件前端，纯 HTML/CSS/JS
- **项目数据**: .teamwork/ — 团队配置、看板、经验、决策等
- **同步协议**: WebSocket 消息 + POST /broadcast 中转，类型无关
