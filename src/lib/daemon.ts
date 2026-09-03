import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runLocalRoutine } from './runner.js';
import { cleanupStaleWorktrees, listActiveWorktrees } from './worktree.js';
import pc from 'picocolors';

export interface DaemonState {
  pid: number;
  startedAt: string;
  intervalMinutes: number;
  routines: string[];
  lastCheckAt?: string;
  status: 'idle' | 'working' | 'stopped';
  activeRoutine?: string;
  activeWorktree?: string;
}

export interface DaemonOptions {
  interval?: number; // minutes
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
 * Starts the daemon in the background by detaching a child process.
 */
export async function startBackgroundDaemon(repoRoot: string, options: DaemonOptions = {}): Promise<DaemonState> {
  if (isDaemonRunning(repoRoot)) {
    const existing = readDaemonState(repoRoot);
    throw new Error(`Daemon is already running with PID ${existing?.pid}`);
  }

  const interval = options.interval || 30;
  const routines = options.routines || ['autowork', 'peer-review'];

  // Path to cli entrypoint or executable
  const logFilePath = path.join(repoRoot, '.jonah-fleet', 'daemon.log');
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  const logFd = fs.openSync(logFilePath, 'a');

  // Spawn node with current entrypoint running daemon foreground mode
  const cliPath = process.argv[1];
  const args = ['daemon', '--foreground', '--interval', String(interval), '--routines', routines.join(',')];
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
    intervalMinutes: interval,
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
 * Runs the polling daemon loop in the current process.
 */
export async function runDaemonLoop(repoRoot: string, options: DaemonOptions = {}): Promise<void> {
  const intervalMinutes = options.interval || 30;
  const intervalMs = intervalMinutes * 60 * 1000;
  const routines = options.routines || ['autowork', 'peer-review'];

  const state: DaemonState = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    intervalMinutes,
    routines,
    status: 'idle',
  };
  writeDaemonState(repoRoot, state);

  console.log(pc.cyan(`\n🤖 Jonah Fleet Local Agent Daemon Started`));
  console.log(pc.dim(`   PID: ${process.pid}`));
  console.log(pc.dim(`   Poll Interval: Every ${intervalMinutes} minutes`));
  console.log(pc.dim(`   Routines: ${routines.join(', ')}`));
  console.log(pc.dim(`   Working Directory: ${repoRoot}\n`));

  let isStopping = false;

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

  const runTick = async () => {
    if (isStopping) return;
    const now = new Date().toISOString();
    state.lastCheckAt = now;
    writeDaemonState(repoRoot, state);

    console.log(pc.dim(`[${new Date().toLocaleTimeString()}] Running routine polling sweep...`));

    // Cleanup stale worktrees before new work
    await cleanupStaleWorktrees(repoRoot);

    for (const routine of routines) {
      if (isStopping) break;
      try {
        state.status = 'working';
        state.activeRoutine = routine;
        writeDaemonState(repoRoot, state);

        console.log(pc.cyan(`\n▶ Starting local scan for ${routine}...`));
        const result = await runLocalRoutine({
          targetDir: repoRoot,
          routine,
          model: options.model,
          noWorktree: false,
        });

        if (result.success) {
          console.log(pc.green(`✓ Local routine '${routine}' finished successfully.`));
        } else {
          console.warn(pc.yellow(`⚠️  Local routine '${routine}' completed with code ${result.exitCode}.`));
        }
      } catch (err: any) {
        console.error(pc.red(`✗ Error running routine '${routine}': ${err.message}`));
      } finally {
        state.status = 'idle';
        state.activeRoutine = undefined;
        state.activeWorktree = undefined;
        writeDaemonState(repoRoot, state);
      }
    }

    console.log(pc.dim(`[${new Date().toLocaleTimeString()}] Sweep completed. Next run in ${intervalMinutes}m.`));
  };

  // Run first sweep immediately
  await runTick();

  // Schedule recurring sweeps
  const intervalId = setInterval(runTick, intervalMs);

  // Keep process alive
  await new Promise<void>(() => {});
}
