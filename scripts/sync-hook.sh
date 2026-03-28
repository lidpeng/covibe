#!/usr/bin/env bash
# Harness Team Sync Hook
#
# 在 Claude Code hooks 中调用，自动向 sync server 广播状态。
#
# 用法（在 .claude/settings.json 的 hooks 中配置）:
#   PostToolUse:Edit  → bash sync-hook.sh editing "$TOOL_INPUT_FILE_PATH"
#   PostToolUse:Write → bash sync-hook.sh editing "$TOOL_INPUT_FILE_PATH"
#   PreToolUse:Edit   → bash sync-hook.sh check "$TOOL_INPUT_FILE_PATH"
#   Stop              → bash sync-hook.sh leave

SYNC_SERVER="${HARNESS_SYNC_SERVER:-http://localhost:3456}"
SYNC_USER="${HARNESS_SYNC_USER:-$(whoami)}"
SYNC_TOKEN="${HARNESS_SYNC_TOKEN:-}"
ACTION="${1:-status}"
FILE_PATH="${2:-}"

# Token header（如果设置了 token）
TOKEN_HEADER=""
if [ -n "$SYNC_TOKEN" ]; then
  TOKEN_HEADER="-H \"X-Covibe-Token: $SYNC_TOKEN\""
fi

case "$ACTION" in
  editing)
    curl -s -X POST "$SYNC_SERVER/broadcast" \
      -H "Content-Type: application/json" \
      -H "X-Covibe-Token: $SYNC_TOKEN" \
      -d "{\"type\":\"editing\",\"name\":\"$SYNC_USER\",\"file\":\"$FILE_PATH\"}" \
      > /dev/null 2>&1 || true
    ;;

  check)
    RESULT=$(curl -s -H "X-Covibe-Token: $SYNC_TOKEN" "$SYNC_SERVER/status" 2>/dev/null || echo '{}')
    EDITOR=$(echo "$RESULT" | node -e "
      const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
      const e=d.active_edits?.['$FILE_PATH'];
      if(e && e.editor!=='$SYNC_USER') console.log(e.editor);
    " 2>/dev/null)
    if [ -n "$EDITOR" ]; then
      echo "⚠️ $EDITOR 正在编辑 $FILE_PATH，注意协调避免冲突！"
    fi
    ;;

  decision)
    WHAT="${3:-}"
    WHY="${4:-}"
    curl -s -X POST "$SYNC_SERVER/broadcast" \
      -H "Content-Type: application/json" \
      -H "X-Covibe-Token: $SYNC_TOKEN" \
      -d "{\"type\":\"decision\",\"name\":\"$SYNC_USER\",\"what\":\"$WHAT\",\"why\":\"$WHY\",\"decision_type\":\"human\"}" \
      > /dev/null 2>&1 || true
    ;;

  experience)
    CONTENT="${3:-}"
    CATEGORY="${4:-general}"
    curl -s -X POST "$SYNC_SERVER/broadcast" \
      -H "Content-Type: application/json" \
      -H "X-Covibe-Token: $SYNC_TOKEN" \
      -d "{\"type\":\"experience\",\"name\":\"$SYNC_USER\",\"content\":\"$CONTENT\",\"category\":\"$CATEGORY\"}" \
      > /dev/null 2>&1 || true
    ;;

  status)
    curl -s -H "X-Covibe-Token: $SYNC_TOKEN" "$SYNC_SERVER/status" 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
      console.log('项目:', d.project, '| 在线:', d.online);
      console.log('成员:', d.members?.join(', ') || '无');
      const edits = d.active_edits || {};
      if(Object.keys(edits).length > 0) {
        console.log('当前编辑:');
        for(const [f,e] of Object.entries(edits)) console.log('  ', e.editor, '→', f);
      }
    " 2>/dev/null || echo "Sync server 未运行（$SYNC_SERVER）"
    ;;

  leave)
    curl -s -X POST "$SYNC_SERVER/broadcast" \
      -H "Content-Type: application/json" \
      -H "X-Covibe-Token: $SYNC_TOKEN" \
      -d "{\"type\":\"left\",\"name\":\"$SYNC_USER\"}" \
      > /dev/null 2>&1 || true
    ;;
esac
