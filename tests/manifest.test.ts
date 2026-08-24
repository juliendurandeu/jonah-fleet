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
  });

  it('generates a full manifest', () => {
    const manifest = createDefaultManifest('full');
    expect(manifest.preset).toBe('full');
    expect(manifest.routines['product-planning']).toBe(true);
    expect(manifest.skills).toContain('to-spec');
    expect(manifest.skills).toContain('to-tickets');
  });
});
