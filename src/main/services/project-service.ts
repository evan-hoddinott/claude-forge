import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CreateProjectInput, Project } from '../../shared/types';
import * as store from '../store';
import { generateClaudeMD } from './claude-md-generator';

const execFileAsync = promisify(execFile);

export async function createProject(input: CreateProjectInput): Promise<Project> {
  // 1. Save to store (generates id, timestamps, resolved path)
  const project = store.createProject(input);

  // 2. Create directory on disk
  await fs.mkdir(project.path, { recursive: true });

  // 3. Initialize git repo
  try {
    await execFileAsync('git', ['init'], { cwd: project.path });
    await execFileAsync('git', ['checkout', '-b', 'main'], {
      cwd: project.path,
    });
  } catch {
    // git init is best-effort — don't block project creation
  }

  // 4. Generate CLAUDE.md from project inputs
  try {
    await generateClaudeMD(project);
  } catch {
    // CLAUDE.md generation is best-effort
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
