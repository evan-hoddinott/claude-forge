import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatProviderInfo, OllamaStats } from '../../shared/types';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}

const api = window.electronAPI;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] px-1.5 py-0.5 border border-white/20 text-text-muted hover:text-text-secondary hover:border-white/40 transition-colors font-mono"
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const lang = className?.replace('language-', '') ?? '';
  return (
    <div className="my-2 border border-white/10 bg-black/30">
      <div className="flex items-center justify-between px-3 py-1 border-b border-white/10">
        <span className="text-[10px] text-text-muted font-mono uppercase">{lang || 'code'}</span>
        <CopyButton text={children} />
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-text-secondary">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[90%] px-3 py-2 border text-xs leading-relaxed ${
          isUser
            ? 'bg-white/8 border-white/15 text-text-primary'
            : 'bg-black/20 border-white/8 text-text-secondary'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-xs max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = !props.ref && String(children).includes('\n');
                  if (isBlock) {
                    return <CodeBlock className={className}>{String(children)}</CodeBlock>;
                  }
                  return (
                    <code className="px-1 py-0.5 bg-white/10 font-mono text-[10px]" {...props}>
                      {children}
                    </code>
                  );
                },
                p({ children }) {
                  return <p className="mb-1.5 last:mb-0 text-text-secondary text-xs">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-1.5 text-xs">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-1.5 text-xs">{children}</ol>;
                },
                h1({ children }) {
                  return <h1 className="text-sm font-bold text-text-primary mb-1">{children}</h1>;
                },
                h2({ children }) {
                  return <h2 className="text-xs font-bold text-text-primary mb-1">{children}</h2>;
                },
                h3({ children }) {
                  return <h3 className="text-xs font-semibold text-text-primary mb-1">{children}</h3>;
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      onClick={(e) => { e.preventDefault(); if (href) api.system.openExternal(href); }}
                      className="text-accent underline cursor-pointer"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-accent animate-pulse ml-0.5" />
            )}
          </div>
        )}
        {msg.model && !isUser && (
          <p className="text-[9px] text-text-muted mt-1 font-mono">{msg.model}</p>
        )}
      </div>
    </div>
  );
}

function ModelSelector({
  providers,
  selectedProvider,
  selectedModel,
  onSelect,
}: {
  providers: ChatProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onSelect: (providerId: string, modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-white/15 text-text-muted hover:text-text-secondary hover:border-white/30 transition-colors"
      >
        <span>{currentModel?.displayName ?? 'Select model'}</span>
        {currentModel?.isFree && (
          <span className="text-[8px] bg-green-900/50 text-green-400 px-1 border border-green-900">FREE</span>
        )}
        <svg className="w-2 h-2" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 2l3 3 3-3" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-56 bg-surface border border-white/15 z-50 shadow-xl overflow-y-auto max-h-72"
          >
            {providers.map(provider => (
              <div key={provider.id}>
                <div className="px-3 py-1.5 text-[9px] font-mono text-text-muted uppercase tracking-wider bg-white/[0.02] border-b border-white/[0.05] flex items-center gap-1">
                  {provider.id === 'ollama' && <span>🖥️</span>}
                  {provider.name}
                  {provider.isFree && <span className="text-green-400">[FREE]</span>}
                  {provider.id === 'ollama' && (
                    <>
                      <span className="text-green-400">[OFFLINE]</span>
                      <span className="text-green-400">[LOCAL]</span>
                    </>
                  )}
                  {!provider.isAvailable && provider.id !== 'ollama' && (
                    <span className="text-[8px] text-amber-400 ml-auto">[KEY NEEDED]</span>
                  )}
                </div>
                {provider.models.map(model => (
                  <button
                    key={model.id}
                    onClick={() => { onSelect(provider.id, model.id); setOpen(false); }}
                    disabled={!model.isAvailable}
                    className={`w-full text-left px-3 py-1.5 text-[10px] font-mono flex items-center gap-1 transition-colors ${
                      model.isAvailable
                        ? 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
                        : 'text-text-muted opacity-50 cursor-not-allowed'
                    } ${
                      model.id === selectedModel && provider.id === selectedProvider
                        ? 'bg-white/[0.06] text-text-primary'
                        : ''
                    }`}
                  >
                    {model.isLocal && <span className="text-[9px]">🖥️</span>}
                    <span>{model.displayName}</span>
                    {model.sizeGb && (
                      <span className="text-[8px] text-text-muted ml-1">({model.sizeGb} GB)</span>
                    )}
                    {model.isFree && !model.isLocal && (
                      <span className="text-[8px] bg-green-900/30 text-green-500 px-0.5 ml-auto">FREE</span>
                    )}
                    {model.isLocal && (
                      <span className="text-[8px] bg-green-900/30 text-green-500 px-0.5 ml-auto">LOCAL</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatPanel({ open, onClose, projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState<ChatProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('github');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [panelWidth, setPanelWidth] = useState(400);
  const [ollamaStats, setOllamaStats] = useState<OllamaStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(400);

  // Load providers and history on open
  useEffect(() => {
    if (!open) return;
    api.chat.getProviders().then(setProviders).catch(console.error);
    api.chat.getHistory(projectId).then(setMessages).catch(console.error);
  }, [open, projectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Set up token streaming
  useEffect(() => {
    api.chat.onToken(({ token, done, messageId }) => {
      if (done) {
        setStreamingContent(prev => {
          if (prev) {
            const finalContent = prev;
            setMessages(msgs => {
              const last = msgs[msgs.length - 1];
              if (last?.id === messageId) return msgs;
              return [...msgs, {
                id: messageId,
                role: 'assistant',
                content: finalContent,
                timestamp: new Date().toISOString(),
                model: selectedModel,
              }];
            });
          }
          return '';
        });
        setStreamingId(null);
        setIsLoading(false);
      } else {
        setStreamingId(messageId);
        setStreamingContent(prev => prev + token);
      }
    });
    return () => api.chat.offToken();
  }, [selectedModel]);

  // Poll Ollama stats when using a local model
  useEffect(() => {
    if (selectedProvider !== 'ollama') {
      setOllamaStats(null);
      return;
    }
    const poll = async () => {
      try {
        const stats = await api.ollama.getStats();
        setOllamaStats(stats);
      } catch {
        setOllamaStats(null);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [selectedProvider]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Save user messages to history
    try {
      await api.chat.send(projectId, selectedModel, selectedProvider, newMessages);
    } catch (err) {
      console.error('Chat send error:', err);
      setIsLoading(false);
    }
  }, [input, isLoading, messages, projectId, selectedModel, selectedProvider]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleSelectModel(providerId: string, modelId: string) {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
  }

  // Drag resize from left edge
  function handleDragStart(e: React.MouseEvent) {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    e.preventDefault();
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(600, Math.max(300, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    }
    function handleMouseUp() {
      isDragging.current = false;
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const streamingMessage: ChatMessage | null = streamingId
    ? {
        id: streamingId,
        role: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
        model: selectedModel,
      }
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ width: panelWidth }}
          className="absolute right-0 top-0 bottom-0 bg-surface border-l border-white/[0.08] flex flex-col z-40 shadow-2xl"
        >
          {/* Drag handle */}
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 transition-colors"
          />

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] shrink-0">
            <span className="text-xs font-mono font-semibold text-text-primary">AI CHAT</span>
            <div className="flex items-center gap-2">
              <ModelSelector
                providers={providers}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelect={handleSelectModel}
              />
              <button
                onClick={onClose}
                className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l8 8M9 1l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Ollama performance bar */}
          {selectedProvider === 'ollama' && ollamaStats?.modelName && (
            <div className="px-3 py-1 text-[9px] font-mono text-text-muted bg-black/20 border-b border-white/[0.05] flex items-center gap-2">
              <span>🖥️</span>
              <span>{ollamaStats.modelName}</span>
              {ollamaStats.tokensPerSecond && (
                <span className="text-green-500">{ollamaStats.tokensPerSecond} tok/s</span>
              )}
              {ollamaStats.vramUsedGb && (
                <span className="text-text-muted ml-auto">VRAM: {ollamaStats.vramUsedGb} GB</span>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && !streamingMessage && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="text-2xl mb-2 opacity-30">▲</div>
                <p className="text-xs font-mono text-text-muted">AI CHAT</p>
                <p className="text-[10px] text-text-muted mt-1">
                  Select a model above and start chatting.
                  {providers.find(p => p.id === 'github')?.isAvailable
                    ? ' GitHub Models are free!'
                    : ' Connect GitHub for free access.'}
                </p>
              </div>
            )}

            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {streamingMessage && (
              <MessageBubble msg={streamingMessage} isStreaming />
            )}

            {isLoading && !streamingContent && (
              <div className="flex justify-start mb-3">
                <div className="px-3 py-2 border border-white/8 bg-black/20">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1 h-1 bg-text-muted rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.08] p-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                disabled={isLoading}
                rows={2}
                className="flex-1 bg-black/20 border border-white/10 px-2 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-white/25 resize-none disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="px-2 py-1 border border-white/15 text-[10px] font-mono text-text-muted hover:text-text-primary hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
              >
                SEND
              </button>
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-text-muted font-mono">
                {projectId ? 'PROJECT CONTEXT' : 'GLOBAL'}
              </span>
              <button
                onClick={() => {
                  api.chat.clearHistory(projectId);
                  setMessages([]);
                  setStreamingContent('');
                }}
                className="text-[9px] text-text-muted hover:text-text-secondary font-mono transition-colors"
              >
                CLEAR
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
