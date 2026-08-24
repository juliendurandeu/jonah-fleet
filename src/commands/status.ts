import pc from 'picocolors';
import { loadManifest } from '../lib/manifest.js';
import { checkDrift } from '../lib/diff.js';
import { FLEET_VERSION } from '../lib/presets.js';

export interface StatusOptions {
  cwd?: string;
}

export async function runStatus(options: StatusOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const manifest = loadManifest(cwd);

  if (!manifest) {
    console.log(pc.yellow(`\n⚠️  No agents-manifest.json found in ${cwd}. This project is not configured with Jonah Fleet.`));
    console.log(pc.cyan(`Run 'npx jonah-fleet init' to set up autonomous agent routines.\n`));
    return;
  }

  console.log(pc.bold(pc.cyan(`\n📊 Jonah Fleet Status for ${cwd}\n`)));
  console.log(`  Version:         ${manifest.version === FLEET_VERSION ? pc.green(manifest.version) : pc.yellow(`${manifest.version} (fleet latest: ${FLEET_VERSION})`)}`);
  console.log(`  Preset:          ${pc.bold(manifest.preset)}`);
  console.log(`  Auto-Update:     ${manifest.autoUpdate?.enabled ? pc.green('Enabled (' + manifest.autoUpdate.channel + ')') : pc.gray('Disabled')}`);

  console.log(pc.bold('\n  Enabled Routines:'));
  for (const [routine, enabled] of Object.entries(manifest.routines)) {
    console.log(`    - ${routine.padEnd(35)}: ${enabled ? pc.green('ENABLED') : pc.gray('DISABLED')}`);
  }

  console.log(pc.bold('\n  Configured Skills:'));
  for (const skill of manifest.skills) {
    console.log(`    - ${pc.cyan(skill)}`);
  }

  const drift = checkDrift(cwd, manifest);
  const hasDrift =
    drift.missingPrompts.length > 0 ||
    drift.modifiedPrompts.length > 0 ||
    drift.missingWorkflows.length > 0 ||
    drift.modifiedWorkflows.length > 0 ||
    drift.missingSkills.length > 0;

  console.log(pc.bold('\n  Drift / Health:'));
  if (!hasDrift) {
    console.log(pc.green('    ✓ All prompts, workflows, and skills are healthy and match fleet templates.\n'));
  } else {
    if (drift.missingPrompts.length > 0) console.log(pc.red(`    ❌ Missing prompts: ${drift.missingPrompts.join(', ')}`));
    if (drift.modifiedPrompts.length > 0) console.log(pc.yellow(`    ⚠️  Modified prompts: ${drift.modifiedPrompts.join(', ')}`));
    if (drift.missingWorkflows.length > 0) console.log(pc.red(`    ❌ Missing workflows: ${drift.missingWorkflows.join(', ')}`));
    if (drift.modifiedWorkflows.length > 0) console.log(pc.yellow(`    ⚠️  Modified workflows: ${drift.modifiedWorkflows.join(', ')}`));
    if (drift.missingSkills.length > 0) console.log(pc.red(`    ❌ Missing skills: ${drift.missingSkills.join(', ')}`));
    console.log(pc.cyan('\n  Run \'jonah-fleet sync\' to synchronize files.\n'));
  }
}
