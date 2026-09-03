import pc from 'picocolors';
import {
  isDaemonRunning,
  readDaemonState,
  startBackgroundDaemon,
  stopDaemon,
  runDaemonLoop,
  DaemonOptions,
} from '../lib/daemon.js';
import { listActiveWorktrees } from '../lib/worktree.js';

export interface DaemonCommandOptions {
  interval?: string;
  routines?: string;
  model?: string;
  foreground?: boolean;
}

export async function runDaemonCommand(action?: string, options: DaemonCommandOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const act = action?.toLowerCase() || (options.foreground ? 'foreground' : 'status');

  const daemonOpts: DaemonOptions = {
    interval: options.interval ? parseInt(options.interval, 10) : undefined,
    routines: options.routines ? options.routines.split(',').map((r) => r.trim()) : undefined,
    model: options.model,
    foreground: options.foreground,
  };

  if (act === 'start') {
    if (options.foreground) {
      await runDaemonLoop(cwd, daemonOpts);
      return;
    }

    try {
      const state = await startBackgroundDaemon(cwd, daemonOpts);
      console.log(pc.green(`\n✓ Background agent daemon started successfully.`));
      console.log(pc.dim(`   PID: ${state.pid}`));
      console.log(pc.dim(`   Poll Interval: Every ${state.intervalMinutes} minutes`));
      console.log(pc.dim(`   Routines: ${state.routines.join(', ')}`));
      console.log(pc.dim(`   Log file: .jonah-fleet/daemon.log`));
      console.log(pc.dim(`   Run 'jonah-fleet daemon status' or 'jonah-fleet daemon stop' to manage.`));
    } catch (err: any) {
      console.error(pc.red(`\n✗ Failed to start daemon: ${err.message}`));
      process.exit(1);
    }
    return;
  }

  if (act === 'stop') {
    if (!isDaemonRunning(cwd)) {
      console.log(pc.yellow(`\n⚠️  No local agent daemon is currently running in this repository.`));
      return;
    }
    const state = readDaemonState(cwd);
    console.log(pc.cyan(`\nStopping background agent daemon (PID ${state?.pid})...`));
    const stopped = await stopDaemon(cwd);
    if (stopped) {
      console.log(pc.green(`✓ Local agent daemon stopped successfully.`));
    } else {
      console.error(pc.red(`✗ Could not terminate daemon process.`));
      process.exit(1);
    }
    return;
  }

  if (act === 'foreground') {
    await runDaemonLoop(cwd, daemonOpts);
    return;
  }

  // Default: status
  const running = isDaemonRunning(cwd);
  const state = readDaemonState(cwd);
  const activeWorktrees = await listActiveWorktrees(cwd);

  console.log(pc.cyan(`\n🤖 Jonah Fleet Local Daemon Status\n`));
  if (running && state) {
    console.log(`  Status:         ${pc.green(pc.bold('RUNNING'))}`);
    console.log(`  PID:            ${state.pid}`);
    console.log(`  Started:        ${new Date(state.startedAt).toLocaleString()}`);
    console.log(`  Interval:       Every ${state.intervalMinutes} minutes`);
    console.log(`  Routines:       ${state.routines.join(', ')}`);
    console.log(`  Current State:  ${state.status === 'working' ? pc.yellow('WORKING on ' + state.activeRoutine) : pc.green('IDLE')}`);
    if (state.lastCheckAt) {
      console.log(`  Last Check:     ${new Date(state.lastCheckAt).toLocaleTimeString()}`);
    }
  } else {
    console.log(`  Status:         ${pc.gray('STOPPED')}`);
    console.log(pc.dim(`  Run 'jonah-fleet daemon start' to start the local worker daemon.`));
  }

  console.log(`\n  Active Worktrees: ${activeWorktrees.length}`);
  for (const wt of activeWorktrees) {
    console.log(pc.dim(`   - [${wt.branch}] ${wt.path}`));
  }
  console.log('');
}
