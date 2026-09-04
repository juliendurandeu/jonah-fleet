import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createSyntheticRunLog,
  createSyntheticOptimizerDataset,
  analyzeOptimizerSignals,
  simulateDownstreamSyncWorkflow,
  evaluateIssueAmbiguity,
  runAmbiguityBenchmark,
  extractBenchmarkCaseFromLog,
  feedOptimizerCaseToBenchmark,
  getBaselineAmbiguityBenchmarkDataset,
  type SyntheticLogOptions,
  type BenchmarkIssue,
} from '../src/lib/evals.js';
import { FLEET_VERSION } from '../src/lib/presets.js';

describe('Bi-directional Optimization Bridge & Evals Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-evals-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Synthetic Run Log Fixtures', () => {
    it('creates standard formatted run log markdown matching schema', () => {
      const logOptions: SyntheticLogOptions = {
        routine: 'autowork',
        timestamp: '2026-08-25T01:00:00Z',
        result: 'FAILURE',
        errorCategory: 'prompt_unclear',
        errorReason: 'Ambiguous instruction regarding merge conflict resolution',
        inputTokens: 85000,
        outputTokens: 6200,
        durationSeconds: 320,
        iterations: 42,
        isGenericPattern: true,
        suggestedOptimization: 'Clarify step 13 clean-merge gate and intent resolution rule',
      };

      const markdown = createSyntheticRunLog(logOptions);

      expect(markdown).toContain('# Run Log');
      expect(markdown).toContain('| Routine | `autowork` |');
      expect(markdown).toContain('| Timestamp | `2026-08-25T01:00:00Z` |');
      expect(markdown).toContain('| Result | `FAILURE` |');
      expect(markdown).toContain('| Error reason | Ambiguous instruction regarding merge conflict resolution |');
      expect(markdown).toContain('## Root cause & failure analysis');
      expect(markdown).toContain('Category: `prompt_unclear`');
      expect(markdown).toContain('Clarify step 13 clean-merge gate and intent resolution rule');
    });

    it('generates a realistic optimizer dataset with mixed generic and local patterns', () => {
      const dataset = createSyntheticOptimizerDataset();
      expect(dataset.logs.length).toBeGreaterThanOrEqual(4);

      const analysis = analyzeOptimizerSignals(dataset.logs);
      expect(analysis.totalLogsScanned).toBe(dataset.logs.length);
      expect(analysis.failureCount).toBeGreaterThan(0);
      expect(analysis.proposals.length).toBeGreaterThan(0);

      // Verify generic proposals targeting upstream fleet
      const genericProposals = analysis.proposals.filter((p) => p.scope === 'generic');
      expect(genericProposals.length).toBeGreaterThan(0);
      expect(genericProposals[0].title).toMatch(/^(fix|feat)\(prompts\):/);
      expect(genericProposals[0].body).toContain('Evidence from run logs');
    });
  });

  describe('Optimizer Analysis & Signal Extraction', () => {
    it('detects high iteration inefficiency patterns', () => {
      const inefficientLog = createSyntheticRunLog({
        routine: 'autowork',
        timestamp: '2026-08-25T01:10:00Z',
        result: 'SUCCESS',
        inputTokens: 120000,
        outputTokens: 9000,
        durationSeconds: 600,
        iterations: 58, // High iteration count close to 65 cap
        reviewRounds: 4, // Ping-pong review bounce
      });

      const analysis = analyzeOptimizerSignals([inefficientLog]);
      expect(analysis.highIterationRuns).toBe(1);
      expect(analysis.reviewPingPongCount).toBe(1);
      expect(analysis.proposals.some((p) => p.title.includes('review loop') || p.title.includes('efficiency'))).toBe(true);
    });

    it('distinguishes between generic orchestrator defects and repo-specific issues', () => {
      const genericDefectLog = createSyntheticRunLog({
        routine: 'autowork',
        timestamp: '2026-08-25T01:20:00Z',
        result: 'FAILURE',
        errorCategory: 'orchestration_collision',
        errorReason: 'Race condition on candidate claim lock when timestamps match',
        isGenericPattern: true,
        suggestedOptimization: 'Add millisecond precision or random tiebreaker to Claim protocol in autowork.md',
      });

      const localDefectLog = createSyntheticRunLog({
        routine: 'autowork',
        timestamp: '2026-08-25T01:25:00Z',
        result: 'FAILURE',
        errorCategory: 'data_issue',
        errorReason: 'Missing local database seed credentials in consumer repository .env',
        isGenericPattern: false,
      });

      const analysis = analyzeOptimizerSignals([genericDefectLog, localDefectLog]);
      expect(analysis.failureCount).toBe(2);

      const genericProposals = analysis.proposals.filter((p) => p.scope === 'generic');
      const localProposals = analysis.proposals.filter((p) => p.scope === 'local');

      expect(genericProposals.length).toBe(1);
      expect(genericProposals[0].title).toContain('orchestration');
      expect(localProposals.length).toBe(1);
    });

    it('detects telemetry rabbit hole patterns and proposes Intent vs. Defect guardrail optimization', () => {
      const rabbitHoleLog = createSyntheticRunLog({
        routine: 'autowork',
        timestamp: '2026-08-30T10:00:00Z',
        result: 'FAILURE',
        errorCategory: 'telemetry_rabbit_hole',
        errorReason: 'Agent spent 4 iterations adding fallback error tracking to unused CTA with 0.5% CTR',
        isGenericPattern: true,
        suggestedOptimization: 'Apply Intent vs. Defect Guardrail in autowork.md and diagnosing-bugs',
      });

      const analysis = analyzeOptimizerSignals([rabbitHoleLog]);
      expect(analysis.failureCount).toBe(1);
      expect(analysis.failureCategories['telemetry_rabbit_hole']).toBe(1);
      expect(analysis.proposals.length).toBe(1);
      expect(analysis.proposals[0].scope).toBe('generic');
      expect(analysis.proposals[0].title).toContain('telemetry rabbit hole');
      expect(analysis.proposals[0].suggestedChanges).toContain('Intent vs. Defect Guardrail');
    });

    it('processes synthetic analytics-review and product-planning logs cleanly', () => {
      const analyticsLog = createSyntheticRunLog({
        routine: 'analytics-review',
        timestamp: '2026-08-30T11:00:00Z',
        result: 'SUCCESS',
        inputTokens: 50000,
        outputTokens: 4000,
        iterations: 15,
      });

      const planningLog = createSyntheticRunLog({
        routine: 'product-planning',
        timestamp: '2026-08-30T12:00:00Z',
        result: 'SUCCESS',
        inputTokens: 60000,
        outputTokens: 4500,
        iterations: 18,
      });

      const analysis = analyzeOptimizerSignals([analyticsLog, planningLog]);
      expect(analysis.totalLogsScanned).toBe(2);
      expect(analysis.failureCount).toBe(0);
    });
  });

  describe('Downstream Sync Workflow Simulation', () => {
    it('simulates drift detection and PR creation payload when upstream updates', () => {
      const result = simulateDownstreamSyncWorkflow({
        targetDir: tempDir,
        initialPreset: 'standard',
        initialVersion: '1.0.0', // Older version
        modifiedPrompts: {
          'autowork.md': '# Custom local modification',
        },
      });

      expect(result.initialDrift.hasDrift).toBe(true);
      expect(result.initialDrift.driftDetails.missingPrompts.length + result.initialDrift.driftDetails.modifiedPrompts.length).toBeGreaterThan(0);
      expect(result.syncedVersion).toBe(FLEET_VERSION);
      expect(result.prPayload.headBranch).toMatch(/^chore\/sync-jonah-fleet-/);
      expect(result.prPayload.title).toBe('chore(fleet): sync prompt routines and workflows from jonah-fleet');
      expect(result.prPayload.body).toContain('Automated update from `jonah-fleet`');
      expect(result.isCleanAfterSync).toBe(true);
    });

    it('identifies no PR needed when consumer repo is already fully in sync', () => {
      const result = simulateDownstreamSyncWorkflow({
        targetDir: tempDir,
        initialPreset: 'standard',
        initialVersion: FLEET_VERSION,
      });

      expect(result.initialDrift.hasDrift).toBe(false);
      expect(result.prPayload.shouldCreatePR).toBe(false);
    });
  });

  describe('Ambiguity Benchmark Engine & Dynamic Optimizer Case Feeding', () => {
    it('evaluates ambiguous issues as ASK_QUESTIONS and generates clarifying questions', () => {
      const ambiguousIssue: BenchmarkIssue = {
        id: 'issue-ambiguous-custom',
        title: 'Optimize the dashboard loading time',
        body: 'The dashboard feels slow. Please make it faster and improve user experience.',
        expectedAction: 'ASK_QUESTIONS',
        rationale: 'No metrics, no target latency, no specific endpoints.',
      };

      const result = evaluateIssueAmbiguity(ambiguousIssue);
      expect(result.decision).toBe('ASK_QUESTIONS');
      expect(result.isCorrect).toBe(true);
      expect(result.missingCriteria.length).toBeGreaterThan(0);
      expect(result.generatedQuestions.length).toBeGreaterThanOrEqual(1);
      expect(result.generatedQuestions.length).toBeLessThanOrEqual(2);
      expect(result.generatedQuestions[0]).toMatch(/baseline latency|current response time/i);
    });

    it('evaluates well-specified issues as PROCEED_TO_IMPLEMENT', () => {
      const specifiedIssue: BenchmarkIssue = {
        id: 'issue-specified-custom',
        title: 'Fix null pointer in user profile header avatar rendering',
        body: `When avatarUrl is null, UserAvatar throws TypeError.
        
## Acceptance Criteria
- [ ] Fall back to initials avatar when user.avatarUrl is null or undefined
- [ ] Update \`src/components/UserAvatar.tsx\` lines 42-55
- [ ] Add unit test in \`tests/components/UserAvatar.test.tsx\`

Verification: \`npm test tests/components/UserAvatar.test.tsx\`
`,
        expectedAction: 'PROCEED_TO_IMPLEMENT',
        rationale: 'Contains clear bug reproduction, file seam, tasks, and test verification command.',
      };

      const result = evaluateIssueAmbiguity(specifiedIssue);
      expect(result.decision).toBe('PROCEED_TO_IMPLEMENT');
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('evaluates baseline benchmark dataset with 100% accuracy and 0% false compliance rate', () => {
      const baselineDataset = getBaselineAmbiguityBenchmarkDataset();
      expect(baselineDataset.length).toBe(10);

      const summary = runAmbiguityBenchmark(baselineDataset);
      expect(summary.totalEvaluated).toBe(10);
      expect(summary.passedCount).toBe(10);
      expect(summary.failedCount).toBe(0);
      expect(summary.accuracy).toBe(1.0);
      expect(summary.falseComplianceCount).toBe(0);
      expect(summary.falseComplianceRate).toBe(0);
      expect(summary.falseObstructionCount).toBe(0);
      expect(summary.falseObstructionRate).toBe(0);
    });

    it('extracts benchmark issue fixture from failure run log with ambiguity gate trigger', () => {
      const rawLog = `# Run Log
| Routine | \`autowork\` |
| Timestamp | \`2026-09-04T12:00:00Z\` |
| Result | \`FAILURE\` |
| Error reason | Agent guessed user permissions without schema confirmation |

## Root cause & failure analysis
Category: \`ambiguous_spec\`
Details: Underspecified role-based access control matrix in issue description. Ambiguity gate triggered.
`;

      const extracted = extractBenchmarkCaseFromLog(rawLog, {
        title: 'Add role permissions for org members',
      });

      expect(extracted).not.toBeNull();
      expect(extracted?.expectedAction).toBe('ASK_QUESTIONS');
      expect(extracted?.origin).toBe('optimizer_extracted');
      expect(extracted?.title).toBe('Add role permissions for org members');
      expect(extracted?.labels).toContain('needs-info');
    });

    it('extracts benchmark issue fixture from runs with high review ping-pong bounces (>=3 rounds)', () => {
      const rawLog = `# Run Log
| Routine | \`autowork\` |
| Timestamp | \`2026-09-04T13:00:00Z\` |
| Result | \`SUCCESS\` |
| Review rounds | 4 |

Review bounced 4 times due to divergent expectations on cache eviction timing.
`;

      const extracted = extractBenchmarkCaseFromLog(rawLog);
      expect(extracted).not.toBeNull();
      expect(extracted?.expectedAction).toBe('ASK_QUESTIONS');
      expect(extracted?.origin).toBe('optimizer_extracted');
    });

    it('returns null when log represents a standard successful run with no ambiguity signals', () => {
      const rawLog = `# Run Log
| Routine | \`autowork\` |
| Timestamp | \`2026-09-04T14:00:00Z\` |
| Result | \`SUCCESS\` |
| Review rounds | 1 |
`;

      const extracted = extractBenchmarkCaseFromLog(rawLog);
      expect(extracted).toBeNull();
    });

    it('dynamically feeds optimizer-extracted cases into benchmark dataset without duplicates', () => {
      const baseline = getBaselineAmbiguityBenchmarkDataset();
      const initialCount = baseline.length;

      const newCase: BenchmarkIssue = {
        id: 'eval-extracted-cache-eviction',
        title: 'Add Redis cache eviction for expired sessions',
        body: 'Evict expired sessions from Redis cache.',
        expectedAction: 'ASK_QUESTIONS',
        rationale: 'Extracted by optimizer following 4 review bounces on eviction window.',
        origin: 'optimizer_extracted',
      };

      const updated = feedOptimizerCaseToBenchmark(baseline, newCase);
      expect(updated.length).toBe(initialCount + 1);
      expect(updated[updated.length - 1].id).toBe('eval-extracted-cache-eviction');

      // Feeding same id again updates existing entry rather than duplicating
      const modifiedCase = { ...newCase, rationale: 'Updated rationale' };
      const reUpdated = feedOptimizerCaseToBenchmark(updated, modifiedCase);
      expect(reUpdated.length).toBe(initialCount + 1);
      expect(reUpdated.find((i) => i.id === newCase.id)?.rationale).toBe('Updated rationale');

      // Benchmark executes cleanly on augmented dataset
      const summary = runAmbiguityBenchmark(reUpdated);
      expect(summary.totalEvaluated).toBe(initialCount + 1);
      expect(summary.accuracy).toBe(1.0);
    });
  });
});
