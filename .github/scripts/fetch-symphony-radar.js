import fs from 'node:fs';

const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '7', 10);
const FORCE_REPORT = process.env.FORCE_REPORT === 'true';
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || 'https://github.com';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'juliendurandeu/jonah-fleet';
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || 'manual';

const HEADERS = {
  'User-Agent': 'jonah-fleet-symphony-radar',
  'Accept': 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
};

async function apiFetch(endpoint) {
  const url = `https://api.github.com/repos/openai/symphony/${endpoint}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`Warning: GitHub API returned ${res.status} for ${endpoint}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err);
    return null;
  }
}

async function run() {
  const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Checking openai/symphony activity since ${cutoffDate.toISOString()} (${LOOKBACK_DAYS} days window)...`);

  const [commits, specCommits, releases, pullRequests] = await Promise.all([
    apiFetch('commits?per_page=15'),
    apiFetch('commits?path=SPEC.md&per_page=5'),
    apiFetch('releases?per_page=5'),
    apiFetch('pulls?state=closed&per_page=10')
  ]);

  const recentCommits = (commits || []).filter(c => new Date(c.commit.author.date) >= cutoffDate);
  const recentSpecCommits = (specCommits || []).filter(c => new Date(c.commit.author.date) >= cutoffDate);
  const recentReleases = (releases || []).filter(r => new Date(r.published_at || r.created_at) >= cutoffDate);
  const recentPRs = (pullRequests || []).filter(p => p.merged_at && new Date(p.merged_at) >= cutoffDate);

  const hasNewActivity = recentCommits.length > 0 || recentReleases.length > 0 || recentPRs.length > 0;
  const shouldCreateIssue = hasNewActivity || FORCE_REPORT;

  const todayStr = new Date().toISOString().split('T')[0];
  const issueTitle = `📡 Upstream Symphony Radar: Intel Digest (${todayStr})`;

  let report = `# 📡 Upstream Symphony Radar: Intel Digest (${todayStr})\n\n`;
  report += `> Tracking upstream architectural changes, specification updates, and feature additions in [openai/symphony](https://github.com/openai/symphony).\n\n`;

  if (recentReleases.length > 0) {
    report += `### 🏷️ New Releases\n\n`;
    for (const rel of recentReleases) {
      report += `- **[${rel.name || rel.tag_name}](${rel.html_url})** (published ${rel.published_at?.split('T')[0]})\n`;
      if (rel.body) {
        report += `  > ${rel.body.split('\n')[0]}\n`;
      }
    }
    report += `\n`;
  }

  if (recentSpecCommits.length > 0) {
    report += `### 📜 Specification Updates (\`SPEC.md\`)\n\n`;
    report += `> [!IMPORTANT]\n> Changes were detected in \`SPEC.md\`! Review these to evaluate impact on Jonah Fleet's claim protocols, review loops, or prompt routines.\n\n`;
    for (const sc of recentSpecCommits) {
      const summary = sc.commit.message.split('\n')[0];
      const author = sc.author?.login ? `@${sc.author.login}` : sc.commit.author.name;
      report += `- [\`${sc.sha.slice(0, 7)}\`](${sc.html_url}) **${summary}** by ${author} (${sc.commit.author.date.split('T')[0]})\n`;
    }
    report += `\n`;
  } else if (specCommits && specCommits.length > 0) {
    const latestSpec = specCommits[0];
    report += `### 📜 Latest \`SPEC.md\` Revision\n\n`;
    report += `*No updates to \`SPEC.md\` in the past ${LOOKBACK_DAYS} days.*\n`;
    report += `- Most recent: [\`${latestSpec.sha.slice(0, 7)}\`](${latestSpec.html_url}) "${latestSpec.commit.message.split('\n')[0]}" (${latestSpec.commit.author.date.split('T')[0]})\n\n`;
  }

  report += `### 🔨 Recent Commits (Past ${LOOKBACK_DAYS} Days: ${recentCommits.length})\n\n`;
  if (recentCommits.length > 0) {
    for (const c of recentCommits) {
      const summary = c.commit.message.split('\n')[0];
      const author = c.author?.login ? `@${c.author.login}` : c.commit.author.name;
      report += `- [\`${c.sha.slice(0, 7)}\`](${c.html_url}) ${summary} (${author}, ${c.commit.author.date.split('T')[0]})\n`;
    }
  } else {
    report += `_No new commits in the past ${LOOKBACK_DAYS} days._\n\n`;
    report += `**Latest repository commit:**\n`;
    if (commits && commits.length > 0) {
      const latest = commits[0];
      report += `- [\`${latest.sha.slice(0, 7)}\`](${latest.html_url}) ${latest.commit.message.split('\n')[0]} (${latest.commit.author.date.split('T')[0]})\n`;
    }
  }
  report += `\n`;

  if (recentPRs.length > 0) {
    report += `### 🔀 Merged Pull Requests\n\n`;
    for (const pr of recentPRs) {
      report += `- [#${pr.number}](${pr.html_url}) **${pr.title}** by @${pr.user.login} (merged ${pr.merged_at.split('T')[0]})\n`;
    }
    report += `\n`;
  }

  report += `### ⚖️ Upstream Architectural Evaluation Matrix\n\n`;
  report += `Before adopting concepts from \`openai/symphony\`, evaluate them against Jonah Fleet's operational model:\n\n`;
  report += `| Evaluation Layer | Key Question | Invariant Check |\n`;
  report += `|---|---|---|\n`;
  report += `| **1. Zero-Daemon Invariant** | Can this run within ephemeral GitHub Actions + \`agy\` CLI sessions? | Must require zero 24/7 background servers/sockets |\n`;
  report += `| **2. Issue Tracker Abstraction** | Does this map cleanly to GitHub Issues, labels, and PR checks? | Must avoid proprietary non-GitHub metadata dependencies |\n`;
  report += `| **3. Token & Cost Economy** | Does this optimize LLM spend within the 70% weekly budget ceiling (~8.75M tokens)? | Must prevent unbounded retry burn or loop stagnation |\n`;
  report += `| **4. Multi-Repo Portability** | Can this be cleanly distributed via \`agents-manifest.json\` and \`jonah-fleet sync\`? | Must remain 100% repository-agnostic |\n\n`;

  report += `#### 🧭 Classification Guide:\n`;
  report += `- **🟢 Category A (Adopt Directly)**: Security guardrails, claim lock invariants, reader/writer rules, prompt engineering optimizations.\n`;
  report += `- **🟡 Category B (Adapt to Actions/CLI)**: Dynamic orchestrator pacing, backpressure controls, multi-stage review checks.\n`;
  report += `- **🔴 Category C (Skip)**: Elixir/OTP supervision trees, BEAM memory tuning, proprietary runtime internals.\n\n`;

  report += `### 💡 Maintainer & Optimizer Triage Checklist\n\n`;
  report += `- [ ] **Classify Changes**: Classify detected upstream changes into Category A, B, or C.\n`;
  report += `- [ ] **Zero-Daemon Check**: Confirm no persistent server or long-lived socket requirement is introduced.\n`;
  report += `- [ ] **Prompt & Skill Ports**: If applicable, port routines to \`templates/prompts/\` or \`.agents/skills/\`.\n`;
  report += `- [ ] **Empirical Evals**: Run \`npm run test:evals\` and \`npm test\` to ensure no regressions.\n`;
  report += `- [ ] **Downstream Sync**: Verify \`jonah-fleet sync\` distributes updates cleanly to target repositories.\n`;
  report += `- [ ] **Close Issue**: Close once triage and any resulting PRs are merged.\n\n`;

  report += `---\n_Generated by [Antigravity](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})_\n`;

  fs.writeFileSync('radar-report.md', report, 'utf8');
  console.log(`Generated radar-report.md (shouldCreateIssue: ${shouldCreateIssue}, hasNewActivity: ${hasNewActivity})`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_create_issue=${shouldCreateIssue}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_new_activity=${hasNewActivity}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue_title=${issueTitle}\n`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
