import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectTechStack, renderAgentsTemplate } from '../src/lib/detector.js';

describe('Smart Tech-Stack Detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-detector-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Next.js / React detection', () => {
    it('detects Next.js with TypeScript, Tailwind, Vitest, and Playwright', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'my-next-app',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            lint: 'next lint',
            test: 'vitest run',
            'type-check': 'tsc --noEmit',
          },
          dependencies: {
            next: '^15.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
            tailwindcss: '^4.0.0',
            vitest: '^2.0.0',
            '@playwright/test': '^1.40.0',
          },
        })
      );
      fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Next.js / React');
      expect(detected.language).toBe('TypeScript');
      expect(detected.framework).toBe('Next.js');
      expect(detected.packageManager).toBe('pnpm');
      expect(detected.styling).toBe('Tailwind CSS');
      expect(detected.testFramework).toContain('Vitest');
      expect(detected.commands.dev).toBe('pnpm run dev');
      expect(detected.commands.build).toBe('pnpm run build');
      expect(detected.commands.test).toBe('pnpm test');
      expect(detected.commands.typeCheck).toBe('pnpm run type-check');
    });

    it('detects React with Vite, JavaScript, and npm', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'my-react-app',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            lint: 'eslint .',
            test: 'jest',
          },
          dependencies: {
            react: '^18.2.0',
          },
          devDependencies: {
            vite: '^5.0.0',
            jest: '^29.0.0',
          },
        })
      );

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('React');
      expect(detected.language).toBe('JavaScript');
      expect(detected.framework).toBe('React');
      expect(detected.packageManager).toBe('npm');
      expect(detected.testFramework).toBe('Jest');
      expect(detected.commands.dev).toBe('npm run dev');
      expect(detected.commands.test).toBe('npm test');
    });
  });

  describe('Node.js / Express / Fastify detection', () => {
    it('detects Express backend with TypeScript and npm', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'api-service',
          scripts: {
            build: 'tsc',
            start: 'node dist/index.js',
            test: 'vitest',
          },
          dependencies: {
            express: '^4.19.0',
          },
          devDependencies: {
            typescript: '^5.4.0',
            vitest: '^2.0.0',
          },
        })
      );
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Node.js / Express');
      expect(detected.language).toBe('TypeScript');
      expect(detected.framework).toBe('Express');
      expect(detected.packageManager).toBe('npm');
      expect(detected.commands.test).toBe('npm test');
      expect(detected.commands.typeCheck).toBe('npx tsc --noEmit');
    });

    it('detects Fastify backend with TypeScript and yarn', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'fastify-app',
          dependencies: {
            fastify: '^4.26.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
          },
        })
      );
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Node.js / Fastify');
      expect(detected.language).toBe('TypeScript');
      expect(detected.framework).toBe('Fastify');
      expect(detected.packageManager).toBe('yarn');
    });
  });

  describe('Python detection', () => {
    it('detects FastAPI with uv, pytest, ruff, and mypy', () => {
      fs.writeFileSync(
        path.join(tempDir, 'pyproject.toml'),
        `
[project]
name = "fastapi-sample"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn>=0.28.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
    "ruff>=0.3.0",
    "mypy>=1.9.0",
]
`
      );
      fs.writeFileSync(path.join(tempDir, 'uv.lock'), '');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Python / FastAPI');
      expect(detected.language).toBe('Python');
      expect(detected.framework).toBe('FastAPI');
      expect(detected.packageManager).toBe('uv');
      expect(detected.testFramework).toBe('pytest');
      expect(detected.linter).toBe('ruff');
      expect(detected.typeChecker).toBe('mypy');
      expect(detected.commands.test).toBe('uv run pytest');
      expect(detected.commands.lint).toBe('uv run ruff check .');
      expect(detected.commands.typeCheck).toBe('uv run mypy .');
    });

    it('detects Django with manage.py and requirements.txt', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.txt'),
        'django>=5.0\npytest-django>=4.8\nflake8>=7.0\n'
      );
      fs.writeFileSync(path.join(tempDir, 'manage.py'), '#!/usr/bin/env python');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Python / Django');
      expect(detected.language).toBe('Python');
      expect(detected.framework).toBe('Django');
      expect(detected.packageManager).toBe('pip');
      expect(detected.commands.dev).toBe('python manage.py runserver');
      expect(detected.commands.test).toBe('pytest');
      expect(detected.commands.lint).toBe('flake8');
    });
  });

  describe('Go detection', () => {
    it('detects Go module with go test and golangci-lint', () => {
      fs.writeFileSync(
        path.join(tempDir, 'go.mod'),
        `module github.com/example/myservice

go 1.22

require github.com/gin-gonic/gin v1.9.1
`
      );
      fs.writeFileSync(path.join(tempDir, 'main.go'), 'package main\nfunc main() {}');
      fs.writeFileSync(path.join(tempDir, '.golangci.yml'), '');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Go / Gin');
      expect(detected.language).toBe('Go');
      expect(detected.framework).toBe('Gin');
      expect(detected.packageManager).toBe('go');
      expect(detected.testFramework).toBe('go test');
      expect(detected.linter).toBe('golangci-lint');
      expect(detected.commands.dev).toBe('go run .');
      expect(detected.commands.build).toBe('go build -v ./...');
      expect(detected.commands.test).toBe('go test ./...');
      expect(detected.commands.lint).toBe('golangci-lint run');
    });
  });

  describe('Rust detection', () => {
    it('detects Rust project with Cargo, axum, clippy, and cargo test', () => {
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        `[package]
name = "rust-service"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
`
      );
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/main.rs'), 'fn main() {}');

      const detected = detectTechStack(tempDir);

      expect(detected.name).toBe('Rust / Axum');
      expect(detected.language).toBe('Rust');
      expect(detected.framework).toBe('Axum');
      expect(detected.packageManager).toBe('cargo');
      expect(detected.testFramework).toBe('cargo test');
      expect(detected.linter).toBe('cargo clippy');
      expect(detected.commands.dev).toBe('cargo run');
      expect(detected.commands.build).toBe('cargo build --release');
      expect(detected.commands.test).toBe('cargo test');
      expect(detected.commands.lint).toBe('cargo clippy -- -D warnings');
      expect(detected.commands.typeCheck).toBe('cargo check');
    });
  });

  describe('AGENTS.md Template Rendering', () => {
    it('replaces placeholder sections in AGENTS.template.md with concrete detected stack values', () => {
      const template = `# AGENTS.md (also GEMINI.md & CLAUDE.md)

## Project Overview

{Brief 1-2 paragraph description of the project, core capabilities, and target users.}

## Tech Stack

- **Framework / Language**: {e.g. Next.js 15, TypeScript strict mode, Python 3.12, Go 1.23}
- **Backend / Database**: {e.g. PostgreSQL, Supabase, SQLite, Redis}
- **Styling / UI**: {e.g. Tailwind CSS, Radix UI, CSS Modules}
- **Testing**: {e.g. Vitest, Playwright, Jest, pytest}
- **Deployment**: {e.g. Vercel, Cloudflare, Docker, AWS}
- **Package Manager**: {e.g. npm, pnpm, yarn, uv, pip}

## Development Workflows

\`\`\`bash
npm run dev          # Start local development server
npm run build        # Production build
npm run lint         # ESLint / static linter
npm run type-check   # Type verification (tsc --noEmit)
npm test             # Run test suite
\`\`\`
`;

      const detected = {
        name: 'Rust / Axum',
        language: 'Rust',
        framework: 'Axum',
        packageManager: 'cargo',
        testFramework: 'cargo test',
        linter: 'cargo clippy',
        typeChecker: 'cargo check',
        commands: {
          dev: 'cargo run',
          build: 'cargo build --release',
          lint: 'cargo clippy -- -D warnings',
          typeCheck: 'cargo check',
          test: 'cargo test',
        },
        detectedFiles: ['Cargo.toml'],
      };

      const rendered = renderAgentsTemplate(template, detected);

      expect(rendered).toContain('- **Framework / Language**: Rust (Axum)');
      expect(rendered).toContain('- **Package Manager**: cargo');
      expect(rendered).toContain('- **Testing**: cargo test');
      expect(rendered).toContain('cargo test');
      expect(rendered).toContain('cargo build --release');
      expect(rendered).toContain('cargo clippy -- -D warnings');
      expect(rendered).toContain('cargo check');
    });
  });
});
