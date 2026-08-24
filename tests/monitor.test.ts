import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runMonitor } from '../src/commands/monitor.js';
import { loadGlobalConfig } from '../src/lib/global-config.js';

describe('Monitor Command', () => {
  let tempDir: string;
  let customConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-mon-test-'));
    customConfigFile = path.join(tempDir, 'config.json');
    process.env.JONAH_FLEET_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.JONAH_FLEET_CONFIG_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('adds and removes repositories from global registry via flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runMonitor({ add: 'owner/test-repo-1', cwd: tempDir });
    expect(loadGlobalConfig(customConfigFile).repositories).toContain('owner/test-repo-1');

    await runMonitor({ remove: 'owner/test-repo-1', cwd: tempDir });
    expect(loadGlobalConfig(customConfigFile).repositories).not.toContain('owner/test-repo-1');
  });

  it('runs monitor in json mode and outputs structured json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockExecutor = async (args: string[]) => {
      if (args.includes('pr')) return '[]';
      if (args.includes('issue')) return '[]';
      return '{}';
    };

    await runMonitor({
      repos: ['owner/repo-a'],
      json: true,
      executor: mockExecutor,
      cwd: tempDir,
    });

    expect(logSpy).toHaveBeenCalled();
    const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed.repositories[0].repo).toBe('owner/repo-a');
  });
});
