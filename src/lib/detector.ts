import fs from 'node:fs';
import path from 'node:path';

export interface StackCommands {
  dev?: string;
  build?: string;
  lint?: string;
  typeCheck?: string;
  test?: string;
  testWatch?: string;
}

export interface DetectedStack {
  name: string;
  language: string;
  framework?: string;
  backend?: string;
  packageManager: string;
  testFramework?: string;
  linter?: string;
  typeChecker?: string;
  styling?: string;
  deployment?: string;
  commands: StackCommands;
  detectedFiles: string[];
}

export function detectTechStack(projectDir: string): DetectedStack {
  const detectedFiles: string[] = [];

  const fileExists = (relPath: string) => {
    const full = path.join(projectDir, relPath);
    if (fs.existsSync(full)) {
      detectedFiles.push(relPath);
      return true;
    }
    return false;
  };

  const readFileSafe = (relPath: string): string => {
    try {
      const full = path.join(projectDir, relPath);
      if (fs.existsSync(full)) {
        return fs.readFileSync(full, 'utf8');
      }
    } catch {
      // Ignore read errors
    }
    return '';
  };

  // 1. Check Rust (Cargo.toml)
  if (fileExists('Cargo.toml')) {
    const cargoToml = readFileSafe('Cargo.toml');
    let framework: string | undefined;
    if (cargoToml.includes('axum')) framework = 'Axum';
    else if (cargoToml.includes('actix-web')) framework = 'Actix Web';
    else if (cargoToml.includes('rocket')) framework = 'Rocket';
    else if (cargoToml.includes('tokio')) framework = 'Tokio';

    const name = framework ? `Rust / ${framework}` : 'Rust';
    return {
      name,
      language: 'Rust',
      framework,
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
      detectedFiles,
    };
  }

  // 2. Check Go (go.mod)
  if (fileExists('go.mod') || fileExists('main.go')) {
    const goMod = readFileSafe('go.mod');
    let framework: string | undefined;
    if (goMod.includes('github.com/gin-gonic/gin')) framework = 'Gin';
    else if (goMod.includes('github.com/labstack/echo')) framework = 'Echo';
    else if (goMod.includes('github.com/go-chi/chi')) framework = 'Chi';
    else if (goMod.includes('github.com/gofiber/fiber')) framework = 'Fiber';

    const hasGolangCi = fileExists('.golangci.yml') || fileExists('.golangci.yaml');
    const name = framework ? `Go / ${framework}` : 'Go';

    return {
      name,
      language: 'Go',
      framework,
      packageManager: 'go',
      testFramework: 'go test',
      linter: hasGolangCi ? 'golangci-lint' : undefined,
      commands: {
        dev: 'go run .',
        build: 'go build -v ./...',
        lint: hasGolangCi ? 'golangci-lint run' : undefined,
        test: 'go test ./...',
      },
      detectedFiles,
    };
  }

  // 3. Check Python (pyproject.toml, requirements.txt, Pipfile, manage.py)
  const hasPyProject = fileExists('pyproject.toml');
  const hasRequirements = fileExists('requirements.txt');
  const hasPipfile = fileExists('Pipfile');
  const hasManagePy = fileExists('manage.py');

  if (hasPyProject || hasRequirements || hasPipfile || hasManagePy) {
    const pyproject = readFileSafe('pyproject.toml');
    const requirements = readFileSafe('requirements.txt');
    const allPythonMeta = `${pyproject}\n${requirements}`.toLowerCase();

    // Package manager
    let packageManager = 'pip';
    if (fileExists('uv.lock') || pyproject.includes('[tool.uv]')) {
      packageManager = 'uv';
    } else if (fileExists('poetry.lock') || pyproject.includes('[tool.poetry]')) {
      packageManager = 'poetry';
    } else if (hasPipfile) {
      packageManager = 'pipenv';
    }

    // Framework
    let framework: string | undefined;
    if (allPythonMeta.includes('fastapi') || pyproject.includes('fastapi')) {
      framework = 'FastAPI';
    } else if (allPythonMeta.includes('django') || hasManagePy) {
      framework = 'Django';
    } else if (allPythonMeta.includes('flask')) {
      framework = 'Flask';
    }

    // Testing
    let testFramework = 'pytest';
    if (allPythonMeta.includes('pytest') || fileExists('pytest.ini') || fileExists('conftest.py')) {
      testFramework = 'pytest';
    }

    // Linter
    let linter: string | undefined;
    if (allPythonMeta.includes('ruff') || fileExists('ruff.toml')) {
      linter = 'ruff';
    } else if (allPythonMeta.includes('flake8') || fileExists('.flake8')) {
      linter = 'flake8';
    }

    // Type checker
    let typeChecker: string | undefined;
    if (allPythonMeta.includes('mypy') || fileExists('mypy.ini')) {
      typeChecker = 'mypy';
    } else if (allPythonMeta.includes('pyright') || fileExists('pyrightconfig.json')) {
      typeChecker = 'pyright';
    }

    const pmPrefix = packageManager === 'uv' ? 'uv run ' : packageManager === 'poetry' ? 'poetry run ' : '';

    let devCmd = `${pmPrefix}python main.py`;
    if (framework === 'FastAPI') {
      devCmd = packageManager === 'uv' ? 'uv run fastapi dev' : 'fastapi dev';
    } else if (framework === 'Django') {
      devCmd = `${pmPrefix}python manage.py runserver`;
    } else if (framework === 'Flask') {
      devCmd = `${pmPrefix}flask run`;
    }

    const testCmd = `${pmPrefix}${testFramework}`;
    const lintCmd = linter ? `${pmPrefix}${linter}${linter === 'ruff' ? ' check .' : ''}` : undefined;
    const typeCheckCmd = typeChecker ? `${pmPrefix}${typeChecker} .` : undefined;

    const name = framework ? `Python / ${framework}` : 'Python';

    return {
      name,
      language: 'Python',
      framework,
      packageManager,
      testFramework,
      linter,
      typeChecker,
      commands: {
        dev: devCmd,
        test: testCmd,
        lint: lintCmd,
        typeCheck: typeCheckCmd,
      },
      detectedFiles,
    };
  }

  // 4. Check Node.js / JavaScript / TypeScript (package.json)
  if (fileExists('package.json')) {
    let pkg: any = {};
    try {
      pkg = JSON.parse(readFileSafe('package.json'));
    } catch {
      pkg = {};
    }

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const scripts = pkg.scripts || {};

    // Package manager
    let packageManager = 'npm';
    if (fileExists('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (fileExists('yarn.lock')) {
      packageManager = 'yarn';
    } else if (fileExists('bun.lockb') || fileExists('bun.lock')) {
      packageManager = 'bun';
    } else if (fileExists('package-lock.json')) {
      packageManager = 'npm';
    }

    const runPrefix = (scriptName: string): string => {
      if (packageManager === 'npm') {
        return scriptName === 'test' || scriptName === 'start' ? `npm ${scriptName}` : `npm run ${scriptName}`;
      }
      return `${packageManager} ${scriptName === 'test' || scriptName === 'start' ? scriptName : `run ${scriptName}`}`;
    };

    const hasTypeScript = Boolean(allDeps.typescript || fileExists('tsconfig.json'));
    const language = hasTypeScript ? 'TypeScript' : 'JavaScript';

    // Framework detection
    let name = 'Node.js';
    let framework: string | undefined;

    if (allDeps.next || fileExists('next.config.js') || fileExists('next.config.mjs') || fileExists('next.config.ts')) {
      framework = 'Next.js';
      name = 'Next.js / React';
    } else if (allDeps.remix || allDeps['@remix-run/node']) {
      framework = 'Remix';
      name = 'Remix / React';
    } else if (allDeps.astro) {
      framework = 'Astro';
      name = 'Astro';
    } else if (allDeps.nuxt || allDeps.vue) {
      framework = allDeps.nuxt ? 'Nuxt' : 'Vue';
      name = framework;
    } else if (allDeps['@sveltejs/kit'] || allDeps.svelte) {
      framework = allDeps['@sveltejs/kit'] ? 'SvelteKit' : 'Svelte';
      name = framework;
    } else if (allDeps.react) {
      framework = 'React';
      name = 'React';
    } else if (allDeps.express) {
      framework = 'Express';
      name = 'Node.js / Express';
    } else if (allDeps.fastify) {
      framework = 'Fastify';
      name = 'Node.js / Fastify';
    } else if (allDeps['@nestjs/core']) {
      framework = 'NestJS';
      name = 'NestJS';
    } else if (allDeps.koa) {
      framework = 'Koa';
      name = 'Node.js / Koa';
    } else if (allDeps.hono) {
      framework = 'Hono';
      name = 'Hono';
    }

    // Styling
    let styling: string | undefined;
    if (allDeps.tailwindcss || fileExists('tailwind.config.js') || fileExists('tailwind.config.ts')) {
      styling = 'Tailwind CSS';
    }

    // Testing
    const testFrameworks: string[] = [];
    if (allDeps.vitest) testFrameworks.push('Vitest');
    if (allDeps.jest) testFrameworks.push('Jest');
    if (allDeps['@playwright/test']) testFrameworks.push('Playwright');
    if (allDeps.cypress) testFrameworks.push('Cypress');
    const testFramework = testFrameworks.length > 0 ? testFrameworks.join(', ') : scripts.test ? 'npm test' : undefined;

    // Linter
    let linter: string | undefined;
    if (allDeps.eslint || fileExists('.eslintrc.json') || fileExists('eslint.config.js') || fileExists('eslint.config.mjs')) {
      linter = 'ESLint';
    } else if (allDeps['@biomejs/biome'] || fileExists('biome.json')) {
      linter = 'Biome';
    }

    // Type checker
    const typeChecker = hasTypeScript ? 'tsc' : undefined;

    // Commands
    const commands: StackCommands = {};
    if (scripts.dev) {
      commands.dev = runPrefix('dev');
    } else if (scripts.start) {
      commands.dev = runPrefix('start');
    } else {
      commands.dev = `${packageManager} start`;
    }

    if (scripts.build) {
      commands.build = runPrefix('build');
    }

    if (scripts.lint) {
      commands.lint = runPrefix('lint');
    } else if (linter === 'ESLint') {
      commands.lint = `${packageManager === 'npm' ? 'npx' : packageManager} eslint .`;
    }

    if (scripts['type-check']) {
      commands.typeCheck = runPrefix('type-check');
    } else if (scripts.typecheck) {
      commands.typeCheck = runPrefix('typecheck');
    } else if (hasTypeScript) {
      commands.typeCheck = 'npx tsc --noEmit';
    }

    if (scripts.test) {
      commands.test = runPrefix('test');
    }

    if (scripts['test:watch']) {
      commands.testWatch = runPrefix('test:watch');
    }

    return {
      name,
      language,
      framework,
      packageManager,
      testFramework,
      linter,
      typeChecker,
      styling,
      commands,
      detectedFiles,
    };
  }

  // Generic Fallback
  return {
    name: 'Generic',
    language: 'Generic',
    packageManager: 'npm',
    commands: {
      dev: 'npm run dev',
      build: 'npm run build',
      lint: 'npm run lint',
      test: 'npm test',
    },
    detectedFiles,
  };
}

export function renderAgentsTemplate(templateContent: string, stack: DetectedStack): string {
  let rendered = templateContent;

  // Render Tech Stack section
  let frameworkLanguage = '{Framework / Language}';
  if (stack.framework && stack.framework !== stack.language) {
    frameworkLanguage = `${stack.language} (${stack.framework})`;
  } else if (stack.name && stack.name !== 'Generic') {
    frameworkLanguage = stack.name;
  } else if (stack.language && stack.language !== 'Generic') {
    frameworkLanguage = stack.language;
  }

  rendered = rendered.replace(
    /- \*\*Framework \/ Language\*\*:.*/,
    `- **Framework / Language**: ${frameworkLanguage}`
  );

  if (stack.packageManager) {
    rendered = rendered.replace(
      /- \*\*Package Manager\*\*:.*/,
      `- **Package Manager**: ${stack.packageManager}`
    );
  }

  if (stack.testFramework) {
    rendered = rendered.replace(
      /- \*\*Testing\*\*:.*/,
      `- **Testing**: ${stack.testFramework}`
    );
  }

  if (stack.styling) {
    rendered = rendered.replace(
      /- \*\*Styling \/ UI\*\*:.*/,
      `- **Styling / UI**: ${stack.styling}`
    );
  }

  // Render Development Workflows bash block
  const workflowLines: string[] = [];
  if (stack.commands.dev) {
    workflowLines.push(`${stack.commands.dev.padEnd(20)} # Local dev server / run`);
  }
  if (stack.commands.build) {
    workflowLines.push(`${stack.commands.build.padEnd(20)} # Production build`);
  }
  if (stack.commands.lint) {
    workflowLines.push(`${stack.commands.lint.padEnd(20)} # Lint / static analysis`);
  }
  if (stack.commands.typeCheck) {
    workflowLines.push(`${stack.commands.typeCheck.padEnd(20)} # Type / compiler check`);
  }
  if (stack.commands.test) {
    workflowLines.push(`${stack.commands.test.padEnd(20)} # Run test suite`);
  }
  if (stack.commands.testWatch) {
    workflowLines.push(`${stack.commands.testWatch.padEnd(20)} # Run tests in watch mode`);
  }

  if (workflowLines.length > 0) {
    const workflowsBlock = `\`\`\`bash\n${workflowLines.join('\n')}\n\`\`\``;
    rendered = rendered.replace(/```bash[\s\S]*?```/, workflowsBlock);
  }

  return rendered;
}
