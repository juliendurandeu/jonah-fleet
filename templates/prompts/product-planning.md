# Product Planning

## Objective

Turn strategy and evidence into **well-scoped, ready-to-build work** and a **current roadmap** — the "plan" between analytics/measurement and autowork's build phase. Each run reads roadmap priorities, analytics signals, and user feedback to **propose** the next units of product work: new feature issues, formal specs/PRDs for larger epics, backlog re-ranking recommendations, and roadmap updates.

This routine runs behind a **human approval gate**: it **never files autowork-ready issues on its own**. It stages proposals in one planning issue for operator approval; only a subsequent operator-approved **Promote** run creates the real issues autowork can claim.

## Definition of Done

This routine runs in two modes: **Propose** (scheduled cron sweep / unapproved fire) and **Promote** (operator-approved fire).

In **Propose mode**, SUCCESS requires:
- [ ] Read current roadmap, domain documentation, and recent feedback/analytics findings
- [ ] Created or updated exactly one dated staging issue (`🗺️ Product Plan — {date}`) containing:
  - Up to 3 well-scoped proposals (Summary/Tasks/Why/Complexity)
  - Backlog re-ranking recommendations
  - Formal `/to-spec` PRD drafts for any proposal above `size/M`
  - Proposed `ROADMAP.md` updates
- [ ] Filed ZERO autowork-ready issues without approval

In **Promote mode**, SUCCESS requires:
- [ ] Verified operator approval directives from fire payload
- [ ] Created real, labeled GitHub issues for approved proposals using `/to-tickets` for epic decomposition
- [ ] Applied approved backlog re-rankings
- [ ] Committed approved changes to `ROADMAP.md` if explicitly approved
- [ ] Annotated the staging issue with created issue numbers (`✅ Created → #N`)

If any criterion cannot be met, stop immediately and log FAILURE with the reason.

## Constraints

- **Max iterations**: 30 — after 30 tool call rounds without completing Definition of Done, STOP. Log FAILURE with category `token_limit`.
- **Max scope**: planning and staging only. Do not implement code or open feature PRs.
- **Language Requirement**: All GitHub issue titles, descriptions, task checklists, and comments MUST be written in **English**.

## Instructions

### Mode 0: Determine Propose vs Promote Mode

- **Promote mode**: Payload contains approval tokens (e.g. `Approve #1, #2`, `Approve roadmap`). Proceed to Step 4 (Promote).
- **Propose mode**: Scheduled sweep or no approval directives. Proceed to Steps 1–3 (Propose).

### Steps 1–3: Propose Mode (Staging Proposals)

1. Read `ROADMAP.md`, `AGENTS.md`, and open issues.
2. Draft up to 3 high-impact proposals based on roadmap priorities and user feedback.
3. For proposals sized `size/M` or above, draft a formal specification using `/to-spec`.
4. Stage all proposals in a dedicated staging issue: `🗺️ Product Plan — {YYYY-MM-DD}` assigned to the repo maintainer.

### Step 4: Promote Mode (Approved Execution)

1. For each approved proposal in the staging issue:
   - Create a GitHub issue with the full specification and appropriate labels (`type/*`, `size/*`, `priority/*`).
   - If the proposal is an epic, decompose into child tickets using `/to-tickets`.
2. Apply approved backlog re-rankings.
3. If roadmap edits were approved, update `ROADMAP.md` directly on `main`.
4. Update the staging issue checklist with references to created issues.

## Logging

After completing (SUCCESS or FAILURE), write a log file to `.github/prompts/logs/product-planning/{timestamp}.md` following the schema in `.github/prompts/logs/_template.md`. Include:
- Prompt SHA
- Mode (Propose or Promote)
- Staged or promoted proposals tally

**Important**: Commit the log file directly to `main` and push. Follow the Log delivery fallback in `ORCHESTRATION.md` if direct push fails.
