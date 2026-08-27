# Prompt Optimizer

## Objective

Scan recent agent run logs and closed issues, diagnose four classes of problem — **failures** (runs that logged FAILURE), **inefficiency** (runs burning excessive iterations or multi-loop PRs), **token consumption & cost anomalies** (runs trending toward weekly budget ceilings), and **preventable bugs & defect avoidance** (analyzing resolved bugs to determine root causes and authoring/review prevention checks) — and propose targeted prompt, template, test, and workflow fixes via pull requests.

Additionally, this routine acts as the **Upstream Evolution Bridge**: when a prompt improvement solves a generic orchestrator pattern (benefiting all fleet-connected projects), it proposes the fix upstream to the `jonah-fleet` repository (`juliendurandeu/jonah-fleet`).

## Definition of Done

The run is SUCCESS if ALL of these are true:

- [ ] All log files from the incremental window in `.github/prompts/logs/` have been scanned
- [ ] Every FAILURE log has been categorized and analyzed
- [ ] Inefficiency and review loops per PR have been computed across SUCCESS logs
- [ ] Closed bug issues and merged bug-fix PRs in the window have been analyzed for systemic root causes
- [ ] For each fixable pattern:
  - If project-specific: opened a local PR with a prompt, template, or test fix and marked ready for review
  - If generic/fleet-wide: opened an upstream PR against `juliendurandeu/jonah-fleet` (or flagged via `npx jonah-fleet contribute`)
- [ ] Every PR links a tracking issue via `Closes #N`
- [ ] If no issues or optimization patterns are found, logged SUCCESS with "No issues to address"

If any criterion cannot be met, stop immediately and log FAILURE with the reason.

## Constraints

- **Max iterations**: 30 — stop after 30 tool call rounds.
- **Max scope**: one PR per identified problem. Do not bundle unrelated fixes.
- **No speculative work**: only fix patterns evidenced by logs, closed bug issues, or reviewer findings.
- **Language Requirement**: All GitHub issue titles, descriptions, task checklists, and comments MUST be written in **English**.

## Instructions

### 0. Establish the incremental scan boundary

1. Check `.github/prompts/logs/optimizer/` for the most recent optimizer log.
2. Extract the timestamp as the scan boundary (or last 7 days if first run).

### 1. Collect signals & analyze logs

1. **Scan in-window log files**: Read all log files in `.github/prompts/logs/*/` within the incremental window.
2. **Extract failure categories**: Group failures by `prompt_unclear`, `data_issue`, `token_limit`, and `infeasible_task`.
3. **Compute efficiency metrics**: Identify PRs with 3+ review rounds or runs with high iteration usage.
4. **Aggregate per-routine token & cost consumption**:
   - Group log metadata by `Routine` (`autowork`, `peer-review`, `issues-housekeeping`, `dependency-update-security-check`, `optimizer`, `product-planning`).
   - Calculate total input tokens, output tokens, total tokens, total estimated cost, run count, average iterations, max iterations, and percentage share of fleet spend.
   - Calculate weekly token ceiling pacing against the global 70% budget ceiling (~8.75M tokens/week) defined in `ORCHESTRATION.md`.
5. **Evaluate Token Anomaly Heuristics**: Detect actionable anomalies using concrete numerical thresholds:
   - **Token Surge**: Routine average token consumption increases >50% week-over-week (or against baseline).
   - **Budget Hog**: A single agent routine consumes >75% of total fleet token allowance.
   - **Iteration Ceiling Exhaustion**: >20% of runs in a routine terminate at the `token_limit` / max iteration cap.
   - **Review Loop Burn**: Pull requests experiencing >= 3 bounce rounds between autowork and peer-review over unresolved or recurring findings.
6. **Analyze resolved bugs**: Review closed bug issues and merged bug-fix PRs for missing checks in authoring (`autowork.md`) or review (`peer-review.md`).

### 2. Formulate preventative improvements

Translate findings into concrete preventative improvements and remediation triggers:
- **Instruction Pruning**: For Token Surge and prompt bloat, prune redundant instructions, anti-patterns, and no-ops in routine prompts following `/writing-for-agents` principles (replacing sprawling descriptions with crisp leading words and progressive disclosure pointers).
- **Early Exit & Candidate Skip**: For Budget Hog and runaway sweeps, add early termination guards, candidate pre-qualification filters, and infeasible evaluation caps.
- **Iteration Ceiling & Self-Audit Tuning**: For Iteration Ceiling Exhaustion, adjust max iteration bounds or tighten pre-ready self-audits in `autowork.md` to catch defects before review cycles start.
- **Ping-Pong Convergence**: For Review Loop Burn, tighten reviewer trust & noise filtering, enforce clean-merge gates, and apply ping-pong caps to prevent endless bounce cycles.
- **Verification & Invariant Tests**: Add automated test cases in `tests/` verifying prompt invariant preservation and schema conformity.

### 3. Open Fix PR (Local or Upstream Bridge)

- **Local Improvement**: If the fix touches repository-specific rules, local docs, or custom tests:
  - Branch from `origin/main`, apply changes, and open PR via `gh pr create --draft`.
  - Link tracking issue and mark ready for review (`gh pr ready <PR>`).
- **Generic / Fleet Improvement**: If the fix improves core prompt orchestration, claim protocols, or universal error handling:
  - Open a PR against upstream `juliendurandeu/jonah-fleet` using the GitHub CLI:
    ```bash
    npx jonah-fleet contribute --title "fix(prompt): <description>" --body "<evidence from local run logs>"
    ```
    or branch and open a PR against upstream `juliendurandeu/jonah-fleet`.

## Logging

After completing (SUCCESS or FAILURE), write a log file to `.github/prompts/logs/optimizer/{timestamp}.md` following the schema in `.github/prompts/logs/_template.md`. Include:
- Prompt SHA
- Analyzed logs count and identified patterns
- Per-Agent Token & Cost Consumption Scorecard table:

```markdown
### Token & Cost Consumption by Agent

| Routine | Runs | Input Tokens | Output Tokens | Total Tokens | Cost | Fleet % | Avg Iterations | Max Iterations | Status / Anomaly |
|---|---|---|---|---|---|---|---|---|---|
| `autowork` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
| `peer-review` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
| `issues-housekeeping` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
| `dependency-update-security-check` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
| `optimizer` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
| `product-planning` | 0 | 0 | 0 | 0 | $0.00 | 0.0% | 0 | 0 | Nominal |
```

- PRs opened (local or upstream)

**Important**: Commit the log file directly to `main` and push. Follow the Log delivery fallback in `ORCHESTRATION.md` if direct push fails.

