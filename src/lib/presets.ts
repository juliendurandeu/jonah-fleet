export type PresetName = 'minimal' | 'standard' | 'full' | 'custom';

export interface FleetManifest {
  $schema?: string;
  version: string;
  preset: PresetName;
  routines: {
    autowork: boolean;
    'peer-review': boolean;
    optimizer: boolean;
    'issues-housekeeping': boolean;
    'dependency-update-security-check': boolean;
    'product-planning': boolean;
  };
  skills: string[];
  repositories?: string[];
  autoUpdate?: {
    enabled: boolean;
    channel: 'stable' | 'latest';
  };
}

export const PRESET_CONFIGS: Record<Exclude<PresetName, 'custom'>, { routines: FleetManifest['routines']; skills: string[] }> = {
  minimal: {
    routines: {
      autowork: true,
      'peer-review': true,
      optimizer: true,
      'issues-housekeeping': false,
      'dependency-update-security-check': false,
      'product-planning': false,
    },
    skills: [
      'tdd',
      'code-review',
      'diagnosing-bugs',
      'resolving-merge-conflicts',
      'writing-for-agents',
    ],
  },
  standard: {
    routines: {
      autowork: true,
      'peer-review': true,
      optimizer: true,
      'issues-housekeeping': true,
      'dependency-update-security-check': true,
      'product-planning': false,
    },
    skills: [
      'tdd',
      'code-review',
      'codebase-design',
      'domain-modeling',
      'diagnosing-bugs',
      'resolving-merge-conflicts',
      'writing-for-agents',
      'triage',
    ],
  },
  full: {
    routines: {
      autowork: true,
      'peer-review': true,
      optimizer: true,
      'issues-housekeeping': true,
      'dependency-update-security-check': true,
      'product-planning': true,
    },
    skills: [
      'tdd',
      'code-review',
      'codebase-design',
      'domain-modeling',
      'diagnosing-bugs',
      'resolving-merge-conflicts',
      'writing-for-agents',
      'triage',
      'to-spec',
      'to-tickets',
    ],
  },
};

export const ROUTINE_TO_WORKFLOW_MAP: Record<keyof FleetManifest['routines'], string[]> = {
  autowork: ['autowork-cron.yml', 'trigger-autowork-on-merge.yml', 'trigger-autowork-on-bug.yml'],
  'peer-review': ['trigger-review-routine.yml'],
  optimizer: ['prompt-optimizer-cron.yml'],
  'issues-housekeeping': ['issues-housekeeping-cron.yml'],
  'dependency-update-security-check': ['dependency-check-cron.yml'],
  'product-planning': [],
};

export const FLEET_VERSION = '1.0.0';
export const SCHEMA_URL = 'https://raw.githubusercontent.com/juliendurandeu/jonah-fleet/main/schema.json';
