import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '7', 10);
const FORCE_REPORT = process.env.FORCE_REPORT === 'true';
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || 'https://github.com';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'juliendurandeu/jonah-fleet';
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || 'manual';

export function getHeaders(token = GITHUB_TOKEN) {
  return {
    'User-Agent': 'jonah-fleet-upstream-radar',
    'Accept': 'application/vnd.github.v3+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function apiFetch(repo, endpoint, token = GITHUB_TOKEN) {
  const url = `https://api.github.com/repos/${repo}/${endpoint}`;
  try {
    const res = await fetch(url, { headers: getHeaders(token) });
    if (!res.ok) {
      console.warn(`Warning: GitHub API returned ${res.status} for ${repo}/${endpoint}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${repo}/${endpoint}:`, err);
    return null;
  }
}

export async function fetchRepoData(repo, options = {}) {
  const token = options.token ?? GITHUB_TOKEN;
  const isSymphony = options.isSymphony ?? repo.includes('symphony');

  const promises = [
    apiFetch(repo, 'commits?per_page=15', token),
    apiFetch(repo, 'releases?per_page=5', token),
    apiFetch(repo, 'pulls?state=closed&per_page=10', token)
  ];

  if (isSymphony) {
    promises.push(apiFetch(repo, 'commits?path=SPEC.md&per_page=5', token));
  }

  const results = await Promise.all(promises);
  const commits = Array.isArray(results[0]) ? results[0] : [];
  const releases = Array.isArray(results[1]) ? results[1] : [];
  const pullRequests = Array.isArray(results[2]) ? results[2] : [];
  const specCommits = isSymphony && Array.isArray(results[3]) ? results[3] : [];

  return {
    commits,
    releases,
    pullRequests,
    ...(isSymphony ? { specCommits } : {})
  };
}

export function evaluateActivity(symphonyData, funesData, options = {}) {
  const lookbackDays = options.lookbackDays ?? LOOKBACK_DAYS;
  const forceReport = options.forceReport ?? FORCE_REPORT;
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const symCommits = (symphonyData?.commits || []).filter(c => new Date(c.commit.author.date) >= cutoffDate);
  const symSpecCommits = (symphonyData?.specCommits || []).filter(c => new Date(c.commit.author.date) >= cutoffDate);
  const symReleases = (symphonyData?.releases || []).filter(r => new Date(r.published_at || r.created_at) >= cutoffDate);
  const symPRs = (symphonyData?.pullRequests || []).filter(p => p.merged_at && new Date(p.merged_at) >= cutoffDate);

  const funesCommits = (funesData?.commits || []).filter(c => new Date(c.commit.author.date) >= cutoffDate);
  const funesReleases = (funesData?.releases || []).filter(r => new Date(r.published_at || r.created_at) >= cutoffDate);
  const funesPRs = (funesData?.pullRequests || []).filter(p => p.merged_at && new Date(p.merged_at) >= cutoffDate);

  const symphonyActivity = symCommits.length > 0 || symSpecCommits.length > 0 || symReleases.length > 0 || symPRs.length > 0;
  const funesActivity = funesCommits.length > 0 || funesReleases.length > 0 || funesPRs.length > 0;

  const hasNewActivity = symphonyActivity || funesActivity;
  const shouldCreateIssue = hasNewActivity || forceReport;

  return {
    hasNewActivity,
    shouldCreateIssue,
    symphonyActivity,
    funesActivity,
    cutoffDate,
    recent: {
      symphony: { commits: symCommits, specCommits: symSpecCommits, releases: symReleases, pullRequests: symPRs },
      funes: { commits: funesCommits, releases: funesReleases, pullRequests: funesPRs }
    }
  };
}

export function generateRadarReport(params = {}) {
  const symphony = params.symphony || { commits: [], specCommits: [], releases: [], pullRequests: [] };
  const funes = params.funes || { commits: [], releases: [], pullRequests: [] };
  const lookbackDays = params.lookbackDays ?? LOOKBACK_DAYS;
  const serverUrl = params.serverUrl || GITHUB_SERVER_URL;
  const repository = params.repository || GITHUB_REPOSITORY;
  const runId = params.runId || GITHUB_RUN_ID;
  const dateStr = params.dateStr || new Date().toISOString().split('T')[0];

  const evalResult = evaluateActivity(symphony, funes, { lookbackDays, forceReport: true });
  const { symphony: symRecent, funes: funesRecent } = evalResult.recent;

  let report = `# 📡 Upstream Ecosystem Radar: Intel Digest (${dateStr})\n\n`;
  report += `> Tracking upstream architectural changes, specification updates, and feature additions across:\n`;
  report += `> - [openai/symphony](https://github.com/openai/symphony) (Orchestration & Claim Invariants)\n`;
  report += `> - [huggingface/funes](https://github.com/huggingface/funes) (Agent Memory & Session Indexing)\n\n`;

  // Section 1: Symphony
  report += `## 🎼 Upstream Orchestration Watch (\`openai/symphony\`)\n\n`;

  if (symRecent.releases.length > 0) {
    report += `### 🏷️ New Releases\n\n`;
    for (const rel of symRecent.releases) {
      report += `- **[${rel.name || rel.tag_name}](${rel.html_url})** (published ${rel.published_at?.split('T')[0]})\n`;
      if (rel.body) {
        report += `  > ${rel.body.split('\n')[0]}\n`;
      }
    }
    report += `\n`;
  }

  if (symRecent.specCommits.length > 0) {
    report += `### 📜 Specification Updates (\`SPEC.md\`)\n\n`;
    report += `> [!IMPORTANT]\n> Changes were detected in \`SPEC.md\`! Review these to evaluate impact on Jonah Fleet's claim protocols, review loops, or prompt routines.\n\n`;
    for (const sc of symRecent.specCommits) {
      const summary = sc.commit.message.split('\n')[0];
      const author = sc.author?.login ? `@${sc.author.login}` : sc.commit.author.name;
      report += `- [\`${sc.sha.slice(0, 7)}\`](${sc.html_url}) **${summary}** by ${author} (${sc.commit.author.date.split('T')[0]})\n`;
    }
    report += `\n`;
  } else if (symphony.specCommits && symphony.specCommits.length > 0) {
    const latestSpec = symphony.specCommits[0];
    report += `### 📜 Latest \`SPEC.md\` Revision\n\n`;
    report += `*No updates to \`SPEC.md\` in the past ${lookbackDays} days.*\n`;
    report += `- Most recent: [\`${latestSpec.sha.slice(0, 7)}\`](${latestSpec.html_url}) "${latestSpec.commit.message.split('\n')[0]}" (${latestSpec.commit.author.date.split('T')[0]})\n\n`;
  }

  report += `### 🔨 Recent Commits (Past ${lookbackDays} Days: ${symRecent.commits.length})\n\n`;
  if (symRecent.commits.length > 0) {
    for (const c of symRecent.commits) {
      const summary = c.commit.message.split('\n')[0];
      const author = c.author?.login ? `@${c.author.login}` : c.commit.author.name;
      report += `- [\`${c.sha.slice(0, 7)}\`](${c.html_url}) ${summary} (${author}, ${c.commit.author.date.split('T')[0]})\n`;
    }
  } else {
    report += `_No new commits in the past ${lookbackDays} days._\n\n`;
    if (symphony.commits && symphony.commits.length > 0) {
      const latest = symphony.commits[0];
      report += `**Latest repository commit:**\n`;
      report += `- [\`${latest.sha.slice(0, 7)}\`](${latest.html_url}) ${latest.commit.message.split('\n')[0]} (${latest.commit.author.date.split('T')[0]})\n`;
    }
  }
  report += `\n`;

  if (symRecent.pullRequests.length > 0) {
    report += `### 🔀 Merged Pull Requests\n\n`;
    for (const pr of symRecent.pullRequests) {
      report += `- [#${pr.number}](${pr.html_url}) **${pr.title}** by @${pr.user.login} (merged ${pr.merged_at.split('T')[0]})\n`;
    }
    report += `\n`;
  }

  // Section 2: Funes
  report += `## 🧠 Upstream Agent Memory Watch (\`huggingface/funes\`)\n\n`;

  if (funesRecent.releases.length > 0) {
    report += `### 🏷️ New Releases\n\n`;
    for (const rel of funesRecent.releases) {
      report += `- **[${rel.name || rel.tag_name}](${rel.html_url})** (published ${rel.published_at?.split('T')[0]})\n`;
      if (rel.body) {
        report += `  > ${rel.body.split('\n')[0]}\n`;
      }
    }
    report += `\n`;
  }

  report += `### 🔨 Recent Commits (Past ${lookbackDays} Days: ${funesRecent.commits.length})\n\n`;
  if (funesRecent.commits.length > 0) {
    for (const c of funesRecent.commits) {
      const summary = c.commit.message.split('\n')[0];
      const author = c.author?.login ? `@${c.author.login}` : c.commit.author.name;
      report += `- [\`${c.sha.slice(0, 7)}\`](${c.html_url}) ${summary} (${author}, ${c.commit.author.date.split('T')[0]})\n`;
    }
  } else {
    report += `_No new commits in the past ${lookbackDays} days._\n\n`;
    if (funes.commits && funes.commits.length > 0) {
      const latest = funes.commits[0];
      report += `**Latest repository commit:**\n`;
      report += `- [\`${latest.sha.slice(0, 7)}\`](${latest.html_url}) ${latest.commit.message.split('\n')[0]} (${latest.commit.author.date.split('T')[0]})\n`;
    }
  }
  report += `\n`;

  if (funesRecent.pullRequests.length > 0) {
    report += `### 🔀 Merged Pull Requests\n\n`;
    for (const pr of funesRecent.pullRequests) {
      report += `- [#${pr.number}](${pr.html_url}) **${pr.title}** by @${pr.user.login} (merged ${pr.merged_at.split('T')[0]})\n`;
    }
    report += `\n`;
  }

  // Section 3: Evaluation Matrix
  report += `## ⚖️ Upstream Architectural Evaluation Matrix\n\n`;
  report += `Before adopting concepts from \`openai/symphony\` or \`huggingface/funes\`, evaluate them against Jonah Fleet's operational model:\n\n`;
  report += `| Evaluation Layer | Key Question | Invariant Check |\n`;
  report += `|---|---|---|\n`;
  report += `| **1. Zero-Daemon Invariant** | Can this run within ephemeral GitHub Actions + \`agy\` CLI sessions? | Must require zero 24/7 background servers/sockets |\n`;
  report += `| **2. Issue Tracker Abstraction** | Does this map cleanly to GitHub Issues, labels, and PR checks? | Must avoid proprietary non-GitHub metadata dependencies |\n`;
  report += `| **3. Token & Cost Economy** | Does this optimize LLM spend within the 70% weekly budget ceiling (~8.75M tokens)? | Must prevent unbounded retry burn or loop stagnation |\n`;
  report += `| **4. Multi-Repo Portability** | Can this be cleanly distributed via \`agents-manifest.json\` and \`jonah-fleet sync\`? | Must remain 100% repository-agnostic |\n\n`;

  report += `### 🧠 Agent Memory & Session Indexing Evaluation (Funes Integration)\n\n`;
  report += `| Memory Dimension | Funes Pattern | Jonah Fleet Applicability & Guardrails |\n`;
  report += `|---|---|---|\n`;
  report += `| **Zero-LLM Ingestion** | Deterministic parsing of agent session traces (\`.jsonl\`/Parquet) into LanceDB | Extracts patterns and session summaries without spending LLM tokens from weekly budget |\n`;
  report += `| **Pull-Based Memory Delivery** | Delivered on demand via MCP (\`recall\`, \`get\`) | Prevents context window bloat; memory is queried only when explicitly referenced |\n`;
  report += `| **Cross-Session Provenance** | Verbatim turns and provenance retention | Avoids lossy LLM summarization drift across multi-session debugging tasks |\n`;
  report += `| **Multi-Agent Portability** | Agent-agnostic \`TraceSource\` trait (Claude Code, Codex, pi) | Allows Jonah Fleet to analyze sessions across different agent harnesses |\n\n`;

  report += `#### 🧭 Classification Guide:\n`;
  report += `- **🟢 Category A (Adopt Directly)**: Security guardrails, claim lock invariants, reader/writer rules, prompt engineering optimizations, deterministic zero-LLM indexing.\n`;
  report += `- **🟡 Category B (Adapt to Actions/CLI)**: Dynamic orchestrator pacing, backpressure controls, multi-stage review checks, pull-based memory MCP integrations.\n`;
  report += `- **🔴 Category C (Skip)**: Elixir/OTP supervision trees, BEAM memory tuning, proprietary runtime internals, always-loaded memory context dumps.\n\n`;

  report += `### 💡 Maintainer & Optimizer Triage Checklist\n\n`;
  report += `- [ ] **Classify Changes**: Classify detected upstream changes into Category A, B, or C across Orchestration and Memory domains.\n`;
  report += `- [ ] **Zero-Daemon Check**: Confirm no persistent server or long-lived socket requirement is introduced.\n`;
  report += `- [ ] **Token Economy Gate**: Verify that indexing or memory retrieval does not exceed the 70% weekly token ceiling (~8.75M tokens).\n`;
  report += `- [ ] **Prompt & Skill Ports**: If applicable, port routines to \`templates/prompts/\` or \`.agents/skills/\` (e.g. MCP memory skill).\n`;
  report += `- [ ] **Empirical Evals**: Run \`npm run test:evals\` and \`npm test\` to ensure no regressions.\n`;
  report += `- [ ] **Downstream Sync**: Verify \`jonah-fleet sync\` distributes updates cleanly to target repositories.\n`;
  report += `- [ ] **Close Issue**: Close once triage and any resulting PRs are merged.\n\n`;

  report += `---\n_Generated by [Antigravity](${serverUrl}/${repository}/actions/runs/${runId})_\n`;

  return report;
}

export async function runRadar(options = {}) {
  const lookbackDays = options.lookbackDays ?? LOOKBACK_DAYS;
  const forceReport = options.forceReport ?? FORCE_REPORT;
  const token = options.token ?? GITHUB_TOKEN;
  const serverUrl = options.serverUrl ?? GITHUB_SERVER_URL;
  const repository = options.repository ?? GITHUB_REPOSITORY;
  const runId = options.runId ?? GITHUB_RUN_ID;

  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  console.log(`Checking upstream activity (openai/symphony & huggingface/funes) since ${cutoffDate.toISOString()} (${lookbackDays} days window)...`);

  const [symphony, funes] = await Promise.all([
    fetchRepoData('openai/symphony', { lookbackDays, token, isSymphony: true }),
    fetchRepoData('huggingface/funes', { lookbackDays, token, isSymphony: false })
  ]);

  const { hasNewActivity, shouldCreateIssue } = evaluateActivity(symphony, funes, { lookbackDays, forceReport });
  const todayStr = new Date().toISOString().split('T')[0];
  const issueTitle = `📡 Upstream Ecosystem Radar: Intel Digest (${todayStr})`;

  const report = generateRadarReport({
    symphony,
    funes,
    lookbackDays,
    serverUrl,
    repository,
    runId,
    dateStr: todayStr
  });

  const outputPath = options.outputPath || 'radar-report.md';
  fs.writeFileSync(outputPath, report, 'utf8');
  console.log(`Generated ${outputPath} (shouldCreateIssue: ${shouldCreateIssue}, hasNewActivity: ${hasNewActivity})`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_create_issue=${shouldCreateIssue}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_new_activity=${hasNewActivity}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue_title=${issueTitle}\n`);
  }

  return {
    shouldCreateIssue,
    hasNewActivity,
    issueTitle,
    report
  };
}

// Auto-run if executed directly as a script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runRadar().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
