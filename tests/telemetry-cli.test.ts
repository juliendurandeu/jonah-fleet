import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runTelemetry } from '../src/commands/telemetry.js';

describe('Telemetry CLI Command', () => {
  let tmpDir: string;
  let logDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-telem-test-'));
    logDir = path.join(tmpDir, '.github/prompts/logs/autowork');
    fs.mkdirSync(logDir, { recursive: true });
    process.env.JONAH_FLEET_CONFIG_DIR = tmpDir;
  });

  afterEach(() => {
    delete process.env.JONAH_FLEET_CONFIG_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('aggregates local logs and outputs formatted dashboard and JSON', async () => {
    const logContent = `
# Run Log
## Metadata
| Field | Value |
|-------|-------|
| Routine | \`autowork\` |
| Timestamp | \`2026-08-25T14:30:00Z\` |
| Result | \`SUCCESS\` |
| Input tokens | 80000 |
| Output tokens | 5000 |
| Estimated cost | $0.25 |
| Duration | 180s |
| Iterations used | 14 / 65 |
`;
    fs.writeFileSync(path.join(logDir, '2026-08-25T14-30-00Z.md'), logContent, 'utf8');

    let consoleOutput = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      consoleOutput += msg + '\n';
    });

    // 1. Text dashboard
    await runTelemetry({ cwd: tmpDir });
    expect(consoleOutput).toContain('Jonah Fleet Telemetry Hub');
    expect(consoleOutput).toContain('autowork');
    expect(consoleOutput).toContain('85.0k');

    // 2. JSON dashboard
    consoleOutput = '';
    await runTelemetry({ cwd: tmpDir, json: true, budget: 10_000_000 });
    const parsed = JSON.parse(consoleOutput);
    expect(parsed.totalRuns).toBe(1);
    expect(parsed.totalTokens).toBe(85000);
    expect(parsed.budget.weeklyCeilingTokens).toBe(10_000_000);
    expect(parsed.budget.status).toBe('HEALTHY');

    consoleSpy.mockRestore();
  });

  it('handles emitting a specific run log to an endpoint', async () => {
    const logPath = path.join(logDir, 'sample-run.md');
    const logContent = `
# Run Log
## Metadata
| Field | Value |
|-------|-------|
| Routine | \`peer-review\` |
| Timestamp | \`2026-08-25T15:00:00Z\` |
| Result | \`SUCCESS\` |
| Input tokens | 30000 |
| Output tokens | 2000 |
| Estimated cost | $0.09 |
`;
    fs.writeFileSync(logPath, logContent, 'utf8');

    let consoleOutput = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      consoleOutput += msg + '\n';
    });

    await runTelemetry({ cwd: tmpDir, action: 'emit', log: logPath, json: true });
    const parsed = JSON.parse(consoleOutput);
    expect(parsed.success).toBe(true);
    expect(parsed.summary.routine).toBe('peer-review');
    expect(parsed.summary.totalTokens).toBe(32000);

    consoleSpy.mockRestore();
  });

  it('handles missing log gracefully', async () => {
    let consoleOutput = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      consoleOutput += msg + '\n';
    });

    await runTelemetry({ cwd: tmpDir, action: 'emit', log: path.join(tmpDir, 'nonexistent.md'), json: true });
    const parsed = JSON.parse(consoleOutput);
    expect(parsed.error).toContain('No log file found');

    consoleSpy.mockRestore();
  });
});
