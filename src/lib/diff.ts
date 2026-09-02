import fs from 'node:fs';
import path from 'node:path';
import { getTemplatesDir, resolveWorkflowSchedule, applyWorkflowSchedule } from './installer.js';
import { FleetManifest, ROUTINE_TO_WORKFLOW_MAP } from './presets.js';

export interface DriftReport {
  missingPrompts: string[];
  modifiedPrompts: string[];
  missingWorkflows: string[];
  modifiedWorkflows: string[];
  missingSkills: string[];
}

export function checkDrift(targetDir: string, manifest: FleetManifest): DriftReport {
  const templatesDir = getTemplatesDir();
  const report: DriftReport = {
    missingPrompts: [],
    modifiedPrompts: [],
    missingWorkflows: [],
    modifiedWorkflows: [],
    missingSkills: [],
  };

  const targetPromptsDir = path.join(targetDir, '.github/prompts');
  const targetWorkflowsDir = path.join(targetDir, '.github/workflows');
  const targetSkillsDir = path.join(targetDir, '.agents/skills');

  // Check base prompts
  const basePrompts = ['ORCHESTRATION.md', '_prompt-template.md'];
  for (const file of basePrompts) {
    const src = path.join(templatesDir, 'prompts', file);
    const dest = path.join(targetPromptsDir, file);
    if (!fs.existsSync(dest)) {
      report.missingPrompts.push(file);
    } else if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(dest, 'utf8')) {
      report.modifiedPrompts.push(file);
    }
  }

  // Check routine prompts & workflows
  for (const [routineName, isEnabled] of Object.entries(manifest.routines)) {
    if (!isEnabled) continue;

    const promptFile = `${routineName}.md`;
    const promptSrc = path.join(templatesDir, 'prompts', promptFile);
    const promptDest = path.join(targetPromptsDir, promptFile);
    if (!fs.existsSync(promptDest)) {
      report.missingPrompts.push(promptFile);
    } else if (fs.existsSync(promptSrc) && fs.readFileSync(promptSrc, 'utf8') !== fs.readFileSync(promptDest, 'utf8')) {
      report.modifiedPrompts.push(promptFile);
    }

    const workflows = ROUTINE_TO_WORKFLOW_MAP[routineName as keyof FleetManifest['routines']] || [];
    for (const workflowFile of workflows) {
      const wfSrc = path.join(templatesDir, 'workflows', workflowFile);
      const wfDest = path.join(targetWorkflowsDir, workflowFile);
      if (!fs.existsSync(wfDest)) {
        report.missingWorkflows.push(workflowFile);
      } else if (fs.existsSync(wfSrc)) {
        const rawSrc = fs.readFileSync(wfSrc, 'utf8');
        const destContent = fs.readFileSync(wfDest, 'utf8');
        const schedule = resolveWorkflowSchedule(workflowFile, routineName, manifest, destContent);
        const expectedSrc = applyWorkflowSchedule(rawSrc, schedule);
        if (expectedSrc !== destContent) {
          report.modifiedWorkflows.push(workflowFile);
        }
      }
    }
  }

  // Check sync workflow if autoUpdate is enabled
  if (manifest.autoUpdate?.enabled) {
    const syncWfSrc = path.join(templatesDir, 'workflows/sync-fleet.yml');
    const syncWfDest = path.join(targetWorkflowsDir, 'sync-fleet.yml');
    if (!fs.existsSync(syncWfDest)) {
      report.missingWorkflows.push('sync-fleet.yml');
    } else if (fs.existsSync(syncWfSrc)) {
      const rawSrc = fs.readFileSync(syncWfSrc, 'utf8');
      const destContent = fs.readFileSync(syncWfDest, 'utf8');
      const schedule = resolveWorkflowSchedule('sync-fleet.yml', 'sync-fleet', manifest, destContent);
      const expectedSrc = applyWorkflowSchedule(rawSrc, schedule);
      if (expectedSrc !== destContent) {
        report.modifiedWorkflows.push('sync-fleet.yml');
      }
    }
  }

  // Check skills
  for (const skill of manifest.skills) {
    const skillDestDir = path.join(targetSkillsDir, skill);
    if (!fs.existsSync(skillDestDir)) {
      report.missingSkills.push(skill);
    }
  }

  return report;
}
