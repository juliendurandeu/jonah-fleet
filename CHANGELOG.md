# Changelog

All notable changes to `jonah-fleet` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Priority-Driven Dual Agent Execution (Local + GitHub Actions):
  - Added CLI `jonah-fleet run <routine>` command to execute prompt routines locally with automatic Git worktree isolation (`.jonah-fleet/worktrees/`), protecting active working copies and uncommitted editor files.
  - Added CLI `jonah-fleet daemon [start|stop|status]` background worker to continuously poll open issues and PRs for local execution.
  - Added `dualExecution` configuration schema in `agents-manifest.json` and `schema.json` supporting configurable `cloudPriorities` (default: `['P0', 'P1']`) and `cloudCatchupHours` (default: `48`).
  - Added PR priority label mirroring in `autowork.md` to automatically mirror `priority/PX` labels onto opened PRs.
  - Added dual routing and 48-hour cloud catchup logic in `autowork.md`, `peer-review.md`, and `trigger-review-routine.yml`.
  - Added Git worktree isolation manager (`src/lib/worktree.ts`) and local routine runner (`src/lib/runner.ts`).
- Design System & Telemetry Friction Guardrails in Core Routines:
  - Added Design System & Viewport Density Pass to `peer-review.md` (`templates/prompts/peer-review.md` & `.github/prompts/peer-review.md`) enforcing Token Purity, WCAG AA 4.5:1 contrast ratios, single primary CTA hierarchy, and mobile viewport budget checks on UI diffs (#49).
  - Added Design System & Viewport Pre-flight to `autowork.md` (`templates/prompts/autowork.md` & `.github/prompts/autowork.md`) in Pre-ready self-audit (#49).
  - Added UI Friction & Nudge Fatigue Guardrail to `analytics-review.md` (`templates/prompts/analytics-review.md` & `.github/prompts/analytics-review.md`) to aggregate component-level `$rageclick` events and flag low-conversion promotional elements (500+ impressions, CTR < 2.0%) (#49).
  - Documented Design System & UI Guardrails in `templates/docs/AGENTS.template.md` and `AGENTS.md` (#49).
- Custom Cron Schedules & Sync Preservation: Added `schedules` configuration support in `agents-manifest.json` and `schema.json` for routines (`autowork`, `peer-review`, `optimizer`, `issues-housekeeping`, `dependency-update-security-check`, `analytics-review`, `sync-fleet`). Enhanced `installFleet()` and `checkDrift()` to dynamically inject configured schedules, preserve existing local workflow cron triggers, and prevent false-positive drift on synchronizations (#47).
- Analytics Review Routine (`templates/prompts/analytics-review.md` & `.github/prompts/analytics-review.md`): Evaluates active and scheduled measurement trackers against product metrics, user adoption, and conversion funnels. Requires mandatory structured action directives (`RECOMMENDATION: [PIVOT | DEPRECATE | ITERATE]`) upon measurement closure to bridge outcomes directly into product planning (#28).
- Feature Pruning & Deprecation Audit in Product Planning (`templates/prompts/product-planning.md` & `.github/prompts/product-planning.md`): Audits shipped features and closed measurement tracker verdicts in Propose mode for low-ROI / high-maintenance features (<2% adoption, >50% failure rate) and drafts deprecation / simplification proposals (#28).
- Intent vs. Defect Guardrail & Telemetry Rabbit Hole Prevention in Autowork and Diagnosing Bugs (`templates/prompts/autowork.md`, `.github/prompts/autowork.md`, `templates/skills/diagnosing-bugs/SKILL.md`, `.agents/skills/diagnosing-bugs/SKILL.md`): Prevents agents from wasting cycles writing elaborate fallback telemetry or defensive error handling when low adoption stems from lack of user intent rather than software defects, routing issues to `needs-design`/`roadmap/*` (#28).
- Post-Measurement Product Bridge & Intent vs. Defect Guardrail Architecture in `ORCHESTRATION.md` (#28).
- Registered `analytics-review` in `schema.json`, `src/lib/presets.ts`, `src/lib/manifest.ts`, and `full` preset bundle (#28).

### Performance
- GitHub Actions Quota Optimization:
  - Added zero-open-PR preflight check to `trigger-review-routine.yml` scheduled sweeps to skip Node setup, Antigravity CLI installation, and agent runs when no PRs are pending review, cutting empty sweep runner time from ~4m to ~3s.
  - Fixed `trigger-autowork-on-bug.yml` issue event trigger condition to strictly require both `bug` and priority labels (`priority/P1` or `priority/P0`), preventing arbitrary label edits from spawning unnecessary runners.
  - Tightened job and step timeouts across routine trigger workflows (`trigger-review-routine.yml`, `trigger-autowork-on-bug.yml`, `trigger-autowork-on-merge.yml`) to 30m–35m to prevent runaway billing on stuck runners.

### Changed
- Upgraded development dependency `@types/node` from `22.20.1` to `^26.4.0` (#41).
- Upgraded development dependency `typescript` from `5.9.3` to `^7.0.2`, configured `"types": ["node"]` in `tsconfig.json`, and configured `tsc` declaration emit (#40).
- Upgraded production dependency `commander` from `12.1.0` to `^15.0.0` (#39).

### Fixed
- Resolved Critical (GHSA-5xrq-8626-4rwp), High (GHSA-fx2h-pf6j-xcff), and Moderate security vulnerabilities in `vitest` and transitive dependencies (`vite`, `esbuild`, `vite-node`, `@vitest/mocker`) by upgrading `vitest` to `^4.1.11` and overriding `esbuild` to `^0.28.2` (#38).

## [1.3.0](https://github.com/juliendurandeu/jonah-fleet/compare/jonah-fleet-v1.2.0...jonah-fleet-v1.3.0) (2026-08-31)


### Features

* **cli:** add multi-repo fleet monitoring command (jonah-fleet monitor) ([#6](https://github.com/juliendurandeu/jonah-fleet/issues/6)) ([0093c0f](https://github.com/juliendurandeu/jonah-fleet/commit/0093c0f2bdeb0d48d952119b96e541be73c59a03))
* **cli:** add per-agent token breakdown to jonah-fleet status and monitor commands ([#16](https://github.com/juliendurandeu/jonah-fleet/issues/16)) ([7e51d0c](https://github.com/juliendurandeu/jonah-fleet/commit/7e51d0cb6bdf8fef127cac7f13f8320821cb4391))
* **evals:** add automated test suite for bi-directional optimization bridge and downstream sync ([#23](https://github.com/juliendurandeu/jonah-fleet/issues/23)) ([2e55227](https://github.com/juliendurandeu/jonah-fleet/commit/2e552273600c22879d81b6ad607ad912809d3dbb))
* **fleet-query:** extend fleet query engine with per-routine token and iteration aggregation ([#15](https://github.com/juliendurandeu/jonah-fleet/issues/15)) ([cabbbbc](https://github.com/juliendurandeu/jonah-fleet/commit/cabbbbcc62d8fe39ea135f56acdba0343aa11e02))
* **fleet:** initial release of jonah-fleet standalone agent suite and CLI ([1b08b3e](https://github.com/juliendurandeu/jonah-fleet/commit/1b08b3e14626cda25e76464d92782f16cfaae936))
* **optimizer:** implement token anomaly heuristics and automated PR triggers ([#10](https://github.com/juliendurandeu/jonah-fleet/issues/10)) ([#17](https://github.com/juliendurandeu/jonah-fleet/issues/17)) ([3090785](https://github.com/juliendurandeu/jonah-fleet/commit/30907857f7e24edaee1d2c2dbca61568d95f7767))
* **optimizer:** update optimizer routine with per-agent token aggregation protocol and scorecard schema ([#14](https://github.com/juliendurandeu/jonah-fleet/issues/14)) ([2e435ef](https://github.com/juliendurandeu/jonah-fleet/commit/2e435ef7492bf75dbf3c081d64375f49ea542667))
* **peer-review:** add autonomous issue synthesis for unlinked PRs ([54e9a54](https://github.com/juliendurandeu/jonah-fleet/commit/54e9a54685ee89bf124923fb6086760c3753d097))
* **peer-review:** allow self-contained PR descriptions without blocking on linked issues ([97b7034](https://github.com/juliendurandeu/jonah-fleet/commit/97b703403040fc9dbe4f6b6622000822d9925aae))
* **prompts:** add feedback loop stagnation heuristic and closed-loop verification audit ([#24](https://github.com/juliendurandeu/jonah-fleet/issues/24)) ([c3ea012](https://github.com/juliendurandeu/jonah-fleet/commit/c3ea01297017347f6b3c43e4bdd99ea2704fd60e))
* **telemetry:** design and implement centralized cross-repo telemetry and token tracking hub (closes [#5](https://github.com/juliendurandeu/jonah-fleet/issues/5)) ([#22](https://github.com/juliendurandeu/jonah-fleet/issues/22)) ([e910277](https://github.com/juliendurandeu/jonah-fleet/commit/e9102779293601e94a23401a10e669bb174cb972))
* **workflows:** support manual and comment-based (re)triggering for peer review routine ([#30](https://github.com/juliendurandeu/jonah-fleet/issues/30)) ([e8be955](https://github.com/juliendurandeu/jonah-fleet/commit/e8be955f429450fdce2d79f52a27c3ee4bb41acd)), closes [#29](https://github.com/juliendurandeu/jonah-fleet/issues/29)
* **workflows:** support triggering autowork via workflow_dispatch badge link (closes [#18](https://github.com/juliendurandeu/jonah-fleet/issues/18)) ([#20](https://github.com/juliendurandeu/jonah-fleet/issues/20)) ([a44e54e](https://github.com/juliendurandeu/jonah-fleet/commit/a44e54e647db11587ab58eb0ec01201cb7e9376f))


### Added
- Smart Tech-Stack Auto-Detection for `jonah-fleet init` (`src/lib/detector.ts`): inspects repository files to detect languages (TypeScript, JavaScript, Python, Go, Rust), frameworks (Next.js, React, Remix, Astro, Vue, Nuxt, SvelteKit, Express, Fastify, NestJS, Koa, Hono, FastAPI, Django, Flask, Gin, Echo, Chi, Fiber, Axum, Actix Web, Rocket), package managers (npm, pnpm, yarn, bun, pip, uv, poetry, pipenv, go, cargo), linters, test runners, and auto-populates tailored build, test, and type-check commands into `AGENTS.md` (#4).
- CLI flag overrides (`--stack`, `--package-manager`, `--test-cmd`, `--build-cmd`, `--interactive`, `--no-interactive`) on `jonah-fleet init` for customized initialization.
- Inward Blocker Dependency Gating in `autowork.md` (`templates/prompts/autowork.md` and `.github/prompts/autowork.md`): automatically detects and gates issues carrying `Blocked by #N` / `Depends on #N` until prerequisite issues merge, preventing premature execution of dependent tasks.
- Standard `NOTICE` attribution file formally crediting OpenAI Symphony's architectural lineage under Apache-2.0.
- Automated Upstream Symphony Radar GitHub Actions workflow (`.github/workflows/symphony-radar.yml` and `.github/scripts/fetch-symphony-radar.js`) for periodic detection and issue reporting of specification updates in `openai/symphony`.
- Explicit Acknowledgments & Credits section in `README.md`.
- Review failure notification handler and 2-hour scheduled scan sweep watchdog in `trigger-review-routine.yml` to prevent stuck PRs and recover orphaned ready PRs.
- Orphaned ready PR watchdog in `autowork.md` (Step 3c) and Scan mode unreviewed prioritization in `peer-review.md`.
- Peer Review Resilience & Orphaned PR Recovery protocol documentation in `ORCHESTRATION.md`.
- Comprehensive bi-directional optimization bridge evaluations test suite and synthetic run log fixtures (`src/lib/evals.ts`, `tests/evals.test.ts`).
- Upstream contribution CLI test suite with mock executor and dry-run support (`tests/contribute.test.ts`).
- Downstream synchronization workflow and drift scenario test suite (`tests/sync-workflow.test.ts`).
- Dedicated `evals` CI workflow job in `.github/workflows/ci.yml` and `test:evals` npm script.
- Centralized cross-repo telemetry aggregation and token tracking hub (`jonah-fleet telemetry`).
- Routine telemetry JSON schema and parser (`RoutineTelemetrySummary`) supporting failure categories, duration, iterations, cost, and tokens.
- Global 70% weekly token budget ceiling tracking (~8.75M tokens/week) with utilization percentage, daily burn rates, and health badges (`[HEALTHY]`, `[WARNING]`, `[CRITICAL]`, `[EXCEEDED]`).
- Opt-in telemetry emission step in `autowork-cron.yml`, `trigger-review-routine.yml`, and `prompt-optimizer-cron.yml`.
- `telemetry` configuration block in `schema.json` and `agents-manifest.json`.
- Dedicated `trigger-autowork-manual.yml` workflow template for targeted on-demand Autowork runs via `workflow_dispatch` and issue badge links.
- Badge link format documentation in `templates/docs/AGENTS.template.md` and repository `AGENTS.md`.
- Default GitHub Issue Templates in `.github/ISSUE_TEMPLATE/` (`feature_request.md` and `bug_report.md`) embedding the Targeted Autowork badge link.
- `trigger-autowork-manual.yml` added to `ROUTINE_TO_WORKFLOW_MAP.autowork` for automatic installation and drift detection.
- Alias support for `issue_number` in `autowork-cron.yml` `workflow_dispatch` trigger.
- Explicit `token: ${{ secrets.GH_PAT || github.token }}` parameter in `release-please.yml` ensuring automated release PRs are authored with maintainer permissions to prevent workflow approval blocks.
- Release PR branch exclusion (`release-please--*`) in `trigger-review-routine.yml` workflow triggers, guard skip step, and `peer-review.md` prompt routines.
- Unit and drift tests in `tests/workflows-validation.test.ts` and `tests/installer.test.ts`.

## [1.2.0] - 2026-08-30

### Added
- Manual and comment-based (re)triggering for the Peer Review routine in `trigger-review-routine.yml`: supports `workflow_dispatch` (with optional `pr_number` for Targeted mode or blank for Scan mode), PR comment commands (`/review`, `/peer-review`, `/retrigger`, `/re-review`), and `review_requested` events with anti-loop bot guards.
- Automated release pipeline powered by Google Release Please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`), automatically analyzing Conventional Commits on `main` to create release PRs, tag SemVer versions, and publish to npm via OIDC Trusted Publishing.
- Feedback Loop Stagnation token anomaly heuristic in `optimizer.md` and `ORCHESTRATION.md`: flags when downstream processing routines report 0 intake across >= 2 consecutive runs while upstream PRs/issues close.
- Loop Discovery Mechanical Audits remediation rule in `optimizer.md`: mandates deterministic per-issue matching tables and itemized reconciliation against upstream closed work.
- Closed-loop verification check in `issues-housekeeping.md`: audits recently closed roadmap/feature issues against tracking issues for projects operating impact or verification loops.
- Autonomous Issue Synthesis in `peer-review.md` and `ORCHESTRATION.md`: peer-review routine automatically synthesizes a tracking issue on GitHub (`gh issue create`) and links `Closes #N` (`gh pr edit`) before squash-merging unlinked contributor PRs, maintaining 100% issue auditability without human contributor friction.
- Documented required GitHub Actions workflow permissions and fork approval policies in `README.md` and post-init CLI output (`src/commands/init.ts`).
- Contributor PR lenience in `peer-review.md`: allow self-contained PR descriptions to serve as the spec for external contributions rather than blocking on missing `Closes #N` tracking issues.
- Per-agent token & cost aggregation protocol and scorecard schema in `optimizer.md` (`templates/prompts/optimizer.md` and `.github/prompts/optimizer.md`).
- Token Anomaly Heuristics in `optimizer.md`: defined concrete numerical thresholds for Token Surge (>50% week-over-week), Budget Hog (>75% fleet spend), Iteration Ceiling Exhaustion (>20% at `token_limit`), and Review Loop Burn (>= 3 bounce rounds).
- Automated preventative remediation actions and triggers in `optimizer.md` for instruction pruning, early exit/skip guards, iteration ceiling tuning, and ping-pong convergence.
- Documented fleet-wide Token Anomaly Triage & Remediation workflow in `ORCHESTRATION.md`.
- Prompt validation tests verifying token anomaly heuristics, automated remediation triggers, orchestration triage, and prompt template sync.
- Per-agent token and cost consumption breakdown in `src/lib/fleet-query.ts`, `src/lib/dashboard.ts`, `src/commands/status.ts`, and `src/commands/monitor.ts`.
- `--tokens` / `--detailed` CLI options for `jonah-fleet status` and `jonah-fleet monitor` to inspect granular per-routine token usage, iteration averages, and fleet spend share.
- Extended JSON telemetry with complete `byRoutine` metadata across repositories and fleet summaries.
- Per-routine token, cost, and iteration aggregation in `src/lib/fleet-query.ts` (`RoutineTokenSpend` and `TokenSpendInfo.byRoutine`).
- Support for extracting `iterationsUsed` and `duration` in `parseLogMetadata()`.
- Extended test coverage in `tests/fleet-query.test.ts` for per-routine token stats, fleet share calculation, and parsing edge cases.

## [1.1.1] - 2026-08-26

### Added
- Explicit OpenAI Symphony specification lineage documentation and conceptual mapping table.
- Architectural comparison matrix contrasting Jonah Fleet's zero-daemon GitHub-native model against persistent multi-agent runtimes (SwarmClaw).
- Synchronized template orchestration docs under `templates/prompts/ORCHESTRATION.md`.

## [1.1.0] - 2026-08-24


### Added
- Multi-repository fleet monitoring command (`jonah-fleet monitor` / `jonah-fleet status --fleet`).
- Global repository registry manager (`~/.jonah-fleet/config.json`) with `--add` and `--remove` CLI flags.
- Real-time active claim inspection and stale claim detection (> 6h with no open PR).
- 7-day rolling token spend tracking and cost estimation from routine run logs.
- Live watch mode (`--watch`, `--interval <sec>`) and JSON output (`--json`).

## [1.0.0] - 2026-08-24

### Added
- Extracted standalone `jonah-fleet` repository and distribution engine from Jonah-RuPaul.
- Created core generic prompts: `ORCHESTRATION.md`, `autowork.md`, `peer-review.md`, `optimizer.md`, `issues-housekeeping.md`, `dependency-update-security-check.md`, `product-planning.md`.
- Packaged core engineering skills: `tdd`, `code-review`, `codebase-design`, `domain-modeling`, `diagnosing-bugs`, `resolving-merge-conflicts`, `writing-for-agents`, `triage`, `to-spec`, `to-tickets`.
- Created standard workflow templates: `autowork-cron.yml`, `trigger-review-routine.yml`, `trigger-autowork-on-merge.yml`, `trigger-autowork-on-bug.yml`, `issues-housekeeping-cron.yml`, `prompt-optimizer-cron.yml`, `dependency-check-cron.yml`, and `sync-fleet.yml`.
- Built TypeScript CLI (`jonah-fleet`) with `init`, `sync`, `status`, and `contribute` commands.
- Implemented `schema.json` and `agents-manifest.json` configuration engine with preset bundling (`minimal`, `standard`, `full`).
- Implemented automated bi-directional improvement bridge in `optimizer.md` and `contribute` CLI command.
