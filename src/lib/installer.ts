import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FleetManifest, ROUTINE_TO_WORKFLOW_MAP } from './presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getTemplatesDir(): string {
  // Check if running from dist/ or src/
  const candidate1 = path.resolve(__dirname, '../templates');
  const candidate2 = path.resolve(__dirname, '../../templates');
  if (fs.existsSync(candidate1)) return candidate1;
  if (fs.existsSync(candidate2)) return candidate2;
  throw new Error(`Templates directory not found at ${candidate1} or ${candidate2}`);
}

export interface InstallResult {
  promptsInstalled: string[];
  workflowsInstalled: string[];
  skillsInstalled: string[];
  docsInstalled: string[];
}

export function installFleet(targetDir: string, manifest: FleetManifest, options: { force?: boolean } = {}): InstallResult {
  const templatesDir = getTemplatesDir();
  const result: InstallResult = {
    promptsInstalled: [],
    workflowsInstalled: [],
    skillsInstalled: [],
    docsInstalled: [],
  };

  const targetPromptsDir = path.join(targetDir, '.github/prompts');
  const targetWorkflowsDir = path.join(targetDir, '.github/workflows');
  const targetSkillsDir = path.join(targetDir, '.agents/skills');

  fs.mkdirSync(targetPromptsDir, { recursive: true });
  fs.mkdirSync(targetWorkflowsDir, { recursive: true });
  fs.mkdirSync(targetSkillsDir, { recursive: true });

  // 1. Install base prompt files
  const basePrompts = ['ORCHESTRATION.md', '_prompt-template.md'];
  for (const file of basePrompts) {
    const src = path.join(templatesDir, 'prompts', file);
    const dest = path.join(targetPromptsDir, file);
    if (fs.existsSync(src)) {
      if (!fs.existsSync(dest) || options.force) {
        fs.copyFileSync(src, dest);
        result.promptsInstalled.push(file);
      }
    }
  }

  // 2. Install enabled routines and their workflows
  for (const [routineName, isEnabled] of Object.entries(manifest.routines)) {
    if (!isEnabled) continue;

    // Prompt file
    const promptFile = `${routineName}.md`;
    const promptSrc = path.join(templatesDir, 'prompts', promptFile);
    const promptDest = path.join(targetPromptsDir, promptFile);
    if (fs.existsSync(promptSrc)) {
      if (!fs.existsSync(promptDest) || options.force) {
        fs.copyFileSync(promptSrc, promptDest);
        result.promptsInstalled.push(promptFile);
      }
    }

    // Associated Workflows
    const workflows = ROUTINE_TO_WORKFLOW_MAP[routineName as keyof FleetManifest['routines']] || [];
    for (const workflowFile of workflows) {
      const wfSrc = path.join(templatesDir, 'workflows', workflowFile);
      const wfDest = path.join(targetWorkflowsDir, workflowFile);
      if (fs.existsSync(wfSrc)) {
        if (!fs.existsSync(wfDest) || options.force) {
          fs.copyFileSync(wfSrc, wfDest);
          result.workflowsInstalled.push(workflowFile);
        }
      }
    }
  }

  // 3. Install sync workflow if autoUpdate is enabled
  if (manifest.autoUpdate?.enabled) {
    const syncWfSrc = path.join(templatesDir, 'workflows/sync-fleet.yml');
    const syncWfDest = path.join(targetWorkflowsDir, 'sync-fleet.yml');
    if (fs.existsSync(syncWfSrc)) {
      if (!fs.existsSync(syncWfDest) || options.force) {
        fs.copyFileSync(syncWfSrc, syncWfDest);
        result.workflowsInstalled.push('sync-fleet.yml');
      }
    }
  }

  // 4. Install selected skills
  for (const skill of manifest.skills) {
    const skillSrcDir = path.join(templatesDir, 'skills', skill);
    const skillDestDir = path.join(targetSkillsDir, skill);
    if (fs.existsSync(skillSrcDir)) {
      if (!fs.existsSync(skillDestDir) || options.force) {
        fs.cpSync(skillSrcDir, skillDestDir, { recursive: true });
        result.skillsInstalled.push(skill);
      }
    }
  }

  // 5. Install AGENTS.md template if neither AGENTS.md, CLAUDE.md nor GEMINI.md exists
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  const claudePath = path.join(targetDir, 'CLAUDE.md');
  const geminiPath = path.join(targetDir, 'GEMINI.md');
  if (!fs.existsSync(agentsPath) && !fs.existsSync(claudePath) && !fs.existsSync(geminiPath)) {
    const docSrc = path.join(templatesDir, 'docs/AGENTS.template.md');
    if (fs.existsSync(docSrc)) {
      fs.copyFileSync(docSrc, agentsPath);
      result.docsInstalled.push('AGENTS.md');
    }
  }

  return result;
}
