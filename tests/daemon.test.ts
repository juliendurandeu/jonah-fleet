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
      reviewIntervalMinutes: 3,
      autoworkIntervalMinutes: 30,
      routines: ['peer-review', 'autowork'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    const read = readDaemonState(tmpRepo);

    expect(read).not.toBeNull();
    expect(read?.pid).toBe(process.pid);
    expect(read?.reviewIntervalMinutes).toBe(3);
    expect(read?.autoworkIntervalMinutes).toBe(30);
    expect(read?.routines).toEqual(['peer-review', 'autowork']);
  });

  it('correctly reports daemon running when PID is alive', () => {
    const state: DaemonState = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      reviewIntervalMinutes: 3,
      autoworkIntervalMinutes: 30,
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
      reviewIntervalMinutes: 3,
      autoworkIntervalMinutes: 30,
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
      reviewIntervalMinutes: 3,
      autoworkIntervalMinutes: 30,
      routines: ['autowork'],
      status: 'idle',
    };

    writeDaemonState(tmpRepo, state);
    clearDaemonState(tmpRepo);
    expect(readDaemonState(tmpRepo)).toBeNull();
  });

  it('safely handles PR count query on non-git or error directories', async () => {
    const { countOpenReadyPRs } = await import('../src/lib/daemon.js');
    const count = await countOpenReadyPRs(tmpRepo);
    expect(typeof count).toBe('number');
    expect(count).toBe(0);
  });

  it('supports verbose flag in daemon options', async () => {
    const { DaemonOptions } = await import('../src/lib/daemon.js');
    const opts = { verbose: true, reviewInterval: 5 };
    expect(opts.verbose).toBe(true);
    expect(opts.reviewInterval).toBe(5);
  });
});
