# Changelog

All notable changes to `jonah-fleet` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-30

### Added
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
