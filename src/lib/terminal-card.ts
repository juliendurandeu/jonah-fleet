import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export interface SummaryCardOptions {
  routine: string;
  output?: string;
  repoRoot?: string;
  issue?: string | number;
  pr?: string | number;
  durationMs?: number;
}

export interface ErrorCardOptions {
  routine: string;
  exitCode: number;
  repoRoot: string;
  issue?: string | number;
  pr?: string | number;
  durationMs?: number;
  error?: Error;
}

export interface ParsedRunSummary {
  routine?: string;
  target?: string;
  decision?: string;
  result?: string;
  duration?: string;
  passes?: Array<{ name: string; status: 'pass' | 'fail' | 'info'; detail?: string }>;
  actions?: string[];
  logPath?: string;
}

/**
 * Strips temporary worktree roots and converts absolute worktree paths to clean relative paths.
 */
export function sanitizeWorktreePaths(text: string): string {
  // Replace file:///.../.jonah-fleet/worktrees/<session-id>/ with relative path
  let cleaned = text.replace(/file:\/\/\/[^\s"'()]+?\/\.jonah-fleet\/worktrees\/[^/\s"'()]+\//g, '');

  // Replace /path/to/.jonah-fleet/worktrees/<session-id>/ with relative path
  cleaned = cleaned.replace(/(?:^|[\s"'(`[])(?:\/[^\s"'()]+?)?\.jonah-fleet\/worktrees\/[^/\s"'()]+\//g, (match) => {
    const prefix = match.charAt(0);
    return prefix === '/' ? '' : prefix;
  });

  // Clean Markdown links where text and url are file paths: [`src/foo.ts`](file:///...) -> `src/foo.ts`
  cleaned = cleaned.replace(/\[`?([^`\]]+?)`?\]\(file:\/\/\/[^\s)]+\)/g, '`$1`');

  return cleaned;
}

/**
 * Extracts the '# ... Execution Summary' section from routine output text.
 */
export function extractExecutionSummary(output: string): string | null {
  const summaryHeaderRegex = /#\s+([A-Za-z0-9\s_-]+?Execution\s+Summary[\s\S]*)/i;
  const match = output.match(summaryHeaderRegex);
  if (!match) return null;

  let summary = match[1].trim();

  // Strip trailing completion messages if any leaked into the summary
  const trailingSeparators = [
    '✓ Local peer-review completed',
    '✓ Local autowork completed',
    '✓ Local agent session',
    '[6:',
    'Peer Review Watchdog:',
  ];

  for (const sep of trailingSeparators) {
    const idx = summary.indexOf(sep);
    if (idx !== -1) {
      summary = summary.slice(0, idx).trim();
    }
  }

  return sanitizeWorktreePaths(summary);
}

/**
 * Finds the latest committed run log in .github/prompts/logs/<routine>/*.md.
 */
export function findLatestRunLog(repoRoot: string, routine: string): string | null {
  const logsDir = path.join(repoRoot, '.github', 'prompts', 'logs', routine);
  if (!fs.existsSync(logsDir)) return null;

  try {
    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
    if (files.length === 0) return null;

    // Sort descending by name (ISO timestamp in name)
    files.sort().reverse();
    return path.join(logsDir, files[0]);
  } catch {
    return null;
  }
}

/**
 * Parses markdown run log files into structured data.
 */
export function parseRunLog(logContent: string): ParsedRunSummary {
  const summary: ParsedRunSummary = {
    passes: [],
    actions: [],
  };

  // Parse Metadata table
  const lines = logContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const parts = trimmed
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const key = parts[0].toLowerCase();
        const value = parts[1].replace(/`/g, '');
        if (key.includes('routine')) summary.routine = value;
        if (key.includes('target pr') || key.includes('target issue')) summary.target = value;
        if (key.includes('decision')) summary.decision = value;
        if (key.includes('result')) summary.result = value;
        if (key.includes('duration')) summary.duration = value;
      }
    }
  }

  // Parse Definition of Done or passes
  let inDoD = false;
  let inFindings = false;
  let inActions = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Definition of Done')) {
      inDoD = true;
      inFindings = false;
      inActions = false;
      continue;
    } else if (trimmed.startsWith('## Code Review Findings') || trimmed.startsWith('## Findings')) {
      inDoD = false;
      inFindings = true;
      inActions = false;
      continue;
    } else if (trimmed.startsWith('## Execution Trace') || trimmed.startsWith('### Actions Taken')) {
      inDoD = false;
      inFindings = false;
      inActions = true;
      continue;
    } else if (trimmed.startsWith('## ')) {
      inDoD = false;
      inFindings = false;
      inActions = false;
    }

    if (inDoD && trimmed.startsWith('|') && !trimmed.includes('Criterion') && !trimmed.includes('---')) {
      const parts = trimmed
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const criterion = parts[0];
        const met = parts[1].toUpperCase() === 'YES' || parts[1].toUpperCase() === 'PASS';
        const evidence = parts[2] ? ` (${parts[2].slice(0, 60)}...)` : '';
        summary.passes?.push({
          name: criterion,
          status: met ? 'pass' : 'fail',
          detail: evidence,
        });
      }
    }

    if (inActions && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
      summary.actions?.push(sanitizeWorktreePaths(trimmed.slice(2)));
    }
  }

  return summary;
}

/**
 * Heuristics to detect active stage from streaming agent tokens.
 */
export function detectActivePhase(chunk: string, currentPhase: string = 'Executing routine'): string {
  const lower = chunk.toLowerCase();

  if (lower.includes('🔒 addressing review findings') || lower.includes('addressing review findings by')) {
    return 'Claimed bounced PR, addressing review findings';
  }
  if (lower.includes('🔒 claimed') || lower.includes('claimed by local autowork') || lower.includes('claimed by autowork')) {
    return 'Claimed target issue, starting implementation';
  }
  if (lower.includes('starting review (round')) {
    return 'Claimed review window, starting review passes';
  }
  if (lower.includes('check-client-boundary')) return 'Verifying React Server Component boundaries';
  if (lower.includes('type-check') || lower.includes('tsc --noemit')) return 'Running TypeScript type checks';
  if (lower.includes('lint') || lower.includes('eslint')) return 'Running codebase linter';
  if (lower.includes('test') || lower.includes('vitest') || lower.includes('jest')) return 'Running automated test suite';
  if (lower.includes('build') || lower.includes('next build') || lower.includes('tsup')) return 'Running production build verification';
  if (lower.includes('code-review') || lower.includes('subagent')) return 'Running multi-angle code review passes';
  if (lower.includes('squash-merge') || lower.includes('pr merge')) return 'Squash-merging target PR to main';
  if (lower.includes('gh issue create') || lower.includes('autonomous issue synthesis')) return 'Synthesizing tracking issue';
  if (lower.includes('--undo') || lower.includes('draft')) return 'Bouncing PR back to draft for author fixes';
  if (lower.includes('issue edit') || lower.includes('pr edit')) return 'Linking PR & tracking issues';
  if (lower.includes('pr comment') || lower.includes('review summary')) return 'Submitting review comment';
  if (lower.includes('worktree')) return 'Preparing workspace worktree';

  return currentPhase;
}

/**
 * Detects if the agent has selected or claimed a specific issue in Scan mode.
 */
export function detectClaimedIssue(chunk: string): string | null {
  // Pattern 1: 🔒 Claimed ... #123
  const claimMatch = chunk.match(/🔒\s*Claimed[^\n#]*?#(\d+)/i);
  if (claimMatch) return `Issue #${claimMatch[1]}`;

  // Pattern 2: gh issue (view|edit|comment|develop) 123
  const ghMatch = chunk.match(/gh\s+issue\s+(?:view|edit|comment|develop)\s+(\d+)/i);
  if (ghMatch) return `Issue #${ghMatch[1]}`;

  // Pattern 3: Candidate issue #123, Selected issue #123, Claiming issue #123
  const textMatch = chunk.match(/(?:selected|claimed|claiming|target(?:ing)?|working|candidate)\s+(?:candidate\s+)?issue\s+#?(\d+)/i);
  if (textMatch) return `Issue #${textMatch[1]}`;

  // Pattern 4: Issue #123 claimed
  const passiveMatch = chunk.match(/issue\s+#(\d+)\s+(?:claimed|selected)/i);
  if (passiveMatch) return `Issue #${passiveMatch[1]}`;

  return null;
}

/**
 * Detects if the agent has selected a specific pull request in Scan mode.
 */
export function detectClaimedPR(chunk: string): string | null {
  // Pattern 0: 🔒 Addressing review findings ... PR #123 or on #123
  const findingMatch = chunk.match(/(?:addressing\s+review\s+findings|fixing\s+review\s+findings)[^\n#]*?#(\d+)/i);
  if (findingMatch) return `PR #${findingMatch[1]}`;

  // Pattern 1: Starting review (round N) on PR #123
  const reviewMatch = chunk.match(/Starting\s+review[^\n#]*?#(\d+)/i);
  if (reviewMatch) return `PR #${reviewMatch[1]}`;

  // Pattern 2: Selected Target PR: [PR #123] or PR #123
  const prMatch = chunk.match(/(?:selected|target|reviewing)\s+(?:target\s+)?PR:?\s*\[?PR\s*#?(\d+)/i);
  if (prMatch) return `PR #${prMatch[1]}`;

  // Pattern 3: gh pr (view|diff|checkout|review|edit|ready) 123
  const ghPrMatch = chunk.match(/gh\s+pr\s+(?:view|diff|checkout|review|edit|ready)\s+(\d+)/i);
  if (ghPrMatch) return `PR #${ghPrMatch[1]}`;

  return null;
}

/**
 * Renders a styled Unicode summary card.
 */
export function renderSummaryCard(options: SummaryCardOptions): string {
  const width = Math.min(Math.max((process.stdout.columns || 80) - 4, 60), 86);
  const horizontal = '─'.repeat(width - 2);

  const rawSummary = options.output ? extractExecutionSummary(options.output) : null;
  let parsedFromLog: ParsedRunSummary | null = null;

  if (options.repoRoot) {
    const latestLog = findLatestRunLog(options.repoRoot, options.routine);
    if (latestLog) {
      try {
        const content = fs.readFileSync(latestLog, 'utf8');
        parsedFromLog = parseRunLog(content);
        parsedFromLog.logPath = path.relative(options.repoRoot, latestLog);
      } catch {
        // Ignore read errors
      }
    }
  }

  // Format header details
  let target = options.pr ? `PR #${options.pr}` : options.issue ? `Issue #${options.issue}` : '';
  if (!target && parsedFromLog?.target) target = parsedFromLog.target;

  let decision = parsedFromLog?.decision || '';
  if (!decision && rawSummary) {
    const decisionMatch = rawSummary.match(/\*\*Final Action\*\*:\s*([^\n]+)/i);
    if (decisionMatch) decision = decisionMatch[1].replace(/[`*]/g, '').trim();
  }

  const durationStr = options.durationMs
    ? `${Math.round(options.durationMs / 1000)}s`
    : parsedFromLog?.duration || '';

  const lines: string[] = [];
  lines.push(pc.cyan(`┌${horizontal}┐`));

  // Title line
  const title = ` Jonah Fleet Routine: ${pc.bold(options.routine.toUpperCase())} `;
  lines.push(
    pc.cyan('│') +
      ` ${pc.bold(pc.white(options.routine.toUpperCase()))}` +
      (target ? ` · ${pc.yellow(target)}` : '') +
      (durationStr ? pc.dim(` (${durationStr})`) : '') +
      ' '.repeat(
        Math.max(
          1,
          width - 4 - options.routine.length - target.length - (durationStr ? durationStr.length + 3 : 0)
        )
      ) +
      pc.cyan('│')
  );

  if (decision) {
    let decisionBadge = pc.green(`✔ ${decision}`);
    if (/bounce|draft|reject|fail/i.test(decision)) {
      decisionBadge = pc.yellow(`⚠️  ${decision}`);
    } else if (/escalat/i.test(decision)) {
      decisionBadge = pc.red(`🚨 ${decision}`);
    }
    lines.push(
      pc.cyan('│') +
        ` Action: ${decisionBadge}` +
        ' '.repeat(Math.max(1, width - 11 - decision.length)) +
        pc.cyan('│')
    );
  }

  lines.push(pc.cyan(`├${horizontal}┤`));

  // If we have rawSummary markdown, format its core lines cleanly
  if (rawSummary) {
    const summaryLines = rawSummary.split('\n');

    for (const rawLine of summaryLines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('# ')) continue;
      if (line.startsWith('---')) continue;
      if (line.startsWith('**Selected Target') || line.startsWith('**Final Action') || line.startsWith('**Mode**:')) {
        continue; // Already in card header
      }

      if (line.startsWith('### ')) {
        const heading = line.replace('### ', '').trim();
        lines.push(
          pc.cyan('│') +
            ` ${pc.bold(pc.cyan(heading))}` +
            ' '.repeat(Math.max(1, width - 3 - heading.length)) +
            pc.cyan('│')
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const item = sanitizeWorktreePaths(line.slice(2)).trim();
        const formatted = item
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => pc.bold(text))
          .replace(/`([^`]+)`/g, (_, code) => pc.yellow(code));

        const plainLen = item
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1').length;
        if (plainLen <= width - 6) {
          lines.push(pc.cyan('│') + `  • ${formatted}` + ' '.repeat(Math.max(1, width - 5 - plainLen)) + pc.cyan('│'));
        } else {
          // Truncate cleanly if too long
          const truncated = formatted.slice(0, width - 10) + '...';
          lines.push(pc.cyan('│') + `  • ${truncated}` + ' '.repeat(Math.max(1, width - 5 - (width - 7))) + pc.cyan('│'));
        }
      } else if (/^[0-9]+\.\s+/.test(line)) {
        const item = sanitizeWorktreePaths(line.replace(/^[0-9]+\.\s+/, '')).trim();
        const formatted = item
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => pc.bold(text))
          .replace(/`([^`]+)`/g, (_, code) => pc.yellow(code));

        const plainLen = item
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1').length;
        if (plainLen <= width - 6) {
          lines.push(pc.cyan('│') + `  ✔ ${formatted}` + ' '.repeat(Math.max(1, width - 5 - plainLen)) + pc.cyan('│'));
        } else {
          const truncated = formatted.slice(0, width - 10) + '...';
          lines.push(pc.cyan('│') + `  ✔ ${truncated}` + ' '.repeat(Math.max(1, width - 5 - (width - 7))) + pc.cyan('│'));
        }
      }
    }
  } else if (parsedFromLog && parsedFromLog.passes && parsedFromLog.passes.length > 0) {
    // Fallback to parsed log passes
    lines.push(pc.cyan('│') + ` ${pc.bold('Verification Passes:')}` + ' '.repeat(Math.max(1, width - 23)) + pc.cyan('│'));
    for (const pass of parsedFromLog.passes.slice(0, 6)) {
      const icon = pass.status === 'pass' ? pc.green('✔') : pc.red('✖');
      const text = `${pass.name}${pass.detail || ''}`;
      const plainLen = text.length + 4;
      const truncated = plainLen > width - 6 ? text.slice(0, width - 10) + '...' : text;
      lines.push(pc.cyan('│') + `  ${icon} ${truncated}` + ' '.repeat(Math.max(1, width - 5 - truncated.length)) + pc.cyan('│'));
    }
  }

  // Footer section with log link
  if (parsedFromLog?.logPath) {
    lines.push(pc.cyan(`├${horizontal}┤`));
    const logInfo = ` Run log: ${pc.dim(parsedFromLog.logPath)}`;
    const logPlain = ` Run log: ${parsedFromLog.logPath}`;
    lines.push(pc.cyan('│') + logInfo + ' '.repeat(Math.max(1, width - 2 - logPlain.length)) + pc.cyan('│'));
  }

  lines.push(pc.cyan(`└${horizontal}┘`));
  return lines.join('\n');
}

/**
 * Renders an Error Card with tail of daemon.log.
 */
export function renderErrorCard(options: ErrorCardOptions): string {
  const width = Math.min(Math.max((process.stdout.columns || 80) - 4, 60), 86);
  const horizontal = '─'.repeat(width - 2);

  const lines: string[] = [];
  lines.push(pc.red(`┌${horizontal}┐`));

  const target = options.pr ? ` · PR #${options.pr}` : options.issue ? ` · Issue #${options.issue}` : '';
  const durationStr = options.durationMs ? ` (${Math.round(options.durationMs / 1000)}s)` : '';
  const routineUpper = options.routine.toUpperCase();
  const header = ` ✗ Routine '${routineUpper}' Failed (Exit Code ${options.exitCode})${target}${durationStr}`;
  const headerPlain = ` ✗ Routine '${routineUpper}' Failed (Exit Code ${options.exitCode})${target}${durationStr}`;

  lines.push(
    pc.red('│') +
      pc.bold(pc.red(header.slice(0, width - 3))) +
      ' '.repeat(Math.max(1, width - 2 - headerPlain.length)) +
      pc.red('│')
  );
  lines.push(pc.red(`├${horizontal}┤`));

  // Extract log tail
  const logPath = path.join(options.repoRoot, '.jonah-fleet', 'daemon.log');
  lines.push(pc.red('│') + pc.yellow(' Recent Log Output:') + ' '.repeat(Math.max(1, width - 21)) + pc.red('│'));

  if (fs.existsSync(logPath)) {
    try {
      const logContent = fs.readFileSync(logPath, 'utf8');
      const allLines = logContent.split('\n').filter((l) => l.trim().length > 0);
      const tailLines = allLines.slice(-10);

      for (const line of tailLines) {
        const cleaned = sanitizeWorktreePaths(line).trim();
        const truncated = cleaned.length > width - 6 ? cleaned.slice(0, width - 9) + '...' : cleaned;
        lines.push(pc.red('│') + pc.dim(`  ${truncated}`) + ' '.repeat(Math.max(1, width - 4 - truncated.length)) + pc.red('│'));
      }
    } catch {
      lines.push(
        pc.red('│') + pc.dim('  (Could not read .jonah-fleet/daemon.log)') + ' '.repeat(Math.max(1, width - 45)) + pc.red('│')
      );
    }
  } else {
    lines.push(pc.red('│') + pc.dim('  (No daemon.log found)') + ' '.repeat(Math.max(1, width - 26)) + pc.red('│'));
  }

  lines.push(pc.red(`├${horizontal}┤`));
  const relLogPath = path.relative(options.repoRoot, logPath) || '.jonah-fleet/daemon.log';
  const footer = ` Full trace: ${relLogPath}`;
  const truncatedFooter = footer.slice(0, width - 4);
  lines.push(pc.red('│') + pc.dim(truncatedFooter) + ' '.repeat(Math.max(1, width - 2 - truncatedFooter.length)) + pc.red('│'));
  lines.push(pc.red(`└${horizontal}┘`));

  return lines.join('\n');
}

/**
 * Minimalist zero-dependency terminal spinner.
 */
export class TerminalSpinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private message: string = '';
  private isRunning: boolean = false;
  private isTTY: boolean;

  constructor() {
    this.isTTY = Boolean(process.stderr.isTTY);
  }

  public start(initialMessage: string): void {
    this.message = initialMessage;
    this.startTime = Date.now();
    this.isRunning = true;

    if (!this.isTTY) {
      process.stderr.write(`[jonah-fleet] ${initialMessage}\n`);
      return;
    }

    this.intervalId = setInterval(() => {
      this.render();
    }, 80);
  }

  public update(newMessage: string): void {
    this.message = newMessage;
    if (!this.isTTY) {
      process.stderr.write(`[jonah-fleet] ${newMessage}\n`);
    }
  }

  private render(): void {
    if (!this.isRunning || !this.isTTY) return;

    const frame = pc.cyan(this.frames[this.currentFrame]);
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;

    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const timeStr = pc.dim(`[${mins}m ${secs < 10 ? '0' : ''}${secs}s]`);

    // \r moves to beginning of line, \x1b[K clears line to right
    process.stderr.write(`\r\x1b[K  ${frame} ${this.message}  ${timeStr}`);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.isTTY) {
      process.stderr.write('\r\x1b[K');
    }
  }
}
