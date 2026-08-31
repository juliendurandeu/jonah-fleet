import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getTemplatesDir } from '../src/lib/installer.js';
import { ROUTINE_TO_WORKFLOW_MAP } from '../src/lib/presets.js';

describe('Workflow Validation & Invariants', () => {
  const templatesDir = getTemplatesDir();
  const workflowsDir = path.join(templatesDir, 'workflows');

  it('includes trigger-autowork-manual.yml in ROUTINE_TO_WORKFLOW_MAP for autowork', () => {
    expect(ROUTINE_TO_WORKFLOW_MAP.autowork).toContain('trigger-autowork-manual.yml');
  });

  it('has trigger-autowork-manual.yml template with required inputs and steps', () => {
    const manualWorkflowPath = path.join(workflowsDir, 'trigger-autowork-manual.yml');
    expect(fs.existsSync(manualWorkflowPath)).toBe(true);

    const content = fs.readFileSync(manualWorkflowPath, 'utf8');
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('issue_number:');
    expect(content).toContain('TARGET_ISSUE: ${{ inputs.issue_number }}');
    expect(content).toContain('Targeted mode');
    expect(content).toContain('gemini-3.7-flash-high');
    expect(content).toContain('Verify Atomic Handoff Invariant');
  });

  it('ensures autowork-cron.yml supports target_issue and issue_number inputs', () => {
    const cronWorkflowPath = path.join(workflowsDir, 'autowork-cron.yml');
    const content = fs.readFileSync(cronWorkflowPath, 'utf8');
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('target_issue:');
    expect(content).toContain('issue_number:');
    expect(content).toContain('TARGET_ISSUE: ${{ inputs.target_issue || inputs.issue_number }}');
  });

  it('ensures all workflow templates exist in the templates directory', () => {
    for (const workflows of Object.values(ROUTINE_TO_WORKFLOW_MAP)) {
      for (const workflowFile of workflows) {
        const filePath = path.join(workflowsDir, workflowFile);
        expect(fs.existsSync(filePath), `Workflow file ${workflowFile} should exist in templates`).toBe(true);
      }
    }
  });

  it('verifies badge link template format in docs and templates', () => {
    const agentsTemplate = fs.readFileSync(path.join(templatesDir, 'docs/AGENTS.template.md'), 'utf8');
    const orchestrationDoc = fs.readFileSync(path.join(templatesDir, 'prompts/ORCHESTRATION.md'), 'utf8');

    expect(agentsTemplate).toContain('actions/workflows/trigger-autowork-manual.yml');
    expect(orchestrationDoc).toContain('trigger-autowork-manual.yml');
  });

  it('verifies trigger-review-routine.yml includes periodic scan sweep and failure notification handler', () => {
    const workflowPath = path.join(workflowsDir, 'trigger-review-routine.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('schedule:');
    expect(content).toContain('cron:');
    expect(content).toContain("github.event_name == 'schedule'");
    expect(content).toContain('Handle Review Failure & PR Notification');
    expect(content).toContain('if: failure()');
    expect(content).toContain('Peer Review Routine Notice');
  });
});
