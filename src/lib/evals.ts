import fs from 'node:fs';
import path from 'node:path';
import { parseLogMetadata } from './fleet-query.js';
import { checkDrift, type DriftReport } from './diff.js';
import { installFleet } from './installer.js';
import { createDefaultManifest, loadManifest, saveManifest } from './manifest.js';
import { FLEET_VERSION, type FleetManifest } from './presets.js';

export interface SyntheticLogOptions {
  routine: 'autowork' | 'peer-review' | 'optimizer' | 'issues-housekeeping' | 'dependency-check';
  timestamp: string;
  result: 'SUCCESS' | 'FAILURE';
  errorCategory?: 'prompt_unclear' | 'token_limit' | 'data_issue' | 'infeasible_task' | 'merge_conflict' | 'orchestration_collision';
  errorReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  iterations?: number;
  reviewRounds?: number;
  isGenericPattern?: boolean;
  suggestedOptimization?: string;
}

export interface ContributionProposal {
  id: string;
  scope: 'generic' | 'local';
  title: string;
  body: string;
  targetPrompt?: string;
  evidenceLogs: string[];
  suggestedChanges: string;
}

export interface OptimizationAnalysisResult {
  totalLogsScanned: number;
  failureCount: number;
  failureCategories: Record<string, number>;
  highIterationRuns: number;
  reviewPingPongCount: number;
  proposals: ContributionProposal[];
}

export interface DownstreamSyncSimulationOptions {
  targetDir: string;
  initialPreset?: 'minimal' | 'standard' | 'full';
  initialVersion?: string;
  modifiedPrompts?: Record<string, string>;
  deletedFiles?: string[];
}

export interface DownstreamSyncSimulationResult {
  initialDrift: {
    hasDrift: boolean;
    driftDetails: DriftReport;
  };
  syncedVersion: string;
  isCleanAfterSync: boolean;
  prPayload: {
    shouldCreatePR: boolean;
    headBranch?: string;
    baseBranch?: string;
    title?: string;
    body?: string;
  };
}

/**
 * Generate a synthetic markdown log conforming to .github/prompts/logs/_template.md
 */
export function createSyntheticRunLog(options: SyntheticLogOptions): string {
  const inputTokens = options.inputTokens ?? (options.result === 'SUCCESS' ? 75000 : 95000);
  const outputTokens = options.outputTokens ?? 5000;
  const cost = ((inputTokens * 0.15 + outputTokens * 0.6) / 1000000).toFixed(2);
  const duration = options.durationSeconds ?? 350;
  const iterations = options.iterations ?? (options.result === 'SUCCESS' ? 22 : 48);

  let doc = `# Run Log

## Metadata

| Field | Value |
|-------|-------|
| Routine | \`${options.routine}\` |
| Timestamp | \`${options.timestamp}\` |
| Prompt file | \`.github/prompts/${options.routine}.md\` |
| Result | \`${options.result}\` |
| Error reason | ${options.errorReason ?? (options.result === 'FAILURE' ? 'Execution failure' : 'N/A')} |
| Input tokens | \`${inputTokens}\` |
| Output tokens | \`${outputTokens}\` |
| Estimated cost | \`$${cost}\` |
| Duration | \`${duration}s\` |
| Iterations used | ${iterations} / 65 |
`;

  if (options.reviewRounds) {
    doc += `| Review rounds | ${options.reviewRounds} |\n`;
  }

  doc += `
## Definition of Done evaluation

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Overall routine completion | ${options.result === 'SUCCESS' ? 'YES' : 'NO'} | ${options.errorReason ?? 'Completed smoothly'} |

`;

  if (options.result === 'FAILURE' || options.errorCategory || options.suggestedOptimization) {
    doc += `## Root cause & failure analysis

- Category: \`${options.errorCategory ?? 'prompt_unclear'}\`
- Scope: \`${options.isGenericPattern ? 'generic' : 'local'}\`
- Details: ${options.errorReason ?? 'Unspecified failure'}
- Suggested Fix: ${options.suggestedOptimization ?? 'Review and clarify routine constraints'}
`;
  }

  return doc;
}

/**
 * Build a realistic synthetic dataset simulating multiple routine runs
 */
export function createSyntheticOptimizerDataset(): { logs: string[] } {
  const logs: string[] = [
    // 1. Generic failure in autowork (merge collision gate)
    createSyntheticRunLog({
      routine: 'autowork',
      timestamp: '2026-08-25T00:10:00Z',
      result: 'FAILURE',
      errorCategory: 'orchestration_collision',
      errorReason: 'Candidate claim lock collision when two runs evaluated issue simultaneously',
      isGenericPattern: true,
      suggestedOptimization: 'Add atomic read-back and millisecond timestamp verification to Claim protocol in autowork.md',
    }),
    // 2. High review rounds inefficiency
    createSyntheticRunLog({
      routine: 'autowork',
      timestamp: '2026-08-25T00:30:00Z',
      result: 'SUCCESS',
      inputTokens: 110000,
      outputTokens: 8500,
      iterations: 55,
      reviewRounds: 4,
      isGenericPattern: true,
      suggestedOptimization: 'Add ping-pong bounce cap and warm-context auto-convergence in peer-review.md',
    }),
    // 3. Local repo failure (missing local dependency/config)
    createSyntheticRunLog({
      routine: 'autowork',
      timestamp: '2026-08-25T00:50:00Z',
      result: 'FAILURE',
      errorCategory: 'data_issue',
      errorReason: 'Local test harness failed due to missing local database container in consumer repo',
      isGenericPattern: false,
    }),
    // 4. Clean success
    createSyntheticRunLog({
      routine: 'peer-review',
      timestamp: '2026-08-25T01:05:00Z',
      result: 'SUCCESS',
      inputTokens: 45000,
      outputTokens: 3200,
      durationSeconds: 180,
      iterations: 12,
    }),
  ];

  return { logs };
}

/**
 * Analyze run logs and extract failure patterns, efficiency bottlenecks, and contribution proposals
 */
export function analyzeOptimizerSignals(logs: string[]): OptimizationAnalysisResult {
  let failureCount = 0;
  const failureCategories: Record<string, number> = {};
  let highIterationRuns = 0;
  let reviewPingPongCount = 0;
  const proposals: ContributionProposal[] = [];

  for (let i = 0; i < logs.length; i++) {
    const rawLog = logs[i];
    const meta = parseLogMetadata(rawLog);
    if (!meta) continue;

    const timestamp = meta.timestamp || `2026-08-25T00:00:0${i}Z`;
    const routine = meta.routine || 'autowork';

    if (meta.result === 'FAILURE') {
      failureCount++;
      const catMatch = rawLog.match(/Category:\s*`([^`]+)`/);
      const cat = catMatch ? catMatch[1] : 'unspecified';
      failureCategories[cat] = (failureCategories[cat] || 0) + 1;

      const isGeneric = rawLog.includes('Scope: `generic`') || cat === 'orchestration_collision' || cat === 'prompt_unclear';
      const reasonMatch = rawLog.match(/Details:\s*([^\n]+)/) || rawLog.match(/\| Error reason \| ([^|]+) \|/);
      const reason = reasonMatch ? reasonMatch[1].trim() : 'Routine execution failed';
      const fixMatch = rawLog.match(/Suggested Fix:\s*([^\n]+)/);
      const fix = fixMatch ? fixMatch[1].trim() : 'Refine prompt instructions';

      proposals.push({
        id: `proposal-${i + 1}`,
        scope: isGeneric ? 'generic' : 'local',
        title: isGeneric
          ? `fix(prompts): improve ${cat.replace(/_/g, ' ')} handling in ${routine}`
          : `fix(repo): address local ${cat.replace(/_/g, ' ')} failure in ${routine}`,
        body: `### Proposed Optimization\n\n**Observed Defect**:\n${reason}\n\n**Suggested Fix**:\n${fix}\n\n**Evidence from run logs**:\nLog timestamp \`${timestamp}\`, result \`${meta.result}\`.`,
        targetPrompt: `${routine}.md`,
        evidenceLogs: [timestamp],
        suggestedChanges: fix,
      });
    }

    // Check iterations
    const iterMatch = rawLog.match(/Iterations used \| (\d+)/);
    if (iterMatch && parseInt(iterMatch[1], 10) >= 50) {
      highIterationRuns++;
    }

    // Check review rounds
    const roundsMatch = rawLog.match(/Review rounds \| (\d+)/);
    if (roundsMatch && parseInt(roundsMatch[1], 10) >= 3) {
      reviewPingPongCount++;
      proposals.push({
        id: `proposal-efficiency-${i + 1}`,
        scope: 'generic',
        title: `fix(prompts): prevent excessive review loop bounces in ${routine}`,
        body: `### Proposed Efficiency Optimization\n\nDetected ${roundsMatch[1]} review rounds. Added tighter convergence gates.\n\n**Evidence from run logs**:\nLog timestamp \`${timestamp}\`.`,
        targetPrompt: 'peer-review.md',
        evidenceLogs: [timestamp],
        suggestedChanges: 'Enforce ping-pong cap at 3 rounds.',
      });
    }
  }

  return {
    totalLogsScanned: logs.length,
    failureCount,
    failureCategories,
    highIterationRuns,
    reviewPingPongCount,
    proposals,
  };
}

/**
 * Simulate consumer repository downstream sync and verify drift & PR generation
 */
export function simulateDownstreamSyncWorkflow(options: DownstreamSyncSimulationOptions): DownstreamSyncSimulationResult {
  const targetDir = options.targetDir;
  const initialPreset = options.initialPreset || 'standard';
  const initialVersion = options.initialVersion || '1.0.0';

  // 1. Initialize consumer repo at initial state
  const manifest = createDefaultManifest(initialPreset);
  manifest.version = initialVersion;
  saveManifest(targetDir, manifest);
  installFleet(targetDir, manifest, { force: true });

  // 2. Apply any simulated local drift/modifications
  if (options.modifiedPrompts) {
    for (const [filename, content] of Object.entries(options.modifiedPrompts)) {
      const promptPath = path.join(targetDir, '.github/prompts', filename);
      fs.mkdirSync(path.dirname(promptPath), { recursive: true });
      fs.writeFileSync(promptPath, content, 'utf8');
    }
  }

  if (options.deletedFiles) {
    for (const relPath of options.deletedFiles) {
      const filePath = path.join(targetDir, relPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  // 3. Detect drift prior to sync
  const currentManifest = loadManifest(targetDir) || manifest;
  const driftDetails = checkDrift(targetDir, currentManifest);
  const hasDrift =
    driftDetails.missingPrompts.length > 0 ||
    driftDetails.modifiedPrompts.length > 0 ||
    driftDetails.missingWorkflows.length > 0 ||
    driftDetails.modifiedWorkflows.length > 0 ||
    driftDetails.missingSkills.length > 0 ||
    currentManifest.version !== FLEET_VERSION;

  // 4. Perform sync
  currentManifest.version = FLEET_VERSION;
  saveManifest(targetDir, currentManifest);
  installFleet(targetDir, currentManifest, { force: true });

  // 5. Verify post-sync cleanliness
  const postDrift = checkDrift(targetDir, currentManifest);
  const isCleanAfterSync =
    postDrift.missingPrompts.length === 0 &&
    postDrift.modifiedPrompts.length === 0 &&
    postDrift.missingWorkflows.length === 0 &&
    postDrift.missingSkills.length === 0 &&
    currentManifest.version === FLEET_VERSION;

  // 6. Formulate PR payload matching sync-fleet.yml
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prPayload = {
    shouldCreatePR: hasDrift,
    headBranch: hasDrift ? `chore/sync-jonah-fleet-${dateStr}` : undefined,
    baseBranch: hasDrift ? 'main' : undefined,
    title: hasDrift ? 'chore(fleet): sync prompt routines and workflows from jonah-fleet' : undefined,
    body: hasDrift
      ? 'Automated update from `jonah-fleet`. Synchronizes latest prompt invariants, claim protocols, and workflow fixes.'
      : undefined,
  };

  return {
    initialDrift: {
      hasDrift,
      driftDetails,
    },
    syncedVersion: currentManifest.version,
    isCleanAfterSync,
    prPayload,
  };
}
