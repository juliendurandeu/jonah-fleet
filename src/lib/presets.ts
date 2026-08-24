export type PresetName = 'minimal' | 'standard' | 'full' | 'custom';

export interface RoutineModels {
  default?: string;
  autowork?: string;
  'peer-review'?: string;
  optimizer?: string;
  'issues-housekeeping'?: string;
  'dependency-update-security-check'?: string;
  'product-planning'?: string;
}

export interface RoutineBudgets {
  weeklyTokens?: number;
  maxIterations?: {
    default?: number;
    autowork?: number;
    'peer-review'?: number;
    optimizer?: number;
    'issues-housekeeping'?: number;
    'dependency-update-security-check'?: number;
    'product-planning'?: number;
  };
  timeoutMinutes?: {
    default?: number;
    autowork?: number;
    'peer-review'?: number;
    optimizer?: number;
    'issues-housekeeping'?: number;
    'dependency-update-security-check'?: number;
    'product-planning'?: number;
  };
}

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
  models?: RoutineModels;
  budgets?: RoutineBudgets;
  repositories?: string[];
  autoUpdate?: {
    enabled: boolean;
    channel: 'stable' | 'latest';
  };
}

export const DEFAULT_ROUTINE_MODELS: Record<string, string> = {
  autowork: 'gemini-3.7-flash-high',
  'peer-review': 'gemini-3.7-flash-high',
  optimizer: 'gemini-3.7-flash-high',
  'issues-housekeeping': 'gemini-3.7-flash',
  'dependency-update-security-check': 'gemini-3.7-flash',
  'product-planning': 'gemini-3.7-flash-high',
};

export const DEFAULT_ROUTINE_TIMEOUTS: Record<string, number> = {
  autowork: 60,
  'peer-review': 55,
  optimizer: 35,
  'issues-housekeeping': 40,
  'dependency-update-security-check': 25,
  'product-planning': 45,
};

export const DEFAULT_ROUTINE_MAX_ITERATIONS: Record<string, number> = {
  autowork: 65,
  'peer-review': 40,
  optimizer: 30,
  'issues-housekeeping': 30,
  'dependency-update-security-check': 20,
  'product-planning': 40,
};

export const DEFAULT_MODELS_CONFIG: RoutineModels = {
  default: 'gemini-3.7-flash-high',
  'issues-housekeeping': 'gemini-3.7-flash',
  'dependency-update-security-check': 'gemini-3.7-flash',
};

export const DEFAULT_BUDGETS_CONFIG: RoutineBudgets = {
  weeklyTokens: 8750000,
  timeoutMinutes: {
    autowork: 60,
    'peer-review': 55,
    optimizer: 35,
    'issues-housekeeping': 40,
    'dependency-update-security-check': 25,
  },
  maxIterations: {
    autowork: 65,
    'peer-review': 40,
    optimizer: 30,
    'issues-housekeeping': 30,
    'dependency-update-security-check': 20,
  },
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

export const FLEET_VERSION = '1.1.0';
export const SCHEMA_URL = 'https://raw.githubusercontent.com/juliendurandeu/jonah-fleet/main/schema.json';
