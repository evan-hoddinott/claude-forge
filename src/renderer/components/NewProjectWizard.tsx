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

const STEP_LABELS = ['Basics', 'Inputs', 'GitHub', 'Review'];

const INPUT_PRESETS: { label: string; type: ProjectInput['type']; options?: string[] }[] = [
  { label: 'Tech Stack', type: 'text' },
  { label: 'Template', type: 'select', options: ['React', 'Vue', 'Next.js', 'Node', 'Python', 'Custom'] },
  { label: 'System Prompt', type: 'textarea' },
  { label: 'Dependencies', type: 'textarea' },
  { label: 'Features', type: 'textarea' },
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
        {/* Header row: grip, label, type, delete */}
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
          <input
            type="text"
            value={input.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Label"
            className="flex-1 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted outline-none min-w-0"
          />
          <select
            value={input.type}
            onChange={(e) =>
              onUpdate({ type: e.target.value as ProjectInput['type'] })
            }
            className="text-xs bg-white/5 border border-white/6 rounded-md px-2 py-1 text-text-secondary outline-none"
          >
            <option value="text">Text</option>
            <option value="textarea">Long Text</option>
            <option value="select">Dropdown</option>
          </select>
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

        {/* Options (dropdown type only) */}
        {input.type === 'select' && (
          <input
            type="text"
            value={input.options?.join(', ') ?? ''}
            onChange={(e) =>
              onUpdate({
                options: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Options (comma-separated)"
            className={`${INPUT_CLS} text-xs`}
          />
        )}

        {/* Value */}
        {input.type === 'textarea' ? (
          <textarea
            value={input.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Value..."
            rows={2}
            className={`${INPUT_CLS} resize-none text-xs`}
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
        ) : (
          <input
            type="text"
            value={input.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Value..."
            className={`${INPUT_CLS} text-xs`}
          />
        )}
      </motion.div>
    </Reorder.Item>
  );
}

function StepInputs({
  inputs,
  onInputsChange,
}: {
  inputs: ProjectInput[];
  onInputsChange: (inputs: ProjectInput[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    type: 'text' as ProjectInput['type'],
    value: '',
    optionsText: '',
  });

  function addInput() {
    if (!draft.label.trim()) return;
    const newInput: ProjectInput = {
      id: uuidv4(),
      label: draft.label.trim(),
      type: draft.type,
      value: draft.value,
      options:
        draft.type === 'select'
          ? draft.optionsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    };
    onInputsChange([...inputs, newInput]);
    setDraft({ label: '', type: 'text', value: '', optionsText: '' });
    setShowForm(false);
  }

  function quickAdd(preset: (typeof INPUT_PRESETS)[number]) {
    setDraft({
      label: preset.label,
      type: preset.type,
      value: '',
      optionsText: preset.options?.join(', ') ?? '',
    });
    setShowForm(true);
  }

  function updateInput(id: string, updates: Partial<ProjectInput>) {
    onInputsChange(
      inputs.map((inp) => (inp.id === id ? { ...inp, ...updates } : inp)),
    );
  }

  function deleteInput(id: string) {
    onInputsChange(inputs.filter((inp) => inp.id !== id));
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs text-text-secondary mb-3">
          Add custom inputs that will shape your project&apos;s CLAUDE.md. These
          are flexible key-value pairs — add whatever context Claude needs.
        </p>

        {/* Quick-add presets */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {INPUT_PRESETS.map((preset) => {
            const alreadyAdded = inputs.some(
              (i) => i.label === preset.label,
            );
            return (
              <button
                key={preset.label}
                type="button"
                disabled={alreadyAdded}
                onClick={() => quickAdd(preset)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  alreadyAdded
                    ? 'bg-white/3 text-text-muted cursor-default'
                    : 'bg-accent/10 text-accent hover:bg-accent/20'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Existing inputs (draggable list) */}
      {inputs.length > 0 && (
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

      {/* Add input form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border border-accent/20 bg-accent/[0.03] space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, label: e.target.value }))
                  }
                  placeholder="Input label (e.g. Tech Stack)"
                  className={`${INPUT_CLS} flex-1`}
                  autoFocus
                />
                <select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      type: e.target.value as ProjectInput['type'],
                    }))
                  }
                  className="bg-white/5 border border-white/6 rounded-lg px-2 py-2 text-sm text-text-secondary outline-none"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>

              {draft.type === 'select' && (
                <input
                  type="text"
                  value={draft.optionsText}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, optionsText: e.target.value }))
                  }
                  placeholder="Options (comma-separated, e.g. React, Vue, Svelte)"
                  className={INPUT_CLS}
                />
              )}

              {draft.type === 'textarea' ? (
                <textarea
                  value={draft.value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, value: e.target.value }))
                  }
                  placeholder="Value..."
                  rows={3}
                  className={`${INPUT_CLS} resize-none`}
                />
              ) : (
                <input
                  type="text"
                  value={draft.value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, value: e.target.value }))
                  }
                  placeholder="Value..."
                  className={INPUT_CLS}
                />
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addInput}
                  disabled={!draft.label.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add button */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/10 text-sm text-text-muted hover:text-text-secondary hover:border-white/20 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Input
        </button>
      )}
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
  agentStatuses,
  onAgentsChange,
  onLaunchAgentChange,
}: {
  data: WizardData;
  defaultDir: string;
  creating: boolean;
  createError: string | null;
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

  const handleCreate = useCallback(
    async (launchAgent: boolean) => {
      setCreating(true);
      setCreateError(null);

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
    [data, api, onCreated], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
