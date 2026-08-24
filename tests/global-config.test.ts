import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadGlobalConfig,
  saveGlobalConfig,
  addGlobalRepository,
  removeGlobalRepository,
  getFleetRepositories,
} from '../src/lib/global-config.js';
import { saveManifest, createDefaultManifest } from '../src/lib/manifest.js';

describe('Global Config and Repository Registry', () => {
  let tempDir: string;
  let customConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jonah-fleet-config-test-'));
    customConfigFile = path.join(tempDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns default empty config when file does not exist', () => {
    const config = loadGlobalConfig(customConfigFile);
    expect(config).toEqual({ repositories: [] });
  });

  it('saves and reloads global config', () => {
    const initialConfig = { repositories: ['owner/repo-a', 'owner/repo-b'] };
    saveGlobalConfig(initialConfig, customConfigFile);

    const reloaded = loadGlobalConfig(customConfigFile);
    expect(reloaded).toEqual(initialConfig);
  });

  it('adds a repository without duplicates', () => {
    addGlobalRepository('owner/repo-a', customConfigFile);
    addGlobalRepository('owner/repo-b', customConfigFile);
    const updated = addGlobalRepository('owner/repo-a', customConfigFile);

    expect(updated.repositories).toEqual(['owner/repo-a', 'owner/repo-b']);
    expect(loadGlobalConfig(customConfigFile).repositories).toEqual(['owner/repo-a', 'owner/repo-b']);
  });

  it('removes a repository correctly', () => {
    saveGlobalConfig({ repositories: ['owner/repo-a', 'owner/repo-b', 'owner/repo-c'] }, customConfigFile);
    const updated = removeGlobalRepository('owner/repo-b', customConfigFile);

    expect(updated.repositories).toEqual(['owner/repo-a', 'owner/repo-c']);
    expect(loadGlobalConfig(customConfigFile).repositories).toEqual(['owner/repo-a', 'owner/repo-c']);
  });

  it('merges repositories from manifest and global config', () => {
    const localRepoDir = path.join(tempDir, 'local-repo');
    fs.mkdirSync(localRepoDir, { recursive: true });
    const manifest = createDefaultManifest('standard');
    manifest.repositories = ['owner/repo-manifest-1', 'owner/shared-repo'];
    saveManifest(localRepoDir, manifest);

    saveGlobalConfig({ repositories: ['owner/shared-repo', 'owner/repo-global-2'] }, customConfigFile);

    const repos = getFleetRepositories(localRepoDir, customConfigFile);
    expect(repos).toEqual(['owner/repo-manifest-1', 'owner/shared-repo', 'owner/repo-global-2']);
  });
});
