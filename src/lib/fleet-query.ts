import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GhExecutor = (args: string[]) => Promise<string>;

export const defaultGhExecutor: GhExecutor = async (args: string[]) => {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (err: any) {
    if (err.stdout) return err.stdout;
    throw err;
  }
};

export interface AutoworkClaim {
  issueNumber: number;
  title: string;
  assignee: string;
  claimedAt: string;
  ageHours: number;
  isStale: boolean;
  url?: string;
}

export interface OpenPRInfo {
  number: number;
  title: string;
  author: string;
  isDraft: boolean;
  reviewDecision?: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
  headRefName?: string;
  body?: string;
}

export interface TokenSpendInfo {
  sevenDayInputTokens: number;
  sevenDayOutputTokens: number;
  sevenDayTotalTokens: number;
  sevenDayEstimatedCost: number;
  recentRunCount: number;
}

export interface RepoFleetStatus {
  repo: string;
  fleetVersion?: string;
  preset?: string;
  activeClaims: AutoworkClaim[];
  openPRs: OpenPRInfo[];
  tokenUsage: TokenSpendInfo;
  staleWarnings: string[];
  error?: string;
}

export interface FleetSummary {
  totalRepos: number;
  activeClaimsCount: number;
  staleClaimsCount: number;
  openPRsCount: number;
  draftPRsCount: number;
  readyPRsCount: number;
  totalInputTokens7d: number;
  totalOutputTokens7d: number;
  totalTokens7d: number;
  totalEstimatedCost7d: number;
  totalRuns7d: number;
}

export interface LogMetadata {
  routine?: string;
  timestamp?: string;
  result?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}

export function parseLogMetadata(content: string): LogMetadata | null {
  const lines = content.split('\n');
  const meta: LogMetadata = {};

  for (const line of lines) {
    const match = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (!match) continue;

    const key = match[1].trim().toLowerCase();
    let val = match[2].trim().replace(/`/g, '');

    if (key === 'routine') {
      meta.routine = val;
    } else if (key === 'timestamp') {
      meta.timestamp = val;
    } else if (key === 'result') {
      meta.result = val;
    } else if (key === 'input tokens') {
      const num = parseInt(val.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num)) meta.inputTokens = num;
    } else if (key === 'output tokens') {
      const num = parseInt(val.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num)) meta.outputTokens = num;
    } else if (key === 'estimated cost') {
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) meta.estimatedCost = num;
    }
  }

  if (meta.timestamp || meta.routine) {
    return meta;
  }
  return null;
}

export function computeTokenSpendFromLogs(logContents: string[], now: number = Date.now()): TokenSpendInfo {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now - SEVEN_DAYS_MS;

  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let runs = 0;

  for (const content of logContents) {
    const meta = parseLogMetadata(content);
    if (!meta || !meta.timestamp) continue;

    const logTime = new Date(meta.timestamp).getTime();
    if (isNaN(logTime) || logTime < cutoff) continue;

    runs++;
    if (meta.inputTokens) inputTokens += meta.inputTokens;
    if (meta.outputTokens) outputTokens += meta.outputTokens;
    if (meta.estimatedCost) cost += meta.estimatedCost;
  }

  return {
    sevenDayInputTokens: inputTokens,
    sevenDayOutputTokens: outputTokens,
    sevenDayTotalTokens: inputTokens + outputTokens,
    sevenDayEstimatedCost: cost,
    recentRunCount: runs,
  };
}

export function parseClaimFromIssue(
  issue: {
    number: number;
    title: string;
    assignees?: Array<{ login: string }>;
    comments?: Array<{ body: string; createdAt: string; author?: { login: string } }>;
    url?: string;
  },
  openPRs: Array<{ number: number; title: string; body?: string; headRefName?: string }> = [],
  now: number = Date.now()
): AutoworkClaim | null {
  if (!issue.assignees || issue.assignees.length === 0) {
    return null;
  }

  const comments = issue.comments || [];
  // Find latest claim comment
  let latestClaimComment: { body: string; createdAt: string; author?: { login: string } } | null = null;

  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].body && comments[i].body.includes('🔒 Claimed by autowork run')) {
      latestClaimComment = comments[i];
      break;
    }
  }

  if (!latestClaimComment) {
    return null;
  }

  const claimTime = new Date(latestClaimComment.createdAt).getTime();
  const ageMs = now - (isNaN(claimTime) ? now : claimTime);
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));

  // Check if there is an open PR referencing this issue
  const issueNumStr = `#${issue.number}`;
  const hasOpenPR = openPRs.some((pr) => {
    const bodyMatch = pr.body && pr.body.includes(issueNumStr);
    const titleMatch = pr.title && pr.title.includes(issueNumStr);
    const branchMatch = pr.headRefName && pr.headRefName.includes(`issue-${issue.number}`);
    return bodyMatch || titleMatch || branchMatch;
  });

  const isStale = ageHours > 6 && !hasOpenPR;

  return {
    issueNumber: issue.number,
    title: issue.title,
    assignee: issue.assignees[0]?.login || latestClaimComment.author?.login || 'unknown',
    claimedAt: latestClaimComment.createdAt,
    ageHours,
    isStale,
    url: issue.url,
  };
}

export async function queryRepoFleetStatus(
  repoIdentifier: string,
  executor: GhExecutor = defaultGhExecutor,
  now: number = Date.now()
): Promise<RepoFleetStatus> {
  const result: RepoFleetStatus = {
    repo: repoIdentifier,
    activeClaims: [],
    openPRs: [],
    tokenUsage: {
      sevenDayInputTokens: 0,
      sevenDayOutputTokens: 0,
      sevenDayTotalTokens: 0,
      sevenDayEstimatedCost: 0,
      recentRunCount: 0,
    },
    staleWarnings: [],
  };

  try {
    // 1. Fetch Manifest / Fleet Version
    // Check if repoIdentifier is a local directory
    if (fs.existsSync(repoIdentifier) && fs.statSync(repoIdentifier).isDirectory()) {
      const manifestPath = path.join(repoIdentifier, 'agents-manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          result.fleetVersion = raw.version;
          result.preset = raw.preset;
        } catch {}
      }
    } else {
      // Query via GitHub API
      try {
        const manifestRaw = await executor([
          'api',
          `repos/${repoIdentifier}/contents/agents-manifest.json`,
        ]);
        const parsed = JSON.parse(manifestRaw);
        if (parsed.content) {
          const content = Buffer.from(parsed.content, 'base64').toString('utf8');
          const manifest = JSON.parse(content);
          result.fleetVersion = manifest.version;
          result.preset = manifest.preset;
        }
      } catch {}
    }

    // 2. Fetch Open PRs
    try {
      const prsRaw = await executor([
        'pr',
        'list',
        '--repo',
        repoIdentifier,
        '--state',
        'open',
        '--json',
        'number,title,author,isDraft,createdAt,updatedAt,reviewDecision,url,headRefName,body',
      ]);
      const prs = JSON.parse(prsRaw);
      if (Array.isArray(prs)) {
        result.openPRs = prs.map((pr: any) => ({
          number: pr.number,
          title: pr.title,
          author: pr.author?.login || 'unknown',
          isDraft: Boolean(pr.isDraft),
          reviewDecision: pr.reviewDecision,
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          url: pr.url,
          headRefName: pr.headRefName,
          body: pr.body,
        }));
      }
    } catch (err: any) {
      result.error = `Failed to fetch PRs: ${err.message}`;
    }

    // 3. Fetch Open Issues (for Active and Stale Claims)
    try {
      const issuesRaw = await executor([
        'issue',
        'list',
        '--repo',
        repoIdentifier,
        '--state',
        'open',
        '--json',
        'number,title,assignees,updatedAt,comments,url',
      ]);
      const issues = JSON.parse(issuesRaw);
      if (Array.isArray(issues)) {
        for (const issue of issues) {
          const claim = parseClaimFromIssue(issue, result.openPRs, now);
          if (claim) {
            result.activeClaims.push(claim);
            if (claim.isStale) {
              result.staleWarnings.push(
                `Issue #${claim.issueNumber} claimed by @${claim.assignee} ${claim.ageHours.toFixed(1)}h ago with no open PR`
              );
            }
          }
        }
      }
    } catch (err: any) {
      if (!result.error) result.error = `Failed to fetch issues: ${err.message}`;
    }

    // 4. Fetch Logs for Token Spend
    const logContents: string[] = [];
    if (fs.existsSync(repoIdentifier) && fs.statSync(repoIdentifier).isDirectory()) {
      const logsDir = path.join(repoIdentifier, '.github/prompts/logs');
      if (fs.existsSync(logsDir)) {
        const collectLogs = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              collectLogs(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              try {
                logContents.push(fs.readFileSync(fullPath, 'utf8'));
              } catch {}
            }
          }
        };
        collectLogs(logsDir);
      }
    } else {
      // Query recent log files via GitHub API tree or search
      try {
        const treeRaw = await executor([
          'api',
          `repos/${repoIdentifier}/git/trees/HEAD?recursive=1`,
        ]);
        const tree = JSON.parse(treeRaw);
        if (Array.isArray(tree.tree)) {
          const logFiles = tree.tree
            .filter((node: any) => node.path && node.path.startsWith('.github/prompts/logs/') && node.path.endsWith('.md'))
            .slice(-15); // Take last 15 logs
          for (const file of logFiles) {
            try {
              const fileRaw = await executor(['api', `repos/${repoIdentifier}/contents/${file.path}`]);
              const parsed = JSON.parse(fileRaw);
              if (parsed.content) {
                logContents.push(Buffer.from(parsed.content, 'base64').toString('utf8'));
              }
            } catch {}
          }
        }
      } catch {}
    }

    if (logContents.length > 0) {
      result.tokenUsage = computeTokenSpendFromLogs(logContents, now);
    }
  } catch (err: any) {
    result.error = err.message;
  }

  return result;
}

export function summarizeFleet(statuses: RepoFleetStatus[]): FleetSummary {
  const summary: FleetSummary = {
    totalRepos: statuses.length,
    activeClaimsCount: 0,
    staleClaimsCount: 0,
    openPRsCount: 0,
    draftPRsCount: 0,
    readyPRsCount: 0,
    totalInputTokens7d: 0,
    totalOutputTokens7d: 0,
    totalTokens7d: 0,
    totalEstimatedCost7d: 0,
    totalRuns7d: 0,
  };

  for (const s of statuses) {
    summary.activeClaimsCount += s.activeClaims.length;
    summary.staleClaimsCount += s.activeClaims.filter((c) => c.isStale).length;
    summary.openPRsCount += s.openPRs.length;
    summary.draftPRsCount += s.openPRs.filter((p) => p.isDraft).length;
    summary.readyPRsCount += s.openPRs.filter((p) => !p.isDraft).length;

    summary.totalInputTokens7d += s.tokenUsage.sevenDayInputTokens;
    summary.totalOutputTokens7d += s.tokenUsage.sevenDayOutputTokens;
    summary.totalTokens7d += s.tokenUsage.sevenDayTotalTokens;
    summary.totalEstimatedCost7d += s.tokenUsage.sevenDayEstimatedCost;
    summary.totalRuns7d += s.tokenUsage.recentRunCount;
  }

  return summary;
}
