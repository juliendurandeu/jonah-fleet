import path from 'node:path';
import pc from 'picocolors';
import { createDefaultManifest, loadManifest, saveManifest } from '../lib/manifest.js';
import { installFleet } from '../lib/installer.js';
import { PresetName } from '../lib/presets.js';

export interface InitOptions {
  preset?: string;
  force?: boolean;
  cwd?: string;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const preset = (options.preset || 'standard') as PresetName;

  console.log(pc.cyan(`\n⚓ Initializing Jonah Fleet (preset: ${pc.bold(preset)}) in ${cwd}\n`));

  let manifest = loadManifest(cwd);
  if (manifest && !options.force) {
    console.log(pc.yellow(`⚠️  Found existing agents-manifest.json. Updating with preset '${preset}'...`));
  } else {
    manifest = createDefaultManifest(preset);
  }

  saveManifest(cwd, manifest);
  console.log(pc.green(`✓ Created/Updated agents-manifest.json`));

  const result = installFleet(cwd, manifest, { force: options.force });

  console.log(pc.bold('\nInstalled components:'));
  if (result.promptsInstalled.length > 0) {
    console.log(pc.green(`  📁 Prompts (.github/prompts/):`));
    result.promptsInstalled.forEach((p) => console.log(`     - ${p}`));
  }
  if (result.workflowsInstalled.length > 0) {
    console.log(pc.green(`  ⚙️ Workflows (.github/workflows/):`));
    result.workflowsInstalled.forEach((w) => console.log(`     - ${w}`));
  }
  if (result.skillsInstalled.length > 0) {
    console.log(pc.green(`  🧠 Skills (.agents/skills/):`));
    result.skillsInstalled.forEach((s) => console.log(`     - ${s}`));
  }
  if (result.docsInstalled.length > 0) {
    console.log(pc.green(`  📄 Documentation:`));
    result.docsInstalled.forEach((d) => console.log(`     - ${d}`));
  }

  console.log(pc.bold(pc.green('\n🎉 Jonah Fleet initialization complete!\n')));
  console.log(pc.cyan('Next steps for GitHub repository configuration:'));
  console.log('  1. In Settings → Actions → General → Workflow permissions:');
  console.log('     Select "Read and write permissions" and check "Allow GitHub Actions to create and approve pull requests".');
  console.log('  2. In Settings → Actions → General → Fork pull request workflows:');
  console.log('     Configure workflow approval settings to prevent automated runs from stalling awaiting approval.');
  console.log('  3. Customize project context, build, and test commands in AGENTS.md.\n');
}
