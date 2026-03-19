import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CreateProjectInput, Project } from '../../shared/types';
import * as store from '../store';
import { writeContextFiles } from './context-generator';
import { sanitizeProjectName } from '../utils/sanitize';

const execFileAsync = promisify(execFile);

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
    await execFileAsync('git', ['init'], { cwd: project.path });
    await execFileAsync('git', ['checkout', '-b', 'main'], {
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
