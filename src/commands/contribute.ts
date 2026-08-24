import { execSync } from 'node:child_process';
import pc from 'picocolors';

export interface ContributeOptions {
  title?: string;
  body?: string;
  prompt?: string;
  cwd?: string;
}

export async function runContribute(options: ContributeOptions = {}): Promise<void> {
  console.log(pc.cyan(`\n🚀 Jonah Fleet Upstream Contribution Bridge\n`));

  const title = options.title || 'fix(prompts): improve orchestrator routine handling';
  const body = options.body || 'Proposed prompt optimization discovered during autonomous execution runs.';

  console.log(`Preparing upstream contribution PR against ${pc.bold('juliendurandeu/jonah-fleet')}...`);
  console.log(`Title: ${pc.green(title)}`);
  console.log(`Body:  ${pc.gray(body)}\n`);

  try {
    const branchName = `contrib/optimize-${Date.now()}`;
    console.log(`Creating branch ${pc.cyan(branchName)}...`);

    // Verify git status and gh CLI
    try {
      execSync('gh auth status', { stdio: 'pipe' });
    } catch {
      console.error(pc.red('❌ GitHub CLI (`gh`) is not authenticated. Run `gh auth login` first.'));
      process.exit(1);
    }

    console.log(pc.green(`✓ Ready to package and submit upstream contribution to juliendurandeu/jonah-fleet.`));
    console.log(pc.cyan(`Command executed by optimizer routine or operator:\n`));
    console.log(`  gh pr create --repo juliendurandeu/jonah-fleet --title "${title}" --body "${body}"\n`);
  } catch (err: any) {
    console.error(pc.red(`❌ Error during contribution preparation: ${err.message}`));
    process.exit(1);
  }
}
