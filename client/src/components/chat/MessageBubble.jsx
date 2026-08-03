import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, RotateCcw, Pencil, Volume2, Sparkles, User, FileText, Globe, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// "Searched the web · N sources" — collapsed by default, expands to show
// each result as a clickable chip with its favicon, like a citations row.
function SearchSources({ sources }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources?.length) return null;

  return (
    <div className="mb-2 inline-block">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-secondary/40 hover:bg-secondary/60 rounded-lg px-2.5 py-1.5"
      >
        <Search className="w-3.5 h-3.5 text-primary" />
        <span>Searched the web · {sources.length} source{sources.length === 1 ? '' : 's'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-secondary/60 hover:bg-secondary rounded-lg px-2.5 py-1.5 text-xs max-w-[220px] transition-colors"
                  title={s.title}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${getHostname(s.url)}&sz=32`}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="truncate">{s.title || getHostname(s.url)}</span>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className || '')?.[1] || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/60 text-xs text-muted-foreground">
        <span>{lang || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-foreground transition-colors">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-card p-3 overflow-x-auto text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export default function MessageBubble({ message, isLast, onRegenerate, onEditSave, isStreaming }) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = () => {
    setEditText(message.content);
    setIsEditing(true);
  };

  const submitEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onEditSave(message, trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group flex gap-3 py-4 px-4 md:px-0 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
        isUser ? 'bg-primary/10' : 'bg-primary'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 max-w-[85%] md:max-w-[75%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* File/image attachments */}
        {message.file_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.file_urls.map((url, i) => {
              const isImg = /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url) || url.includes('image');
              return isImg ? (
                <img key={i} src={url} alt="attachment" className="max-h-48 max-w-xs rounded-xl border border-border object-cover" />
              ) : (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-3 py-2 text-xs hover:bg-secondary transition-colors">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  File {i + 1}
                </a>
              );
            })}
          </div>
        )}

        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        } ${isEditing ? 'w-full' : ''}`}>
          {isUser ? (
            isEditing ? (
              <div className="w-full min-w-[240px]">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  rows={Math.min(8, Math.max(2, editText.split('\n').length))}
                  className="w-full resize-none bg-primary-foreground/10 text-primary-foreground text-sm leading-relaxed rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-foreground/40 placeholder:text-primary-foreground/50"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-7 px-3 text-xs bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={submitEdit}>
                    Save & submit
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            )
          ) : (
            <div className="text-sm">
              {/* Web search status — shows while the search is in flight, then
                  gives way to the permanent "Searched the web" source chips
                  once results are back. */}
              {message.searchStatus === 'start' && !message.content && (
                <div className="flex items-center gap-2 py-1 px-1 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
                  <span>Searching the web...</span>
                </div>
              )}
              {message.searchStatus === 'done' && <SearchSources sources={message.searchSources} />}

              {isStreaming && isLast && !message.content && message.searchStatus !== 'start' ? (
                /* Thinking indicator */
                <div className="flex items-center gap-1.5 py-1 px-1 text-muted-foreground">
                  <span>Thinking</span>
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="block w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              ) : message.searchStatus === 'start' && !message.content ? null : (
                <>
                  <ReactMarkdown
                    className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    components={{
                      code: ({ inline, className, children, ...props }) => {
                        if (!inline && /language-/.test(className || '')) {
                          return <CodeBlock className={className}>{children}</CodeBlock>;
                        }
                        return (
                          <code className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-mono" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-1.5">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1.5">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                      a: ({ children, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {children}
                        </a>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {isStreaming && isLast && message.content && (
                    <span className="typing-cursor inline-block w-0.5 h-4 bg-primary ml-0.5 align-text-bottom" />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isStreaming && !isEditing && (
          <div className={`flex items-center gap-1 mt-1.5 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            {isUser && onEditSave && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isUser && isLast && onRegenerate && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRegenerate}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isUser && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                if ('speechSynthesis' in window) {
                  const utter = new SpeechSynthesisUtterance(message.content);
                  speechSynthesis.speak(utter);
                }
              }}>
                <Volume2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}