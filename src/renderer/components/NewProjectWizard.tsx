import { useState, useEffect, useCallback, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectInput, GitHubRepo, EnvironmentInfo, ProjectLocationMode, AgentType, AgentStatus } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface WizardData {
  name: string;
  path: string;
  description: string;
  inputs: ProjectInput[];
  githubChoice: 'create' | 'link' | 'skip';
  newRepoName: string;
  newRepoPrivate: boolean;
  newRepoDescription: string;
  linkedRepoUrl: string;
  selectedAgents: AgentType[];
  launchAgent: AgentType;
}

const INITIAL_DATA: WizardData = {
  name: '',
  path: '',
  description: '',
  inputs: [],
  githubChoice: 'skip',
  newRepoName: '',
  newRepoPrivate: true,
  newRepoDescription: '',
  linkedRepoUrl: '',
  selectedAgents: ['claude'],
  launchAgent: 'claude',
};

const STEP_LABELS = ['Basics', 'Context', 'GitHub', 'Review'];

interface InputPreset {
  label: string;
  type: ProjectInput['type'];
  placeholder?: string;
  options?: string[];
  multiSelect?: boolean;
}

const INPUT_PRESETS: InputPreset[] = [
  { label: 'Description', type: 'textarea', placeholder: 'What are you building? What problem does it solve?' },
  {
    label: 'Tech Stack',
    type: 'select',
    options: ['React', 'Vue', 'Svelte', 'Next.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Electron', 'React Native', 'Other'],
    multiSelect: true,
  },
  { label: 'Template', type: 'select', options: ['Web App', 'API Server', 'CLI Tool', 'Desktop App', 'Mobile App', 'Chrome Extension', 'Library/Package', 'Full-Stack', 'Other'] },
  { label: 'Features', type: 'textarea', placeholder: 'List the features you want built...' },
  { label: 'System Prompt', type: 'textarea', placeholder: 'Custom instructions for Claude Code...' },
  { label: 'Dependencies', type: 'text', placeholder: 'Key packages or APIs to use...' },
  { label: 'Design Style', type: 'select', options: ['Minimal', 'Modern', 'Playful', 'Corporate', 'Brutalist', 'Retro', 'No preference'] },
  { label: 'Target Audience', type: 'text', placeholder: 'Who is this for?' },
];

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/6 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:bg-white/[0.07] transition-colors';

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
};

// ---------------------------------------------------------------------------
// Tiny shared sub-components
// ---------------------------------------------------------------------------

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-status-error mt-1">{error}</p>}
    </div>
  );
}

function RadioOption({
  selected,
  onClick,
  children,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-accent/40 bg-accent/5'
          : 'border-white/6 bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected ? 'border-accent' : 'border-white/20'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
        </div>
        <span className="text-sm font-medium text-text-primary">
          {children}
        </span>
      </div>
      {description && (
        <p className="text-xs text-text-muted mt-1 ml-7">{description}</p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 px-6 pt-5 pb-2">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1 flex-1 last:flex-initial">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < current
                  ? 'bg-accent text-bg'
                  : i === current
                    ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                    : 'bg-white/5 text-text-muted ring-1 ring-white/6'
              }`}
            >
              {i < current ? (
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                i <= current ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`flex-1 h-px mx-2 transition-colors ${
                i < current ? 'bg-accent/40' : 'bg-white/6'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Basics
// ---------------------------------------------------------------------------

function LocationModeToggle({
  mode,
  onChange,
  envInfo,
}: {
  mode: ProjectLocationMode;
  onChange: (mode: ProjectLocationMode) => void;
  envInfo: EnvironmentInfo;
}) {
  if (!envInfo.wslAvailable) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] w-fit">
        <button
          type="button"
          onClick={() => onChange('wsl')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === 'wsl'
              ? 'bg-white/8 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          WSL (recommended)
        </button>
        <button
          type="button"
          onClick={() => onChange('windows')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === 'windows'
              ? 'bg-white/8 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Windows
        </button>
      </div>
      <div className="flex items-start gap-1.5 text-xs text-text-muted">
        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent/60" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
        <span>
          WSL is recommended for Claude Code. Projects on the Windows filesystem will be slower for file operations.
        </span>
      </div>
    </div>
  );
}

function StepBasics({
  data,
  defaultDir,
  errors,
  onChange,
  onBrowse,
  envInfo,
  locationMode,
  onLocationModeChange,
}: {
  data: WizardData;
  defaultDir: string;
  errors: Record<string, string>;
  onChange: (updates: Partial<WizardData>) => void;
  onBrowse: () => void;
  envInfo: EnvironmentInfo | null;
  locationMode: ProjectLocationMode;
  onLocationModeChange: (mode: ProjectLocationMode) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const pathPreview = data.path || `${defaultDir}/${data.name || 'my-project'}`;

  return (
    <div className="space-y-4 p-6">
      <FormField label="Project name" error={errors.name}>
        <input
          ref={nameRef}
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="my-awesome-project"
          className={INPUT_CLS}
        />
      </FormField>

      <FormField label="Location">
        {envInfo && envInfo.wslAvailable && (
          <div className="mb-2">
            <LocationModeToggle
              mode={locationMode}
              onChange={onLocationModeChange}
              envInfo={envInfo}
            />
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={data.path}
            onChange={(e) => onChange({ path: e.target.value })}
            placeholder={pathPreview}
            className={`${INPUT_CLS} flex-1`}
          />
          <button
            type="button"
            onClick={onBrowse}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/6 text-sm text-text-secondary hover:text-text-primary hover:bg-white/8 transition-colors shrink-0"
          >
            Browse
          </button>
        </div>
        <p className="text-xs text-text-muted mt-1 truncate">
          {pathPreview}
        </p>
      </FormField>

      <FormField label="Description (optional)">
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What is this project about?"
          rows={3}
          className={`${INPUT_CLS} resize-none`}
        />
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Inputs
// ---------------------------------------------------------------------------

function MultiSelectDropdown({
  options,
  selectedOptions,
  onToggle,
  onCustomAdd,
}: {
  options: string[];
  selectedOptions: string[];
  onToggle: (opt: string) => void;
  onCustomAdd: (opt: string) => void;
}) {
  const [customText, setCustomText] = useState('');

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = selectedOptions.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selected
                  ? 'bg-accent/20 text-accent ring-1 ring-accent/30'
                  : 'bg-white/5 text-text-secondary hover:bg-white/8 hover:text-text-primary'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customText.trim()) {
              e.preventDefault();
              onCustomAdd(customText.trim());
              setCustomText('');
            }
          }}
          placeholder="Add custom..."
          className={`${INPUT_CLS} flex-1 text-xs`}
        />
        {customText.trim() && (
          <button
            type="button"
            onClick={() => {
              onCustomAdd(customText.trim());
              setCustomText('');
            }}
            className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors shrink-0"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistInput({
  options,
  selectedOptions,
  onToggle,
}: {
  options: string[];
  selectedOptions: string[];
  onToggle: (opt: string) => void;
}) {
  return (
    <div className="space-y-1">
      {options.map((opt) => {
        const checked = selectedOptions.includes(opt);
        return (
          <label
            key={opt}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                checked
                  ? 'bg-accent border-accent'
                  : 'border-white/20 bg-white/5'
              }`}
            >
              {checked && (
                <svg className="w-2.5 h-2.5 text-bg" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </div>
            <span className="text-xs text-text-primary">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function DraggableInputCard({
  input,
  onUpdate,
  onDelete,
}: {
  input: ProjectInput;
  onUpdate: (updates: Partial<ProjectInput>) => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const preset = INPUT_PRESETS.find((p) => p.label === input.label);
  const placeholder = preset?.placeholder || 'Value...';

  function toggleOption(opt: string) {
    const current = input.selectedOptions || [];
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    onUpdate({ selectedOptions: next, value: next.join(', ') });
  }

  function addCustomOption(opt: string) {
    const currentOpts = input.options || [];
    if (!currentOpts.includes(opt)) {
      onUpdate({ options: [...currentOpts, opt] });
    }
    const current = input.selectedOptions || [];
    if (!current.includes(opt)) {
      const next = [...current, opt];
      onUpdate({
        options: currentOpts.includes(opt) ? currentOpts : [...currentOpts, opt],
        selectedOptions: next,
        value: next.join(', '),
      });
    }
  }

  return (
    <Reorder.Item
      value={input}
      dragListener={false}
      dragControls={controls}
      className="list-none"
    >
      <motion.div
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="p-3 rounded-lg bg-white/[0.03] border border-white/6 space-y-2"
      >
        {/* Header row: grip, label, delete */}
        <div className="flex items-center gap-2">
          <div
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary touch-none"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="4" r="1.2" />
              <circle cx="11" cy="4" r="1.2" />
              <circle cx="5" cy="8" r="1.2" />
              <circle cx="11" cy="8" r="1.2" />
              <circle cx="5" cy="12" r="1.2" />
              <circle cx="11" cy="12" r="1.2" />
            </svg>
          </div>
          <span className="flex-1 text-sm font-medium text-text-primary min-w-0 truncate">
            {input.label}
          </span>
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-white/5">
            {input.type === 'textarea' ? 'Long Text' : input.type === 'select' ? (input.multiSelect ? 'Multi-Select' : 'Dropdown') : input.type === 'checklist' ? 'Checklist' : 'Text'}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="text-text-muted hover:text-status-error transition-colors p-0.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Value field based on type */}
        {input.type === 'textarea' ? (
          <textarea
            value={input.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={placeholder}
            rows={3}
            className={`${INPUT_CLS} resize-none text-xs`}
          />
        ) : input.type === 'select' && input.multiSelect ? (
          <MultiSelectDropdown
            options={input.options || []}
            selectedOptions={input.selectedOptions || []}
            onToggle={toggleOption}
            onCustomAdd={addCustomOption}
          />
        ) : input.type === 'select' && input.options?.length ? (
          <select
            value={input.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={INPUT_CLS}
          >
            <option value="">Select...</option>
            {input.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : input.type === 'checklist' && input.options?.length ? (
          <ChecklistInput
            options={input.options}
            selectedOptions={input.selectedOptions || []}
            onToggle={toggleOption}
          />
        ) : (
          <input
            type="text"
            value={input.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={placeholder}
            className={`${INPUT_CLS} text-xs`}
          />
        )}
      </motion.div>
    </Reorder.Item>
  );
}

function generatePreviewMarkdown(projectName: string, description: string, inputs: ProjectInput[]): string {
  const sections: string[] = [];
  sections.push(`# ${projectName || 'Untitled Project'}`);
  if (description) {
    sections.push(`## What This Is\n${description}`);
  }
  for (const input of inputs) {
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
  sections.push(
    [
      '## Coding Standards',
      '- Write clean, readable code with meaningful names',
      '- Add error handling for external operations',
      '- Keep functions small and focused',
      '- Use TypeScript strict mode where applicable',
      '- Commit after completing each major feature',
    ].join('\n'),
  );
  return sections.join('\n\n') + '\n';
}

function StepInputs({
  inputs,
  projectName,
  description,
  onInputsChange,
}: {
  inputs: ProjectInput[];
  projectName: string;
  description: string;
  onInputsChange: (inputs: ProjectInput[]) => void;
}) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [customDraft, setCustomDraft] = useState({
    label: '',
    type: 'text' as ProjectInput['type'],
    optionsText: '',
  });

  function addPreset(preset: InputPreset) {
    const newInput: ProjectInput = {
      id: uuidv4(),
      label: preset.label,
      type: preset.type,
      value: '',
      options: preset.options,
      multiSelect: preset.multiSelect,
      selectedOptions: [],
    };
    onInputsChange([...inputs, newInput]);
  }

  function addCustomInput() {
    if (!customDraft.label.trim()) return;
    const options =
      customDraft.type === 'select' || customDraft.type === 'checklist'
        ? customDraft.optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const newInput: ProjectInput = {
      id: uuidv4(),
      label: customDraft.label.trim(),
      type: customDraft.type,
      value: '',
      options,
      selectedOptions: [],
    };
    onInputsChange([...inputs, newInput]);
    setCustomDraft({ label: '', type: 'text', optionsText: '' });
    setShowCustomForm(false);
  }

  function updateInput(id: string, updates: Partial<ProjectInput>) {
    onInputsChange(
      inputs.map((inp) => (inp.id === id ? { ...inp, ...updates } : inp)),
    );
  }

  function deleteInput(id: string) {
    onInputsChange(inputs.filter((inp) => inp.id !== id));
  }

  const previewContent = generatePreviewMarkdown(projectName, description, inputs);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-text-primary">Project Context</h3>
        <p className="text-xs text-text-muted mt-1">
          Add any information Claude Code should know about your project.
          The more context you provide, the better the results.
        </p>
      </div>

      {/* Quick-add presets — horizontal scrollable row */}
      <div className="overflow-x-auto -mx-6 px-6 pb-1">
        <div className="flex gap-1.5 w-max">
          {INPUT_PRESETS.map((preset) => {
            const alreadyAdded = inputs.some((i) => i.label === preset.label);
            return (
              <button
                key={preset.label}
                type="button"
                disabled={alreadyAdded}
                onClick={() => addPreset(preset)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  alreadyAdded
                    ? 'bg-white/[0.03] text-text-muted cursor-default line-through decoration-text-muted/30'
                    : 'bg-accent/10 text-accent hover:bg-accent/20 hover:shadow-sm'
                }`}
              >
                {alreadyAdded ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                    {preset.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M6 2v8M2 6h8" />
                    </svg>
                    {preset.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input cards or empty state */}
      {inputs.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <div className="flex justify-center gap-3 opacity-30">
            {/* Ghost preview cards */}
            {['Description', 'Tech Stack', 'Features'].map((label) => (
              <div
                key={label}
                className="w-28 h-16 rounded-lg border border-dashed border-white/10 flex items-center justify-center"
              >
                <span className="text-[10px] text-text-muted">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-muted">
            No context added yet
          </p>
          <p className="text-xs text-text-muted">
            Use the quick-add buttons above or create your own below.
          </p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={inputs}
          onReorder={onInputsChange}
          className="space-y-2"
        >
          <AnimatePresence initial={false}>
            {inputs.map((input) => (
              <DraggableInputCard
                key={input.id}
                input={input}
                onUpdate={(u) => updateInput(input.id, u)}
                onDelete={() => deleteInput(input.id)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* Custom input builder */}
      <AnimatePresence>
        {showCustomForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border border-accent/20 bg-accent/[0.03] space-y-3">
              <p className="text-xs font-medium text-text-secondary">Add Custom Input</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customDraft.label}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, label: e.target.value }))
                  }
                  placeholder="Label (e.g. Database Schema, API Endpoints)"
                  className={`${INPUT_CLS} flex-1`}
                  autoFocus
                />
                <select
                  value={customDraft.type}
                  onChange={(e) =>
                    setCustomDraft((d) => ({
                      ...d,
                      type: e.target.value as ProjectInput['type'],
                    }))
                  }
                  className="bg-white/5 border border-white/6 rounded-lg px-2 py-2 text-sm text-text-secondary outline-none"
                >
                  <option value="text">Short Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Dropdown</option>
                  <option value="checklist">Checklist</option>
                </select>
              </div>

              {(customDraft.type === 'select' || customDraft.type === 'checklist') && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={customDraft.optionsText}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, optionsText: e.target.value }))
                    }
                    placeholder="Options (comma-separated, e.g. Option A, Option B, Option C)"
                    className={INPUT_CLS}
                  />
                  {customDraft.optionsText && (
                    <div className="flex flex-wrap gap-1">
                      {customDraft.optionsText.split(',').map((opt, i) => opt.trim() && (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-text-secondary">
                          {opt.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addCustomInput}
                  disabled={!customDraft.label.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add custom input button */}
      {!showCustomForm && (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/10 text-sm text-text-muted hover:text-text-secondary hover:border-white/20 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Custom Input
        </button>
      )}

      {/* CLAUDE.md Preview */}
      <div className="border border-white/6 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" />
            </svg>
            Preview CLAUDE.md
          </span>
          <motion.svg
            animate={{ rotate: showPreview ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 6 8 10 12 6" />
          </motion.svg>
        </button>
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/6 bg-white/[0.02] px-4 py-3 max-h-48 overflow-y-auto">
                <pre className="text-[11px] text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
                  {previewContent}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — GitHub
// ---------------------------------------------------------------------------

function StepGitHub({
  data,
  errors,
  onChange,
}: {
  data: WizardData;
  errors: Record<string, string>;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  const api = useAPI();
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [ghAuthStatus, setGhAuthStatus] = useState<{ checked: boolean; authenticated: boolean }>({ checked: false, authenticated: true });
  const [offline, setOffline] = useState(!navigator.onLine);

  // Check GitHub auth and online status when this step mounts
  useEffect(() => {
    setOffline(!navigator.onLine);
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    api.github.checkAuth().then((status) => {
      setGhAuthStatus({ checked: true, authenticated: status.authenticated });
    }).catch(() => {
      setGhAuthStatus({ checked: true, authenticated: false });
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [api]);

  function handleChoiceChange(choice: WizardData['githubChoice']) {
    onChange({ githubChoice: choice });
    if (choice === 'link' && repos === null) {
      setLoadingRepos(true);
      api.github
        .listRepos()
        .then(setRepos)
        .catch(() => setRepos([]))
        .finally(() => setLoadingRepos(false));
    }
  }

  const filteredRepos =
    repos?.filter((r) =>
      r.name.toLowerCase().includes(repoSearch.toLowerCase()),
    ) ?? [];

  return (
    <div className="p-6 space-y-4">
      {/* Offline warning */}
      {offline && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-in-progress/10 border border-status-in-progress/20">
          <svg className="w-4 h-4 text-status-in-progress shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 5v3M8 11h.01" />
            <circle cx="8" cy="8" r="6.5" />
          </svg>
          <span className="text-xs text-status-in-progress">
            You appear to be offline. GitHub operations require an internet connection.
          </span>
        </div>
      )}

      {/* Auth expired warning */}
      {ghAuthStatus.checked && !ghAuthStatus.authenticated && !offline && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-error/10 border border-status-error/20">
          <svg className="w-4 h-4 text-status-error shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 5v3M8 11h.01" />
            <circle cx="8" cy="8" r="6.5" />
          </svg>
          <span className="text-xs text-status-error">
            GitHub authentication expired or not configured. Reconnect from the sidebar GitHub tab, or skip for now.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <RadioOption
          selected={data.githubChoice === 'create'}
          onClick={() => handleChoiceChange('create')}
          description="Creates a new repo and links it to this project"
        >
          Create new repository
        </RadioOption>
        <RadioOption
          selected={data.githubChoice === 'link'}
          onClick={() => handleChoiceChange('link')}
          description="Connect to one of your existing repos"
        >
          Link existing repository
        </RadioOption>
        <RadioOption
          selected={data.githubChoice === 'skip'}
          onClick={() => handleChoiceChange('skip')}
          description="You can always add GitHub later"
        >
          Skip for now
        </RadioOption>
      </div>

      {/* Create new repo form */}
      <AnimatePresence>
        {data.githubChoice === 'create' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <FormField label="Repository name" error={errors.repoName}>
                <input
                  type="text"
                  value={data.newRepoName}
                  onChange={(e) => onChange({ newRepoName: e.target.value })}
                  placeholder={data.name || 'repo-name'}
                  className={INPUT_CLS}
                />
              </FormField>

              <FormField label="Visibility">
                <div className="flex rounded-lg bg-white/5 border border-white/6 p-0.5 w-fit">
                  <button
                    type="button"
                    onClick={() => onChange({ newRepoPrivate: false })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      !data.newRepoPrivate
                        ? 'bg-white/10 text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ newRepoPrivate: true })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      data.newRepoPrivate
                        ? 'bg-white/10 text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    Private
                  </button>
                </div>
              </FormField>

              <FormField label="Description (optional)">
                <input
                  type="text"
                  value={data.newRepoDescription}
                  onChange={(e) =>
                    onChange({ newRepoDescription: e.target.value })
                  }
                  placeholder={data.description || 'A short description'}
                  className={INPUT_CLS}
                />
              </FormField>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link existing repo */}
      <AnimatePresence>
        {data.githubChoice === 'link' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <FormField label="Repository URL or search" error={errors.repoUrl}>
                <input
                  type="text"
                  value={
                    data.linkedRepoUrl.startsWith('http')
                      ? data.linkedRepoUrl
                      : repoSearch
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('github.com') || val.includes('git@')) {
                      onChange({ linkedRepoUrl: val });
                    } else {
                      setRepoSearch(val);
                      onChange({ linkedRepoUrl: '' });
                    }
                  }}
                  placeholder="Search repos or paste a URL..."
                  className={INPUT_CLS}
                />
              </FormField>

              {loadingRepos ? (
                <div className="flex items-center gap-2 text-xs text-text-muted py-4 justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: 'linear',
                    }}
                    className="w-4 h-4 border-2 border-white/10 border-t-accent rounded-full"
                  />
                  Loading repos...
                </div>
              ) : repos && repos.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-white/6 divide-y divide-white/[0.04]">
                  {filteredRepos.slice(0, 20).map((repo) => (
                    <button
                      key={repo.fullName}
                      type="button"
                      onClick={() =>
                        onChange({ linkedRepoUrl: repo.url })
                      }
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        data.linkedRepoUrl === repo.url
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                      }`}
                    >
                      <span className="font-medium">{repo.name}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {repo.fullName}
                      </span>
                    </button>
                  ))}
                  {filteredRepos.length === 0 && (
                    <p className="px-3 py-3 text-xs text-text-muted text-center">
                      No repos matching &ldquo;{repoSearch}&rdquo;
                    </p>
                  )}
                </div>
              ) : repos && repos.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">
                  No repositories found. Paste a URL above.
                </p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-text-muted shrink-0 w-24">{label}</span>
      <span className="text-text-primary break-all">{value}</span>
    </div>
  );
}

function AgentIconSmall({ agentType }: { agentType: AgentType }) {
  switch (agentType) {
    case 'claude':
      return (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <polyline points="4 7 6 9 4 11" />
          <line x1="8" y1="11" x2="12" y2="11" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C8 4.42 4.42 8 0 8c4.42 0 8 3.58 8 8 0-4.42 3.58-8 8-8-4.42 0-8-3.58-8-8z" />
        </svg>
      );
    case 'codex':
      return (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L14.93 4v8L8 16 1.07 12V4L8 0zm0 1.6L2.47 4.8v6.4L8 14.4l5.53-3.2V4.8L8 1.6z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
  }
}

function StepReview({
  data,
  defaultDir,
  creating,
  createError,
  folderConflict,
  onForceCreate,
  agentStatuses,
  onAgentsChange,
  onLaunchAgentChange,
}: {
  data: WizardData;
  defaultDir: string;
  creating: boolean;
  createError: string | null;
  folderConflict: string | null;
  onForceCreate: () => void;
  agentStatuses: Record<AgentType, AgentStatus> | null;
  onAgentsChange: (agents: AgentType[]) => void;
  onLaunchAgentChange: (agent: AgentType) => void;
}) {
  const resolvedPath = data.path || `${defaultDir}/${data.name}`;

  function toggleAgent(agentType: AgentType) {
    const current = data.selectedAgents;
    if (current.includes(agentType)) {
      if (current.length <= 1) return; // must have at least one
      const next = current.filter((a) => a !== agentType);
      onAgentsChange(next);
      if (data.launchAgent === agentType) onLaunchAgentChange(next[0]);
    } else {
      onAgentsChange([...current, agentType]);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Project */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Project
        </h4>
        <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <ReviewRow label="Name" value={data.name} />
          <ReviewRow label="Location" value={resolvedPath} />
          {data.description && (
            <ReviewRow label="Description" value={data.description} />
          )}
        </div>
      </div>

      {/* Inputs */}
      {data.inputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Inputs ({data.inputs.length})
          </h4>
          <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            {data.inputs.map((inp) => (
              <ReviewRow
                key={inp.id}
                label={inp.label}
                value={inp.value || '(empty)'}
              />
            ))}
          </div>
        </div>
      )}

      {/* GitHub */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          GitHub
        </h4>
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          {data.githubChoice === 'create' && (
            <div className="space-y-1.5">
              <ReviewRow
                label="New repo"
                value={data.newRepoName || data.name}
              />
              <ReviewRow
                label="Visibility"
                value={data.newRepoPrivate ? 'Private' : 'Public'}
              />
            </div>
          )}
          {data.githubChoice === 'link' && (
            <ReviewRow label="Link to" value={data.linkedRepoUrl} />
          )}
          {data.githubChoice === 'skip' && (
            <span className="text-sm text-text-muted">
              No GitHub integration
            </span>
          )}
        </div>
      </div>

      {/* AI Agents */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          AI Agents
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => {
            const config = AGENTS[agentType];
            const status = agentStatuses?.[agentType];
            const isInstalled = status?.installed && status?.authenticated;
            const selected = data.selectedAgents.includes(agentType);
            return (
              <button
                key={agentType}
                type="button"
                onClick={() => isInstalled && toggleAgent(agentType)}
                disabled={!isInstalled}
                className={`p-3 rounded-lg border transition-all text-left ${
                  !isInstalled
                    ? 'opacity-30 cursor-not-allowed border-white/[0.04] bg-white/[0.01]'
                    : selected
                      ? 'border-white/20 bg-white/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
                style={selected && isInstalled ? { borderColor: config.color + '40' } : undefined}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: isInstalled ? config.color : undefined }}>
                    <AgentIconSmall agentType={agentType} />
                  </span>
                  <span className="text-xs font-medium text-text-primary">{config.displayName}</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  {!isInstalled ? 'Install first' : config.contextFileName}
                </span>
              </button>
            );
          })}
        </div>
        {data.selectedAgents.length > 1 && (
          <div className="mt-2">
            <span className="text-[10px] text-text-muted mr-2">Launch with:</span>
            {data.selectedAgents.map((a) => {
              const config = AGENTS[a];
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => onLaunchAgentChange(a)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] mr-1 transition-colors ${
                    data.launchAgent === a
                      ? 'bg-white/10 text-text-primary font-medium'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <span style={{ color: config.color }}>
                    <AgentIconSmall agentType={a} />
                  </span>
                  {config.displayName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {createError && (
        <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/20 text-sm text-status-error">
          {createError}
        </div>
      )}

      {folderConflict && !createError && (
        <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/20 text-sm text-status-warning">
          <p>Folder &quot;{folderConflict}&quot; already exists and is not empty.</p>
          <button
            type="button"
            onClick={onForceCreate}
            className="mt-2 px-3 py-1 rounded text-xs bg-status-warning/20 hover:bg-status-warning/30 transition-colors"
          >
            Create anyway
          </button>
        </div>
      )}

      {creating && (
        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary py-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-4 h-4 border-2 border-white/10 border-t-accent rounded-full"
          />
          Creating project...
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

interface NewProjectWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewProjectWizard({
  open,
  onClose,
  onCreated,
}: NewProjectWizardProps) {
  const api = useAPI();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [folderConflict, setFolderConflict] = useState<string | null>(null);
  const [defaultDir, setDefaultDir] = useState('~/Projects');
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [locationMode, setLocationMode] = useState<ProjectLocationMode>('wsl');
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentType, AgentStatus> | null>(null);

  // Fetch default project dir, environment info, and agent statuses on open
  useEffect(() => {
    if (open) {
      api.preferences.get().then((prefs) => {
        setDefaultDir(prefs.defaultProjectDir);
        setLocationMode(prefs.projectLocationMode);
        // Pre-select default agent
        setData((d) => ({
          ...d,
          selectedAgents: [prefs.defaultAgent || 'claude'],
          launchAgent: prefs.defaultAgent || 'claude',
        }));
      });
      api.system.getEnvironment().then((env) => {
        setEnvInfo(env);
      });
      api.agent.checkAllStatuses().then((statuses) => {
        setAgentStatuses(statuses);
      });
    }
  }, [open, api]);

  // Update defaultDir when location mode changes
  function handleLocationModeChange(mode: ProjectLocationMode) {
    setLocationMode(mode);
    if (envInfo) {
      const newDir = mode === 'wsl' ? envInfo.wslProjectDir : envInfo.windowsProjectDir;
      if (newDir) {
        setDefaultDir(newDir);
        // Clear custom path so it picks up the new default
        setData((d) => ({ ...d, path: '' }));
      }
    }
  }

  function handleClose() {
    if (creating) return;
    setStep(0);
    setDirection(1);
    setData(INITIAL_DATA);
    setErrors({});
    setCreateError(null);
    onClose();
  }

  function updateData(updates: Partial<WizardData>) {
    setData((d) => ({ ...d, ...updates }));
    // Clear errors for changed fields
    const clearedErrors = { ...errors };
    for (const key of Object.keys(updates)) {
      delete clearedErrors[key];
    }
    setErrors(clearedErrors);
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!data.name.trim()) e.name = 'Project name is required';
    }
    if (s === 2) {
      if (data.githubChoice === 'create' && !data.newRepoName.trim() && !data.name.trim()) {
        e.repoName = 'Repository name is required';
      }
      if (data.githubChoice === 'link' && !data.linkedRepoUrl.trim()) {
        e.repoUrl = 'Select a repository or paste a URL';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (!validate(step)) return;
    // Auto-fill repo name/description from project if empty
    if (step === 1) {
      setData((d) => ({
        ...d,
        newRepoName: d.newRepoName || d.name,
        newRepoDescription: d.newRepoDescription || d.description,
      }));
    }
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  const defaultDirRef = useRef(defaultDir);
  defaultDirRef.current = defaultDir;
  const lastLaunchAgentRef = useRef(false);

  const doCreate = useCallback(
    async (launchAgent: boolean) => {
      try {
        const project = await api.projects.create({
          name: data.name.trim(),
          description: data.description.trim(),
          path: data.path.trim() || undefined,
          inputs: data.inputs,
          tags: [],
          preferredAgent: data.launchAgent,
          agents: data.selectedAgents,
        });

        // GitHub (best-effort)
        try {
          if (data.githubChoice === 'create') {
            const repoName = data.newRepoName.trim() || data.name.trim();
            const repo = await api.github.createRepo(
              repoName,
              data.newRepoPrivate,
              data.description.trim(),
              project.path,
            );
            await api.projects.update(project.id, {
              githubRepo: repo.fullName,
              githubUrl: repo.url,
            });
            toast('GitHub repo created');
          } else if (data.githubChoice === 'link' && data.linkedRepoUrl) {
            await api.github.linkRepo(project.path, data.linkedRepoUrl);
            const match = data.linkedRepoUrl.match(
              /github\.com[/:](.+?)(?:\.git)?$/,
            );
            if (match) {
              await api.projects.update(project.id, {
                githubRepo: match[1],
                githubUrl: data.linkedRepoUrl,
              });
            }
          }
        } catch {
          toast('GitHub setup failed — you can add it later', 'error');
        }

        if (launchAgent) {
          const agentConfig = AGENTS[data.launchAgent];
          try {
            await api.agent.start(project.id, data.launchAgent);
            toast(`${agentConfig.displayName} launched`);
          } catch {
            toast(`Failed to launch ${agentConfig.displayName}`, 'error');
          }
        }

        onCreated();
        handleClose();
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : 'Failed to create project',
        );
      } finally {
        setCreating(false);
      }
    },
    [data, api, onCreated],
  );

  const handleCreate = useCallback(
    async (launchAgent: boolean) => {
      lastLaunchAgentRef.current = launchAgent;
      setCreating(true);
      setCreateError(null);
      setFolderConflict(null);

      const targetPath = data.path.trim() || `${defaultDirRef.current}/${data.name.trim()}`;
      try {
        const pathCheck = await api.system.checkPathExists(targetPath);
        if (pathCheck.exists && pathCheck.hasContent) {
          setFolderConflict(targetPath);
          setCreating(false);
          return;
        }
      } catch {
        // If check fails, proceed anyway
      }

      await doCreate(launchAgent);
    },
    [data.path, data.name, api, doCreate],
  );

  const handleForceCreate = useCallback(() => {
    setFolderConflict(null);
    setCreating(true);
    doCreate(lastLaunchAgentRef.current);
  }, [doCreate]);

  // Keyboard: Escape to close, Enter to advance
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        if (step < 3) goNext();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, step, data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBrowse() {
    const dir = await api.system.selectDirectory();
    if (dir) updateData({ path: dir });
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="wizard-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="relative flex flex-col w-full max-w-2xl max-h-[85vh] bg-surface border border-white/8 rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between pr-4">
            <StepProgress current={step} />
            <button
              onClick={handleClose}
              className="text-text-muted hover:text-text-primary transition-colors p-1"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body — slides */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto min-h-0">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.25, 0.1, 0.25, 1] as const,
                }}
              >
                {step === 0 && (
                  <StepBasics
                    data={data}
                    defaultDir={defaultDir}
                    errors={errors}
                    onChange={updateData}
                    onBrowse={handleBrowse}
                    envInfo={envInfo}
                    locationMode={locationMode}
                    onLocationModeChange={handleLocationModeChange}
                  />
                )}
                {step === 1 && (
                  <StepInputs
                    inputs={data.inputs}
                    projectName={data.name}
                    description={data.description}
                    onInputsChange={(inputs) => updateData({ inputs })}
                  />
                )}
                {step === 2 && (
                  <StepGitHub
                    data={data}
                    errors={errors}
                    onChange={updateData}
                  />
                )}
                {step === 3 && (
                  <StepReview
                    data={data}
                    defaultDir={defaultDir}
                    creating={creating}
                    createError={createError}
                    folderConflict={folderConflict}
                    onForceCreate={handleForceCreate}
                    agentStatuses={agentStatuses}
                    onAgentsChange={(agents) => updateData({ selectedAgents: agents })}
                    onLaunchAgentChange={(agent) => updateData({ launchAgent: agent })}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-white/6">
            <button
              type="button"
              onClick={step === 0 ? handleClose : goBack}
              disabled={creating}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
              >
                Continue
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreate(false)}
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/6 text-sm font-medium text-text-primary transition-colors disabled:opacity-40"
                >
                  Create Only
                </button>
                <button
                  type="button"
                  onClick={() => handleCreate(true)}
                  disabled={creating}
                  className="px-4 py-2 rounded-lg text-bg text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ backgroundColor: AGENTS[data.launchAgent].color }}
                >
                  Create &amp; Launch {AGENTS[data.launchAgent].displayName}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
