import { describe, it, expect, vi } from 'vitest';
import {
  generateRadarReport,
  evaluateActivity,
  fetchRepoData
} from '../.github/scripts/fetch-symphony-radar.js';

describe('Upstream Ecosystem Radar (Symphony & Funes)', () => {
  const mockSymphonyData = {
    commits: [
      {
        sha: 'abc1234567',
        commit: {
          message: 'feat: add single-flight claim validation',
          author: { name: 'Alice', date: new Date().toISOString() }
        },
        author: { login: 'alice' },
        html_url: 'https://github.com/openai/symphony/commit/abc1234567'
      }
    ],
    specCommits: [
      {
        sha: 'def4567890',
        commit: {
          message: 'docs: update SPEC.md claim lifecycle state machine',
          author: { name: 'Bob', date: new Date().toISOString() }
        },
        author: { login: 'bob' },
        html_url: 'https://github.com/openai/symphony/commit/def4567890'
      }
    ],
    releases: [
      {
        name: 'v0.5.0',
        tag_name: 'v0.5.0',
        published_at: new Date().toISOString(),
        html_url: 'https://github.com/openai/symphony/releases/tag/v0.5.0',
        body: 'Release notes for v0.5.0'
      }
    ],
    pullRequests: [
      {
        number: 42,
        title: 'Add reader/writer separation check',
        merged_at: new Date().toISOString(),
        html_url: 'https://github.com/openai/symphony/pull/42',
        user: { login: 'carol' }
      }
    ]
  };

  const mockFunesData = {
    commits: [
      {
        sha: 'fun1112223',
        commit: {
          message: 'feat(memory): add zero-llm LanceDB transcript indexing',
          author: { name: 'Dave', date: new Date().toISOString() }
        },
        author: { login: 'dave' },
        html_url: 'https://github.com/huggingface/funes/commit/fun1112223'
      }
    ],
    releases: [
      {
        name: 'funes v0.2.0',
        tag_name: 'v0.2.0',
        published_at: new Date().toISOString(),
        html_url: 'https://github.com/huggingface/funes/releases/tag/v0.2.0',
        body: 'Funes memory release 0.2.0'
      }
    ],
    pullRequests: [
      {
        number: 15,
        title: 'Support hybrid BM25 and vector search with RRF',
        merged_at: new Date().toISOString(),
        html_url: 'https://github.com/huggingface/funes/pull/15',
        user: { login: 'eve' }
      }
    ]
  };

  it('generates a comprehensive report covering both Symphony and Funes', () => {
    const report = generateRadarReport({
      symphony: mockSymphonyData,
      funes: mockFunesData,
      lookbackDays: 7,
      serverUrl: 'https://github.com',
      repository: 'juliendurandeu/jonah-fleet',
      runId: '12345'
    });

    // Header and multi-source tracking info
    expect(report).toContain('Upstream Ecosystem Radar: Intel Digest');
    expect(report).toContain('openai/symphony');
    expect(report).toContain('huggingface/funes');

    // Symphony Orchestration section
    expect(report).toContain('Upstream Orchestration Watch (`openai/symphony`)');
    expect(report).toContain('v0.5.0');
    expect(report).toContain('Specification Updates (`SPEC.md`)');
    expect(report).toContain('def4567');
    expect(report).toContain('add single-flight claim validation');
    expect(report).toContain('Add reader/writer separation check');

    // Funes Agent Memory section
    expect(report).toContain('Upstream Agent Memory Watch (`huggingface/funes`)');
    expect(report).toContain('funes v0.2.0');
    expect(report).toContain('add zero-llm LanceDB transcript indexing');
    expect(report).toContain('Support hybrid BM25 and vector search with RRF');

    // Evaluation matrices
    expect(report).toContain('Upstream Architectural Evaluation Matrix');
    expect(report).toContain('Zero-Daemon Invariant');
    expect(report).toContain('Issue Tracker Abstraction');
    expect(report).toContain('Token & Cost Economy');
    expect(report).toContain('Multi-Repo Portability');

    // Agent memory specific evaluation
    expect(report).toContain('Agent Memory & Session Indexing Evaluation');
    expect(report).toContain('Zero-LLM Ingestion');
    expect(report).toContain('Pull-Based Memory Delivery');
    expect(report).toContain('Cross-Session Provenance');

    // Classification & Checklist
    expect(report).toContain('Category A');
    expect(report).toContain('Category B');
    expect(report).toContain('Category C');
    expect(report).toContain('Maintainer & Optimizer Triage Checklist');
  });

  it('correctly evaluates new activity when only Funes has updates', () => {
    const emptySymphony = { commits: [], specCommits: [], releases: [], pullRequests: [] };
    const { hasNewActivity, shouldCreateIssue } = evaluateActivity(emptySymphony, mockFunesData, {
      lookbackDays: 7,
      forceReport: false
    });

    expect(hasNewActivity).toBe(true);
    expect(shouldCreateIssue).toBe(true);
  });

  it('correctly evaluates new activity when only Symphony has updates', () => {
    const emptyFunes = { commits: [], releases: [], pullRequests: [] };
    const { hasNewActivity, shouldCreateIssue } = evaluateActivity(mockSymphonyData, emptyFunes, {
      lookbackDays: 7,
      forceReport: false
    });

    expect(hasNewActivity).toBe(true);
    expect(shouldCreateIssue).toBe(true);
  });

  it('handles zero activity gracefully with forceReport=false and forceReport=true', () => {
    const emptySymphony = { commits: [], specCommits: [], releases: [], pullRequests: [] };
    const emptyFunes = { commits: [], releases: [], pullRequests: [] };

    const noForce = evaluateActivity(emptySymphony, emptyFunes, {
      lookbackDays: 7,
      forceReport: false
    });
    expect(noForce.hasNewActivity).toBe(false);
    expect(noForce.shouldCreateIssue).toBe(false);

    const withForce = evaluateActivity(emptySymphony, emptyFunes, {
      lookbackDays: 7,
      forceReport: true
    });
    expect(withForce.hasNewActivity).toBe(false);
    expect(withForce.shouldCreateIssue).toBe(true);
  });

  it('handles fetch failures gracefully and returns empty arrays', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error / 403 Rate limit'));

    const data = await fetchRepoData('openai/symphony', { lookbackDays: 7, token: '' });
    expect(data.commits).toEqual([]);
    expect(data.releases).toEqual([]);
    expect(data.pullRequests).toEqual([]);

    global.fetch = originalFetch;
  });
});
