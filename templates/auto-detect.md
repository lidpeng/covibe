# 自动探测规则 (Auto-Detection Rules)

## 技术栈识别

### 入口文件优先级

按以下顺序检测项目类型，找到即停止：

```
1. package.json        → Node.js 生态
2. pyproject.toml      → Python 现代项目
3. requirements.txt    → Python 传统���目
4. Cargo.toml          → Rust
5. go.mod              → Go
6. pom.xml             → Java (Maven)
7. build.gradle(.kts)  → Java/Kotlin (Gradle)
8. Gemfile             → Ruby
9. composer.json       → PHP
10. pubspec.yaml       → Dart/Flutter
11. Makefile           → 通用 (需进一步分析)
```

### 框架识别规则

**Node.js (package.json)**
```
dependencies 或 devDependencies 中：
  "react"           → React
  "next"            → Next.js (React SSR)
  "vue"             → Vue
  "nuxt"            → Nuxt (Vue SSR)
  "svelte"          → Svelte
  "express"         → Express
  "fastify"         → Fastify
  "koa"             → Koa
  "@nestjs/core"    → NestJS
  "electron"        → Electron

辅助检测：
  "typescript"      → TypeScript 项目
  "tailwindcss"     → 使用 Tailwind CSS
  "prisma"          → 使用 Prisma ORM
  "drizzle-orm"     → 使用 Drizzle ORM
  "jest"/"vitest"   → 测试框架
  "eslint"          → Lint 工具
```

**Python (pyproject.toml / requirements.txt)**
```
依赖中：
  fastapi          → FastAPI
  django           → Django
  flask            → Flask
  sqlalchemy       → SQLAlchemy ORM
  pytest           → pytest 测试
  ruff             → Ruff linter
  alembic          → 数据库迁移
  celery           → 任务队列
  pandas/numpy     → 数据科学
  torch/tensorflow → ML/AI
```

### 命令发现规则

**从 package.json scripts 提取**
```json
{
  "dev": "..."     → 开发命令
  "build": "..."   → 构建命令
  "test": "..."    → 测试命令
  "lint": "..."    → Lint 命令
  "start": "..."   → 启动命令
}
```

**从 pyproject.toml 提取**
```toml
[project.scripts]     → CLI 入口
[tool.pytest.ini_options] → pytest 配置
[tool.ruff]           → ruff 配置
```

**通用文件检测**
```
Makefile              → 解析 target 名称
docker-compose.yml    → docker-compose up/down
Dockerfile            → docker build
.github/workflows/    → CI/CD 命令参考
scripts/              → 检查可执行脚本名称
```

### 目录结构分析

**全栈项目模式（前后端分��）**
```
检测到 frontend/ + backend/ → 全栈项目
  frontend/package.json → 前端技术栈
  backend/pyproject.toml → 后端技��栈
  docker-compose.yml → 容器编排
```

**Monorepo 模式**
```
检测到 packages/ 或 apps/ → Monorepo
  packages/*/package.json → 分析每个包
  turbo.json / nx.json → 构建工具
```

**单体应用模式**
```
仅 package.json 在根目录 → 前端单体
仅 pyproject.toml 在根目录 → 后端单体
```

## CLAUDE.md 增强模式

如果检测到已有 CLAUDE.md，进入增强模式：

1. 读取现有 CLAUDE.md 内容
2. 检查缺失章节（对比宪法模板）
3. 只补充缺失的部分，不修改已有内容
4. 输出增强报告说明添加了什么

**必须保留的内容**：
- 用户自定义的规则和约定
- 项目特定的注意事项
- 已有的构建命令（除非检测到更准确的）

**可以补充的内容**：
- 缺失的技术栈信息
- 缺失的项目结构描述
- 缺失的质量门禁章节
- 缺失的 Git 工作流章节

## Git 配置检测

```bash
git remote -v          → 识别远程仓库（GitHub/GitLab/Bitbucket）
git config user.name   → 当前用户名
git config user.email  → 当前邮箱
git log --oneline -5   → 最近提交风格分析
git branch -a          → 分支策略分析
```
