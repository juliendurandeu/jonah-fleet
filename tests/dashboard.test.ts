import { describe, it, expect } from 'vitest';
import { renderFleetDashboard } from '../src/lib/dashboard.js';
import { RepoFleetStatus } from '../src/lib/fleet-query.js';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[\d+m/g, '');
}

describe('Fleet Dashboard Renderer', () => {
  const sampleStatuses: RepoFleetStatus[] = [
    {
      repo: 'juliendurandeu/jonah-fleet',
      fleetVersion: '1.0.0',
      preset: 'standard',
      activeClaims: [
        {
          issueNumber: 1,
          title: 'feat: add fleet monitor',
          assignee: 'juliendurandeu',
          claimedAt: '2026-08-24T12:00:00Z',
          ageHours: 0.5,
          isStale: false,
        },
      ],
      openPRs: [
        {
          number: 10,
          title: 'feat: multi-repo monitor',
          author: 'juliendurandeu',
          isDraft: true,
          reviewDecision: undefined,
          createdAt: '2026-08-24T12:15:00Z',
          updatedAt: '2026-08-24T12:15:00Z',
        },
      ],
      tokenUsage: {
        sevenDayInputTokens: 50000,
        sevenDayOutputTokens: 3000,
        sevenDayTotalTokens: 53000,
        sevenDayEstimatedCost: 0.75,
        recentRunCount: 4,
      },
      staleWarnings: [],
    },
    {
      repo: 'juliendurandeu/Jonah-RuPaul',
      fleetVersion: '1.0.0',
      preset: 'full',
      activeClaims: [
        {
          issueNumber: 3390,
          title: 'fix: stale runner',
          assignee: 'agent-bot',
          claimedAt: '2026-08-24T02:00:00Z',
          ageHours: 10.0,
          isStale: true,
        },
      ],
      openPRs: [],
      tokenUsage: {
        sevenDayInputTokens: 200000,
        sevenDayOutputTokens: 12000,
        sevenDayTotalTokens: 212000,
        sevenDayEstimatedCost: 2.80,
        recentRunCount: 15,
      },
      staleWarnings: ['Issue #3390 claimed by @agent-bot 10.0h ago with no open PR'],
    },
  ];

  it('renders terminal dashboard text with repository sections and summary', () => {
    const rawOutput = renderFleetDashboard(sampleStatuses, { json: false });
    const output = stripAnsi(rawOutput);

    expect(output).toContain('Jonah Fleet Multi-Repo Monitor');
    expect(output).toContain('juliendurandeu/jonah-fleet');
    expect(output).toContain('juliendurandeu/Jonah-RuPaul');
    expect(output).toContain('Active Claims');
    expect(output).toContain('#1 feat: add fleet monitor');
    expect(output).toContain('Open PRs');
    expect(output).toContain('#10 [DRAFT]');
    expect(output).toContain('7-Day Token Spend');
    expect(output).toContain('⚠️  STALE CLAIM');
    expect(output).toContain('Fleet Summary');
  });

  it('renders valid JSON when json: true is specified', () => {
    const jsonOutput = renderFleetDashboard(sampleStatuses, { json: true });
    const parsed = JSON.parse(jsonOutput);

    expect(parsed.repositories).toHaveLength(2);
    expect(parsed.summary.totalRepos).toBe(2);
    expect(parsed.summary.activeClaimsCount).toBe(2);
    expect(parsed.summary.staleClaimsCount).toBe(1);
  });
});
