# 实时同步模板 (Realtime Sync)

## 部署模式：P2P 主机模式（无需额外服务器）

团队中**任意一人**在自己电脑上启动 sync-server 即可，其他人连接过来。
Server 极其轻量（~5MB 内存），不影响正常开发。

```
Alice 的电脑 (192.168.1.100)        Bob 的电脑 (192.168.1.101)
┌────────────────────────┐          ┌────────────────────────┐
│  Claude Code (正常写代码) │          │  Claude Code (正常写代码) │
│  + sync hooks          │          │  + sync hooks          │
│                        │          │                        │
│  sync-server (:3456)   │◄─── WS ──┤  连接 Alice:3456       │
│  (后台运行，占用极少)    │          │                        │
└────────────────────────┘          └────────────────────────┘
```

**如果 Alice 下线了？** Bob 可以随时在自己电脑上启动 server 接替。
Server 无状态（历史消息会从 sync.jsonl 恢复），谁跑都一样。

## 快速开始（3 步）

### Step 1: Alice 启动 server（一条命令）

```bash
# Alice 在自己电脑上后台运行
nohup node ~/.claude/skills/harness/scripts/sync-server.mjs \
  --port 3456 --project clawith > /tmp/harness-sync.log 2>&1 &

# 确认启动成功
curl http://localhost:3456/status
# → {"project":"clawith","members":[],"active_edits":{},"online":0}
```

查看自己的内网 IP：
```bash
# macOS
ipconfig getifaddr en0    # → 192.168.1.100

# Linux
hostname -I | awk '{print $1}'
```

### Step 2: 所有人配置环境变量

**Alice（本机）**：
```bash
# 加到 ~/.zshrc 或 ~/.bashrc
export HARNESS_SYNC_SERVER="http://localhost:3456"
export HARNESS_SYNC_USER="alice"
```

**Bob（连接 Alice）**：
```bash
export HARNESS_SYNC_SERVER="http://192.168.1.100:3456"
export HARNESS_SYNC_USER="bob"
```

### Step 3: 项目中配置 Claude Code Hooks

在项目 `.claude/settings.json` 的 hooks 中添加（所有成员共享，提交到 git）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": "bash ~/.claude/skills/harness/scripts/sync-hook.sh check \"$TOOL_INPUT_FILE_PATH\""
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash ~/.claude/skills/harness/scripts/sync-hook.sh editing \"$TOOL_INPUT_FILE_PATH\""
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "bash ~/.claude/skills/harness/scripts/sync-hook.sh leave"
        }]
      }
    ]
  }
}
```

**搞定！** 现在 Alice 和 Bob 的 Claude Code 会自动：
- 编辑文件时广播状态
- 发现同时编辑同一文件时互相警告
- 下线时自动清理状态

## 日常使用

```bash
# 查看团队状态（任何人都可以跑）
bash ~/.claude/skills/harness/scripts/sync-hook.sh status
# → 项目: clawith | 在线: 2
# → 成员: alice, bob
# → 当前编辑:
# →   alice → src/pages/Dashboard.tsx

# 广播一条决策
bash ~/.claude/skills/harness/scripts/sync-hook.sh decision "移除Z方块" "用户反馈不喜欢"

# 广播一条经验
bash ~/.claude/skills/harness/scripts/sync-hook.sh experience "Redis连接池别超过50" "performance"
```

## 冲突检测工作原理

```
1. Alice 的 AI 编辑 Header.tsx
   → PostToolUse:Edit hook 触发
   → sync-hook.sh editing Header.tsx
   → server 记录: activeEdits["Header.tsx"] = {editor: "alice"}

2. Bob 的 AI 准备编辑 Header.tsx
   → PreToolUse:Edit hook 触发
   → sync-hook.sh check Header.tsx
   → curl /status → 发现 alice 在编辑
   → 输出: "⚠️ alice 正在编辑 Header.tsx，注意协调！"
   → Bob 的 AI 看到警告，可以选择：
     a) 等 Alice 完成再编辑
     b) 和 Alice 沟通后继续
     c) 编辑不同部分（自行判断）
```

## REST API（给自动化脚本和 CI 用）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/status` | 在线成员 + 编辑状态 |
| GET | `/since?ts=ISO时间` | 获取该时间后的新消息 |
| POST | `/broadcast` | 广播任意消息 |
| GET | `/` | 服务器信息 |

```bash
# CI 构建通过后通知团队
curl -X POST http://192.168.1.100:3456/broadcast \
  -H "Content-Type: application/json" \
  -d '{"type":"broadcast","name":"ci-bot","content":"✅ main 构建通过"}'
```

## 主机切换

如果 Alice 要下线，Bob 接替当主机：

```bash
# Bob 启动 server
node ~/.claude/skills/harness/scripts/sync-server.mjs --port 3456 --project clawith

# 所有人更新环境变量（或者约定一个固定 hostname）
export HARNESS_SYNC_SERVER="http://192.168.1.101:3456"
```

**更好的方式**：内网设一个固定 hostname（比如 `harness-sync.local`），DNS 指向当前主机。换人时只改 DNS，不改环境变量。

## 日志和回溯

所有同步消息持久化到项目的 `.teamwork/live/sync.jsonl`：
```jsonl
{"type":"joined","name":"alice","ts":"2026-03-28T10:00:00Z"}
{"type":"editing","name":"alice","file":"src/Header.tsx","ts":"2026-03-28T10:01:30Z"}
{"type":"conflict","file":"src/Header.tsx","other_editor":"bob","ts":"2026-03-28T10:02:15Z"}
{"type":"decision","name":"alice","what":"Header改为固定定位","why":"移动端体验","ts":"2026-03-28T10:05:00Z"}
```

## 零依赖设计

- **sync-server.mjs**: 纯 Node.js，零 npm 依赖（自实现 WebSocket 协议）
- **sync-hook.sh**: 纯 bash + curl
- **数据格式**: JSON
- **传输**: WebSocket（实时）+ HTTP REST（Hook 调用）
- **存储**: JSONL 文件（人可读、git 可追踪）

## 安全

- 仅限内网使用，不暴露公网
- 无认证（内网信任模型）
- 如需认证：server 前加 nginx + basic auth
