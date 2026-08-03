import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { conversations as conversationsApi, streamChat, generateTitle } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/chat/Sidebar';
import { incrementMessageCount } from '@/lib/usageTracker';
import ModelSelector from '@/components/chat/ModelSelector';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import EmptyState from '@/components/chat/EmptyState';
import Settings from '@/pages/Settings';

export default function Chat() {
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState('synch-4');
  const [webSearch, setWebSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(false);
  const isStreamingRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => conversationsApi.list(),
    enabled: !!user?.id,
  });

  // Load messages when switching conversations — but never overwrite while streaming
  useEffect(() => {
    if (activeConvId && !isStreamingRef.current) {
      const conv = conversations.find(c => c.id === activeConvId);
      if (conv?.messages) {
        setMessages(conv.messages);
      }
    }
  }, [activeConvId, conversations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessages = useCallback(async (convId, msgs) => {
    await conversationsApi.update(convId, { messages: msgs });
    queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
  }, [queryClient, user?.id]);

  const createConversationMutation = useMutation({
    mutationFn: (data) => conversationsApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] }),
  });

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleSend = async (text, fileUrls = [], baseMessages = messages) => {
    abortRef.current = false;
    incrementMessageCount();
    const content = text || (fileUrls.length ? '[Attached files]' : '');
    const userMsg = { role: 'user', content, timestamp: new Date().toISOString(), file_urls: fileUrls.length ? fileUrls : undefined };
    const newMessages = [...baseMessages, userMsg];
    setMessages(newMessages);

    let convId = activeConvId;

    // Create conversation if new
    if (!convId) {
      const conv = await createConversationMutation.mutateAsync({
        title: 'New conversation',
        messages: newMessages,
        model,
        pinned: false,
        is_temporary: false,
      });
      convId = conv.id;
      setActiveConvId(convId);

      // Generate AI title in background
      generateTitle(text)
        .then((title) => {
          conversationsApi.update(conv.id, { title });
          queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
        })
        .catch(() => {
          const fallback = text.length > 50 ? text.substring(0, 50) + '...' : text;
          conversationsApi.update(conv.id, { title: fallback });
          queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
        });
    } else {
      await saveMessages(convId, newMessages);
    }

    // Show typing indicator
    isStreamingRef.current = true;
    const assistantMsg = { role: 'assistant', content: '', timestamp: new Date().toISOString(), model };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreaming(true);

    try {
      let displayed = '';
      let searchMeta = {}; // { searchStatus: 'start'|'done', searchSources: [...] }

      await streamChat(newMessages, {
        onDelta: (delta) => {
          if (abortRef.current) return;
          displayed += delta;
          setMessages(prev => [...prev.slice(0, -1), { ...assistantMsg, content: displayed, ...searchMeta }]);
        },
        onSearch: (status, sources) => {
          if (abortRef.current) return;
          searchMeta = { searchStatus: status, searchSources: sources ?? searchMeta.searchSources };
          setMessages(prev => [...prev.slice(0, -1), { ...assistantMsg, content: displayed, ...searchMeta }]);
        },
      }, webSearch, model);

      const finalMsgs = [...newMessages, { ...assistantMsg, content: displayed, ...searchMeta }];
      setMessages(finalMsgs);
      await saveMessages(convId, finalMsgs);
    } catch (err) {
      const friendlyMsg = 'Sorry, something went wrong. Please try again.';
      const errorMsg = { ...assistantMsg, content: friendlyMsg };
      setMessages(prev => [...prev.slice(0, -1), errorMsg]);
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    isStreamingRef.current = false;
    setIsStreaming(false);
  };

  const handleRegenerate = async () => {
    if (messages.length < 2) return;
    const withoutLast = messages.slice(0, -1); // drop the old AI response
    const lastUserMsg = [...withoutLast].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    const idx = withoutLast.indexOf(lastUserMsg);
    const base = withoutLast.slice(0, idx); // everything before that user message
    await handleSend(lastUserMsg.content, lastUserMsg.file_urls || [], base);
  };

  // Editing a past message: drop it and everything after it (including the
  // old AI response, which visibly vanishes), then resubmit the edited text
  // as a fresh message so a new AI response gets generated in its place.
  const handleEditSave = async (msg, newText) => {
    const idx = messages.indexOf(msg);
    if (idx < 0) return;
    const base = messages.slice(0, idx);
    await handleSend(newText, msg.file_urls || [], base);
  };

  const handleDelete = async (id) => {
    await conversationsApi.remove(id);
    queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const handleRename = async (id, title) => {
    await conversationsApi.update(id, { title });
    queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
  };

  const handleTogglePin = async (id, pinned) => {
    await conversationsApi.update(id, { pinned });
    queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
  };

  return (
    <div className="flex h-screen bg-background relative">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={setActiveConvId}
        onNew={handleNewChat}
        onRename={handleRename}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Settings overlay */}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}

      {/* Main chat area — fixed-height column: top bar, then a scrollable message
          list that takes all remaining space, then the input bar. min-h-0 is what
          lets the middle flex child actually scroll instead of growing the page. */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar — not part of the scroll region */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-background/80 backdrop-blur-sm z-10">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <ModelSelector
            selectedModel={model}
            onModelChange={(m) => {
              setModel(m);
              if (m === 'synch-search') setWebSearch(true);
            }}
          />
        </div>

        {/* Chat bubble list — its own isolated scroll container */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto py-4">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  isLast={i === messages.length - 1}
                  isStreaming={isStreaming}
                  onRegenerate={handleRegenerate}
                  onEditSave={handleEditSave}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar — not part of the scroll region */}
        <div className="flex-shrink-0">
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={handleStop}
            webSearch={webSearch}
            onToggleWebSearch={() => setWebSearch(!webSearch)}
          />
        </div>
      </div>
    </div>
  );
}