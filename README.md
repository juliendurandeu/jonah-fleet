# ⚓ Jonah Fleet

> **Standalone Autonomous Agent Fleet & Symphony Orchestration Engine**  
> Battle-tested autonomous coding agents, claim protocols, review loops, and engineering skills for multi-repo teams.

[![CI](https://github.com/juliendurandeu/jonah-fleet/actions/workflows/ci.yml/badge.svg)](https://github.com/juliendurandeu/jonah-fleet/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Overview

`jonah-fleet` packages a complete suite of autonomous software engineering agents into a standalone repository and zero-install CLI (`npx jonah-fleet`). It turns any repository into an autonomous agent-driven development environment with:

- **Symphony-aligned Orchestration**: Single-flight locking, stale-claim recovery, and reader/writer separation.
- **Autonomous Autowork**: Issue claiming, test-driven implementation (`/tdd`), automated draft PR creation, and warm-session review synchronization.
- **Strict Peer Review**: Multi-angle subagent code reviews (`/code-review`), security scanning, and automated squash-merge.
- **Issues Housekeeping & Dependency Security**: Weekly automated sweeps for duplicate detection, triage label assignment, and vulnerability remediation.
- **Continuous Bi-Directional Improvement Bridge**: When local `optimizer.md` routines discover generic prompt optimizations, fixes can be submitted directly back upstream to `jonah-fleet` and distributed to all projects.

---

## 🚀 Quickstart

### 1. Initialize a repository

Inside any project directory, run:

```bash
npx jonah-fleet init --preset standard
```

Available presets:
- **`minimal`**: `autowork` + `peer-review` + `optimizer`
- **`standard`** (default): minimal + `issues-housekeeping` + `dependency-update-security-check`
- **`full`**: standard + `product-planning`

### 2. Configure project context (`AGENTS.md`)

`jonah-fleet init` generates an `AGENTS.md` file (or uses your existing one). Specify your test commands, build scripts, and architecture patterns:

```markdown
## Tech Stack
- Next.js 15, TypeScript, Tailwind CSS, Supabase

## Development Workflows
```bash
npm run build
npm test
npm run type-check
```
```

### 3. Check health and drift

To inspect which routines and skills are active or verify alignment with latest fleet updates:

```bash
npx jonah-fleet status
```

To synchronize with the latest fleet version:

```bash
npx jonah-fleet sync
```

### 4. Multi-repo Fleet Monitoring

Monitor health, in-flight autowork claims, open PR review loops, and token usage across your entire fleet:

```bash
# Register repositories to your fleet registry
npx jonah-fleet monitor --add juliendurandeu/Jonah-RuPaul
npx jonah-fleet monitor --add juliendurandeu/jonah-newsletter-gemini

# View terminal dashboard
npx jonah-fleet monitor

# Live watch mode with auto-refresh
npx jonah-fleet monitor --watch --interval 10

# Output as JSON
npx jonah-fleet monitor --json
```

---

## 🛠️ Repository Layout

```
jonah-fleet/
├── templates/
│   ├── prompts/          # Core generic prompts (autowork, peer-review, optimizer, etc.)
│   ├── workflows/        # GitHub Actions workflows for scheduling and event triggers
│   ├── skills/           # Reusable engineering skills (tdd, code-review, diagnosing-bugs, etc.)
│   └── docs/             # Starter documentation templates (AGENTS.template.md)
├── src/                  # TypeScript CLI source code
├── tests/                # Unit test & prompt validation suite
└── schema.json           # JSON Schema for agents-manifest.json
```

---

## 📜 Manifest Configuration (`agents-manifest.json`)

Each target project contains an `agents-manifest.json` at its root:

```json
{
  "$schema": "https://raw.githubusercontent.com/juliendurandeu/jonah-fleet/main/schema.json",
  "version": "1.0.0",
  "preset": "standard",
  "routines": {
    "autowork": true,
    "peer-review": true,
    "optimizer": true,
    "issues-housekeeping": true,
    "dependency-update-security-check": true,
    "product-planning": false
  },
  "skills": [
    "tdd",
    "code-review",
    "codebase-design",
    "domain-modeling",
    "diagnosing-bugs",
    "resolving-merge-conflicts",
    "writing-for-agents",
    "triage"
  ],
  "autoUpdate": {
    "enabled": true,
    "channel": "stable"
  }
}
```

---

## 🔄 Bi-Directional Continuous Improvement

1. **Local Optimization**: The `optimizer.md` routine monitors run logs in each connected project.
2. **Upstream Contribution**: When a prompt or workflow improvement is discovered, the optimizer opens an upstream PR against `juliendurandeu/jonah-fleet` (or via `npx jonah-fleet contribute`).
3. **Downstream Sync**: Merged improvements in `jonah-fleet` create a semantic release, and downstream consumer repositories receive automated update PRs via `.github/workflows/sync-fleet.yml`.

---

## 📄 License

MIT © Julien Durandeu
