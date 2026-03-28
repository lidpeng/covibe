/**
 * 自动探测引擎 — 识别项目技术栈、框架、命令
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function detect(cwd) {
  const result = {
    type: 'unknown',
    language: null,
    frameworks: [],
    buildTool: null,
    commands: { dev: null, build: null, test: null, lint: null, start: null },
    hasDocker: false,
    hasCI: false,
    structure: 'single', // single | fullstack | monorepo
    existing: { claudeMd: false, claudeDir: false, omc: false, teamwork: false },
  };

  // 检测已有 harness
  result.existing.claudeMd = existsSync(join(cwd, 'CLAUDE.md'));
  result.existing.claudeDir = existsSync(join(cwd, '.claude'));
  result.existing.omc = existsSync(join(cwd, '.omc'));
  result.existing.teamwork = existsSync(join(cwd, '.teamwork'));

  // Docker & CI
  result.hasDocker = existsSync(join(cwd, 'docker-compose.yml')) || existsSync(join(cwd, 'Dockerfile'));
  result.hasCI = existsSync(join(cwd, '.github/workflows')) || existsSync(join(cwd, '.gitlab-ci.yml'));

  // 全栈检测
  if (existsSync(join(cwd, 'frontend')) && existsSync(join(cwd, 'backend'))) {
    result.structure = 'fullstack';
  } else if (existsSync(join(cwd, 'packages')) || existsSync(join(cwd, 'apps'))) {
    result.structure = 'monorepo';
  }

  // Node.js
  const pkgPath = join(cwd, 'package.json');
  const frontPkgPath = join(cwd, 'frontend/package.json');
  for (const p of [pkgPath, frontPkgPath]) {
    if (existsSync(p)) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (!result.language) result.language = 'javascript';
        if (deps.typescript) result.language = 'typescript';
        if (deps.react || deps['react-dom']) result.frameworks.push('react');
        if (deps.next) result.frameworks.push('nextjs');
        if (deps.vue) result.frameworks.push('vue');
        if (deps.nuxt) result.frameworks.push('nuxt');
        if (deps.svelte) result.frameworks.push('svelte');
        if (deps.express) result.frameworks.push('express');
        if (deps['@nestjs/core']) result.frameworks.push('nestjs');
        if (deps.tailwindcss) result.frameworks.push('tailwind');
        if (deps.zustand) result.frameworks.push('zustand');
        if (deps['@tanstack/react-query']) result.frameworks.push('react-query');
        result.buildTool = deps.vite ? 'vite' : deps.webpack ? 'webpack' : deps.turbo ? 'turbo' : null;
        // 提取 scripts
        if (pkg.scripts) {
          result.commands.dev = pkg.scripts.dev ? `npm run dev` : null;
          result.commands.build = pkg.scripts.build ? `npm run build` : null;
          result.commands.test = pkg.scripts.test ? `npm test` : null;
          result.commands.lint = pkg.scripts.lint ? `npm run lint` : null;
          result.commands.start = pkg.scripts.start ? `npm start` : null;
        }
        result.type = 'node';
      } catch {}
    }
  }

  // Python
  const pyprojectPath = join(cwd, 'pyproject.toml');
  const backPyPath = join(cwd, 'backend/pyproject.toml');
  const reqPath = join(cwd, 'requirements.txt');
  for (const p of [pyprojectPath, backPyPath, reqPath]) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf8');
        if (result.type === 'node') result.type = 'fullstack';
        else result.type = 'python';
        result.language = result.language || 'python';
        if (content.includes('fastapi')) result.frameworks.push('fastapi');
        if (content.includes('django')) result.frameworks.push('django');
        if (content.includes('flask')) result.frameworks.push('flask');
        if (content.includes('sqlalchemy')) result.frameworks.push('sqlalchemy');
        if (content.includes('pytest')) {
          result.commands.test = result.commands.test || 'pytest';
        }
        if (content.includes('ruff')) {
          result.commands.lint = result.commands.lint || 'ruff check .';
        }
        if (content.includes('uvicorn') || content.includes('fastapi')) {
          result.commands.dev = result.commands.dev || 'uvicorn app.main:app --reload';
        }
      } catch {}
    }
  }

  // Go
  if (existsSync(join(cwd, 'go.mod'))) {
    result.type = 'go';
    result.language = 'go';
    result.commands.build = 'go build ./...';
    result.commands.test = 'go test ./...';
  }

  // Rust
  if (existsSync(join(cwd, 'Cargo.toml'))) {
    result.type = 'rust';
    result.language = 'rust';
    result.commands.build = 'cargo build';
    result.commands.test = 'cargo test';
    result.commands.lint = 'cargo clippy';
  }

  // Smoke test 检测
  if (existsSync(join(cwd, 'scripts/smoke-test.sh'))) {
    result.commands.smokeTest = 'bash scripts/smoke-test.sh';
  }

  // 去重
  result.frameworks = [...new Set(result.frameworks)];

  return result;
}
