import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { Project, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';

export function generateContextContent(project: Project, _agentType: AgentType): string {
  // agentType available for future per-agent customization
  const sections: string[] = [];

  sections.push(`# ${project.name}`);

  if (project.description) {
    sections.push(`## What This Is\n${project.description}`);
  }

  for (const input of project.inputs) {
    const hasSelected = input.selectedOptions && input.selectedOptions.length > 0;
    const hasValue = input.value.trim();
    if (!hasValue && !hasSelected) continue;

    if (input.type === 'checklist' && hasSelected) {
      const items = input.selectedOptions!.map((opt) => `- [x] ${opt}`);
      const unchecked = (input.options || [])
        .filter((opt) => !input.selectedOptions!.includes(opt))
        .map((opt) => `- [ ] ${opt}`);
      sections.push(`## ${input.label}\n${[...items, ...unchecked].join('\n')}`);
    } else if (input.multiSelect && hasSelected) {
      sections.push(`## ${input.label}\n${input.selectedOptions!.join(', ')}`);
    } else if (hasValue) {
      sections.push(`## ${input.label}\n${input.value}`);
    }
  }

  if (project.tags.length > 0) {
    sections.push(`## Tags\n${project.tags.join(', ')}`);
  }

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

  return sections.join('\n\n') + '\n';
}

export async function writeContextFile(project: Project, agentType: AgentType): Promise<void> {
  const config = AGENTS[agentType];
  const content = generateContextContent(project, agentType);
  await fs.writeFile(path.join(project.path, config.contextFileName), content, 'utf-8');
}

export async function writeContextFiles(project: Project): Promise<void> {
  for (const agentType of project.agents) {
    await writeContextFile(project, agentType);
  }
}
