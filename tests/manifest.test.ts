import { describe, it, expect } from 'vitest';
import { createDefaultManifest } from '../src/lib/manifest.js';
import { FLEET_VERSION } from '../src/lib/presets.js';

describe('Manifest generation', () => {
  it('generates a standard manifest with standard routines', () => {
    const manifest = createDefaultManifest('standard');
    expect(manifest.version).toBe(FLEET_VERSION);
    expect(manifest.preset).toBe('standard');
    expect(manifest.routines.autowork).toBe(true);
    expect(manifest.routines['peer-review']).toBe(true);
    expect(manifest.routines.optimizer).toBe(true);
    expect(manifest.routines['issues-housekeeping']).toBe(true);
    expect(manifest.routines['product-planning']).toBe(false);
    expect(manifest.routines['analytics-review']).toBe(false);
    expect(manifest.skills).toContain('tdd');
    expect(manifest.skills).toContain('code-review');
  });

  it('generates a minimal manifest', () => {
    const manifest = createDefaultManifest('minimal');
    expect(manifest.preset).toBe('minimal');
    expect(manifest.routines.autowork).toBe(true);
    expect(manifest.routines['peer-review']).toBe(true);
    expect(manifest.routines.optimizer).toBe(true);
    expect(manifest.routines['issues-housekeeping']).toBe(false);
    expect(manifest.routines['analytics-review']).toBe(false);
  });

  it('generates a full manifest', () => {
    const manifest = createDefaultManifest('full');
    expect(manifest.preset).toBe('full');
    expect(manifest.routines['product-planning']).toBe(true);
    expect(manifest.routines['analytics-review']).toBe(true);
    expect(manifest.skills).toContain('to-spec');
    expect(manifest.skills).toContain('to-tickets');
  });

  it('supports telemetry configuration in manifest', () => {
    const manifest = createDefaultManifest('standard');
    manifest.telemetry = {
      enabled: true,
      endpoint: 'https://telemetry.example.com/api/events',
      weeklyTokenBudget: 8_750_000,
    };
    expect(manifest.telemetry.enabled).toBe(true);
    expect(manifest.telemetry.weeklyTokenBudget).toBe(8_750_000);
  });

  it('supports custom cron schedules in manifest', () => {
    const manifest = createDefaultManifest('standard');
    manifest.schedules = {
      autowork: '0 * * * *',
      'peer-review': '0 */3 * * *',
      optimizer: '0 12 * * 0',
      'sync-fleet': '0 0 * * 1',
    };
    expect(manifest.schedules.autowork).toBe('0 * * * *');
    expect(manifest.schedules['peer-review']).toBe('0 */3 * * *');
    expect(manifest.schedules.optimizer).toBe('0 12 * * 0');
    expect(manifest.schedules['sync-fleet']).toBe('0 0 * * 1');
  });

  it('supports dualExecution configuration in manifest', () => {
    const manifest = createDefaultManifest('standard');
    manifest.dualExecution = {
      enabled: true,
      cloudPriorities: ['P0', 'P1'],
      cloudCatchupHours: 48,
    };
    expect(manifest.dualExecution.enabled).toBe(true);
    expect(manifest.dualExecution.cloudPriorities).toEqual(['P0', 'P1']);
    expect(manifest.dualExecution.cloudCatchupHours).toBe(48);
  });
});
