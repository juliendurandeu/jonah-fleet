import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { createWorktree, removeWorktree } from './worktree.js';
import {
  TerminalSpinner,
  detectActivePhase,
  renderSummaryCard,
  renderErrorCard,
} from './terminal-card.js';
import pc from 'picocolors';

export interface RunLocalRoutineOptions {
  targetDir: string;
  routine: string;
  issue?: string | number;
  pr?: string | number;
  model?: string;
  printTimeout?: string;
  noWorktree?: boolean;
  keepWorktree?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  showCard?: boolean;
  env?: Record<string, string>;
  onLog?: (chunk: string) => void;
}

export interface RunLocalRoutineResult {
  success: boolean;
  exitCode: number;
  output: string;
  worktreePath?: string;
  branchName?: string;
}

/**
 * Discovers domain skills in .agents/skills and formats instruction string.
 */
export function discoverSkillsPrompt(targetDir: string): string {
  const skillsDir = path.join(targetDir, '.agents', 'skills');
  if (!fs.existsSync(skillsDir)) return '';

  let skillsPrompt = '';
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join('.agents', 'skills', entry.name, 'SKILL.md');
        const fullPath = path.join(targetDir, skillPath);
        if (fs.existsSync(fullPath)) {
          skillsPrompt += `Read and follow ${skillPath}. `;
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return skillsPrompt;
}

/**
 * Builds the prompt string for a given routine and target.
 */
export function buildRoutinePrompt(
  targetDir: string,
  routine: string,
  options: { issue?: string | number; pr?: string | number } = {}
): string {
  const skillsPrompt = discoverSkillsPrompt(targetDir);
  const promptFile = `.github/prompts/${routine}.md`;

  if (routine === 'autowork') {
    if (options.issue) {
      return `You are the Autowork routine for this repository. Read and follow the instructions in ${promptFile} exactly. ${skillsPrompt}Your target is issue #${options.issue}. You are in Targeted mode: work issue #${options.issue} directly, ahead of Phase 1 convergence and priority scan.`;
    }
    return `You are the Autowork routine for this repository. Read and follow the instructions in ${promptFile} exactly. ${skillsPrompt}You are in Scan mode: check open PRs for review comments to fix, close merged issues, then pick the highest-priority unclaimed issue.`;
  }

  if (routine === 'peer-review') {
    if (options.pr) {
      return `You are the Peer Review routine for this repository. Read and follow the instructions in ${promptFile} exactly. ${skillsPrompt}Your target is pull request #${options.pr}. You are in Targeted mode: review PR #${options.pr} directly.`;
    }
    return `You are the Peer Review routine for this repository. Read and follow the instructions in ${promptFile} exactly. ${skillsPrompt}You are in Scan mode: check open PRs and select the highest-priority PR to review.`;
  }

  return `You are the ${routine} routine for this repository. Read and follow the instructions in ${promptFile} exactly. ${skillsPrompt}`;
}

/**
 * Checks if Antigravity CLI (`agy`) is installed and accessible.
 */
export function isAgyInstalled(): boolean {
  try {
    execSync('agy --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs a routine locally with worktree isolation and Antigravity CLI invocation.
 */
export async function runLocalRoutine(options: RunLocalRoutineOptions): Promise<RunLocalRoutineResult> {
  const targetDir = path.resolve(options.targetDir);
  const routine = options.routine;
  const model = options.model || 'gemini-3.7-flash-high';
  const printTimeout = options.printTimeout || '30m';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hostname = os.hostname();

  // Validate prompt file existence
  const promptFile = path.join(targetDir, '.github', 'prompts', `${routine}.md`);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Routine prompt file not found: ${promptFile}`);
  }

  // Generate branch name
  let branchName = `agent/${routine}-${timestamp}`;
  if (options.issue) {
    branchName = `agent/${routine}-issue-${options.issue}-${timestamp}`;
  } else if (options.pr) {
    branchName = `agent/${routine}-pr-${options.pr}-${timestamp}`;
  }

  let worktreePath: string | undefined;
  let executionDir = targetDir;

  if (!options.noWorktree && !options.dryRun) {
    const worktreeResult = await createWorktree(targetDir, { branchName });
    worktreePath = worktreeResult.worktreePath;
    executionDir = worktreePath;
  }

  const prompt = buildRoutinePrompt(executionDir, routine, {
    issue: options.issue,
    pr: options.pr,
  });

  if (options.dryRun) {
    return {
      success: true,
      exitCode: 0,
      output: `[DRY RUN] Would execute routine '${routine}' in ${options.noWorktree ? 'current directory' : 'worktree'}:\nPrompt: ${prompt}\nModel: ${model}\nTimeout: ${printTimeout}`,
      worktreePath,
      branchName,
    };
  }

  // Prepare environment
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...options.env,
    LOCAL_AGENT: 'true',
    LOCAL_HOST: hostname,
    TARGET_ISSUE: options.issue ? String(options.issue) : '',
    PR_NUMBER: options.pr ? String(options.pr) : '',
  };

  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--output-format',
    'text',
    '--print-timeout',
    printTimeout,
    '--dangerously-skip-permissions',
  ];

  let output = '';
  let exitCode = 0;
  const startTime = Date.now();

  const logDir = path.join(targetDir, '.jonah-fleet');
  fs.mkdirSync(logDir, { recursive: true });
  const logFilePath = path.join(logDir, 'daemon.log');

  const targetLabel = options.pr
    ? `PR #${options.pr}`
    : options.issue
      ? `Issue #${options.issue}`
      : routine;

  let activePhase = 'Starting session...';
  const spinner = !options.verbose ? new TerminalSpinner() : null;
  if (spinner) {
    spinner.start(`${targetLabel}: ${activePhase}`);
  }

  // Cleanup handler on process interruption
  const cleanup = async () => {
    spinner?.stop();
    if (worktreePath && !options.keepWorktree) {
      await removeWorktree(targetDir, worktreePath, { deleteBranch: false }).catch(() => {});
    }
  };

  const sigintHandler = async () => {
    await cleanup();
    process.exit(130);
  };
  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigintHandler);

  try {
    exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn('agy', args, {
        cwd: executionDir,
        env: childEnv,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

        try {
          fs.appendFileSync(logFilePath, chunk, 'utf8');
        } catch {
          // Ignore log write errors
        }

        if (options.onLog) {
          options.onLog(chunk);
        }

        if (options.verbose) {
          process.stdout.write(chunk);
        } else if (spinner) {
          const newPhase = detectActivePhase(chunk, activePhase);
          if (newPhase !== activePhase) {
            activePhase = newPhase;
            spinner.update(`${targetLabel}: ${activePhase}`);
          }
        }
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

        try {
          fs.appendFileSync(logFilePath, chunk, 'utf8');
        } catch {
          // Ignore log write errors
        }

        if (options.onLog) {
          options.onLog(chunk);
        }

        if (options.verbose) {
          process.stderr.write(chunk);
        } else if (spinner) {
          const newPhase = detectActivePhase(chunk, activePhase);
          if (newPhase !== activePhase) {
            activePhase = newPhase;
            spinner.update(`${targetLabel}: ${activePhase}`);
          }
        }
      });

      child.on('error', (err) => {
        spinner?.stop();
        reject(err);
      });

      child.on('close', (code) => {
        spinner?.stop();
        resolve(code ?? 0);
      });
    });
  } finally {
    spinner?.stop();
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigintHandler);
    if (!options.keepWorktree) {
      await cleanup();
    }
  }

  // Render Card if not in verbose mode and showCard is not disabled
  if (options.showCard !== false && !options.verbose) {
    const durationMs = Date.now() - startTime;
    if (exitCode === 0) {
      console.log(
        '\n' +
          renderSummaryCard({
            routine,
            output,
            repoRoot: targetDir,
            issue: options.issue,
            pr: options.pr,
            durationMs,
          }) +
          '\n'
      );
    } else {
      console.log(
        '\n' +
          renderErrorCard({
            routine,
            exitCode,
            repoRoot: targetDir,
            issue: options.issue,
            pr: options.pr,
            durationMs,
          }) +
          '\n'
      );
    }
  }

  return {
    success: exitCode === 0,
    exitCode,
    output,
    worktreePath,
    branchName,
  };
}
