import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultManifest } from '../src/lib/manifest.js';
import { installFleet } from '../src/lib/installer.js';
import { checkDrift } from '../src/lib/diff.js';

describe('Fleet Installer & Drift Detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('installs standard preset files into target directory', () => {
    const manifest = createDefaultManifest('standard');
    const result = installFleet(tempDir, manifest);

    expect(result.promptsInstalled).toContain('autowork.md');
    expect(result.promptsInstalled).toContain('peer-review.md');
    expect(result.promptsInstalled).toContain('optimizer.md');
    expect(result.promptsInstalled).toContain('ORCHESTRATION.md');

    expect(fs.existsSync(path.join(tempDir, '.github/prompts/autowork.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.github/workflows/autowork-cron.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.agents/skills/tdd/SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);

    const drift = checkDrift(tempDir, manifest);
    expect(drift.missingPrompts.length).toBe(0);
    expect(drift.modifiedPrompts.length).toBe(0);
    expect(drift.missingWorkflows.length).toBe(0);
    expect(drift.missingSkills.length).toBe(0);
  });

  it('detects missing files as drift', () => {
    const manifest = createDefaultManifest('standard');
    installFleet(tempDir, manifest);

    // Remove one prompt file
    fs.unlinkSync(path.join(tempDir, '.github/prompts/autowork.md'));

    const drift = checkDrift(tempDir, manifest);
    expect(drift.missingPrompts).toContain('autowork.md');
  });

  it('detects modified files as drift', () => {
    const manifest = createDefaultManifest('standard');
    installFleet(tempDir, manifest);

    // Modify a prompt file
    fs.appendFileSync(path.join(tempDir, '.github/prompts/autowork.md'), '\n# Modified');

    const drift = checkDrift(tempDir, manifest);
    expect(drift.modifiedPrompts).toContain('autowork.md');
  });
});
