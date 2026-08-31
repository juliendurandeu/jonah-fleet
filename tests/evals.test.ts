import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createSyntheticRunLog,
  createSyntheticOptimizerDataset,
  analyzeOptimizerSignals,
  simulateDownstreamSyncWorkflow,
  type SyntheticLogOptions,
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
});
