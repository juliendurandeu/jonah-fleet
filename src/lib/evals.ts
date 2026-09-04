import fs from 'node:fs';
import path from 'node:path';
import { parseLogMetadata } from './fleet-query.js';
import { checkDrift, type DriftReport } from './diff.js';
import { installFleet } from './installer.js';
import { createDefaultManifest, loadManifest, saveManifest } from './manifest.js';
import { FLEET_VERSION, type FleetManifest } from './presets.js';

export interface SyntheticLogOptions {
  routine: 'autowork' | 'peer-review' | 'optimizer' | 'issues-housekeeping' | 'dependency-check' | 'product-planning' | 'analytics-review';
  timestamp: string;
  result: 'SUCCESS' | 'FAILURE';
  errorCategory?: 'prompt_unclear' | 'token_limit' | 'data_issue' | 'infeasible_task' | 'merge_conflict' | 'orchestration_collision' | 'telemetry_rabbit_hole' | 'intent_vs_defect' | 'ambiguous_spec';
  errorReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  iterations?: number;
  reviewRounds?: number;
  isGenericPattern?: boolean;
  suggestedOptimization?: string;
}

export interface BenchmarkIssue {
  id: string;
  title: string;
  body: string;
  labels?: string[];
  expectedAction: 'ASK_QUESTIONS' | 'PROCEED_TO_IMPLEMENT';
  rationale: string;
  origin?: 'synthetic' | 'optimizer_extracted' | 'human_authored';
  sourceLogTimestamp?: string;
}

export interface BenchmarkEvaluationResult {
  issueId: string;
  decision: 'ASK_QUESTIONS' | 'PROCEED_TO_IMPLEMENT';
  expectedAction: 'ASK_QUESTIONS' | 'PROCEED_TO_IMPLEMENT';
  isCorrect: boolean;
  confidence: number;
  missingCriteria: string[];
  generatedQuestions: string[];
  rationale: string;
}

export interface BenchmarkRunSummary {
  totalEvaluated: number;
  passedCount: number;
  failedCount: number;
  accuracy: number;
  falseComplianceCount: number; // Said PROCEED when expected ASK_QUESTIONS (Yes-Man error)
  falseComplianceRate: number;
  falseObstructionCount: number; // Said ASK_QUESTIONS when expected PROCEED
  falseObstructionRate: number;
  itemizedResults: BenchmarkEvaluationResult[];
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

      const isGeneric =
        rawLog.includes('Scope: `generic`') ||
        cat === 'orchestration_collision' ||
        cat === 'prompt_unclear' ||
        cat === 'telemetry_rabbit_hole' ||
        cat === 'intent_vs_defect' ||
        cat === 'ambiguous_spec';
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
    const iterationsUsed = meta.iterationsUsed ?? (rawLog.match(/Iterations used \| (\d+)/) ? parseInt(rawLog.match(/Iterations used \| (\d+)/)![1], 10) : undefined);
    if (iterationsUsed !== undefined && iterationsUsed >= 50) {
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
    postDrift.modifiedWorkflows.length === 0 &&
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
      ? 'Automated update from `jonah-fleet`. Synchronizes latest prompt invariants, claim protocols, and workflow fixes.\n\n_Generated by [Antigravity](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})_'
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

/**
 * Evaluate whether an issue is ambiguous or ready for immediate autonomous implementation
 */
export function evaluateIssueAmbiguity(issue: BenchmarkIssue): BenchmarkEvaluationResult {
  const title = issue.title.trim();
  const body = (issue.body || '').trim();
  const combined = `${title}\n${body}`.toLowerCase();

  const missingCriteria: string[] = [];
  const generatedQuestions: string[] = [];

  // Positive signals (well-specified)
  const hasTaskChecklist = /- \[[ xX]\]/.test(body) || /## tasks/i.test(body) || /## deliverables/i.test(body);
  const hasTestCommand = /(npm test|pytest|cargo test|vitest|npm run type-check|tsc --noemit)/i.test(body);
  const hasFileReferences = /(src\/|tests\/|\.ts|\.js|\.md|line \d+|:\d+)/i.test(body);
  const hasExactErrorOrRepro = /(ts\d{4}|error:|expected:|actual:|reproduction:|when running)/i.test(body);

  // Ambiguity signals
  const isTooShort = body.length < 90 && !hasTaskChecklist && !hasTestCommand;
  const hasVagueVerbs =
    /(make it fast|make faster|improve speed|sluggish|clean up|clean up stale|rework ui|make better|look broken|needs to be cleaned up|add.*permissions|add role-based permissions|refactor.*queries)/i.test(
      combined
    );
  const lacksAcceptanceCriteria = !hasTaskChecklist && !hasTestCommand && !hasExactErrorOrRepro;

  if (isTooShort || hasVagueVerbs || lacksAcceptanceCriteria) {
    if (!hasTaskChecklist) missingCriteria.push('Missing structured task checklist or explicit deliverables');
    if (!hasTestCommand) missingCriteria.push('Missing verification path or automated test command');
    if (!hasFileReferences) missingCriteria.push('Missing explicit module boundaries, file seams, or target components');
    if (hasVagueVerbs) missingCriteria.push('Relies on qualitative or unquantified goals without acceptance thresholds');

    // Generate 1-2 sharp clarifying questions addressing the exact missing decisions
    if (combined.includes('speed') || combined.includes('fast') || combined.includes('sluggish') || combined.includes('performance')) {
      generatedQuestions.push('What is the baseline latency and target performance threshold for this operation?');
      generatedQuestions.push('Which exact module or transport layer has been profiled as the bottleneck?');
    } else if (combined.includes('permission') || combined.includes('role') || combined.includes('auth')) {
      generatedQuestions.push('What specific roles and permission tiers should be established, and which endpoints/routes do they guard?');
      generatedQuestions.push('Where should permission checks be enforced (server middleware, domain boundary, or client UI)?');
    } else if (combined.includes('mobile') || combined.includes('ui') || combined.includes('layout') || combined.includes('phone')) {
      generatedQuestions.push('Which viewports (~390px mobile, tablet, or desktop) and specific components exhibit the layout issue?');
      generatedQuestions.push('What are the reproduction steps or expected visual alignment for the broken state?');
    } else if (combined.includes('stale') || combined.includes('clean up') || combined.includes('unused') || combined.includes('delete')) {
      generatedQuestions.push('Which specific files, functions, or modules are targeted for removal?');
      generatedQuestions.push('What verification test confirms no external consumers or dynamic imports depend on them?');
    } else if (combined.includes('database') || combined.includes('quer')) {
      generatedQuestions.push('Which specific tables, models, or queries are encountering performance or structural issues?');
      generatedQuestions.push('What architectural pattern or query optimization is expected?');
    } else {
      generatedQuestions.push('What observable acceptance criteria define successful completion of this task?');
      generatedQuestions.push('Which files or modules should be modified to implement this change?');
    }

    const decision = 'ASK_QUESTIONS';
    return {
      issueId: issue.id,
      decision,
      expectedAction: issue.expectedAction,
      isCorrect: decision === issue.expectedAction,
      confidence: 0.95,
      missingCriteria,
      generatedQuestions: generatedQuestions.slice(0, 2),
      rationale: `Ambiguity detected: ${missingCriteria.join('; ')}`,
    };
  }

  const decision = 'PROCEED_TO_IMPLEMENT';
  return {
    issueId: issue.id,
    decision,
    expectedAction: issue.expectedAction,
    isCorrect: decision === issue.expectedAction,
    confidence: 0.95,
    missingCriteria: [],
    generatedQuestions: [],
    rationale: 'Well-specified: contains actionable tasks, file targets, and verification criteria.',
  };
}

/**
 * Execute an automated benchmark run over a dataset of candidate issues
 */
export function runAmbiguityBenchmark(dataset: BenchmarkIssue[]): BenchmarkRunSummary {
  const itemizedResults = dataset.map((issue) => evaluateIssueAmbiguity(issue));
  const totalEvaluated = itemizedResults.length;
  const passedCount = itemizedResults.filter((r) => r.isCorrect).length;
  const failedCount = totalEvaluated - passedCount;
  const accuracy = totalEvaluated > 0 ? passedCount / totalEvaluated : 0;

  // False Compliance: expected ASK_QUESTIONS, but agent decided PROCEED_TO_IMPLEMENT (Yes-Man error)
  const falseComplianceCount = itemizedResults.filter(
    (r) => r.expectedAction === 'ASK_QUESTIONS' && r.decision === 'PROCEED_TO_IMPLEMENT'
  ).length;
  const falseComplianceRate = totalEvaluated > 0 ? falseComplianceCount / totalEvaluated : 0;

  // False Obstruction: expected PROCEED_TO_IMPLEMENT, but agent decided ASK_QUESTIONS
  const falseObstructionCount = itemizedResults.filter(
    (r) => r.expectedAction === 'PROCEED_TO_IMPLEMENT' && r.decision === 'ASK_QUESTIONS'
  ).length;
  const falseObstructionRate = totalEvaluated > 0 ? falseObstructionCount / totalEvaluated : 0;

  return {
    totalEvaluated,
    passedCount,
    failedCount,
    accuracy,
    falseComplianceCount,
    falseComplianceRate,
    falseObstructionCount,
    falseObstructionRate,
    itemizedResults,
  };
}

/**
 * Extract an ambiguous benchmark fixture from an agent failure log or review ping-pong run
 */
export function extractBenchmarkCaseFromLog(
  rawLog: string,
  issueDetails?: { title?: string; body?: string; id?: string }
): BenchmarkIssue | null {
  const meta = parseLogMetadata(rawLog);
  const catMatch = rawLog.match(/Category:\s*`([^`]+)`/);
  const cat = catMatch ? catMatch[1] : '';

  const isAmbiguityPattern =
    cat === 'ambiguous_spec' ||
    cat === 'prompt_unclear' ||
    cat === 'telemetry_rabbit_hole' ||
    rawLog.toLowerCase().includes('ambiguity gate') ||
    rawLog.toLowerCase().includes('needs-info');

  const roundsMatch = rawLog.match(/Review rounds \| (\d+)/);
  const hasExcessiveBounces = roundsMatch && parseInt(roundsMatch[1], 10) >= 3;

  if (!isAmbiguityPattern && !hasExcessiveBounces && meta?.result !== 'FAILURE') {
    return null;
  }

  const reasonMatch = rawLog.match(/Details:\s*([^\n]+)/) || rawLog.match(/\| Error reason \| ([^|]+) \|/);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'Unspecified failure';
  const timestamp = meta?.timestamp || new Date().toISOString();

  const title = issueDetails?.title || `Ambiguous requirement discovered in run ${timestamp}`;
  const body = issueDetails?.body || `Issue encountered execution failure or review bounce.\n\nEvidence: ${reason}`;
  const id = issueDetails?.id || `optimizer-extracted-${timestamp.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  return {
    id,
    title,
    body,
    labels: ['needs-info', 'eval-extracted'],
    expectedAction: 'ASK_QUESTIONS',
    rationale: `Extracted by optimizer from failure log (${reason}). Agent should ask clarifying questions before implementation.`,
    origin: 'optimizer_extracted',
    sourceLogTimestamp: timestamp,
  };
}

/**
 * Dynamically feed an optimizer-extracted issue into a benchmark dataset
 */
export function feedOptimizerCaseToBenchmark(
  dataset: BenchmarkIssue[],
  newCase: BenchmarkIssue
): BenchmarkIssue[] {
  const existingIdx = dataset.findIndex((i) => i.id === newCase.id || i.title === newCase.title);
  if (existingIdx >= 0) {
    const updated = [...dataset];
    updated[existingIdx] = newCase;
    return updated;
  }
  return [...dataset, newCase];
}

/**
 * Load the baseline ambiguity benchmark dataset
 */
export function getBaselineAmbiguityBenchmarkDataset(): BenchmarkIssue[] {
  const benchmarkFile = path.resolve(process.cwd(), 'templates/evals/ambiguity-benchmark.json');
  if (fs.existsSync(benchmarkFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(benchmarkFile, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [
    {
      id: 'eval-ambiguous-01',
      title: 'Improve telemetry export speed',
      body: 'The telemetry export is feeling sluggish lately. Please optimize it to make it faster.',
      labels: ['enhancement'],
      expectedAction: 'ASK_QUESTIONS',
      rationale: 'Lacks baseline metrics, target latency thresholds, profiling data, or specific code bottlenecks.',
      origin: 'synthetic',
    },
    {
      id: 'eval-specified-01',
      title: 'Fix CLI flag parsing for --budget in telemetry command',
      body: 'When running `jonah-fleet telemetry --budget 5000000`, the budget is ignored because the option parser expects a number.\n\n## Tasks\n- [ ] Parse `options.budget` string to integer in `src/commands/telemetry.ts`\n- [ ] Fall back to manifest `weeklyTokenBudget` if omitted\n- [ ] Add unit test in `tests/telemetry-cli.test.ts` verifying flag override\n\nVerification: `npm test tests/telemetry-cli.test.ts`',
      labels: ['bug', 'priority/P1'],
      expectedAction: 'PROCEED_TO_IMPLEMENT',
      rationale: 'Carries reproduction path, explicit file locations, task checklist, and test verification command.',
      origin: 'synthetic',
    },
  ];
}

