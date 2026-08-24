import pc from 'picocolors';
import { loadManifest } from '../lib/manifest.js';
import { checkDrift } from '../lib/diff.js';
import { FLEET_VERSION } from '../lib/presets.js';
import { runMonitor } from './monitor.js';

export interface StatusOptions {
  cwd?: string;
  fleet?: boolean;
  json?: boolean;
}

export async function runStatus(options: StatusOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();

  if (options.fleet) {
    await runMonitor({ cwd, json: options.json });
    return;
  }

  const manifest = loadManifest(cwd);

  if (!manifest) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'No agents-manifest.json found', cwd }, null, 2));
      return;
    }
    console.log(pc.yellow(`\n⚠️  No agents-manifest.json found in ${cwd}. This project is not configured with Jonah Fleet.`));
    console.log(pc.cyan(`Run 'npx jonah-fleet init' to set up autonomous agent routines.\n`));
    return;
  }

  const drift = checkDrift(cwd, manifest);
  const hasDrift =
    drift.missingPrompts.length > 0 ||
    drift.modifiedPrompts.length > 0 ||
    drift.missingWorkflows.length > 0 ||
    drift.modifiedWorkflows.length > 0 ||
    drift.missingSkills.length > 0;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          cwd,
          version: manifest.version,
          fleetLatestVersion: FLEET_VERSION,
          preset: manifest.preset,
          autoUpdate: manifest.autoUpdate,
          routines: manifest.routines,
          skills: manifest.skills,
          models: manifest.models || {},
          budgets: manifest.budgets || {},
          repositories: manifest.repositories || [],
          drift: {
            hasDrift,
            ...drift,
          },
        },
        null,
        2
      )
    );
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

  if (manifest.models && Object.keys(manifest.models).length > 0) {
    console.log(pc.bold('\n  Model Profiles:'));
    if (manifest.models.default) {
      console.log(`    - ${'default'.padEnd(35)}: ${pc.green(manifest.models.default)}`);
    }
    for (const [key, model] of Object.entries(manifest.models)) {
      if (key === 'default' || !model) continue;
      console.log(`    - ${key.padEnd(35)}: ${pc.cyan(model)}`);
    }
  }

  if (manifest.budgets) {
    console.log(pc.bold('\n  Budget & Resource Constraints:'));
    if (manifest.budgets.weeklyTokens) {
      console.log(`    - Weekly Token Budget: ${pc.green(manifest.budgets.weeklyTokens.toLocaleString())} tokens`);
    }
    if (manifest.budgets.timeoutMinutes && Object.keys(manifest.budgets.timeoutMinutes).length > 0) {
      const timeouts = Object.entries(manifest.budgets.timeoutMinutes)
        .map(([r, t]) => `${r}: ${t}m`)
        .join(', ');
      console.log(`    - Timeouts:            ${pc.cyan(timeouts)}`);
    }
    if (manifest.budgets.maxIterations && Object.keys(manifest.budgets.maxIterations).length > 0) {
      const iters = Object.entries(manifest.budgets.maxIterations)
        .map(([r, i]) => `${r}: ${i}`)
        .join(', ');
      console.log(`    - Max Iterations:      ${pc.cyan(iters)}`);
    }
  }

  if (manifest.repositories && manifest.repositories.length > 0) {
    console.log(pc.bold('\n  Fleet Repositories:'));
    for (const repo of manifest.repositories) {
      console.log(`    - ${pc.cyan(repo)}`);
    }
  }

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
