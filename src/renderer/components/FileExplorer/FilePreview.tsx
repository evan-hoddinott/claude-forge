import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAPI, useMutation } from '../../hooks/useAPI';
import { useToast } from '../Toast';
import type { FileTreeNode, FileReadResult, UserPreferences } from '../../../shared/types';
import { AGENTS } from '../../../shared/types';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface FilePreviewProps {
  selectedFile: FileTreeNode | null;
  preferences: UserPreferences | null;
  totalFiles: number;
  totalLines: number;
  detectedLanguages: string[];
}

export default function FilePreview({
  selectedFile,
  preferences,
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
          <span>
            Context file for <strong>{contextFileAgent.displayName}</strong> — read by the agent when working on your project.
          </span>
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

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              Loading editor...
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            language={fileContent?.language ?? 'plaintext'}
            value={editMode ? editorContent : fileContent?.content ?? ''}
            onChange={editMode ? handleEditorChange : undefined}
            theme="claude-forge-dark"
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
              // Define custom theme matching app dark theme
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
            }}
          />
        </Suspense>
      </div>
    </div>
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
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? 'bg-status-in-progress/20 text-status-in-progress'
          : 'bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
