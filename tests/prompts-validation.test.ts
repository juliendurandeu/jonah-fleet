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

  it('validates optimizer.md defines concrete token anomaly heuristics and preventative remediation actions', () => {
    const optimizerPath = path.join(promptsDir, 'optimizer.md');
    const content = fs.readFileSync(optimizerPath, 'utf8');

    // Token Anomaly Heuristics
    expect(content).toContain('Token Surge');
    expect(content).toMatch(/Token Surge.*>50%/s);
    expect(content).toContain('Budget Hog');
    expect(content).toMatch(/Budget Hog.*>75%/s);
    expect(content).toContain('Iteration Ceiling Exhaustion');
    expect(content).toMatch(/Iteration Ceiling Exhaustion.*>20%/s);
    expect(content).toContain('Review Loop Burn');
    expect(content).toMatch(/Review Loop Burn.*(?:≥|>=)\s*3/s);

    // Automated preventative actions
    expect(content).toMatch(/pruning redundant instructions|instruction pruning/i);
    expect(content).toMatch(/early exit|candidate skip/i);
    expect(content).toMatch(/iteration ceiling|pre-ready self-audit/i);
  });

  it('validates ORCHESTRATION.md documents the token anomaly triage and remediation workflow', () => {
    const orchestrationPath = path.join(templatesDir, 'prompts', 'ORCHESTRATION.md');
    const content = fs.readFileSync(orchestrationPath, 'utf8');

    expect(content).toContain('## Token Anomaly Triage & Remediation');
    expect(content).toContain('Token Surge');
    expect(content).toContain('Budget Hog');
    expect(content).toContain('Iteration Ceiling Exhaustion');
    expect(content).toContain('Review Loop Burn');
  });

  it('ensures prompt templates in templates/prompts are synchronized with .github/prompts', () => {
    const githubPromptsDir = path.join(process.cwd(), '.github', 'prompts');
    if (fs.existsSync(githubPromptsDir)) {
      for (const filename of fs.readdirSync(promptsDir)) {
        const templatePath = path.join(promptsDir, filename);
        const githubPath = path.join(githubPromptsDir, filename);
        if (fs.existsSync(githubPath)) {
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          const githubContent = fs.readFileSync(githubPath, 'utf8');
          expect(githubContent).toBe(templateContent);
        }
      }
    }
  });
});

