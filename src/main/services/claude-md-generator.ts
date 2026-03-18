import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../../shared/types';

export async function generateClaudeMD(project: Project): Promise<void> {
  const sections: string[] = [];

  // Header
  sections.push(`# ${project.name}`);

  // Description
  if (project.description) {
    sections.push(`## What This Is\n${project.description}`);
  }

  // Custom inputs — each becomes its own section
  for (const input of project.inputs) {
    if (!input.value.trim()) continue;

    sections.push(`## ${input.label}\n${input.value}`);
  }

  // Tags as metadata
  if (project.tags.length > 0) {
    sections.push(`## Tags\n${project.tags.join(', ')}`);
  }

  // Coding standards boilerplate
  sections.push(
    [
      '## Coding Standards',
      '- Write clean, readable code with meaningful names',
      '- Add error handling for external operations (file I/O, network, child processes)',
      '- Keep functions small and focused',
      '- Use TypeScript strict mode where applicable',
      '- Commit after completing each major feature',
    ].join('\n'),
  );

  const content = sections.join('\n\n') + '\n';
  await fs.writeFile(path.join(project.path, 'CLAUDE.md'), content, 'utf-8');
}
