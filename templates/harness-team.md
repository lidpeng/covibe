# 团队协作配置模板

## harness.team.json 完整模板

```json
{
  "version": "2.0",
  "team": {
    "name": "{团队名称}",
    "language": "zh-CN",
    "members": [
      {
        "name": "{姓名}",
        "role": "{角色: PM/前端/后端/全栈/DevOps/QA}",
        "email": "{邮箱}",
        "claude_user": true
      }
    ]
  },
  "enforced": {
    "quality_gates": [
      "no_half_finished_features",
      "no_fake_data",
      "tests_must_pass",
      "smoke_test_before_push"
    ],
    "commit_style": "semantic_zh",
    "blocked_operations": [
      "git push --force",
      "git reset --hard",
      "rm -rf /",
      "drop table",
      "git push origin main"
    ],
    "required_hooks": [
      "pre_commit_lint",
      "post_edit_syntax_check"
    ],
    "code_review_required": true,
    "min_test_coverage": null
  },
  "recommended": {
    "naming_convention": "snake_case_python_camelCase_ts",
    "doc_language": "zh-CN",
    "max_file_change_per_commit": 10,
    "debug_rule": "reproduce_before_fix"
  },
  "personal_overrides_allowed": [
    "execution_style",
    "editor_preferences",
    "model_routing",
    "ui_theme",
    "verbose_output"
  ],
  "onboarding": {
    "setup_script": "scripts/setup-dev.sh",
    "required_checks": [
      "claude_md_read",
      "dev_env_running",
      "smoke_test_pass",
      "first_commit_reviewed"
    ],
    "welcome_message": "欢迎加入团队！请先运行 scripts/setup-dev.sh，然后阅读 CLAUDE.md。"
  },
  "experience_board": {
    "enabled": true,
    "path": ".teamwork/experiences/",
    "auto_inject_limit": 5,
    "categories": ["frontend", "backend", "db", "deploy", "debug", "performance", "security"]
  },
  "coordination": {
    "enabled": true,
    "profiles_path": ".teamwork/profiles/",
    "auto_git_blame_analysis": true,
    "max_tasks_per_person": 5
  }
}
```

## .teamwork 目录结构

```
.teamwork/
├── experiences/              # 共享经验板（git tracked）
│   ├── index.json            # 经验索引（按 tag/category/recency 排序）
│   ├── frontend/             # 前端经验
│   ├── backend/              # 后端经验
│   ├── db/                   # 数据库经验
│   ├── deploy/               # 部署经验
│   ├── debug/                # 调试经验
│   ├── performance/          # 性能经验
│   └── security/             # 安全经验
├── decisions/                # 决策记录（借鉴 TeamVibe 模式）
│   └── {timestamp}_{author}_{hash}.json
├── coordination/             # 分工协调
│   ├── current.json          # 当前分工方案
│   └── history/              # 历史分工记录
├── profiles/                 # 成员画像
│   └── {name}.json
└── drafts/                   # 本地草稿（gitignored）
    └── current.json
```

## .gitignore 追加项

```gitignore
# Harness 团队协作 - 个人文件
.claude/settings.local.json
.teamwork/drafts/
```

## setup-dev.sh 模板

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== 团队开发环境初始化 ==="

# 1. 检查必要工具
MISSING=()
command -v git >/dev/null || MISSING+=("git")
command -v node >/dev/null || MISSING+=("node")
command -v python3 >/dev/null || MISSING+=("python3")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "缺少必要工具: ${MISSING[*]}"
  exit 1
fi
echo "✓ 必要工具检查通过"

# 2. 安装项目依赖
if [ -f "package.json" ]; then
  echo "安装前端依赖..."
  npm install
fi
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  echo "安装后端依赖..."
  pip install -e ".[dev]" 2>/dev/null || pip install -r requirements.txt 2>/dev/null || true
fi
echo "✓ 项目依赖安装完成"

# 3. 创建个人 settings.local.json（如果不存在）
if [ ! -f ".claude/settings.local.json" ]; then
  mkdir -p .claude
  echo '{}' > .claude/settings.local.json
  echo "✓ 创建了 .claude/settings.local.json（个人配置）"
fi

# 4. 确保 .gitignore 包含个人文件
if ! grep -q "settings.local.json" .gitignore 2>/dev/null; then
  echo ".claude/settings.local.json" >> .gitignore
  echo ".teamwork/drafts/" >> .gitignore
  echo "✓ 更新了 .gitignore"
fi

# 5. 创建成员画像（交互式）
PROFILE_DIR=".teamwork/profiles"
mkdir -p "$PROFILE_DIR"
read -p "你的名字: " NAME
read -p "你的角色 (前端/后端/全栈/PM/DevOps/QA): " ROLE

cat > "$PROFILE_DIR/$(echo $NAME | tr ' ' '_').json" << PROFILE
{
  "name": "$NAME",
  "role": "$ROLE",
  "skills": [],
  "recent_modules": [],
  "preferences": {},
  "current_load": 0
}
PROFILE
echo "✓ 创建了成员画像: $PROFILE_DIR/$(echo $NAME | tr ' ' '_').json"

echo ""
echo "=== 初始化完成！==="
echo "请阅读 CLAUDE.md 了解项目规范"
echo "运行 /harness audit 检查环境健康度"
```

## 团队规则分级说明

### enforced（团队铁律）
不可覆盖。违反这些规则的操作会被 hooks 拦截或在 audit 中标记为 FAIL。
- 质量红线（禁止半成品、禁止假数据）
- 安全规则（禁止 force push、禁止删库）
- 必要的 hooks（lint、语法检查）

### recommended（团队推荐）
可以个人覆盖，但 audit 时会提示偏离��
- 命名规范
- 文档语言
- 调试规则

### personal_overrides_allowed（个人自由区）
完全个人决定，不做检查。
- 执行风格（全速/确认式）
- 编辑器偏好
- 模型路由选择
