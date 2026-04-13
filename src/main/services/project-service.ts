import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CreateProjectInput, ImportProjectInput, Project, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';
import { writeContextFiles, writeContextFile } from './context-generator';
import { sanitizeProjectName } from '../utils/sanitize';
import { runExecFile } from '../utils/run-command';
import * as forgeDirectory from './forge-directory';

export async function createProject(input: CreateProjectInput): Promise<Project> {
  // Validate and sanitize the project name before any file operations
  sanitizeProjectName(input.name);

  const project = store.createProject(input);

  // Check if folder already exists and has content
  try {
    const entries = await fs.readdir(project.path);
    if (entries.length > 0) {
      throw new Error(
        'Folder already exists and is not empty. Choose a different name or location.',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      // Remove from store since we can't create
      store.deleteProject(project.id);
      throw err;
    }
    // ENOENT means folder doesn't exist, which is fine
  }

  await fs.mkdir(project.path, { recursive: true });

  try {
    await runExecFile('git', ['init'], { cwd: project.path });
    await runExecFile('git', ['checkout', '-b', 'main'], {
      cwd: project.path,
    });
  } catch {
    // git init is best-effort
  }

  try {
    await writeContextFiles(project);
  } catch {
    // context file generation is best-effort
  }

  try {
    await forgeDirectory.initialize(project.path, project.agents as AgentType[]);
  } catch {
    // forge init is best-effort
  }

  return project;
}

export async function importProject(input: ImportProjectInput): Promise<Project> {
  // Create the store entry pointing at the existing folder — no mkdir, no git init
  const project = store.createProject({
    name: input.name,
    description: input.description,
    path: input.path,
    inputs: input.inputs,
    tags: [],
    preferredAgent: input.preferredAgent,
    agents: [input.preferredAgent],
  });

  // Optionally generate / overwrite context files (best-effort)
  if (input.generateMissingContextFiles || input.overwriteExistingContextFiles) {
    for (const agentType of project.agents as AgentType[]) {
      const ctxPath = path.join(input.path, AGENTS[agentType].contextFileName);
      let fileAlreadyExists = false;
      try {
        await fs.access(ctxPath);
        fileAlreadyExists = true;
      } catch { /* doesn't exist */ }
      if (!fileAlreadyExists || input.overwriteExistingContextFiles) {
        await writeContextFile(project, agentType).catch(() => { /* best-effort */ });
      }
    }
  }

  try {
    if (!(await forgeDirectory.exists(input.path))) {
      await forgeDirectory.initialize(input.path, [input.preferredAgent]);
    }
  } catch {
    // forge init is best-effort
  }

  return project;
}

export async function deleteProject(
  id: string,
  deleteFromDisk: boolean,
): Promise<void> {
  const project = store.getProjectById(id);
  store.deleteProject(id);

  if (deleteFromDisk && project) {
    await fs.rm(project.path, { recursive: true, force: true });
  }
}
