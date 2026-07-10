import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, RotateCcw, Pencil, Volume2, Sparkles, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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

export default function MessageBubble({ message, isLast, onRegenerate, onEdit, isStreaming }) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied to clipboard');
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
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm">
              {isStreaming && isLast && !message.content ? (
                /* Typing dots bubble */
                <div className="flex items-center gap-1.5 py-1 px-1">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="block w-2 h-2 rounded-full bg-muted-foreground/60"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              ) : (
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
        {!isStreaming && (
          <div className={`flex items-center gap-1 mt-1.5 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {isUser && onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(message)}>
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