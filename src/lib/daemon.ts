import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runLocalRoutine } from './runner.js';
import { cleanupStaleWorktrees } from './worktree.js';
import pc from 'picocolors';

const execFileAsync = promisify(execFile);

export interface DaemonState {
  pid: number;
  startedAt: string;
  reviewIntervalMinutes: number;
  autoworkIntervalMinutes: number;
  routines: string[];
  lastReviewCheckAt?: string;
  lastAutoworkCheckAt?: string;
  status: 'idle' | 'working' | 'stopped';
  activeRoutine?: string;
  activeWorktree?: string;
}

export interface DaemonOptions {
  interval?: number; // legacy fallback interval (minutes)
  reviewInterval?: number; // minutes (default: 3)
  autoworkInterval?: number; // minutes (default: 30)
  routines?: string[];
  model?: string;
  foreground?: boolean;
}

export function getDaemonStatePath(repoRoot: string): string {
  return path.join(repoRoot, '.jonah-fleet', 'daemon.json');
}

export function readDaemonState(repoRoot: string): DaemonState | null {
  const statePath = getDaemonStatePath(repoRoot);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as DaemonState;
  } catch {
    return null;
  }
}

export function writeDaemonState(repoRoot: string, state: DaemonState): void {
  const statePath = getDaemonStatePath(repoRoot);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function clearDaemonState(repoRoot: string): void {
  const statePath = getDaemonStatePath(repoRoot);
  if (fs.existsSync(statePath)) {
    try {
      fs.unlinkSync(statePath);
    } catch {
      // Ignore unlink errors
    }
  }
}

export function isDaemonRunning(repoRoot: string): boolean {
  const state = readDaemonState(repoRoot);
  if (!state || !state.pid) return false;
  try {
    // Check if process exists by sending signal 0
    process.kill(state.pid, 0);
    return true;
  } catch {
    // Process is dead, clean up stale state
    clearDaemonState(repoRoot);
    return false;
  }
}

/**
 * Fast pre-flight check to query number of open ready PRs in ~100ms with 0 token cost.
 */
export async function countOpenReadyPRs(repoRoot: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'list', '--state', 'open', '--draft=false', '--json', 'number', '--jq', 'length'],
      { cwd: repoRoot }
    );
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Starts the daemon in the background by detaching a child process.
 */
export async function startBackgroundDaemon(repoRoot: string, options: DaemonOptions = {}): Promise<DaemonState> {
  if (isDaemonRunning(repoRoot)) {
    const existing = readDaemonState(repoRoot);
    throw new Error(`Daemon is already running with PID ${existing?.pid}`);
  }

  const reviewInterval = options.reviewInterval || 3;
  const autoworkInterval = options.autoworkInterval || options.interval || 30;
  const routines = options.routines || ['peer-review', 'autowork'];

  // Path to cli entrypoint or executable
  const logFilePath = path.join(repoRoot, '.jonah-fleet', 'daemon.log');
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  const logFd = fs.openSync(logFilePath, 'a');

  // Spawn node with current entrypoint running daemon foreground mode
  const cliPath = process.argv[1];
  const args = [
    'daemon',
    '--foreground',
    '--review-interval',
    String(reviewInterval),
    '--autowork-interval',
    String(autoworkInterval),
    '--routines',
    routines.join(','),
  ];
  if (options.model) {
    args.push('--model', options.model);
  }

  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, JONAH_FLEET_DAEMON: 'true' },
  });

  child.unref();

  const state: DaemonState = {
    pid: child.pid!,
    startedAt: new Date().toISOString(),
    reviewIntervalMinutes: reviewInterval,
    autoworkIntervalMinutes: autoworkInterval,
    routines,
    status: 'idle',
  };

  writeDaemonState(repoRoot, state);
  return state;
}

/**
 * Stops a running daemon process.
 */
export async function stopDaemon(repoRoot: string): Promise<boolean> {
  const state = readDaemonState(repoRoot);
  if (!state || !state.pid) return false;

  try {
    process.kill(state.pid, 'SIGTERM');
    clearDaemonState(repoRoot);
    await cleanupStaleWorktrees(repoRoot);
    return true;
  } catch {
    clearDaemonState(repoRoot);
    return false;
  }
}

/**
 * Runs the multi-cadence polling daemon loop in the current process.
 */
export async function runDaemonLoop(repoRoot: string, options: DaemonOptions = {}): Promise<void> {
  const reviewInterval = options.reviewInterval || 3;
  const autoworkInterval = options.autoworkInterval || options.interval || 30;
  const routines = options.routines || ['peer-review', 'autowork'];

  const state: DaemonState = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    reviewIntervalMinutes: reviewInterval,
    autoworkIntervalMinutes: autoworkInterval,
    routines,
    status: 'idle',
  };
  writeDaemonState(repoRoot, state);

  console.log(pc.cyan(`\n🤖 Jonah Fleet Multi-Cadence Local Agent Daemon Started`));
  console.log(pc.dim(`   PID: ${process.pid}`));
  console.log(pc.dim(`   Peer Review Watchdog: Every ${reviewInterval} minutes (with zero-cost PR preflight)`));
  console.log(pc.dim(`   Autowork Backlog Scan: Every ${autoworkInterval} minutes`));
  console.log(pc.dim(`   Working Directory: ${repoRoot}\n`));

  let isStopping = false;
  let isWorking = false;

  const handleStop = async () => {
    if (isStopping) return;
    isStopping = true;
    console.log(pc.yellow(`\nStopping local agent daemon...`));
    clearDaemonState(repoRoot);
    await cleanupStaleWorktrees(repoRoot);
    process.exit(0);
  };

  process.once('SIGINT', handleStop);
  process.once('SIGTERM', handleStop);

  const runReviewCheck = async () => {
    if (isStopping || isWorking) return;
    state.lastReviewCheckAt = new Date().toISOString();
    writeDaemonState(repoRoot, state);

    const openPRCount = await countOpenReadyPRs(repoRoot);
    if (openPRCount === 0) {
      console.log(pc.dim(`[${new Date().toLocaleTimeString()}] Peer Review Watchdog: 0 ready PRs found (0 tokens used).`));
      return;
    }

    try {
      isWorking = true;
      state.status = 'working';
      state.activeRoutine = 'peer-review';
      writeDaemonState(repoRoot, state);

      console.log(pc.cyan(`\n[${new Date().toLocaleTimeString()}] 🔍 Peer Review Watchdog: Found ${openPRCount} ready PR(s). Starting review session...`));
      await cleanupStaleWorktrees(repoRoot);

      const result = await runLocalRoutine({
        targetDir: repoRoot,
        routine: 'peer-review',
        model: options.model,
        noWorktree: false,
      });

      if (result.success) {
        console.log(pc.green(`✓ Local peer-review completed successfully.`));
      } else {
        console.warn(pc.yellow(`⚠️  Local peer-review completed with code ${result.exitCode}.`));
      }
    } catch (err: any) {
      console.error(pc.red(`✗ Error in peer-review: ${err.message}`));
    } finally {
      isWorking = false;
      state.status = 'idle';
      state.activeRoutine = undefined;
      writeDaemonState(repoRoot, state);
    }
  };

  const runAutoworkCheck = async () => {
    if (isStopping || isWorking || !routines.includes('autowork')) return;
    state.lastAutoworkCheckAt = new Date().toISOString();
    writeDaemonState(repoRoot, state);

    try {
      isWorking = true;
      state.status = 'working';
      state.activeRoutine = 'autowork';
      writeDaemonState(repoRoot, state);

      console.log(pc.cyan(`\n[${new Date().toLocaleTimeString()}] 🚀 Autowork Backlog Scan: Starting session...`));
      await cleanupStaleWorktrees(repoRoot);

      const result = await runLocalRoutine({
        targetDir: repoRoot,
        routine: 'autowork',
        model: options.model,
        noWorktree: false,
      });

      if (result.success) {
        console.log(pc.green(`✓ Local autowork completed successfully.`));
      } else {
        console.warn(pc.yellow(`⚠️  Local autowork completed with code ${result.exitCode}.`));
      }
    } catch (err: any) {
      console.error(pc.red(`✗ Error in autowork: ${err.message}`));
    } finally {
      isWorking = false;
      state.status = 'idle';
      state.activeRoutine = undefined;
      writeDaemonState(repoRoot, state);
    }
  };

  // Run initial checks on start
  if (routines.includes('peer-review')) {
    await runReviewCheck();
  }
  if (routines.includes('autowork')) {
    await runAutoworkCheck();
  }

  // Set up decoupled timers
  const reviewIntervalMs = reviewInterval * 60 * 1000;
  const autoworkIntervalMs = autoworkInterval * 60 * 1000;

  const reviewTimer = setInterval(runReviewCheck, reviewIntervalMs);
  const autoworkTimer = setInterval(runAutoworkCheck, autoworkIntervalMs);

  // Keep process alive
  await new Promise<void>(() => {});
}
