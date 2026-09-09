import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import pc from 'picocolors';
import { DaemonState } from './daemon.js';
import { WorktreeInfo } from './worktree.js';

export interface KeyboardControllerOptions {
  stdin?: NodeJS.ReadStream | EventEmitter;
  onReview?: () => Promise<void> | void;
  onAutowork?: () => Promise<void> | void;
  onPauseToggle?: () => void;
  onStatus?: () => void;
  onGracefulStop?: () => void;
  onForceStop?: () => void;
  onHelp?: () => void;
}

export class KeyboardController {
  private stdin: any;
  private isRaw: boolean = false;
  private listening: boolean = false;
  private keypressListener?: (str: string, key: readline.Key) => void;

  constructor(private options: KeyboardControllerOptions = {}) {
    this.stdin = options.stdin || process.stdin;
  }

  public start(): void {
    if (this.listening) return;

    if (this.stdin && typeof this.stdin.setRawMode === 'function' && this.stdin.isTTY) {
      readline.emitKeypressEvents(this.stdin);
      try {
        this.stdin.setRawMode(true);
        this.isRaw = true;
      } catch {
        this.isRaw = false;
      }
      if (typeof this.stdin.resume === 'function') {
        this.stdin.resume();
      }
    }

    this.keypressListener = (str: string, key: readline.Key) => {
      this.handleKeypress(str, key);
    };

    this.stdin.on('keypress', this.keypressListener);
    this.listening = true;
  }

  public handleKeypress(str: string, key?: readline.Key): void {
    const k = key || ({} as readline.Key);

    // Force stop on Ctrl+C or \u0003
    if ((k.ctrl && (k.name === 'c' || k.name === 'C')) || str === '\u0003') {
      this.options.onForceStop?.();
      return;
    }

    const keyName = (k.name || str || '').toLowerCase();

    if (keyName === 'r' || str === 'r' || str === 'R') {
      this.options.onReview?.();
    } else if (keyName === 'a' || str === 'a' || str === 'A') {
      this.options.onAutowork?.();
    } else if (keyName === 'p' || str === 'p' || str === 'P') {
      this.options.onPauseToggle?.();
    } else if (keyName === 's' || str === 's' || str === 'S') {
      this.options.onStatus?.();
    } else if (keyName === 'q' || str === 'q' || str === 'Q') {
      this.options.onGracefulStop?.();
    } else if (str === '?' || keyName === 'h' || str === 'h' || str === 'H') {
      this.options.onHelp?.();
    }
  }

  public stop(): void {
    if (!this.listening) return;
    if (this.keypressListener) {
      this.stdin.removeListener('keypress', this.keypressListener);
    }
    if (this.isRaw && typeof this.stdin.setRawMode === 'function') {
      try {
        this.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
    if (typeof this.stdin.pause === 'function') {
      try {
        this.stdin.pause();
      } catch {}
    }
    this.listening = false;
  }
}

export function printKeybindingCheatSheet(): void {
  console.log(pc.cyan(`\n⌨️  Jonah Fleet Daemon Keybindings\n`));
  console.log(`  ${pc.bold('r')}        Trigger peer-review scan immediately`);
  console.log(`  ${pc.bold('a')}        Trigger autowork backlog scan immediately`);
  console.log(`  ${pc.bold('p')}        Pause / resume automated polling intervals`);
  console.log(`  ${pc.bold('s')}        Print current daemon status summary card`);
  console.log(`  ${pc.bold('q')}        Graceful shutdown (waits for active routine to finish)`);
  console.log(`  ${pc.bold('Ctrl+C')}   Immediate force abort`);
  console.log(`  ${pc.bold('?')} / ${pc.bold('h')}   Show this keybindings cheat-sheet\n`);
}

export interface DaemonStatusSummaryOptions {
  repoRoot: string;
  state?: DaemonState | null;
  pendingRoutine?: string | null;
  activeWorktrees?: WorktreeInfo[];
}

export function printDaemonStatusSummary(options: DaemonStatusSummaryOptions): void {
  const { state, pendingRoutine, activeWorktrees = [] } = options;

  console.log(pc.cyan(`\n🤖 Jonah Fleet Local Daemon Status\n`));
  if (state) {
    let statusText: string;
    if (state.status === 'working') {
      const workingDesc = state.activeRoutine + (state.activeTarget ? ` (${pc.bold(state.activeTarget)})` : '');
      statusText = pc.yellow(pc.bold(`WORKING on ${workingDesc}`));
    } else if (state.status === 'paused') {
      statusText = pc.yellow(pc.bold('PAUSED'));
    } else {
      statusText = pc.green(pc.bold('RUNNING (IDLE)'));
    }

    console.log(`  Status:               ${statusText}`);
    console.log(`  PID:                  ${state.pid}`);
    console.log(`  Started:              ${new Date(state.startedAt).toLocaleString()}`);
    console.log(`  Peer Review Cadence:  Every ${state.reviewIntervalMinutes} minutes (0-token fast preflight)`);
    console.log(`  Autowork Cadence:     Every ${state.autoworkIntervalMinutes} minutes`);
    console.log(`  Routines:             ${state.routines.join(', ')}`);
    if (pendingRoutine) {
      console.log(`  Queued Routine:       ${pc.cyan(pc.bold(pendingRoutine))}`);
    }
    if (state.lastReviewCheckAt) {
      console.log(`  Last Review Check:    ${new Date(state.lastReviewCheckAt).toLocaleTimeString()}`);
    }
    if (state.lastAutoworkCheckAt) {
      console.log(`  Last Autowork Check:  ${new Date(state.lastAutoworkCheckAt).toLocaleTimeString()}`);
    }
  } else {
    console.log(`  Status:               ${pc.gray('STOPPED')}`);
    console.log(pc.dim(`  Run 'jonah-fleet daemon start' to start the local worker daemon.`));
  }

  console.log(`\n  Active Worktrees: ${activeWorktrees.length}`);
  for (const wt of activeWorktrees) {
    console.log(pc.dim(`   - [${wt.branch}] ${wt.path}`));
  }
  console.log('');
}
