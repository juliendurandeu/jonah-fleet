import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadManifest } from './manifest.js';

export interface GlobalConfig {
  repositories: string[];
}

export function getDefaultGlobalConfigPath(): string {
  const baseDir = process.env.JONAH_FLEET_CONFIG_DIR || path.join(os.homedir(), '.jonah-fleet');
  return path.join(baseDir, 'config.json');
}

export function loadGlobalConfig(customPath?: string): GlobalConfig {
  const filePath = customPath || getDefaultGlobalConfigPath();
  if (!fs.existsSync(filePath)) {
    return { repositories: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [],
    };
  } catch {
    return { repositories: [] };
  }
}

export function saveGlobalConfig(config: GlobalConfig, customPath?: string): void {
  const filePath = customPath || getDefaultGlobalConfigPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function addGlobalRepository(repo: string, customPath?: string): GlobalConfig {
  const config = loadGlobalConfig(customPath);
  const normalized = repo.trim();
  if (!normalized) return config;

  if (!config.repositories.includes(normalized)) {
    config.repositories.push(normalized);
    saveGlobalConfig(config, customPath);
  }
  return config;
}

export function removeGlobalRepository(repo: string, customPath?: string): GlobalConfig {
  const config = loadGlobalConfig(customPath);
  const normalized = repo.trim();
  config.repositories = config.repositories.filter((r) => r !== normalized);
  saveGlobalConfig(config, customPath);
  return config;
}

export function getFleetRepositories(cwd?: string, customGlobalConfigPath?: string): string[] {
  const targetDir = cwd || process.cwd();
  const manifest = loadManifest(targetDir);
  const manifestRepos: string[] = Array.isArray(manifest?.repositories) ? manifest.repositories : [];

  const globalConfig = loadGlobalConfig(customGlobalConfigPath);
  const globalRepos = globalConfig.repositories;

  // Merge unique
  const set = new Set<string>();
  for (const r of manifestRepos) {
    if (r && typeof r === 'string' && r.trim()) set.add(r.trim());
  }
  for (const r of globalRepos) {
    if (r && typeof r === 'string' && r.trim()) set.add(r.trim());
  }

  return Array.from(set);
}
