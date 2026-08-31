import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runInit } from '../src/commands/init.js';

describe('Init Command with Smart Stack Detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes repository and auto-detects Rust stack', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'Cargo.toml'),
      '[package]\nname="rust-app"\nversion="0.1.0"\nedition="2021"\n[dependencies]\naxum="0.7"\n'
    );

    await runInit({ cwd: tempDir, preset: 'standard' });

    expect(fs.existsSync(path.join(tempDir, 'agents-manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);

    const agentsMd = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('- **Framework / Language**: Rust (Axum)');
    expect(agentsMd).toContain('- **Package Manager**: cargo');
    expect(agentsMd).toContain('cargo test');
    expect(agentsMd).toContain('cargo build --release');
  });

  it('allows command-line flag overrides for stack parameters', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'custom-app', scripts: { start: 'node index.js' } })
    );

    await runInit({
      cwd: tempDir,
      preset: 'minimal',
      stack: 'Custom Fullstack',
      packageManager: 'pnpm',
      testCmd: 'pnpm test:unit',
      buildCmd: 'pnpm build:prod',
    });

    const agentsMd = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('- **Framework / Language**: Custom Fullstack');
    expect(agentsMd).toContain('- **Package Manager**: pnpm');
    expect(agentsMd).toContain('pnpm test:unit');
    expect(agentsMd).toContain('pnpm build:prod');
  });
});

