import pc from 'picocolors';
import { RepoFleetStatus, summarizeFleet } from './fleet-query.js';

export interface DashboardOptions {
  json?: boolean;
}

function formatTokens(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toString();
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function renderFleetDashboard(statuses: RepoFleetStatus[], options: DashboardOptions = {}): string {
  const summary = summarizeFleet(statuses);

  if (options.json) {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary,
        repositories: statuses,
      },
      null,
      2
    );
  }

  const lines: string[] = [];

  lines.push(pc.bold(pc.cyan('\n📊 Jonah Fleet Multi-Repo Monitor\n')));

  if (statuses.length === 0) {
    lines.push(pc.yellow('  No repositories configured in fleet registry.'));
    lines.push(pc.gray('  Use `jonah-fleet monitor --add <owner/repo>` to register repositories.\n'));
    return lines.join('\n');
  }

  for (const s of statuses) {
    const versionStr = s.fleetVersion ? `v${s.fleetVersion}` : 'unmanaged';
    const presetStr = s.preset ? `preset: ${s.preset}` : '';
    const headerInfo = [versionStr, presetStr].filter(Boolean).join(', ');

    lines.push(pc.bold(`📦 ${pc.cyan(s.repo)} ${pc.gray(`(${headerInfo})`)}`));

    if (s.error) {
      lines.push(pc.red(`   ❌ Error: ${s.error}`));
    }

    // Active Claims
    lines.push(pc.bold('   🔒 Active Claims:'));
    if (s.activeClaims.length === 0) {
      lines.push(pc.gray('      None (idle)'));
    } else {
      for (const claim of s.activeClaims) {
        const staleTag = claim.isStale
          ? pc.red(pc.bold(' [⚠️  STALE CLAIM > 6h]'))
          : pc.green(' [ACTIVE]');
        const ageStr = `${claim.ageHours.toFixed(1)}h ago`;
        lines.push(
          `      #${claim.issueNumber} ${claim.title}${staleTag}` +
            pc.gray(` (claimed by @${claim.assignee}, ${ageStr})`)
        );
      }
    }

    // Open PRs
    lines.push(pc.bold('   🔀 Open PRs:'));
    if (s.openPRs.length === 0) {
      lines.push(pc.gray('      None'));
    } else {
      for (const pr of s.openPRs) {
        const stateTag = pr.isDraft ? pc.yellow('[DRAFT]') : pc.green('[READY]');
        const reviewStr = pr.reviewDecision ? pc.magenta(` (${pr.reviewDecision})`) : '';
        lines.push(`      #${pr.number} ${stateTag} ${pr.title}${reviewStr}` + pc.gray(` by @${pr.author}`));
      }
    }

    // 7-Day Token Spend
    lines.push(pc.bold('   📈 7-Day Token Spend:'));
    const t = s.tokenUsage;
    lines.push(
      `      Runs: ${pc.bold(t.recentRunCount.toString())} | ` +
        `Tokens: ${pc.bold(formatTokens(t.sevenDayTotalTokens))} ` +
        pc.gray(`(in: ${formatTokens(t.sevenDayInputTokens)}, out: ${formatTokens(t.sevenDayOutputTokens)})`) +
        ` | Cost: ${pc.bold(pc.green(formatCurrency(t.sevenDayEstimatedCost)))}`
    );

    // Stale Warnings
    if (s.staleWarnings.length > 0) {
      lines.push(pc.bold(pc.red('   ⚠️  Warnings:')));
      for (const w of s.staleWarnings) {
        lines.push(pc.red(`      - ${w}`));
      }
    }

    lines.push('');
  }

  // Summary box
  lines.push(pc.bold('══════════════════════════════════════════════════════════════════'));
  lines.push(pc.bold('🌐 Fleet Summary:'));
  lines.push(
    `   Repositories:  ${pc.bold(summary.totalRepos.toString())} | ` +
      `Active Claims: ${pc.bold(summary.activeClaimsCount.toString())} ` +
      (summary.staleClaimsCount > 0 ? pc.red(`(${summary.staleClaimsCount} stale)`) : pc.green('(0 stale)')) +
      ` | Open PRs: ${pc.bold(summary.openPRsCount.toString())} ` +
      pc.gray(`(${summary.draftPRsCount} draft, ${summary.readyPRsCount} ready)`)
  );
  lines.push(
    `   7-Day Spend:   ${pc.bold(formatTokens(summary.totalTokens7d))} tokens ` +
      pc.gray(`(in: ${formatTokens(summary.totalInputTokens7d)}, out: ${formatTokens(summary.totalOutputTokens7d)})`) +
      ` | Est. Cost: ${pc.bold(pc.green(formatCurrency(summary.totalEstimatedCost7d)))} ` +
      `across ${pc.bold(summary.totalRuns7d.toString())} runs`
  );
  lines.push(pc.bold('══════════════════════════════════════════════════════════════════\n'));

  return lines.join('\n');
}
