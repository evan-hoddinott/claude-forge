import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useAPI, useMutation } from '../../hooks/useAPI';
import { useToast } from '../Toast';
import type { FileTreeNode, FileReadResult, UserPreferences, Project } from '../../../shared/types';
import { AGENTS } from '../../../shared/types';
import { useTheme } from '../../contexts/ThemeContext';

// Configure Monaco workers for Electron/Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).MonacoEnvironment = {
  getWorker(_workerId: string, _label: string) {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface FilePreviewProps {
  selectedFile: FileTreeNode | null;
  preferences: UserPreferences | null;
  project: Project;
  totalFiles: number;
  totalLines: number;
  detectedLanguages: string[];
}

export default function FilePreview({
  selectedFile,
  preferences,
  project,
  totalFiles,
  totalLines,
  detectedLanguages,
}: FilePreviewProps) {
  const api = useAPI();
  const { toast } = useToast();
  const [fileContent, setFileContent] = useState<FileReadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Determine if selected file is a context file
  const contextFileAgent = selectedFile
    ? Object.values(AGENTS).find((a) => selectedFile.name === a.contextFileName)
    : null;

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'file') {
      setFileContent(null);
      setEditMode(false);
      setHasUnsavedChanges(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setEditMode(false);
    setHasUnsavedChanges(false);

    api.files.read(selectedFile.path).then((result) => {
      if (!cancelled) {
        setFileContent(result);
        setEditorContent(result.content);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setFileContent({ content: 'Error reading file', language: 'plaintext', lineCount: 0 });
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedFile?.path, api]);

  const saveFile = useMutation(async () => {
    if (!selectedFile) return;
    await api.files.save(selectedFile.path, editorContent);
    setHasUnsavedChanges(false);
    toast('File saved');
  });

  const regenerateContext = useMutation(async () => {
    if (!contextFileAgent) return;
    await api.files.regenerateContext(project.id, contextFileAgent.type);
    // Reload the file content
    const result = await api.files.read(selectedFile!.path);
    setFileContent(result);
    setEditorContent(result.content);
    setHasUnsavedChanges(false);
    toast('Context file regenerated');
  });

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
      setHasUnsavedChanges(value !== fileContent?.content);
    }
  }, [fileContent?.content]);

  const toggleEditMode = useCallback(() => {
    if (editMode && hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
      setEditorContent(fileContent?.content ?? '');
      setHasUnsavedChanges(false);
    }
    setEditMode((prev) => !prev);
  }, [editMode, hasUnsavedChanges, fileContent?.content]);

  // Keyboard shortcut for save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editMode && hasUnsavedChanges) {
        e.preventDefault();
        saveFile.mutate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        toggleEditMode();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, hasUnsavedChanges, saveFile, toggleEditMode]);

  // Empty state
  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-text-muted text-sm">Select a file to preview</div>
          <div className="grid grid-cols-2 gap-3 text-xs max-w-xs mx-auto">
            <StatCard label="Total files" value={totalFiles.toLocaleString()} />
            <StatCard label="Lines of code" value={totalLines > 0 ? `~${totalLines.toLocaleString()}` : '--'} />
            <StatCard
              label="Languages"
              value={detectedLanguages.length > 0 ? detectedLanguages.slice(0, 4).join(', ') : '--'}
              span
            />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="h-10 border-b border-white/[0.06] bg-white/[0.02] animate-pulse" />
        <div className="flex-1 bg-white/[0.01] animate-pulse" />
      </div>
    );
  }

  const fontSize = preferences?.fileExplorerFontSize ?? 13;
  const minimap = preferences?.fileExplorerMinimap ?? true;
  const wordWrap = preferences?.fileExplorerWordWrap ? 'on' : 'off';

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Context file banner */}
      {contextFileAgent && (
        <div
          className="px-4 py-2 text-xs border-b flex items-center gap-2"
          style={{
            backgroundColor: contextFileAgent.color + '10',
            borderColor: contextFileAgent.color + '30',
            color: contextFileAgent.color,
          }}
        >
          <span className="flex-1">
            Context file for <strong>{contextFileAgent.displayName}</strong> — read by the agent when working on your project.
          </span>
          <button
            onClick={() => {
              if (confirm('Regenerate this context file from project inputs? This will overwrite the current contents.')) {
                regenerateContext.mutate();
              }
            }}
            disabled={regenerateContext.loading}
            className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0"
            style={{
              backgroundColor: contextFileAgent.color + '20',
              color: contextFileAgent.color,
            }}
          >
            {regenerateContext.loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className={`shrink-0 flex items-center justify-between px-4 py-2 border-b ${editMode ? 'border-status-in-progress/30 bg-status-in-progress/5' : 'border-white/[0.06]'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-text-secondary truncate font-mono">
            {selectedFile.relativePath}
          </span>
          {fileContent && (
            <span className="text-[10px] text-text-muted shrink-0">
              ({fileContent.lineCount} lines, {formatSize(selectedFile.size)})
            </span>
          )}
          {fileContent?.isTruncated && (
            <span className="text-[10px] text-status-in-progress shrink-0">
              Truncated (file &gt; 1MB)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editMode && hasUnsavedChanges && (
            <>
              <button
                onClick={() => saveFile.mutate()}
                disabled={saveFile.loading}
                className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-bg text-[11px] font-semibold transition-colors"
              >
                {saveFile.loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditorContent(fileContent?.content ?? '');
                  setHasUnsavedChanges(false);
                }}
                className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-text-muted transition-colors"
              >
                Discard
              </button>
            </>
          )}
          <ActionButton
            onClick={() => api.files.openVSCode(selectedFile.path)}
            title="Open in VS Code"
          >
            VS Code
          </ActionButton>
          <ActionButton
            onClick={() => api.files.openDefaultEditor(selectedFile.path)}
            title="Open in default editor"
          >
            Editor
          </ActionButton>
          <ActionButton
            onClick={toggleEditMode}
            title={editMode ? 'Exit edit mode (Ctrl+E)' : 'Edit file (Ctrl+E)'}
            active={editMode}
            prominent={!!contextFileAgent && !editMode}
          >
            {editMode ? 'Read-only' : 'Edit'}
          </ActionButton>
          <ActionButton
            onClick={() => {
              navigator.clipboard.writeText(fileContent?.content ?? '');
              toast('Copied to clipboard');
            }}
            title="Copy file contents"
          >
            Copy
          </ActionButton>
        </div>
      </div>

      {/* Monaco Editor with timeout fallback */}
      <div className="flex-1 min-h-0">
        <MonacoWithFallback
          language={fileContent?.language ?? 'plaintext'}
          value={editMode ? editorContent : fileContent?.content ?? ''}
          onChange={editMode ? handleEditorChange : undefined}
          editMode={editMode}
          fontSize={fontSize}
          minimap={minimap}
          wordWrap={wordWrap}
        />
      </div>
    </div>
  );
}

function MonacoWithFallback({
  language,
  value,
  onChange,
  editMode,
  fontSize,
  minimap,
  wordWrap,
}: {
  language: string;
  value: string;
  onChange?: (value: string | undefined) => void;
  editMode: boolean;
  fontSize: number;
  minimap: boolean;
  wordWrap: string;
}) {
  const { theme } = useTheme();
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = false;
    setTimedOut(false);
    const timer = setTimeout(() => {
      if (!mountedRef.current) setTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [retryKey]);

  if (timedOut) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-white/6 flex items-center gap-3 text-xs text-text-muted">
          <span>Editor is taking a while...</span>
          <button
            onClick={() => { setTimedOut(false); setRetryKey((k) => k + 1); }}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-secondary transition-colors"
          >
            Retry
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap bg-[#0d0d14]">
          {value}
        </pre>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="h-full flex flex-col">
          {/* Code editor skeleton */}
          <div className="flex-1 p-4 space-y-2" style={{ backgroundColor: theme === 'forge' ? '#1e2418' : '#0d0d14' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-3 rounded bg-white/[0.04]" />
                <div
                  className="h-3 rounded bg-white/[0.04] animate-pulse"
                  style={{ width: `${30 + Math.random() * 50}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <MonacoEditor
        key={retryKey}
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        theme={theme === 'forge' ? 'claude-forge-retro' : 'claude-forge-dark'}
        onMount={() => { mountedRef.current = true; }}
        options={{
          readOnly: !editMode,
          fontSize,
          fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
          fontLigatures: true,
          minimap: { enabled: minimap },
          wordWrap: wordWrap as 'on' | 'off',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          tabSize: 2,
          bracketPairColorization: { enabled: true },
          padding: { top: 8 },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('claude-forge-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#0d0d14',
              'editor.foreground': '#ededef',
              'editor.lineHighlightBackground': '#ffffff06',
              'editor.selectionBackground': '#38bdf830',
              'editor.inactiveSelectionBackground': '#38bdf815',
              'editorLineNumber.foreground': '#4e4e62',
              'editorLineNumber.activeForeground': '#8e8ea0',
              'editorCursor.foreground': '#38bdf8',
              'editorIndentGuide.background': '#ffffff08',
              'editorIndentGuide.activeBackground': '#ffffff15',
              'editor.selectionHighlightBackground': '#38bdf815',
              'editorWidget.background': '#13131a',
              'editorWidget.border': '#ffffff10',
              'minimap.background': '#0a0a0f',
            },
          });
          monaco.editor.defineTheme('claude-forge-retro', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#1e2418',
              'editor.foreground': '#d4cba8',
              'editor.lineHighlightBackground': '#2d362510',
              'editor.selectionBackground': '#5a7a3a40',
              'editor.inactiveSelectionBackground': '#5a7a3a20',
              'editorLineNumber.foreground': '#6b6450',
              'editorLineNumber.activeForeground': '#9c9478',
              'editorCursor.foreground': '#daa520',
              'editorIndentGuide.background': '#4a5a3830',
              'editorIndentGuide.activeBackground': '#4a5a3860',
              'editor.selectionHighlightBackground': '#5a7a3a20',
              'editorWidget.background': '#232a1c',
              'editorWidget.border': '#4a5a38',
              'minimap.background': '#1a1e14',
            },
          });
        }}
      />
    </Suspense>
  );
}

function StatCard({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={`rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 ${span ? 'col-span-2' : ''}`}>
      <div className="text-text-muted mb-0.5">{label}</div>
      <div className="text-text-secondary font-medium">{value}</div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  title,
  active,
  prominent,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
  prominent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? 'bg-status-in-progress/20 text-status-in-progress'
          : prominent
            ? 'bg-accent/20 text-accent hover:bg-accent/30'
            : 'bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
