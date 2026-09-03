import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getDaemonStatePath,
  readDaemonState,
  writeDaemonState,
  clearDaemonState,
  isDaemonRunning,
  DaemonState,
} from '../src/lib/daemon.js';

describe('Local Agent Daemon Manager', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-daemon-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('computes correct daemon state file path', () => {
    const statePath = getDaemonStatePath(tmpRepo);
    expect(statePath).toBe(path.join(tmpRepo, '.jonah-fleet', 'daemon.json'));
  });

  it('reads and writes daemon state', () => {
    const state: DaemonState = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      intervalMinutes: 15,
      routines: ['autowork', 'peer-review'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    const read = readDaemonState(tmpRepo);

    expect(read).not.toBeNull();
    expect(read?.pid).toBe(process.pid);
    expect(read?.intervalMinutes).toBe(15);
    expect(read?.routines).toEqual(['autowork', 'peer-review']);
  });

  it('correctly reports daemon running when PID is alive', () => {
    const state: DaemonState = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      intervalMinutes: 30,
      routines: ['autowork'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    expect(isDaemonRunning(tmpRepo)).toBe(true);
  });

  it('cleans up and reports false when PID is dead', () => {
    const deadPid = 99999999;
    const state: DaemonState = {
      pid: deadPid,
      startedAt: new Date().toISOString(),
      intervalMinutes: 30,
      routines: ['autowork'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    expect(isDaemonRunning(tmpRepo)).toBe(false);
    expect(readDaemonState(tmpRepo)).toBeNull();
  });

  it('clears daemon state file on command', () => {
    const state: DaemonState = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      intervalMinutes: 30,
      routines: ['autowork'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    clearDaemonState(tmpRepo);
    expect(readDaemonState(tmpRepo)).toBeNull();
  });
});
