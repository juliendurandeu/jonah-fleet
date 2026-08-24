import pc from 'picocolors';
import {
  addGlobalRepository,
  removeGlobalRepository,
  getFleetRepositories,
} from '../lib/global-config.js';
import {
  queryRepoFleetStatus,
  defaultGhExecutor,
  GhExecutor,
  RepoFleetStatus,
} from '../lib/fleet-query.js';
import { renderFleetDashboard } from '../lib/dashboard.js';

export interface MonitorOptions {
  repos?: string[];
  json?: boolean;
  watch?: boolean;
  interval?: string | number;
  all?: boolean;
  add?: string;
  remove?: string;
  cwd?: string;
  executor?: GhExecutor;
}

export async function runMonitor(options: MonitorOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const executor = options.executor || defaultGhExecutor;

  // 1. Handle --add
  if (options.add) {
    const updated = addGlobalRepository(options.add);
    console.log(pc.green(`✓ Added ${pc.bold(options.add)} to Jonah Fleet registry.`));
    console.log(pc.gray(`  Current registered repositories: ${updated.repositories.join(', ') || 'none'}\n`));
    return;
  }

  // 2. Handle --remove
  if (options.remove) {
    const updated = removeGlobalRepository(options.remove);
    console.log(pc.yellow(`✓ Removed ${pc.bold(options.remove)} from Jonah Fleet registry.`));
    console.log(pc.gray(`  Current registered repositories: ${updated.repositories.join(', ') || 'none'}\n`));
    return;
  }

  // 3. Resolve target repositories
  let targetRepos: string[] = [];
  if (options.repos && options.repos.length > 0) {
    targetRepos = options.repos;
  } else {
    targetRepos = getFleetRepositories(cwd);
  }

  if (targetRepos.length === 0) {
    // Attempt auto-discovery from git remote
    try {
      const remoteRaw = await executor(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
      const currentRepo = remoteRaw.trim();
      if (currentRepo) {
        targetRepos = [currentRepo];
      }
    } catch {}
  }

  if (targetRepos.length === 0) {
    console.log(pc.yellow('\n⚠️  No fleet repositories registered.'));
    console.log(pc.cyan('Add repositories to monitor with:'));
    console.log(pc.gray('  jonah-fleet monitor --add owner/repo'));
    console.log(pc.gray('Or specify repositories directly:'));
    console.log(pc.gray('  jonah-fleet monitor owner/repo-1 owner/repo-2\n'));
    return;
  }

  const pollAndRender = async () => {
    const statuses: RepoFleetStatus[] = await Promise.all(
      targetRepos.map((repo) => queryRepoFleetStatus(repo, executor))
    );

    if (options.watch && !options.json) {
      console.clear();
    }

    const output = renderFleetDashboard(statuses, { json: options.json });
    console.log(output);
  };

  await pollAndRender();

  if (options.watch) {
    const intervalSec = typeof options.interval === 'number' ? options.interval : parseInt(options.interval || '10', 10) || 10;
    const timer = setInterval(async () => {
      await pollAndRender();
    }, intervalSec * 1000);

    const handleSigint = () => {
      clearInterval(timer);
      process.removeListener('SIGINT', handleSigint);
      console.log(pc.gray('\nStopped live fleet monitoring.\n'));
      process.exit(0);
    };

    process.on('SIGINT', handleSigint);
  }
}
