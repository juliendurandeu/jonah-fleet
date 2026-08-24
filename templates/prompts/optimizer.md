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

1. Scan in-window log files in `.github/prompts/logs/*/`.
2. Extract failure categories: `prompt_unclear`, `data_issue`, `token_limit`, `infeasible_task`.
3. Compute efficiency metrics: PRs with 3+ review rounds, high iteration usage.
4. Analyze resolved bugs for missing checks in authoring (`autowork.md`) or review (`peer-review.md`).

### 2. Formulate preventative improvements

Translate findings into concrete preventative improvements:
- Enhance pre-ready checklist in `autowork.md`
- Add automated verification tests or invariant checks
- Clarify ambiguous prompt instructions

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
- PRs opened (local or upstream)

**Important**: Commit the log file directly to `main` and push. Follow the Log delivery fallback in `ORCHESTRATION.md` if direct push fails.
