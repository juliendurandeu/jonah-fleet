import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultManifest, resolveRoutineConfig, loadManifest, saveManifest } from '../src/lib/manifest.js';
import { FLEET_VERSION, FleetManifest } from '../src/lib/presets.js';
import { runStatus } from '../src/commands/status.js';
import { runSync } from '../src/commands/sync.js';

describe('Manifest generation', () => {
  it('generates a standard manifest with standard routines, models, and budgets', () => {
    const manifest = createDefaultManifest('standard');
    expect(manifest.version).toBe(FLEET_VERSION);
    expect(manifest.preset).toBe('standard');
    expect(manifest.routines.autowork).toBe(true);
    expect(manifest.routines['peer-review']).toBe(true);
    expect(manifest.routines.optimizer).toBe(true);
    expect(manifest.routines['issues-housekeeping']).toBe(true);
    expect(manifest.routines['product-planning']).toBe(false);
    expect(manifest.skills).toContain('tdd');
    expect(manifest.skills).toContain('code-review');

    expect(manifest.models).toBeDefined();
    expect(manifest.models?.default).toBe('gemini-3.7-flash-high');
    expect(manifest.models?.['issues-housekeeping']).toBe('gemini-3.7-flash');
    expect(manifest.budgets?.weeklyTokens).toBe(8750000);
    expect(manifest.budgets?.timeoutMinutes?.autowork).toBe(60);
    expect(manifest.budgets?.maxIterations?.autowork).toBe(65);
  });

  it('generates a minimal manifest', () => {
    const manifest = createDefaultManifest('minimal');
    expect(manifest.preset).toBe('minimal');
    expect(manifest.routines.autowork).toBe(true);
    expect(manifest.routines['peer-review']).toBe(true);
    expect(manifest.routines.optimizer).toBe(true);
    expect(manifest.routines['issues-housekeeping']).toBe(false);
  });

  it('generates a full manifest', () => {
    const manifest = createDefaultManifest('full');
    expect(manifest.preset).toBe('full');
    expect(manifest.routines['product-planning']).toBe(true);
    expect(manifest.skills).toContain('to-spec');
    expect(manifest.skills).toContain('to-tickets');
  });
});

describe('Routine Configuration Resolution', () => {
  it('resolves defaults when manifest is null or empty', () => {
    const config = resolveRoutineConfig(null, 'autowork');
    expect(config.model).toBe('gemini-3.7-flash-high');
    expect(config.timeoutMinutes).toBe(60);
    expect(config.maxIterations).toBe(65);
  });

  it('resolves per-routine model and timeout overrides', () => {
    const manifest: FleetManifest = {
      version: '1.1.0',
      preset: 'custom',
      routines: {
        autowork: true,
        'peer-review': true,
        optimizer: true,
        'issues-housekeeping': true,
        'dependency-update-security-check': true,
        'product-planning': false,
      },
      skills: ['tdd'],
      models: {
        default: 'gemini-2.5-flash',
        autowork: 'gemini-3.7-flash-high',
        'issues-housekeeping': 'gemini-3.7-flash',
      },
      budgets: {
        weeklyTokens: 5000000,
        timeoutMinutes: {
          default: 30,
          autowork: 45,
          'issues-housekeeping': 20,
        },
        maxIterations: {
          default: 25,
          autowork: 50,
          'issues-housekeeping': 15,
        },
      },
    };

    const autoworkConfig = resolveRoutineConfig(manifest, 'autowork');
    expect(autoworkConfig.model).toBe('gemini-3.7-flash-high');
    expect(autoworkConfig.timeoutMinutes).toBe(45);
    expect(autoworkConfig.maxIterations).toBe(50);

    const housekeepingConfig = resolveRoutineConfig(manifest, 'issues-housekeeping');
    expect(housekeepingConfig.model).toBe('gemini-3.7-flash');
    expect(housekeepingConfig.timeoutMinutes).toBe(20);
    expect(housekeepingConfig.maxIterations).toBe(15);

    // Fallback to default in manifest for routine without specific override
    const optimizerConfig = resolveRoutineConfig(manifest, 'optimizer');
    expect(optimizerConfig.model).toBe('gemini-2.5-flash');
    expect(optimizerConfig.timeoutMinutes).toBe(30);
    expect(optimizerConfig.maxIterations).toBe(25);
  });
});

describe('Manifest preservation in CLI commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves custom model and budget configs during sync', async () => {
    const customManifest: FleetManifest = {
      version: '1.0.0',
      preset: 'custom',
      routines: {
        autowork: true,
        'peer-review': true,
        optimizer: true,
        'issues-housekeeping': true,
        'dependency-update-security-check': true,
        'product-planning': false,
      },
      skills: ['tdd', 'code-review'],
      models: {
        autowork: 'custom-model-autowork',
        'peer-review': 'custom-model-review',
      },
      budgets: {
        weeklyTokens: 10000000,
        timeoutMinutes: {
          autowork: 90,
        },
        maxIterations: {
          autowork: 80,
        },
      },
    };

    saveManifest(tempDir, customManifest);

    await runSync({ cwd: tempDir });

    const synced = loadManifest(tempDir);
    expect(synced).not.toBeNull();
    expect(synced?.version).toBe(FLEET_VERSION);
    expect(synced?.models?.autowork).toBe('custom-model-autowork');
    expect(synced?.models?.['peer-review']).toBe('custom-model-review');
    expect(synced?.budgets?.weeklyTokens).toBe(10000000);
    expect(synced?.budgets?.timeoutMinutes?.autowork).toBe(90);
    expect(synced?.budgets?.maxIterations?.autowork).toBe(80);
  });

  it('outputs models and budgets in status --json', async () => {
    const customManifest: FleetManifest = {
      version: '1.1.0',
      preset: 'custom',
      routines: {
        autowork: true,
        'peer-review': true,
        optimizer: true,
        'issues-housekeeping': true,
        'dependency-update-security-check': true,
        'product-planning': false,
      },
      skills: ['tdd'],
      models: {
        autowork: 'custom-autowork-model',
      },
      budgets: {
        weeklyTokens: 7000000,
        timeoutMinutes: {
          autowork: 45,
        },
      },
    };

    saveManifest(tempDir, customManifest);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runStatus({ cwd: tempDir, json: true });

    expect(logSpy).toHaveBeenCalled();
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.models.autowork).toBe('custom-autowork-model');
    expect(output.budgets.weeklyTokens).toBe(7000000);
    expect(output.budgets.timeoutMinutes.autowork).toBe(45);
    logSpy.mockRestore();
  });
});

describe('JSON Schema validation', () => {
  it('validates that schema.json defines models and budgets properties', () => {
    const schemaPath = path.resolve(__dirname, '../schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    expect(schema.properties.models).toBeDefined();
    expect(schema.properties.models.type).toBe('object');
    expect(schema.properties.models.properties.autowork).toBeDefined();
    expect(schema.properties.models.properties['peer-review']).toBeDefined();

    expect(schema.properties.budgets).toBeDefined();
    expect(schema.properties.budgets.type).toBe('object');
    expect(schema.properties.budgets.properties.weeklyTokens).toBeDefined();
    expect(schema.properties.budgets.properties.maxIterations).toBeDefined();
    expect(schema.properties.budgets.properties.timeoutMinutes).toBeDefined();
  });
});
