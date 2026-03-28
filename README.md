# covibe

> **Co-Vibe — 多人 Vibe Coding 协作工具链**

[![npm version](https://img.shields.io/npm/v/covibe.svg)](https://www.npmjs.com/package/covibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一群人，各自带着自己的 AI，一起 vibe coding。
covibe 让每个人的 AI 都知道队友在干什么、做了什么决策、踩了什么坑。

## 安装

```bash
npm install -g covibe
```

## 30 秒上手

```bash
cd your-project
covibe init           # 自动探测技术栈 → 一键生成 CLAUDE.md + 配置
covibe audit          # 审计你的 AI 工作环境健康度（100 分制）
covibe team init      # 开启团队协作模式
covibe sync start     # 启动实时同步（内网 P2P，无需服务器）
```

## 解决什么��题

**Alice 和 Bob 一起 vibe coding：**

| 没有 covibe | 有 covibe |
|-------------|-----------|
| Alice 让 AI 删了 Z 方块，Bob 不知道又加回来 | Bob 的 AI 自动知道 Alice ��决策，编辑前警告 |
| 两人同时改同一个文件，合并时冲突 | 实时检测编辑冲突，提前预警 |
| Bob 踩了个坑，Alice 下周又踩一遍 | 经验板自动记录，下次有人碰到自动提醒 |
| 新人来了不知道项目规范 | `covibe team onboard` 一键引导 |
| 每个人的 AI 配置不一样，质量参差不齐 | 团队铁律强制统一，个人偏好自由调整 |

## 命令

```bash
covibe init                    # 自动探测 → 一键初始化
covibe audit                   # 审计健康度（100 分制）

covibe team init               # 初始化团队协作层
covibe team onboard            # 新成员入驻
covibe team sync               # 同步配置，检测冲突

covibe sync start              # 启动 P2P 实时同步
covibe sync status             # 查看谁在线、谁在改什么

covibe experience add "..."    # 记录团队经验
covibe experience list         # 查看经验
covibe experience inject       # 注入相关经验

covibe coordinate "任务描述"    # Agent 智能分工

covibe template <type>         # 输出模板
```

## 核心特色

### 1. 自动探测，零配置

支持 Node.js / Python / Go / Rust / 全栈 / Monorepo，自动识别框架、命令、目录结构。

### 2. 团队三级规则

| 级别 | 含义 | 能覆盖吗 |
|------|------|---------|
| **enforced** | 团队铁律（质量红线、安全规则） | 不能 |
| **recommended** | 团队推荐 | 可以 |
| **personal** | 个人偏好 | 随意 |

### 3. 共享经验板

零基建（纯 JSON，随 Git 走），团队踩过的坑自动提醒下一个人。

```bash
covibe experience add "MySQL 大表 ALTER 用 pt-online-schema-change" --category db --author alice
```

### 4. P2P 实时同步

团队任一成员电脑上启动 sync server，其他人连接。零额外基建。

```bash
# Alice 启动
covibe sync start --port 3456 &

# Bob 连接
export HARNESS_SYNC_SERVER="http://alice-ip:3456"
```

自动实现：编辑状态广播、文件冲突检测、决策同步。

### 5. Agent 智能分工

基于成员画像 + git blame 分析，���动推荐任务分配。

### 6. 100 分制审计

14 项检���覆盖知识、工具、权限、记忆、质量、团队六个维度。

## 设计理念

**Harness 三轴模型** — 工具（行动能力）× 知识（认知能力）× 权限（行为边界）

**��大模式** — 宪法模式、记忆分层、证据门禁、钩子守卫、Harness-First、决策保护、共享经验板、Agent 智能分工

## 致谢

- [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) — 三轴模型
- [lazyFrogLOL/Harness_Engineering](https://github.com/lazyFrogLOL/Harness_Engineering) — 宪法模式
- [Disrush/teamvibe](https://github.com/Disrush/teamvibe) — 决策版本管理
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) — Hook 系统

## License

MIT
