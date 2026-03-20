import { useState, useCallback, memo } from 'react';
import {
  VscFolder, VscFolderOpened, VscFile,
  VscJson, VscMarkdown, VscSymbolMisc,
} from 'react-icons/vsc';
import {
  SiTypescript, SiJavascript, SiPython, SiRust, SiGo,
  SiCss, SiHtml5, SiReact,
} from 'react-icons/si';
import type { FileTreeNode, GitFileStatus } from '../../../shared/types';

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelect: (node: FileTreeNode) => void;
  onDoubleClick: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  contextFiles: FileTreeNode[];
  filterExtensions: string[];
}

export default function FileTree({
  nodes,
  selectedPath,
  onSelect,
  onDoubleClick,
  onContextMenu,
  contextFiles,
  filterExtensions,
}: FileTreeProps) {
  return (
    <div className="py-1 text-sm select-none">
      {/* Context files section */}
      {contextFiles.length > 0 && (
        <div className="mb-2">
          <div className="px-3 py-1 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Context Files
          </div>
          {contextFiles.map((node) => (
            <TreeFileNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              isContextFile
            />
          ))}
          <div className="mx-3 my-1 border-t border-white/[0.06]" />
        </div>
      )}

      {/* Main tree */}
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          filterExtensions={filterExtensions}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onDoubleClick,
  onContextMenu,
  filterExtensions,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileTreeNode) => void;
  onDoubleClick: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  filterExtensions: string[];
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  const toggle = useCallback(() => {
    if (node.type === 'directory') {
      setExpanded((prev) => !prev);
    }
  }, [node.type]);

  if (node.type === 'file') {
    // Apply extension filter
    if (filterExtensions.length > 0 && node.extension && !filterExtensions.includes(node.extension)) {
      return null;
    }

    return (
      <TreeFileNode
        node={node}
        depth={depth}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
    );
  }

  // Directory
  // Check if directory has any visible children after filtering
  const hasVisibleChildren = filterExtensions.length === 0 || hasMatchingFiles(node, filterExtensions);
  if (filterExtensions.length > 0 && !hasVisibleChildren) return null;

  return (
    <div>
      <button
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-[3px] hover:bg-white/[0.04] transition-colors text-left group`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="text-text-muted shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronIcon />
        </span>
        <span className="text-text-muted shrink-0">
          {expanded ? <VscFolderOpened className="w-4 h-4" /> : <VscFolder className="w-4 h-4" />}
        </span>
        <span className="text-text-secondary truncate text-xs">{node.name}</span>
      </button>

      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              filterExtensions={filterExtensions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TreeFileNode = memo(function TreeFileNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onDoubleClick,
  onContextMenu,
  isContextFile,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileTreeNode) => void;
  onDoubleClick: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  isContextFile?: boolean;
}) {
  const isSelected = selectedPath === node.path;

  return (
    <button
      onClick={() => onSelect(node)}
      onDoubleClick={() => onDoubleClick(node)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, node);
      }}
      className={`w-full flex items-center gap-1.5 px-2 py-[3px] transition-colors text-left group ${
        isSelected
          ? 'bg-accent/10 text-text-primary'
          : 'hover:bg-white/[0.04] text-text-secondary'
      } ${isContextFile ? 'bg-white/[0.02]' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
    >
      <span className="shrink-0">
        <FileIcon extension={node.extension} name={node.name} />
      </span>
      <span className="truncate text-xs">{node.name}</span>
      {node.gitStatus && (
        <GitStatusIndicator status={node.gitStatus} />
      )}
      {isContextFile && (
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent shrink-0">
          context
        </span>
      )}
    </button>
  );
});

function GitStatusIndicator({ status }: { status: GitFileStatus }) {
  const config: Record<GitFileStatus, { color: string; label: string }> = {
    modified: { color: 'text-status-in-progress', label: 'M' },
    added: { color: 'text-status-ready', label: '+' },
    untracked: { color: 'text-status-ready', label: 'U' },
    deleted: { color: 'text-status-error', label: 'D' },
    renamed: { color: 'text-status-created', label: 'R' },
  };
  const c = config[status];
  return (
    <span className={`ml-auto text-[10px] font-bold ${c.color} shrink-0`}>
      {c.label}
    </span>
  );
}

function FileIcon({ extension, name }: { extension: string | null; name: string }) {
  const cls = 'w-4 h-4';

  if (name.endsWith('.tsx') || name.endsWith('.jsx')) {
    return <SiReact className={cls} style={{ color: '#61DAFB' }} />;
  }

  switch (extension) {
    case '.ts':
      return <SiTypescript className={cls} style={{ color: '#3178C6' }} />;
    case '.js':
    case '.mjs':
    case '.cjs':
      return <SiJavascript className={cls} style={{ color: '#F7DF1E' }} />;
    case '.py':
      return <SiPython className={cls} style={{ color: '#3776AB' }} />;
    case '.rs':
      return <SiRust className={cls} style={{ color: '#DEA584' }} />;
    case '.go':
      return <SiGo className={cls} style={{ color: '#00ADD8' }} />;
    case '.css':
    case '.scss':
    case '.less':
      return <SiCss className={cls} style={{ color: '#1572B6' }} />;
    case '.html':
    case '.htm':
      return <SiHtml5 className={cls} style={{ color: '#E34F26' }} />;
    case '.json':
    case '.jsonc':
      return <VscJson className={cls} style={{ color: '#F5C518' }} />;
    case '.md':
    case '.mdx':
      return <VscMarkdown className={cls} style={{ color: '#83B5D3' }} />;
    default:
      if (name === 'Dockerfile' || name === 'Makefile') {
        return <VscSymbolMisc className={cls} style={{ color: '#8E8EA0' }} />;
      }
      return <VscFile className={cls} style={{ color: '#8E8EA0' }} />;
  }
}

function ChevronIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function hasMatchingFiles(node: FileTreeNode, extensions: string[]): boolean {
  if (node.type === 'file') {
    return node.extension !== null && extensions.includes(node.extension);
  }
  return node.children?.some((child) => hasMatchingFiles(child, extensions)) ?? false;
}
