import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverSkillsPrompt, buildRoutinePrompt, runLocalRoutine } from '../src/lib/runner.js';

describe('Local Routine Runner', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-runner-test-'));
    fs.mkdirSync(path.join(tmpRepo, '.agents', 'skills', 'tdd'), { recursive: true });
    fs.writeFileSync(path.join(tmpRepo, '.agents', 'skills', 'tdd', 'SKILL.md'), '# TDD\n', 'utf8');

    fs.mkdirSync(path.join(tmpRepo, '.github', 'prompts'), { recursive: true });
    fs.writeFileSync(path.join(tmpRepo, '.github', 'prompts', 'autowork.md'), '# Autowork\n', 'utf8');
    fs.writeFileSync(path.join(tmpRepo, '.github', 'prompts', 'peer-review.md'), '# Peer Review\n', 'utf8');
    fs.writeFileSync(path.join(tmpRepo, '.github', 'prompts', 'optimizer.md'), '# Optimizer\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('discovers skills in .agents/skills directory', () => {
    const skills = discoverSkillsPrompt(tmpRepo);
    expect(skills).toContain('Read and follow .agents/skills/tdd/SKILL.md.');
  });

  it('builds autowork prompt in Targeted mode', () => {
    const prompt = buildRoutinePrompt(tmpRepo, 'autowork', { issue: 42 });
    expect(prompt).toContain('Targeted mode: work issue #42 directly');
    expect(prompt).toContain('Read and follow .agents/skills/tdd/SKILL.md.');
  });

  it('builds autowork prompt in Scan mode', () => {
    const prompt = buildRoutinePrompt(tmpRepo, 'autowork');
    expect(prompt).toContain('Scan mode: check open PRs for review comments to fix');
    expect(prompt).toContain('Read and follow .agents/skills/tdd/SKILL.md.');
  });

  it('builds peer-review prompt in Targeted mode', () => {
    const prompt = buildRoutinePrompt(tmpRepo, 'peer-review', { pr: 105 });
    expect(prompt).toContain('Targeted mode: review PR #105 directly');
  });

  it('builds peer-review prompt in Scan mode', () => {
    const prompt = buildRoutinePrompt(tmpRepo, 'peer-review');
    expect(prompt).toContain('Scan mode: check open PRs and select the highest-priority PR');
  });

  it('runs local routine in dry-run mode without launching processes', async () => {
    const result = await runLocalRoutine({
      targetDir: tmpRepo,
      routine: 'autowork',
      issue: 99,
      dryRun: true,
      noWorktree: true,
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('[DRY RUN]');
    expect(result.output).toContain('issue #99');
  });

  it('accepts verbose flag in runLocalRoutine options', async () => {
    const result = await runLocalRoutine({
      targetDir: tmpRepo,
      routine: 'peer-review',
      pr: 10,
      dryRun: true,
      verbose: true,
      noWorktree: true,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('[DRY RUN]');
  });
});
