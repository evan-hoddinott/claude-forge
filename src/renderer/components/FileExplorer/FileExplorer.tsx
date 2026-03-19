import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VscSearch, VscRefresh, VscFolderOpened, VscListFlat, VscListTree } from 'react-icons/vsc';
import { useAPI, useQuery } from '../../hooks/useAPI';
import { useToast } from '../Toast';
import FileTree from './FileTree';
import FilePreview from './FilePreview';
import type { FileTreeNode, SearchResult, Project, AgentType } from '../../../shared/types';
import { AGENTS } from '../../../shared/types';

interface FileExplorerProps {
  project: Project;
}

// Context file names that should be pinned at top
const CONTEXT_FILE_NAMES = Object.values(AGENTS).map((a) => a.contextFileName);

export default function FileExplorer({ project }: FileExplorerProps) {
  const api = useAPI();
  const { toast } = useToast();

  // State
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInContents, setSearchInContents] = useState(false);
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [nameResults, setNameResults] = useState<FileTreeNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filterExtensions, setFilterExtensions] = useState<string[]>([]);
  const [flatView, setFlatView] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    node: FileTreeNode;
  } | null>(null);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch file tree
  const {
    data: fileTree,
    loading: treeLoading,
    refetch: refetchTree,
  } = useQuery(() => api.files.tree(project.path), [project.path]);

  // Fetch preferences
  const { data: preferences } = useQuery(() => api.preferences.get());

  // Set up file watcher
  useEffect(() => {
    api.files.watch(project.path);
    api.files.onFileChange(() => {
      refetchTree();
    });

    return () => {
      api.files.unwatch(project.path);
      api.files.offFileChange();
    };
  }, [project.path, api, refetchTree]);

  // Extract context files from tree
  const contextFiles = useMemo(() => {
    if (!fileTree) return [];
    return fileTree.filter((node) => CONTEXT_FILE_NAMES.includes(node.name));
  }, [fileTree]);

  // Filter out context files from main tree display
  const mainTree = useMemo(() => {
    if (!fileTree) return [];
    return fileTree.filter((node) => !CONTEXT_FILE_NAMES.includes(node.name));
  }, [fileTree]);

  // Compute project stats
  const stats = useMemo(() => {
    if (!fileTree) return { totalFiles: 0, totalLines: 0, languages: [] as string[] };

    let totalFiles = 0;
    const langSet = new Set<string>();
    const extCounts = new Map<string, number>();

    function walk(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          totalFiles++;
          if (node.extension) {
            extCounts.set(node.extension, (extCounts.get(node.extension) ?? 0) + 1);
            const lang = extToLanguage(node.extension);
            if (lang) langSet.add(lang);
          }
        }
        if (node.children) walk(node.children);
      }
    }

    walk(fileTree);

    return {
      totalFiles,
      totalLines: 0, // Would require reading all files, skip
      languages: Array.from(langSet),
    };
  }, [fileTree]);

  // Compute common extensions for filter pills
  const commonExtensions = useMemo(() => {
    if (!fileTree) return [];
    const extCounts = new Map<string, number>();

    function walk(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'file' && node.extension) {
          extCounts.set(node.extension, (extCounts.get(node.extension) ?? 0) + 1);
        }
        if (node.children) walk(node.children);
      }
    }

    walk(fileTree);

    return Array.from(extCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([ext]) => ext);
  }, [fileTree]);

  // Build flat list of all file nodes for arrow key navigation
  const allFiles = useMemo(() => {
    if (!fileTree) return [];
    const files: FileTreeNode[] = [];
    function walk(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') files.push(node);
        if (node.children) walk(node.children);
      }
    }
    for (const node of contextFiles) files.push(node);
    walk(mainTree);
    return files;
  }, [fileTree, contextFiles, mainTree]);

  // Search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setNameResults([]);
      setContentResults([]);
      setIsSearching(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (searchInContents) {
          const results = await api.files.searchContents(project.path, searchQuery);
          setContentResults(results);
        } else {
          const results = await api.files.searchNames(project.path, searchQuery);
          setNameResults(results);
        }
      } catch {
        // search failed
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, searchInContents, project.path, api]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+P - Quick file search
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchInContents(false);
      }
      // Ctrl+Shift+F - Content search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchInContents(true);
      }
      // Ctrl+Enter - Open selected file in VS Code
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (selectedFile) {
          api.files.openVSCode(selectedFile.path);
        }
      }
      // Arrow keys - Navigate file list (only when search input is not focused)
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        const files = allFiles;
        if (files.length === 0) return;
        const currentIdx = selectedFile ? files.findIndex((f) => f.path === selectedFile.path) : -1;
        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < files.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : files.length - 1;
        }
        setSelectedFile(files[nextIdx]);
      }
      // Enter - Open selected file in preview (already selected, this is a no-op if file is selected)
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInputRef.current) {
        // Already handled by selection, no additional action needed
      }
      // Escape
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        } else if (contextMenuState) {
          setContextMenuState(null);
        } else if (selectedFile) {
          setSelectedFile(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, contextMenuState, selectedFile, api, allFiles]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenuState) return;
    const handler = () => setContextMenuState(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenuState]);

  const handleSelect = useCallback((node: FileTreeNode) => {
    if (node.type === 'file') {
      setSelectedFile(node);
    }
  }, []);

  const handleDoubleClick = useCallback((node: FileTreeNode) => {
    if (node.type === 'file') {
      api.files.openVSCode(node.path);
    }
  }, [api]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    setContextMenuState({ x: e.clientX, y: e.clientY, node });
  }, []);

  const toggleFilter = useCallback((ext: string) => {
    setFilterExtensions((prev) =>
      prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext],
    );
  }, []);

  // Resizable panel
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(200, startWidth + e.clientX - startX), 600);
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  // Flatten tree for flat view
  const flatFileList = useMemo(() => {
    if (!flatView || !fileTree) return [];
    const files: FileTreeNode[] = [];
    function walk(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') files.push(node);
        if (node.children) walk(node.children);
      }
    }
    walk(fileTree);
    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [flatView, fileTree]);


  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="h-full flex" style={{ userSelect: isResizing ? 'none' : undefined }}>
      {/* LEFT PANEL — File Tree */}
      <div
        className="flex flex-col border-r border-white/[0.06] shrink-0"
        style={{ width: panelWidth }}
      >
        {/* Toolbar */}
        <div className="shrink-0 border-b border-white/[0.06] p-2 space-y-2">
          {/* Search */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 bg-white/5 border border-white/[0.08] rounded-lg px-2.5 py-1.5">
              <VscSearch className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchInContents ? 'Search in files...' : 'Search files...'}
                className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-text-muted hover:text-text-secondary text-xs"
                >
                  x
                </button>
              )}
            </div>
            <ToolbarButton
              onClick={() => setFlatView((v) => !v)}
              title={flatView ? 'Tree view' : 'Flat view'}
              active={flatView}
            >
              {flatView ? <VscListTree className="w-3.5 h-3.5" /> : <VscListFlat className="w-3.5 h-3.5" />}
            </ToolbarButton>
            <ToolbarButton onClick={refetchTree} title="Refresh">
              <VscRefresh className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => api.files.openFolderVSCode(project.path)}
              title="Open in VS Code"
            >
              <VscFolderOpened className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          {/* Search mode toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchInContents(false)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                !searchInContents
                  ? 'bg-white/8 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setSearchInContents(true)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                searchInContents
                  ? 'bg-white/8 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              In Files
            </button>
            <div className="flex-1" />
            {/* Filter pills */}
            {commonExtensions.map((ext) => (
              <button
                key={ext}
                onClick={() => toggleFilter(ext)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  filterExtensions.includes(ext)
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
                }`}
              >
                {ext}
              </button>
            ))}
            {filterExtensions.length > 0 && (
              <button
                onClick={() => setFilterExtensions([])}
                className="px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-secondary"
              >
                All
              </button>
            )}
          </div>
        </div>

        {/* Tree or search results */}
        <div className="flex-1 overflow-y-auto">
          {treeLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="h-5 rounded bg-white/[0.03] animate-pulse"
                  style={{ width: `${60 + Math.random() * 30}%`, animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          ) : showSearchResults ? (
            <SearchResults
              searchInContents={searchInContents}
              nameResults={nameResults}
              contentResults={contentResults}
              isSearching={isSearching}
              onSelect={handleSelect}
              selectedPath={selectedFile?.path ?? null}
            />
          ) : flatView ? (
            <FileTree
              nodes={flatFileList}
              selectedPath={selectedFile?.path ?? null}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              contextFiles={[]}
              filterExtensions={filterExtensions}
            />
          ) : (
            <FileTree
              nodes={mainTree}
              selectedPath={selectedFile?.path ?? null}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              contextFiles={contextFiles}
              filterExtensions={filterExtensions}
            />
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="w-1 cursor-col-resize hover:bg-accent/20 transition-colors shrink-0"
      />

      {/* RIGHT PANEL — File Preview */}
      <div className="flex-1 min-w-0">
        <FilePreview
          selectedFile={selectedFile}
          preferences={preferences}
          project={project}
          totalFiles={stats.totalFiles}
          totalLines={stats.totalLines}
          detectedLanguages={stats.languages}
        />
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenuState && (
          <ContextMenuOverlay
            x={contextMenuState.x}
            y={contextMenuState.y}
            node={contextMenuState.node}
            project={project}
            api={api}
            toast={toast}
            onClose={() => setContextMenuState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Search Results ---

function SearchResults({
  searchInContents,
  nameResults,
  contentResults,
  isSearching,
  onSelect,
  selectedPath,
}: {
  searchInContents: boolean;
  nameResults: FileTreeNode[];
  contentResults: SearchResult[];
  isSearching: boolean;
  onSelect: (node: FileTreeNode) => void;
  selectedPath: string | null;
}) {
  if (isSearching) {
    return (
      <div className="p-4 text-xs text-text-muted">Searching...</div>
    );
  }

  if (!searchInContents) {
    if (nameResults.length === 0) {
      return <div className="p-4 text-xs text-text-muted">No files found</div>;
    }
    return (
      <div className="py-1">
        {nameResults.map((node) => (
          <button
            key={node.path}
            onClick={() => onSelect(node)}
            className={`w-full flex flex-col px-3 py-1.5 text-left transition-colors ${
              selectedPath === node.path ? 'bg-accent/10' : 'hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-xs text-text-primary truncate">{node.name}</span>
            <span className="text-[10px] text-text-muted truncate">{node.relativePath}</span>
          </button>
        ))}
      </div>
    );
  }

  // Content search results
  if (contentResults.length === 0) {
    return <div className="p-4 text-xs text-text-muted">No matches found</div>;
  }

  // Group by file
  const grouped = new Map<string, SearchResult[]>();
  for (const result of contentResults) {
    const existing = grouped.get(result.relativePath) ?? [];
    existing.push(result);
    grouped.set(result.relativePath, existing);
  }

  return (
    <div className="py-1">
      {Array.from(grouped.entries()).map(([relativePath, results]) => (
        <div key={relativePath}>
          <div className="px-3 py-1 text-[10px] font-medium text-text-muted truncate bg-white/[0.02]">
            {relativePath}
          </div>
          {results.map((result, i) => (
            <button
              key={`${result.filePath}:${result.lineNumber}:${i}`}
              onClick={() =>
                onSelect({
                  name: result.relativePath.split('/').pop() ?? '',
                  path: result.filePath,
                  relativePath: result.relativePath,
                  type: 'file',
                  extension: null,
                  size: 0,
                  modifiedAt: '',
                })
              }
              className="w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-[10px] text-text-muted shrink-0 w-8 text-right">
                {result.lineNumber}
              </span>
              <span className="text-xs text-text-secondary truncate font-mono">
                {result.lineContent.trim()}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Context Menu ---

function ContextMenuOverlay({
  x,
  y,
  node,
  project,
  api,
  toast,
  onClose,
}: {
  x: number;
  y: number;
  node: FileTreeNode;
  project: Project;
  api: ReturnType<typeof useAPI>;
  toast: (msg: string) => void;
  onClose: () => void;
}) {
  const isFile = node.type === 'file';
  const projectAgents = project.agents || [project.preferredAgent || 'claude'];

  // Adjust position to stay on screen
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50"
      style={menuStyle}
    >
      <div className="bg-surface border border-white/[0.1] rounded-xl shadow-2xl py-1 min-w-[180px] backdrop-blur-xl">
        <MenuItem
          label="Open in VS Code"
          onClick={() => {
            if (isFile) api.files.openVSCode(node.path);
            else api.files.openFolderVSCode(node.path);
            onClose();
          }}
        />
        {isFile && (
          <MenuItem
            label="Open in Default Editor"
            onClick={() => {
              api.files.openDefaultEditor(node.path);
              onClose();
            }}
          />
        )}
        <MenuItem
          label="Open in Terminal"
          onClick={() => {
            api.files.openInTerminal(node.path);
            onClose();
          }}
        />
        {isFile && (
          <MenuItem
            label="Open Containing Folder"
            onClick={() => {
              // Open parent directory in file manager
              const parentDir = node.path.substring(0, node.path.lastIndexOf('/'));
              api.files.openFolderVSCode(parentDir);
              onClose();
            }}
          />
        )}

        <div className="my-1 mx-2 border-t border-white/[0.06]" />

        <MenuItem
          label="Copy Path"
          onClick={() => {
            navigator.clipboard.writeText(node.path);
            toast('Path copied');
            onClose();
          }}
        />
        <MenuItem
          label="Copy Relative Path"
          onClick={() => {
            navigator.clipboard.writeText(node.relativePath);
            toast('Relative path copied');
            onClose();
          }}
        />

        {isFile && projectAgents.length > 0 && (
          <>
            <div className="my-1 mx-2 border-t border-white/[0.06]" />
            <div className="px-3 py-1 text-[10px] text-text-muted font-medium">
              Send to Agent
            </div>
            {projectAgents.map((agentType: AgentType) => {
              const config = AGENTS[agentType];
              return (
                <MenuItem
                  key={agentType}
                  label={config.displayName}
                  color={config.color}
                  onClick={async () => {
                    const prompt = window.prompt(
                      `What should ${config.displayName} do with this file?`,
                      `Look at ${node.relativePath} and `,
                    );
                    if (prompt) {
                      try {
                        await api.agent.start(project.id, agentType);
                        toast(`${config.displayName} launched`);
                      } catch (err) {
                        toast(`Failed to launch: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }
                    onClose();
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    </motion.div>
  );
}

function MenuItem({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors"
      style={color ? { color } : undefined}
    >
      {label}
    </button>
  );
}

function ToolbarButton({
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
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

// --- Helpers ---

function extToLanguage(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.rs': 'Rust', '.go': 'Go',
    '.css': 'CSS', '.html': 'HTML', '.md': 'Markdown',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.sql': 'SQL', '.sh': 'Shell', '.rb': 'Ruby',
    '.java': 'Java', '.c': 'C', '.cpp': 'C++',
    '.cs': 'C#', '.swift': 'Swift', '.kt': 'Kotlin',
    '.dart': 'Dart', '.php': 'PHP', '.lua': 'Lua',
  };
  return map[ext] ?? null;
}
