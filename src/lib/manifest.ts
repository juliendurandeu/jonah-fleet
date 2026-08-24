import fs from 'node:fs';
import path from 'node:path';
import { FleetManifest, FLEET_VERSION, PRESET_CONFIGS, PresetName, SCHEMA_URL } from './presets.js';

export const MANIFEST_FILENAME = 'agents-manifest.json';

export function loadManifest(targetDir: string): FleetManifest | null {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as FleetManifest;
  } catch {
    return null;
  }
}

export function saveManifest(targetDir: string, manifest: FleetManifest): void {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function createDefaultManifest(preset: PresetName = 'standard'): FleetManifest {
  if (preset === 'custom') {
    return {
      $schema: SCHEMA_URL,
      version: FLEET_VERSION,
      preset: 'custom',
      routines: {
        autowork: true,
        'peer-review': true,
        optimizer: true,
        'issues-housekeeping': true,
        'dependency-update-security-check': true,
        'product-planning': false,
      },
      skills: PRESET_CONFIGS.standard.skills,
      autoUpdate: {
        enabled: true,
        channel: 'stable',
      },
    };
  }

  const config = PRESET_CONFIGS[preset];
  return {
    $schema: SCHEMA_URL,
    version: FLEET_VERSION,
    preset,
    routines: { ...config.routines },
    skills: [...config.skills],
    autoUpdate: {
      enabled: true,
      channel: 'stable',
    },
  };
}
