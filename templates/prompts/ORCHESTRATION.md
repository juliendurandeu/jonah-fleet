# Orchestration Model (Symphony Alignment)

How agent routines in this repository are dispatched, claimed, and reconciled — plus the single-source-of-truth definitions the routine prompts point at (Stale-claim, Log delivery fallback, Measurement issues). Extracted from `AGENTS.md` so this agent-system reference stays out of every session's auto-loaded context; `AGENTS.md` keeps the invariants and points here.

**Read this when** you need the claim protocol, the stale-claim conditions, the log-push rules, or the measurement-issue protocol — i.e. most Autowork, Peer Review, Analytics Review, and Issues Housekeeping runs.

This project's automation is a GitHub-native implementation of the orchestration pattern formalized by OpenAI's [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md) for orchestrating autonomous coding agents against an issue tracker. There is **no long-running orchestrator daemon**; the roles map onto GitHub primitives:

| Symphony Concept | Implementation in this repo |
|---|---|
| `WORKFLOW.md` (repo-owned config + prompt templates) | `AGENTS.md` (aliased as `GEMINI.md`/`CLAUDE.md`) + `.github/prompts/*.md` |
| Orchestrator (poll, dispatch, reconcile) | GitHub Actions triggers + scheduled routine sessions |
| Issue tracker (Linear in Symphony) | GitHub Issues |
| Agent runner (Codex app-server in per-issue workspace) | An ephemeral agent session (Antigravity CLI `agy`) in an isolated fresh clone |
| Tracker is reader/scheduler; mutations happen via agent tools | Routines only schedule; the agent session makes every GitHub write |


Dispatch is both **scheduled** and **event-driven**. All routines run as ephemeral agent sessions via **Antigravity CLI (`agy`)** powered by **Gemini 3.7 Flash (High reasoning)**. The routine suite is calibrated to operate within a **strict 70% weekly token ceiling across all routines combined**, supervised by `optimizer.md`:
- **Scheduled cron sweeps**: Autowork runs periodically (`autowork-cron.yml`), complemented by prompt optimization (`prompt-optimizer-cron.yml`), issues housekeeping (`issues-housekeeping-cron.yml`), and dependency security checks (`dependency-check-cron.yml`).
- **Event-driven triggers**: GitHub Actions workflows fire routines on events so work starts within seconds instead of waiting for scheduled ticks:
  - `trigger-review-routine.yml` fires Peer Review when a PR is marked ready for review (with debounce on rapid pushes).
  - `trigger-autowork-on-merge.yml` fires Autowork in **Targeted mode** when a PR merges to `main` and unblocks the next unit of chained work.
  - `trigger-autowork-on-bug.yml` fires Autowork when an issue becomes a high-priority bug.

Both autowork triggers pass the target issue via environment variables (`ISSUE_NUMBER`, `ISSUE_URL`), putting autowork.md into **Targeted mode** (working the named issue ahead of Phase 1 convergence). Single-flight per issue is strictly enforced across both scheduled and event-driven runs.

Invariants deliberately upheld from this spec:

- **Single-flight per issue** — at most one run works an issue at a time, enforced by the autowork claim protocol (assign → read-back → earliest-timestamp tiebreak). For **umbrella** issues, single-flight is maintained at the *child-issue* level so slices progress cleanly.
- **Recover dead-run claims** — a crashed run's orphaned claim is released back to the pool rather than starving the issue, both opportunistically during candidate selection and periodically via issues housekeeping.
- **Reader/writer separation** — the routine that authors a PR never merges it; the Peer Review routine is the sole merge authority for **product** PRs. (Operational log-only PRs are exempt; see Log delivery fallback.)
- **Warm-Context Review Synchronization** — Autowork maintains an active warm session during implementation, polling for Peer Review's verdict. When Peer Review bounces a PR to draft with findings, Autowork immediately detects the draft state in-session, applies fixes directly to its warm working tree, and re-marks the PR ready—re-firing Peer Review for Round N+1 without cold-start overhead.

---

## Stale-Claim Definition

Single source of truth for both autowork candidate reclamation and housekeeping sweeps. An assigned issue is a *stale claim* (a dead autowork run's orphaned reservation, safe to release) only when **all** of these hold:

1. **It is an autowork claim, not a manual one.** The issue carries a `🔒 Claimed by autowork run …` comment. An assigned issue with **no** such comment is never stale; leave it alone (it may be a person working manually).
2. **No live work exists.** There is **no open PR** referencing the issue (`Closes #N`). An open PR is live, recoverable work that autowork Phase 1 owns — never reclaim it, at any age.
3. **The claim is old.** The most recent `🔒 Claimed by autowork run …` comment's GitHub creation time (`created_at`) is **more than 6 hours** ago. Measure age from that `created_at` only — never the issue's `updated_at`.

**Releasing a stale claim is a destructive write and MUST be guarded:**
- **Re-read immediately before writing.** Re-read the issue (`issue_read`) right before the unassign and re-confirm conditions 1–3 still hold. If any no longer holds, abort the release and move on.
- **Remove only the named dead owner.** Unassign that specific login; never blindly clear all assignees.

---

## Routine Matching & Invocation

**Identify the applicable routine at the start of every conversation, before doing any work:**

1. **Explicit invocation** — if the incoming prompt names a routine or was fired by a GitHub Actions workflow that references one, follow that routine's instruction file immediately.
2. **Content match** — compare the task against the routine table below. When matching an interactive request from a human, name the matched routine and confirm before proceeding.
3. **No match** — follow the general Working Practices, PR Workflow, and documentation rules with no routine-specific constraints.

| Routine | File | Applies when the conversation is about... |
|---|---|---|
| Autowork | `.github/prompts/autowork.md` | Converging on open work: addressing PR review comments, closing issues whose PRs merged, then claiming and implementing the highest-priority unclaimed issue |
| Peer Review | `.github/prompts/peer-review.md` | Reviewing a pull request (a named PR or scan mode) and merging it or leaving findings and bouncing to draft |
| Prompt Optimizer | `.github/prompts/optimizer.md` | Diagnosing failures, inefficiency, token anomalies, and analyzing resolved bugs to propose prompt/test/workflow fixes and upstream contributions |
| Issues Housekeeping | `.github/prompts/issues-housekeeping.md` | Sweeping open issues for staleness, duplicates, label drift, priority accuracy, and orphaned claims |
| Dependency Update & Security Check | `.github/prompts/dependency-update-security-check.md` | Checking dependencies for updates and known vulnerabilities, opening actionable PRs |
| Product Planning | `.github/prompts/product-planning.md` | Turning roadmap priorities into staged issues (`/to-tickets`) and formal PRDs (`/to-spec`) |

---

## Engineering Skills Integration

The routines invoke specialized engineering skills at key workflow checkpoints:

- **Autowork (`autowork.md`)**:
  - `/diagnosing-bugs`: In Targeted mode or for `bug` issues — establishes reproduction feedback loop before patching.
  - `/domain-modeling` & `/codebase-design`: Consults domain context and establishes deep module interfaces.
  - `/tdd`: Drives red-green-refactor test-first implementation for each issue.
  - `/code-review`: Evaluates Standards (`AGENTS.md`) and Spec (`## Tasks`) during pre-ready self-audit.
  - `/resolving-merge-conflicts`: Resolves merge collisions by intent against primary sources when syncing with `origin/main`.
- **Peer Review (`peer-review.md`)**:
  - `/code-review`: Drives multi-angle diff evaluation along Standards and Spec axes.
  - `/resolving-merge-conflicts`: Resolves merge conflicts mechanically before squash-merging.
- **Issues Housekeeping (`issues-housekeeping.md`)**:
  - `/triage`: Evaluates incoming issues into canonical roles.
- **Product Planning (`product-planning.md`)**:
  - `/domain-modeling`: Pressure-tests proposals and records domain terms / ADRs.
  - `/to-spec`: Authors formal PRDs for larger proposals.
  - `/to-tickets`: Decomposes approved epics/proposals into dependency-linked issues.
- **Prompt Optimizer (`optimizer.md`)**:
  - `/writing-for-agents`: Drafts crisp, token-efficient prompt and rule updates.

---

## Log Delivery Fallback

Single source of truth for every routine's Logging section:
1. **Direct commit to `main` is default**: For operational run logs under `.github/prompts/logs/**`, commit directly to `main` via GitHub API or git push.
2. **Draft PR fallback**: If direct push fails, commit the log to a dedicated, fresh branch and open a draft PR carrying only the log files.
3. **Automated landing**: `auto-merge-log-prs.yml` or `issues-housekeeping.md` lands accumulated log PRs. Draft log PRs are never reviewed by Peer Review and do not count toward Autowork's backpressure limits.

---

## Token Anomaly Triage & Remediation

How token spend, runaway loops, and budget anomalies are detected, triaged, and remediated autonomously across the fleet:

1. **Supervised Token Ceiling**: The fleet operates under a global 70% weekly token ceiling (~8.75M tokens/week across all routines). `optimizer.md` evaluates pacing during each scheduled sweep.
2. **Anomaly Classification & Heuristics**:
   - **Token Surge**: Average token spend per run for a specific routine increases >50% week-over-week. Trigger: prompt bloat or runaway context accumulation. Remediation: prompt instruction pruning, replacing verbose guidelines with concise leading words and progressive disclosure pointers.
   - **Budget Hog**: A single agent routine consumes >75% of total fleet token allowance. Trigger: unbalanced dispatch frequency or unbounded candidate sweeps. Remediation: throttle cron frequency, introduce stricter candidate batching, or add early exit conditions.
   - **Iteration Ceiling Exhaustion**: >20% of runs in a routine terminate at the `token_limit` / max iteration cap. Trigger: tasks too complex for single-flight execution or unbounded looping. Remediation: enforce vertical slicing / umbrella decomposition, tighten pre-ready self-audits, or refine termination bounds.
   - **Review Loop Burn**: Pull requests experiencing $\ge 3$ bounce rounds between autowork and peer-review. Trigger: ambiguous reviewer feedback, pedantic non-blocking findings, or brittle test assertions. Remediation: tighten reviewer trust/noise rules, calibrate reviewer severity thresholds, and engage human escalation via ping-pong caps.
   - **Feedback Loop Stagnation**: A downstream processing routine (e.g. measurement loop, verification, triage) records 0 intake (`filed: 0`) across $\ge 2$ consecutive runs while upstream PRs merge or roadmap/feature issues close in the same window. Trigger: overly broad or qualitative discovery sweeps that falsely claim all items are covered. Remediation: mandate deterministic per-issue matching tables and itemized reconciliation against upstream closed issues/PRs.
3. **Automated Remediation PRs**: The optimizer automatically drafts targeted PRs—locally for repo-specific rules/configs, or upstream via `npx jonah-fleet contribute` for fleet-wide prompt/workflow improvements.

---

## Autonomous Issue Synthesis

How external and human contributor pull requests are reconciled into the issue tracker without manual friction or reviewer bounces:

1. **Zero-Friction Contribution**: External human contributors often submit PRs directly without opening an issue first. Forcing contributors to open tracking issues or bouncing clean PRs causes friction, review thrash, and abandonment.
2. **Autonomous Synthesis on Merge**: When `peer-review.md` approves a pull request lacking a `Closes #N` link, the review routine automatically synthesizes a tracking issue before merging:
   - Creates a tracked issue via `gh issue create` capturing the PR title, body, and deliverables.
   - Appends `Closes #<synthesized_issue_id>` to the PR description via `gh pr edit`.
3. **Audit & Single-Flight Lineage**: When the PR is squash-merged, GitHub's native issue closure kicks in and automatically closes the synthesized issue. This maintains 100% issue auditability, project board tracking, telemetry metrics, and release changelogs without imposing any friction on human contributors.


