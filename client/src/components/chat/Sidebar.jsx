import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Pin, PinOff, Pencil, Trash2, X, Sparkles, MoreHorizontal, MessageSquare, LogOut, Settings, User, Zap, Crown, HelpCircle, ChevronRight, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { usePlan, PLANS } from '@/lib/planStore';
import PlanBadge from '@/components/payment/PlanBadge';
import { useAuth } from '@/lib/AuthContext';

export default function Sidebar({ conversations, activeId, onSelect, onNew, onRename, onDelete, onTogglePin, isOpen, onClose, onOpenSettings }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [currentPlan] = usePlan();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = conversations.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));
  const pinned = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped = {};
  unpinned.forEach(c => {
    // Supabase uses created_at, support both
    const d = new Date(c.created_at || c.created_date).toDateString();
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : 'Older';
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(c);
  });

  const handleRename = (id) => {
    if (editTitle.trim()) onRename(id, editTitle.trim());
    setEditingId(null);
  };

  const planInfo = PLANS[currentPlan];
  const isPro = currentPlan === 'pro';
  const isPlus = currentPlan === 'plus';
  const planIcon = isPro ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : isPlus ? <Zap className="w-3.5 h-3.5 text-blue-400" /> : null;

  // Display name: prefer user_metadata.full_name, fall back to email prefix
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const ChatItem = ({ conv }) => (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
        activeId === conv.id ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent'
      }`}
      onClick={() => { onSelect(conv.id); onClose?.(); }}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-50" />
      {editingId === conv.id ? (
        <input
          autoFocus value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={() => handleRename(conv.id)}
          onKeyDown={e => e.key === 'Enter' && handleRename(conv.id)}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-transparent border-b border-primary/40 focus:outline-none text-sm px-0 py-0"
        />
      ) : (
        <span className="flex-1 truncate">{conv.title || 'New Chat'}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded hover:bg-secondary">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => { setEditingId(conv.id); setEditTitle(conv.title || ''); }}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTogglePin(conv.id, !conv.pinned)}>
            {conv.pinned ? <PinOff className="w-3.5 h-3.5 mr-2" /> : <Pin className="w-3.5 h-3.5 mr-2" />}
            {conv.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(conv.id)} className="text-destructive focus:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Synch AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNew}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..." className="h-8 pl-8 text-sm bg-sidebar-accent border-0" />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {pinned.length > 0 && (
          <div className="mb-2">
            <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Pin className="w-3 h-3" /> Pinned
            </p>
            {pinned.map(c => <ChatItem key={c.id} conv={c} />)}
          </div>
        )}
        {['Today', 'Yesterday', 'Older'].map(label => grouped[label] && (
          <div key={label} className="mb-2">
            <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {grouped[label].map(c => <ChatItem key={c.id} conv={c} />)}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No chats found</p>}
      </div>

      {/* Footer — profile button */}
      <div className="border-t border-sidebar-border p-2" ref={profileMenuRef}>
        {/* Profile popup menu */}
        <AnimatePresence>
          {profileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-[60px] left-2 right-2 z-50 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              {/* User info row */}
              <button
                onClick={() => { setProfileMenuOpen(false); onClose?.(); navigate('/profile'); }}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-accent transition-colors border-b border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold leading-tight">{displayName}</p>
                    <p className="text-xs text-muted-foreground leading-tight capitalize flex items-center gap-1">
                      {planIcon}{planInfo?.name || 'Free'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Menu items */}
              <div className="py-1">
                <button onClick={() => { setProfileMenuOpen(false); onClose?.(); navigate('/pricing'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors">
                  <Sparkles className="w-4 h-4 text-primary" /> Upgrade plan
                </button>
                <button onClick={() => { setProfileMenuOpen(false); onClose?.(); onOpenSettings?.(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors">
                  <LayoutGrid className="w-4 h-4 text-muted-foreground" /> Personalization
                </button>
                <button onClick={() => { setProfileMenuOpen(false); onClose?.(); navigate('/profile'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors">
                  <User className="w-4 h-4 text-muted-foreground" /> Profile
                </button>
                <button onClick={() => { setProfileMenuOpen(false); onClose?.(); onOpenSettings?.(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors">
                  <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                </button>
              </div>

              <div className="border-t border-border py-1">
                <button onClick={() => { setProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" /> Help
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
                <button onClick={() => logout()} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-destructive">
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile trigger button */}
        <button
          onClick={() => setProfileMenuOpen(prev => !prev)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight capitalize">{planInfo?.name || 'Free'}</p>
          </div>
          <PlanBadge planId={currentPlan} size="sm" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block w-64 h-full border-r border-sidebar-border flex-shrink-0">
        {sidebarContent}
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-y-0 left-0 z-50 w-72 md:hidden">
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
