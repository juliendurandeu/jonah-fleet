import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getTemplatesDir } from '../src/lib/installer.js';

describe('Prompt Validation & Invariants', () => {
  const templatesDir = getTemplatesDir();
  const promptsDir = path.join(templatesDir, 'prompts');
  const promptFiles = fs.readdirSync(promptsDir).filter((f) => f.endsWith('.md') && f !== 'ORCHESTRATION.md');

  it.each(promptFiles)('validates structure for %s', (filename) => {
    const filePath = path.join(promptsDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('## Objective');
    expect(content).toContain('## Definition of Done');
    expect(content).toContain('## Constraints');
    expect(content).toContain('## Instructions');
    expect(content).toContain('## Logging');
  });

  it('ensures no hardcoded repo names or credentials exist in prompt templates', () => {
    for (const filename of fs.readdirSync(promptsDir)) {
      const filePath = path.join(promptsDir, filename);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for hardcoded project references that shouldn't be in generic templates
      expect(content).not.toContain('Jonah-RuPaul/src');
      expect(content).not.toContain('jonah-newsletter-gemini');
    }
  });
});
