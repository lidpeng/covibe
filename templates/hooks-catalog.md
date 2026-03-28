# Hooks 模式目录 (Hook Patterns Catalog)

Hooks 是 harness 的运行时守卫层，在 Agent 工具调用前后注入上下文、验证和自动化。

## 配置位置

```
~/.claude/settings.json          → 全局 hooks
.claude/settings.json            → 项目级 hooks
.claude/settings.local.json      → 本地开发 hooks（不提交 git）
```

## Hook 类型

| 类型 | 触发时机 | 常见用途 |
|------|---------|---------|
| PreToolUse | 工具调用前 | 上下文注入、安全拦截、参数验证 |
| PostToolUse | 工具调用后 | 日志记录、质量检查、副作用 |
| Stop | Agent 准备停止时 | 完成验证、遗漏检测 |
| SubagentStop | 子 Agent 完成时 | 交付物验证 |

---

## 模式 1：上下文注入 (Context Injection)

在特定工具调用前注入相关提示，无需塞进 CLAUDE.md。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "echo '提示：优先用并行执行，长操作用 run_in_background'"
        }]
      },
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": "echo '提示：修改后验证功能正常，标记完成前先测试'"
        }]
      }
    ]
  }
}
```

## 模式 2：安全守卫 (Safety Guard)

拦截危险操作，要求确认或直接阻止。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -qE \"rm -rf|force push|drop table|--no-verify\"; then echo \"BLOCK: 检测到危险操作，请确认\"; exit 1; fi'"
        }]
      }
    ]
  }
}
```

## 模式 3：自动语法检查 (Auto Lint)

代码文件修改后自动检查语法。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'FILE=\"$TOOL_INPUT_FILE_PATH\"; case \"$FILE\" in *.py) python3 -c \"import py_compile; py_compile.compile(\\\"$FILE\\\", doraise=True)\" 2>&1 || echo \"WARN: Python 语法错误\";; *.ts|*.tsx) npx tsc --noEmit \"$FILE\" 2>&1 | head -5 || true;; esac'"
        }]
      }
    ]
  }
}
```

## 模式 4：提交前验证 (Pre-Commit Gate)

在 git commit 前运行测试。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"git commit\"; then echo \"提示：commit 前确认测试已通过\"; fi'"
        }]
      }
    ]
  }
}
```

## 模式 5：完成度验证 (Completion Gate)

Agent 停止前检查是否有遗漏。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "echo '检查：所有 TODO 已完成？测试已通过？有未提交的改动吗？'"
        }]
      }
    ]
  }
}
```

## 模式 6：关键词触发 (Keyword Trigger)

检测用户消息中的关键词，触发特定工作流。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [{
          "type": "command",
          "command": "node keyword-detector.js"
        }]
      }
    ]
  }
}
```

## 模式 7：文件读取提示 (Read Reminder)

读取文件后提醒 Agent 先理解再修改。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [{
          "type": "command",
          "command": "echo '提示：多文件时用并行 Read 加速分析'"
        }]
      }
    ]
  }
}
```

---

## 组合建议

### 最小配置（适合所有项目）
- 上下文注入（Bash 并行提示）
- 完成度验证（Stop hook）

### 标准配置（推荐）
- 上下文注入
- 安全守卫
- 自动语法检查
- 完成度验证

### 完整配置（大型项目）
- 全部 7 个模式
- 自定义关键词触发
- 项目特定的验证脚本

---

## 注意事项

1. **Hook 不能替代 CLAUDE.md**：Hook 是运行时提示，CLAUDE.md 是持久化知识
2. **保持轻量**：每个 hook 应在 <1s 内完成，避免阻塞工作流
3. **分层管理**：全局放通用 hooks，项目放特定 hooks
4. **测试 hooks**：新增 hook 后用简单任务验证效果
5. **避免过度守卫**：太多限制会降低 Agent 效率
