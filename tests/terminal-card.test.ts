import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  sanitizeWorktreePaths,
  extractExecutionSummary,
  findLatestRunLog,
  parseRunLog,
  detectActivePhase,
  detectClaimedIssue,
  detectClaimedPR,
  renderSummaryCard,
  renderErrorCard,
  TerminalSpinner,
} from '../src/lib/terminal-card.js';

describe('Terminal UI & Card Primitives', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-card-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  describe('sanitizeWorktreePaths', () => {
    it('strips file:/// URLs pointing to temporary worktrees', () => {
      const raw =
        'Conformance to [`AGENTS.md`](file:///home/user/repo/.jonah-fleet/worktrees/agent-peer-review-2026-09-03/AGENTS.md) and [`DESIGN_SYSTEM.md`](file:///home/user/repo/.jonah-fleet/worktrees/agent-peer-review-2026-09-03/DESIGN_SYSTEM.md)';
      const sanitized = sanitizeWorktreePaths(raw);
      expect(sanitized).not.toContain('.jonah-fleet/worktrees');
      expect(sanitized).not.toContain('file:///');
      expect(sanitized).toContain('`AGENTS.md`');
      expect(sanitized).toContain('`DESIGN_SYSTEM.md`');
    });

    it('strips absolute worktree paths leaving clean relative paths', () => {
      const raw =
        'Inspected /home/user/repo/.jonah-fleet/worktrees/agent-peer-review-2026-09-03/src/components/Nudge.tsx and verified boundary';
      const sanitized = sanitizeWorktreePaths(raw);
      expect(sanitized).not.toContain('.jonah-fleet/worktrees');
      expect(sanitized).toContain('src/components/Nudge.tsx');
    });
  });

  describe('extractExecutionSummary', () => {
    it('extracts markdown summary block from agent output', () => {
      const output = `
The build is finishing up. Continuing when done.
The build is completing. Continuing shortly.
# Peer Review Execution Summary

**Mode**: Scan Mode  
**Selected Target PR**: [PR #3783](https://github.com/org/repo/pull/3783)  
**Final Action**: **MERGED** (Squash commit \`1567d6a0\`)

---

### Review & Verification Passes

1. **Standards**: Conformance to AGENTS.md verified.
2. **Spec**: Clean Next.js RSC boundaries.

---

### Actions Taken

- Squash-merged PR #3783.
✓ Local peer-review completed successfully.
`;

      const summary = extractExecutionSummary(output);
      expect(summary).not.toBeNull();
      expect(summary).toContain('Peer Review Execution Summary');
      expect(summary).toContain('**Final Action**: **MERGED**');
      expect(summary).toContain('### Review & Verification Passes');
      expect(summary).not.toContain('The build is finishing up');
      expect(summary).not.toContain('✓ Local peer-review completed');
    });

    it('returns null if no summary header is present', () => {
      const output = 'Just some arbitrary agent response without execution summary.';
      expect(extractExecutionSummary(output)).toBeNull();
    });
  });

  describe('parseRunLog & findLatestRunLog', () => {
    it('parses structured markdown run log into metadata and criteria', () => {
      const sampleLog = `# Run Log

## Metadata

| Field | Value |
|-------|-------|
| Routine | \`peer-review\` |
| Target PR | \`#3783\` |
| Decision | \`MERGED\` |
| Result | \`SUCCESS\` |
| Duration | 114s |

## Definition of Done evaluation

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Standards Pass | YES | Verified AGENTS.md conventions. |
| Test Suite | YES | 171 test files passed. |

## Actions Taken
- Squash-merged PR #3783 to main.
`;

      const parsed = parseRunLog(sampleLog);
      expect(parsed.routine).toBe('peer-review');
      expect(parsed.target).toBe('#3783');
      expect(parsed.decision).toBe('MERGED');
      expect(parsed.result).toBe('SUCCESS');
      expect(parsed.duration).toBe('114s');
      expect(parsed.passes?.length).toBe(2);
      expect(parsed.passes?.[0].status).toBe('pass');
    });

    it('preserves target from metadata and does not overwrite with YES from DoD table', () => {
      const logWithDoD = `# Run Log

## Metadata

| Field | Value |
|-------|-------|
| Routine | \`peer-review\` |
| Target PR | \`#3783\` |
| Decision | \`MERGED\` |

## Definition of Done evaluation

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Identified target PR: named PR or priority scan | YES | Evaluated open PRs and selected #3783 |
| If in Scan mode and no eligible PRs exist, logged SUCCESS with "No PRs to review" | NO | Found eligible PRs |
`;

      const parsed = parseRunLog(logWithDoD);
      expect(parsed.target).toBe('#3783');
      expect(parsed.decision).toBe('MERGED');
      expect(parsed.passes?.some((p) => p.name.includes('If in Scan mode'))).toBe(false);
    });

    it('finds latest log in repo logs directory', () => {
      const logsDir = path.join(tmpRepo, '.github', 'prompts', 'logs', 'peer-review');
      fs.mkdirSync(logsDir, { recursive: true });

      fs.writeFileSync(path.join(logsDir, '2026-08-26T10-00-00Z.md'), '# Log 1\n');
      fs.writeFileSync(path.join(logsDir, '2026-08-26T12-00-00Z.md'), '# Log 2\n');

      const latest = findLatestRunLog(tmpRepo, 'peer-review');
      expect(latest).not.toBeNull();
      expect(latest).toContain('2026-08-26T12-00-00Z.md');
    });
  });

  describe('detectActivePhase', () => {
    it('detects type checks and linters', () => {
      expect(detectActivePhase('Running npm run type-check')).toContain('type checks');
      expect(detectActivePhase('eslint src/')).toContain('linter');
    });

    it('detects tests and builds', () => {
      expect(detectActivePhase('vitest run')).toContain('test suite');
      expect(detectActivePhase('next build')).toContain('build verification');
    });

    it('detects merges and bounces', () => {
      expect(detectActivePhase('gh pr merge 123 --squash')).toContain('Squash-merging');
      expect(detectActivePhase('gh pr ready 123 --undo')).toContain('draft');
    });

    it('falls back to current phase when unknown', () => {
      expect(detectActivePhase('some random comment', 'Custom phase')).toBe('Custom phase');
    });

    it('detects issue claim in phase detection', () => {
      expect(detectActivePhase('🔒 Claimed by local autowork session (host: devbox)')).toContain('Claimed target issue');
    });

    it('detects PR review finding claim in phase detection', () => {
      expect(detectActivePhase('🔒 Addressing review findings by local autowork session (host: devbox)')).toContain('Claimed bounced PR');
      expect(detectActivePhase('🔒 Addressing review findings by autowork run https://github.com/org/repo/actions/runs/123')).toContain('Claimed bounced PR');
    });
  });

  describe('detectClaimedIssue & detectClaimedPR', () => {
    it('detects claimed issue from lock comment', () => {
      expect(detectClaimedIssue('🔒 Claimed by local autowork session (host: mac) on #42 at 2026-09-03')).toBe('Issue #42');
      expect(detectClaimedIssue('🔒 Claimed candidate #88')).toBe('Issue #88');
    });

    it('detects issue from gh issue command', () => {
      expect(detectClaimedIssue('Running gh issue view 105 --json title')).toBe('Issue #105');
      expect(detectClaimedIssue('gh issue edit 42 --add-assignee user')).toBe('Issue #42');
    });

    it('detects issue from natural language claiming text', () => {
      expect(detectClaimedIssue('Selected candidate issue #99 for implementation')).toBe('Issue #99');
      expect(detectClaimedIssue('Claiming issue #15...')).toBe('Issue #15');
      expect(detectClaimedIssue('Issue #77 claimed atomically.')).toBe('Issue #77');
    });

    it('returns null when no issue is referenced', () => {
      expect(detectClaimedIssue('Checking backlog for unclaimed issues...')).toBeNull();
    });

    it('detects PR from starting review comment or target PR text', () => {
      expect(detectClaimedPR('Starting review (round 1) on #3783')).toBe('PR #3783');
      expect(detectClaimedPR('Selected Target PR: [PR #3783]')).toBe('PR #3783');
      expect(detectClaimedPR('Running gh pr view 3783 --json diff')).toBe('PR #3783');
      expect(detectClaimedPR('gh pr edit 42 --add-assignee user')).toBe('PR #42');
      expect(detectClaimedPR('🔒 Addressing review findings by autowork run on PR #88')).toBe('PR #88');
    });

    it('returns null when no PR is referenced', () => {
      expect(detectClaimedPR('Scanning open pull requests...')).toBeNull();
    });
  });

  describe('renderSummaryCard', () => {
    it('renders a formatted Unicode card with header and actions', () => {
      const card = renderSummaryCard({
        routine: 'peer-review',
        pr: 3783,
        durationMs: 45000,
        output: `
# Peer Review Execution Summary
**Final Action**: **MERGED**

### Review & Verification Passes
- Verified standards and design tokens.
- All 171 test files passed.

### Actions Taken
- Squash-merged to main.
`,
      });

      expect(card).toContain('┌');
      expect(card).toContain('└');
      expect(card).toContain('PEER-REVIEW');
      expect(card).toContain('PR #3783');
      expect(card).toContain('MERGED');
      expect(card).toContain('45s');
    });

    it('renders PR title and wraps long lines without ellipses cropping', () => {
      const card = renderSummaryCard({
        routine: 'peer-review',
        pr: 3783,
        title: 'feat(predictions): show instant group creation nudge on group tab for users without groups',
        durationMs: 503000,
        output: `
# Peer Review Execution Summary
**Selected Target PR**: [PR #3783 (\`feat(predictions): show instant group creation nudge on group tab for users without groups\`)](https://github.com/org/repo/pull/3783)
**Final Action**: **MERGED**

### Review & Verification Passes
- Conformance to AGENTS.md and DESIGN_SYSTEM.md: correct invariant adherence for macro terminology.
- Clean Next.js React Server Component boundaries verified via check-client-boundary script.
- 171 test files passed (1,609 unit tests) with zero errors.
`,
      });

      expect(card).toContain('PR #3783');
      expect(card).toContain('Title:');
      expect(card).toContain('feat(predictions): show instant group creation nudge');
      expect(card).toContain('MERGED');
      expect(card).toContain('503s');
      expect(card).not.toContain('...');
    });
  });

  describe('renderErrorCard', () => {
    it('renders an error card with recent log tail', () => {
      const daemonLogDir = path.join(tmpRepo, '.jonah-fleet');
      fs.mkdirSync(daemonLogDir, { recursive: true });
      fs.writeFileSync(
        path.join(daemonLogDir, 'daemon.log'),
        'Line 1\nLine 2\nError: build failed at src/index.ts:12\n'
      );

      const card = renderErrorCard({
        routine: 'autowork',
        exitCode: 1,
        repoRoot: tmpRepo,
        issue: 42,
        durationMs: 12000,
      });

      expect(card).toContain('┌');
      expect(card).toContain('AUTOWORK');
      expect(card).toContain('Exit Code 1');
      expect(card).toContain('Issue #42');
      expect(card).toContain('Error: build failed');
      expect(card).toContain('daemon.log');
    });
  });

  describe('TerminalSpinner', () => {
    it('starts, updates, and stops safely', () => {
      const spinner = new TerminalSpinner();
      expect(() => {
        spinner.start('Initializing...');
        spinner.update('Running tests...');
        spinner.stop();
      }).not.toThrow();
    });
  });
});
