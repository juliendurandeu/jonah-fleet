import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runSync } from './commands/sync.js';
import { runStatus } from './commands/status.js';
import { runMonitor } from './commands/monitor.js';
import { runContribute } from './commands/contribute.js';
import { FLEET_VERSION } from './lib/presets.js';

const program = new Command();

program
  .name('jonah-fleet')
  .description('Manage autonomous agent fleet, prompt routines, workflows, and skills')
  .version(FLEET_VERSION);

program
  .command('init')
  .description('Initialize Jonah Fleet configuration, routines, workflows, and skills in the current repo')
  .option('-p, --preset <preset>', 'Preset profile to install (minimal | standard | full)', 'standard')
  .option('-f, --force', 'Force overwrite existing files', false)
  .action(async (options) => {
    await runInit(options);
  });

program
  .command('sync')
  .description('Synchronize local prompts, workflows, and skills with the installed fleet version')
  .option('-c, --check', 'Check for drift without writing changes', false)
  .option('-f, --force', 'Force update all files to match fleet version', false)
  .action(async (options) => {
    await runSync(options);
  });

program
  .command('status')
  .description('Check the status, health, and drift of installed agent routines and skills')
  .option('-f, --fleet', 'Display multi-repository fleet monitor overview', false)
  .option('-j, --json', 'Output status as JSON', false)
  .action(async (options) => {
    await runStatus(options);
  });

program
  .command('monitor [repos...]')
  .description('Monitor health, active claims, PR review loops, and token spend across fleet repositories')
  .option('-j, --json', 'Output telemetry as JSON', false)
  .option('-w, --watch', 'Live watch and refresh dashboard', false)
  .option('-i, --interval <seconds>', 'Refresh interval in seconds for watch mode', '10')
  .option('-a, --all', 'Query all registered repositories from config and manifest', false)
  .option('--add <repo>', 'Add a repository to the fleet registry')
  .option('--remove <repo>', 'Remove a repository from the fleet registry')
  .action(async (repos, options) => {
    await runMonitor({ ...options, repos });
  });

program
  .command('contribute')
  .description('Submit local prompt improvements back upstream to jonah-fleet')
  .option('-t, --title <title>', 'Contribution PR title')
  .option('-b, --body <body>', 'Contribution PR description')
  .action(async (options) => {
    await runContribute(options);
  });

program.parse(process.argv);
