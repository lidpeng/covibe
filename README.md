<p align="center"><img src="docs/logo.png" width="800" alt="covibe logo"></p>

# covibe

> **Co-Vibe — 多人 Vibe Coding 协作工具链**

🌐 [English](README.en.md)

[![npm version](https://img.shields.io/npm/v/covibe.svg)](https://www.npmjs.com/package/covibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一群人，各自带着自己的 AI，一起 vibe coding。
covibe 让每个人的 AI 都知道队友在干什么、做了什么决策、踩了什么坑。

![covibe 首页截图](docs/main_page.png)

## 安装

```bash
npm install -g covibe
```

### Claude Code 原生集成

covibe 同时也是一个 **Claude Code Skill**，安装后在 Claude Code 对话中直接输入：

```
/covibe init          # AI 自动调用 covibe CLI 完成初始化
/covibe audit         # AI 运行审计并给出改进建议
/covibe board add     # AI 帮你添加任务到看板
```

所有 covibe 命令都能在 Claude Code 里通过 `/covibe` 直接调用，不用切换到终端。

### Cursor / Windsurf 支持

```bash
covibe cross-ide cursor     # 自动从 CLAUDE.md 生成 .cursorrules
covibe cross-ide windsurf   # 自动生成 .windsurfrules
covibe cross-ide all        # 全部生成
```

团队成员用不同 IDE？没关系，covibe 保证规则一致。

## 30 秒上手

```bash
cd your-project
covibe init           # 自动探测技术栈 → 一键生成完整 AI 工作环境
covibe audit          # 审计你的 AI 工作环境健康度（100 分制）
covibe team init      # 开启团队协作模式
covibe sync start     # 启动实时同步（局域网 P2P）
```

---

## 多人协作完整指南

### 第一步：主机初始化（团队中任一人操作）

```bash
cd your-project

# 1. 初始化 harness（自动探测技术栈 + 注册全局 sync hook）
covibe init

# 2. 初始化团队协作层（生成团队配置、成员画像、经验板）
covibe team init

# 3. 设置你的身份（持久化到 ~/.zshrc）
echo 'export HARNESS_SYNC_USER="你的名字"' >> ~/.zshrc
source ~/.zshrc

# 4. 提交团队配置到 Git
git add .claude/harness.team.json .teamwork/ scripts/setup-dev.sh .gitignore
git commit -m "chore: 初始化 covibe 团队协作层"
git push
```

### 第二步：启动协作服务（主机上运行）

```bash
# 启动 sync server（WebSocket 服务，后台常驻）
covibe sync start &

# 启动 Dashboard（自动读取 HARNESS_SYNC_USER）
covibe dashboard &

# 查看你的内网 IP
ifconfig | grep 'inet ' | grep -v 127.0.0.1
```

启动后会打印完整 URL（已包含你的身份），直接点击打开即可：
```
  📺 打开浏览器: http://localhost:3457?server=localhost:3456&name=你的名字
  👤 当前身份: 你的名字
```

身份首次通过 URL 设置后会保存在浏览器 localStorage，之后直接访问 `http://localhost:3457` 即可。

### 第三步：队友加入

队友需要完成以下步骤：

```bash
# 1. 安装 covibe
npm install -g covibe

# 2. 拉取最新代码（获取团队配置）
git pull

# 3. 初始化本地环境（自动注册全局 sync hook）
covibe init

# 4. 设置身份
echo 'export HARNESS_SYNC_USER="队友名字"' >> ~/.zshrc
source ~/.zshrc

# 5. 新人引导（检查环境、了解项目）
covibe team onboard

# 6. 重启 Claude Code 会话（让 sync hook 生效）
```

队友打开 Dashboard 即可看到所有人状态（首次需指定 server 为主机 IP）：

```
http://主机IP:3457?server=主机IP:3456
```

身份自动从 `HARNESS_SYNC_USER` 读取，无需在 URL 中重复指定。

### 工作原理

```
┌─────────────────────────────────────────────────────┐
│  Sync Server (:3456)                                │
│  ┌───────────────────────────────────────────────┐  │
│  │ WebSocket 持久连接（ws 库 ping/pong 保活）    │  │
│  │ • Dashboard 浏览器 ←→ Server                  │  │
│  │ • 连接保持到 tab 关闭，不会因空闲断开         │  │
│  ├───────────────────────────────────────────────┤  │
│  │ HTTP POST（Claude Code hook 上报）            │  │
│  │ • 每次 Edit/Write → POST /broadcast           │  │
│  │ • 编辑状态 60 秒无更新自动清除                │  │
│  ├───────────────────────────────────────────────┤  │
│  │ REST API                                      │  │
│  │ • GET /status — 在线成员 + 编辑状态           │  │
│  │ • GET /since?ts= — 增量消息                   │  │
│  │ • POST /broadcast — 广播消息                  │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  Dashboard (:3457) — 静态页面 + WebSocket 客户端    │
│  • 实时显示谁在线、谁在编辑哪个文件               │
│  • 团队聊天、任务看板、经验板、决策记录           │
│  • 身份保存在 localStorage，下次打开自动登录       │
└─────────────────────────────────────────────────────┘

┌──────────┐  PostToolUse Hook    ┌──────────┐
│ Claude   │ ─── Edit/Write ───→  │ curl     │ ──→ POST /broadcast
│ Code     │  (sync-edit-hook.sh) │          │     {"type":"editing",
│          │                      └──────────┘      "name":"Dapeng",
└──────────┘                                        "file":"src/App.tsx"}
```

### 常见问题

**Q: Dashboard 显示"已断开"？**
- 检查 sync server 是否在运行：`curl http://localhost:3456/status`
- Cmd+Shift+R 强制刷新浏览器

**Q: Claude Code 编辑文件但 Dashboard 显示空闲？**
- Sync hook 需要在 `~/.claude/settings.json` 中注册
- 运行 `covibe init` 会自动注册
- 修改 settings.json 后需要**重启 Claude Code 会话**

**Q: 队友连不上 sync server？**
- 确认在同一局域网内
- 检查防火墙是否开放 3456 和 3457 端口
- 用 `curl http://主机IP:3456/status` 测试连通性

**Q: 编辑状态一直不消失？**
- 正常行为：60 秒无更新会自动清除
- 如果持续编辑同一文件，状态会一直保持

---

## 为什么需要 covibe

### 没有 covibe 的世界

Alice（PM）用 Cursor，Bob（开发）用 Claude Code，Charlie（前端）用 Windsurf。三个人在一个项目上 vibe coding：

- Alice 让 AI 删了登录页的手机号验证，Bob 不知道又加回来了
- Bob 踩了一个 MySQL 大表迁移的坑，花了 3 小时才搞定。下周 Charlie 遇到同样的问题，又花了 3 小时
- 新来的实习生 David 打开项目，AI 一头雾水，不知道项目规范、不知道怎么跑测试、不知道提交格式
- Alice 和 Charlie 同时改 Header.tsx，合并时发现冲突，两边的 AI 各自都觉得自己改对了

### 有 covibe 的世界

```
covibe init           → David 的 AI 瞬间了解整个项目
covibe team init      → 团队规则自动同步给每个人的 AI
covibe sync start     → 实时知道谁在改什么文件
covibe experience add → Bob 的踩坑经验自动提醒 Charlie
covibe coordinate     → AI 分析谁最适合做什么任务
```

---

## 不只是多人协作 — 也支持单人多设备

你可能不在团队里，但你有两台电脑：公司一台台式机，通勤路上一台笔记本。两边都跑 Claude Code，改同一个项目。

**没有 covibe**：
- 台式机上让 AI 改了一半，切到笔记本继续，AI 完全不知道之前做了什么
- 两边各自 commit，回来一堆冲突
- 踩了一个坑，下次换设备又忘了

**有 covibe**：
```bash
# 台式机启动 sync server（后台跑着就行）
covibe sync start &

# 笔记本连过来
export HARNESS_SYNC_SERVER="http://台式机IP:3456"

# 两台设备的 AI 自动同步：
# - 台式机改了什么文件，笔记本的 AI 知道
# - 踩坑经验两边共享
# - 任务看板两边同步
```

一个人也值得用 covibe —— 把它当作你所有设备上 AI 的共享大脑。

---

## 真实使用案例

### 案例 1：新人 10 分钟上手

**场景**：David 入职第一天，项目是 FastAPI + React 全栈。

```bash
# David 运行一条命令
covibe team onboard

# covibe 自动完成：
# ✓ 安装开发环境依赖
# ✓ 创建个人配置（不影响团队设置）
# ✓ 生成成员画像
# ✓ 注入团队经验板 top-10 经验
# ✓ AI 自动了解：技术栈、构建命令、代码规范、质量红线
```

David 的 AI 第一次对话就知道：项目用 FastAPI + React 19，commit 要用中文语义化前缀，禁止 force push，MySQL 大表 ALTER 要用 pt-online-schema-change。

### 案例 2：防止决策互相覆盖

**场景**：Alice 上午决定把按钮改成圆角，下午 Bob 不知情又改回直角。

```
Alice 编辑 Button.tsx → covibe 广播: "alice 正在编辑 Button.tsx"
Alice commit → 决策记录: "按钮改为圆角，用户反馈直角太硬"

Bob 的 AI 准备改 Button.tsx：
  → PreToolUse hook 触发
  → "⚠️ alice 最近修改了 Button.tsx，她决定把按钮改为圆角（原因：用户反馈）"
  → Bob 的 AI 主动告知 Bob 这个上下文，避免冲突
```

### 案例 3：踩坑经验自动传递

**场景**：Bob 花 3 小时解决了 Redis 连接池问题。

```bash
# Bob 记录经验
covibe experience add "Redis 连接池 max_connections 不要超过 50，否则 OOM" \
  --category performance --tags redis,connection-pool

# 两周后 Charlie 接到 Redis 优化任务
# covibe 自动注入：
## 团队经验（供参考）
# - [performance/bob] Redis 连接池 max_connections 不要超过 50 👍3
# - [performance/alice] Redis 缓存 TTL 建议 5 分钟，太长会导致数据不一致 👍2
```

Charlie 的 AI 直接就知道了上限是 50，不用再踩一次坑。

### 案例 4：AI 帮你分工

**场景**：团队接到一个新功能——"给平台添加 Slack 集成"。

```bash
covibe coordinate "添加 Slack 集成：OAuth 认证 + 消息收发 + Webhook"

## 分工建议

| # | 子任务 | 分配给 | 匹配度 | 理由 |
|---|--------|--------|--------|------|
| 1 | OAuth 认证流程 | Bob | 95% | 上个月刚做过飞书 OAuth，代码在 backend/app/services/ |
| 2 | Slack API 消息收发 | Charlie | 88% | 熟悉 WebSocket，最近在改 channel 模块 |
| 3 | Webhook 端点 | Bob | 90% | API 路由他最熟，git blame 占比 60% |
| 4 | 前端配置页面 | Alice | 92% | React 专家，刚做完类似的飞书配置页 |

### 团队经验提醒
- [backend/bob] IM 集成要统一走 channel_config 表，别单独建表
```

### 案例 5：实时协作不踩脚

**场景**：Alice 和 Charlie 同时在线开发。

```bash
# Alice 的终端
covibe sync status
# → 项目: clawith | 在线: 3
# → 成员: alice, bob, charlie
# → 当前编辑:
# →   charlie → frontend/src/pages/Dashboard.tsx

# Alice 的 AI 准备改 Dashboard.tsx
# → ⚠️ charlie 正在编辑 Dashboard.tsx，注意协调！
# Alice 知道了，选择先做别的页面，等 Charlie 完成再改
```

---

## 全部功能

| 功能 | 命令 | 说明 |
|------|------|------|
| **一键初始化** | `covibe init` | 自动探测技术栈，生成 CLAUDE.md + 配置 + 工作流 |
| **健康审计** | `covibe audit` | 14 项检查，100 分制评分 |
| **团队初始化** | `covibe team init` | 创建团队配置、经验板、分工目录 |
| **新人引导** | `covibe team onboard` | 交互式引导 + setup 脚本 |
| **配置同步** | `covibe team sync` | 检测本地配置与团队规范的冲突 |
| **实时同步** | `covibe sync start` | P2P WebSocket 服务器（任一成员电脑上运行） |
| **同步状态** | `covibe sync status` | 查看谁在线、谁在改什么文件 |
| **添加经验** | `covibe experience add` | 记录团队经验（带分类、标签、作者） |
| **查看经验** | `covibe experience list` | 按类别和标签过滤经验 |
| **注入经验** | `covibe experience inject` | 为当前任务注入相关经验 |
| **智能分工** | `covibe coordinate "任务"` | 基于成员画像 + git blame 推荐分工 |
| **团队建议** | `covibe suggest send <人> "建议"` | 给队友发建议，接收方自主决定是否采纳 |
| **查看建议** | `covibe suggest inbox` | 查看收到的建议 |
| **采纳/跳过** | `covibe suggest accept/skip <id>` | 响应建议 || **生成模板** | `covibe template <type>` | 10 种模板随时查阅 |

---

## 安全模型

### 连接架构

```
局域网 (192.168.x.x)
┌──────────┐     WebSocket      ┌──────────┐
│ Alice     │◄──────────────────►│ Sync     │
│ + AI      │                    │ Server   │
└──────────┘                    │(Alice 的  │
                                │ 电脑)     │
┌──────────┐     WebSocket      │          │
│ Bob       │◄──────────────────►│ :3456    │
│ + AI      │                    └──────────┘
└──────────┘         │
                     │ HTTP REST (hooks)
                     └── curl /broadcast
```

### 安全设计

| 层面 | 措施 |
|------|------|
| **代码不经过 server** | sync 只传文件路径和决策摘要，代码通过 Git 管理 |
| **局域网** | 服务器监听 0.0.0.0 但只在局域网使用 |
| **无持久存储** | 服务端内存中只保留最近 100 条消息，重启即清空 |
| **项目隔离** | `--project` 参数隔离不同项目的消息 |
| **本地日志** | sync.jsonl 只写在本地 `.teamwork/live/`，gitignored |

### 数据流

| 传输内容 | 示例 | 包含代码？ |
|---------|------|-----------|
| 编辑状态 | `"alice 正在编辑 src/Header.tsx"` | 否，只有路径 |
| 决策摘要 | `"按钮改为圆角，原因：用户反馈"` | 否，只有摘要 |
| 经验记录 | `"Redis 连接池不超过 50"` | 否，只有结论 |
| 冲突警告 | `"bob 也在编辑 Header.tsx"` | 否 |

**底线：即使 sync server 被完全窃听，攻击者也只能看到谁在改什么文件，看不到任何代码内容。**

### 进阶安全（可选配置）

```bash
# 1. Token 认证（计划中）
covibe sync start --token "team-secret-2026"

# 2. TLS 加密（通过 nginx 反代）
# nginx 配置 wss:// → ws://localhost:3456

# 3. IP 白名单（计划中）
covibe sync start --allow-ips "192.168.1.100,192.168.1.101"
```

---

## 团队规则三级分离

| 级别 | 含义 | 能覆盖吗 | 示例 |
|------|------|---------|------|
| **enforced** | 团队铁律 | 不能 | 禁止 force push、禁止假数据、测试必须通过 |
| **recommended** | 团队推荐 | 可以 | 中文 commit、snake_case 命名 |
| **personal** | 个人偏好 | 随意 | 执行风格、模型选择、编辑器主题 |

---

## 极简依赖设计

- **CLI**: Node.js（>=18），仅依赖 `ws` 一个包
- **Sync Server**: `ws` 库处理 WebSocket 协议，兼容所有浏览器
- **Hook 脚本**: 纯 bash + curl + jq
- **数据格式**: JSON + Markdown，人可读、Git 可追踪
- **存储**: 文件系统，不需要数据库

---

## 支持的技术栈

自动探测引擎支持：

| 语言 | 框架 |
|------|------|
| **Node.js / TypeScript** | React, Next.js, Vue, Nuxt, Svelte, Express, NestJS |
| **Python** | FastAPI, Django, Flask |
| **Go** | 标准项目结构 |
| **Rust** | Cargo 项目 |
| **全栈** | frontend/ + backend/ 自动识别 |
| **Monorepo** | packages/ / apps/ + Turbo/Nx |

---

## 理论基础：Harness Engineering

covibe 不只是一个协作工具——它建立在 **Harness Engineering（工作台工程）** 这套完整的方法论之上。

> **核心理念**：Harness 不是智能本身，而是释放智能的工具链。同一个 AI 模型，差的 harness 产出平庸结果，好的 harness 产出专家级结果。大多数 AI Agent 失败是 harness 失败，不是模型失败。

### 三轴模型

covibe 围绕三个核心轴构建 AI 的工作环境：

| 轴 | 组成 | covibe 如何实现 |
|---|------|----------------|
| **工具 (Tools)** | MCP Servers、Shell 权限、CLI | `covibe init` 自动配置工具链 |
| **知识 (Knowledge)** | CLAUDE.md、经验板、记忆系统 | `covibe experience` 团队知识沉淀 |
| **权限 (Permissions)** | Hooks、团队规范、沙箱 | `harness.team.json` 三级规则分离 |

### 八大设计模式

| # | 模式 | 说明 | covibe 命令 |
|---|------|------|------------|
| 1 | **宪法模式** | CLAUDE.md 作为 AI 的结构化"宪法" | `covibe init` 自动生成 |
| 2 | **记忆分层** | L1 工作记忆 / L2 项目记忆 / L3 全局记忆 | 经验板 + 项目配置 + 全局 skill |
| 3 | **证据门禁** | 完成前必须提供可验证证据 | `covibe audit` 审计检查 |
| 4 | **钩子守卫** | Pre/Post/Stop hooks 运行时守卫 | sync-hook.sh 自动注入 |
| 5 | **Harness-First** | 先建工作台，再做实际工作 | `covibe init` → 先建再写 |
| 6 | **决策保护** | 人工决策 / AI 建议分级保护 | sync server 决策广播 |
| 7 | **共享经验板** | 零基建团队经验复用 | `covibe experience` |
| 8 | **Agent 智能分工** | 画像 + git blame 匹配 | `covibe coordinate` |
| 9 | **团队建议系统** | 发送自由，接收自主 | `covibe suggest` |
### 内置模板库

covibe 内置 10 种 Harness Engineering 模板，随时查阅：

```bash
covibe template claude-md      # CLAUDE.md 宪法模板
covibe template hooks          # 7 种 Hook 守卫模式
covibe template skill          # Skill 开发模板
covibe template workflow       # 开发工作流模板（4 种项目类型）
covibe template audit          # 审计检查清单（100 分制）
covibe template team           # 团队协作配置 + setup-dev.sh
covibe template experience     # 共享经验板设计
covibe template coordinator    # Agent 分工协调
covibe template sync           # P2P 实时同步文档
covibe template auto-detect    # 自动探测规则
```

## 致谢

- [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) — Harness 三轴模型
- [lazyFrogLOL/Harness_Engineering](https://github.com/lazyFrogLOL/Harness_Engineering) — 宪法模式、记忆分层
- [Disrush/teamvibe](https://github.com/Disrush/teamvibe) — 决策版本管理
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) — Hook 守卫、Skill 系统

## License

MIT
