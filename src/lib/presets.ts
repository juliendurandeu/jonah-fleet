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
    'analytics-review': boolean;
  };
  schedules?: {
    autowork?: string;
    'peer-review'?: string;
    optimizer?: string;
    'issues-housekeeping'?: string;
    'dependency-update-security-check'?: string;
    'analytics-review'?: string;
    'sync-fleet'?: string;
    [key: string]: string | undefined;
  };
  skills: string[];
  repositories?: string[];
  autoUpdate?: {
    enabled: boolean;
    channel: 'stable' | 'latest';
  };
  telemetry?: {
    enabled?: boolean;
    endpoint?: string;
    weeklyTokenBudget?: number;
  };
  dualExecution?: DualExecutionConfig;
}

export interface DualExecutionConfig {
  enabled?: boolean;
  cloudPriorities?: string[];
  cloudCatchupHours?: number;
}

export const DEFAULT_DUAL_EXECUTION_CONFIG: DualExecutionConfig = {
  enabled: true,
  cloudPriorities: ['P0', 'P1'],
  cloudCatchupHours: 48,
};

export const PRESET_CONFIGS: Record<Exclude<PresetName, 'custom'>, { routines: FleetManifest['routines']; skills: string[] }> = {
  minimal: {
    routines: {
      autowork: true,
      'peer-review': true,
      optimizer: true,
      'issues-housekeeping': false,
      'dependency-update-security-check': false,
      'product-planning': false,
      'analytics-review': false,
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
      'analytics-review': false,
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
      'grill-me',
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
      'analytics-review': true,
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
      'grill-me',
      'to-spec',
      'to-tickets',
    ],
  },
};

export const ROUTINE_TO_WORKFLOW_MAP: Record<keyof FleetManifest['routines'], string[]> = {
  autowork: [
    'autowork-cron.yml',
    'trigger-autowork-on-merge.yml',
    'trigger-autowork-on-bug.yml',
    'trigger-autowork-manual.yml',
  ],
  'peer-review': ['trigger-review-routine.yml'],
  optimizer: ['prompt-optimizer-cron.yml'],
  'issues-housekeeping': ['issues-housekeeping-cron.yml'],
  'dependency-update-security-check': ['dependency-check-cron.yml'],
  'product-planning': [],
  'analytics-review': [],
};

export const WORKFLOW_TO_ROUTINE_MAP: Record<string, keyof FleetManifest['routines'] | 'sync-fleet'> = {
  'autowork-cron.yml': 'autowork',
  'trigger-review-routine.yml': 'peer-review',
  'prompt-optimizer-cron.yml': 'optimizer',
  'issues-housekeeping-cron.yml': 'issues-housekeeping',
  'dependency-check-cron.yml': 'dependency-update-security-check',
  'sync-fleet.yml': 'sync-fleet',
};

export const FLEET_VERSION = '1.5.0';
export const SCHEMA_URL = 'https://raw.githubusercontent.com/juliendurandeu/jonah-fleet/main/schema.json';
