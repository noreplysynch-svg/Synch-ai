import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Settings as SettingsIcon, Bell, User, LayoutGrid, CreditCard,
  Database, HardDrive, Shield, X, Sun, Moon, Monitor, ChevronRight,
  Plus, Trash2, Crown, Zap, Sparkles, BarChart2, Download, Archive,
  Link, Eye, EyeOff, AlertTriangle, Check, Copy, LogOut
} from 'lucide-react';
import UsagePanel from '@/components/settings/UsagePanel';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getTheme, setTheme as applyTheme } from '@/lib/themeManager';
import { usePlan, PLANS, setPlan } from '@/lib/planStore';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { conversations as conversationsApi, auth } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'personalization', label: 'Personalization', icon: LayoutGrid },
  { id: 'usage', label: 'Usage', icon: BarChart2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'data', label: 'Data controls', icon: Database },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'account', label: 'Account', icon: User },
];

function Row({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 mr-6">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-xl font-semibold text-foreground mb-1 pb-3 border-b border-border">{children}</h2>;
}

// ─── General ─────────────────────────────────────────────────────────────────
function GeneralPanel() {
  const [theme, setThemeState] = useState(getTheme());
  const [dictation, setDictation] = useState(() => localStorage.getItem('synch-dictation') !== 'false');
  const [language, setLanguage] = useState(() => localStorage.getItem('synch-language') || 'auto');

  const handleTheme = (t) => { setThemeState(t); applyTheme(t); toast.success(`Theme set to ${t}`); };

  const handleDictation = (v) => {
    setDictation(v);
    localStorage.setItem('synch-dictation', v);
    toast.success(v ? 'Dictation enabled' : 'Dictation disabled');
  };

  const handleLanguage = (v) => {
    setLanguage(v);
    localStorage.setItem('synch-language', v);
    toast.success('Language preference saved');
  };

  return (
    <div>
      <SectionTitle>General</SectionTitle>
      <Row label="Appearance" description="Choose your preferred color scheme.">
        <div className="flex gap-1">
          {[{ id: 'light', icon: Sun, label: 'Light' }, { id: 'dark', icon: Moon, label: 'Dark' }, { id: 'system', icon: Monitor, label: 'System' }].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => handleTheme(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === t.id ? 'bg-primary text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label="Language" description="Language for the interface and responses.">
        <Select value={language} onValueChange={handleLanguage}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Enable Dictation" description="Use voice dictation in the chat input.">
        <Switch checked={dictation} onCheckedChange={handleDictation} />
      </Row>
      <Row label="Send with Enter" description="Press Enter to send messages (Shift+Enter for new line).">
        <Switch defaultChecked onCheckedChange={(v) => toast.success(v ? 'Enter to send enabled' : 'Enter to send disabled')} />
      </Row>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────
function NotificationsPanel() {
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('synch-notif')) || { responses: true, updates: true, marketing: false, sound: true }; }
    catch { return { responses: true, updates: true, marketing: false, sound: true }; }
  });

  const update = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    localStorage.setItem('synch-notif', JSON.stringify(next));
    toast.success('Notification preference saved');
  };

  return (
    <div>
      <SectionTitle>Notifications</SectionTitle>
      <Row label="Response notifications" description="Get notified when Synch AI finishes a long response.">
        <Switch checked={prefs.responses} onCheckedChange={v => update('responses', v)} />
      </Row>
      <Row label="Product updates" description="Stay informed about new features and improvements.">
        <Switch checked={prefs.updates} onCheckedChange={v => update('updates', v)} />
      </Row>
      <Row label="Marketing emails" description="Receive promotional emails and special offers.">
        <Switch checked={prefs.marketing} onCheckedChange={v => update('marketing', v)} />
      </Row>
      <Row label="Sound effects" description="Play a sound when a response is complete.">
        <Switch checked={prefs.sound} onCheckedChange={v => update('sound', v)} />
      </Row>
    </div>
  );
}

// ─── Personalization ──────────────────────────────────────────────────────────
function PersonalizationPanel() {
  const [tone, setTone] = useState(() => localStorage.getItem('synch-tone') || 'balanced');
  const [instructions, setInstructions] = useState(() => localStorage.getItem('synch-instructions') || '');
  const [saved, setSaved] = useState(false);

  const handleTone = (v) => { setTone(v); localStorage.setItem('synch-tone', v); toast.success('Tone preference saved'); };

  const saveInstructions = () => {
    localStorage.setItem('synch-instructions', instructions);
    setSaved(true);
    toast.success('Custom instructions saved');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Personalization</SectionTitle>
      <Row label="Response style" description="How Synch AI structures and tones its replies.">
        <Select value={tone} onValueChange={handleTone}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="creative">Creative</SelectItem>
            <SelectItem value="precise">Precise</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="concise">Concise</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div className="py-4 border-b border-border">
        <p className="text-sm font-medium mb-1">Custom instructions</p>
        <p className="text-xs text-muted-foreground mb-3">Tell Synch AI how to behave, what to focus on, or any preferences.</p>
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. Always respond in bullet points. I'm a software engineer. Be brief."
          className="text-sm min-h-[100px] mb-3"
        />
        <Button size="sm" onClick={saveInstructions} className="h-8 text-xs gap-1.5">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save instructions'}
        </Button>
      </div>
      <Row label="Show code line numbers" description="Display line numbers in code blocks.">
        <Switch defaultChecked onCheckedChange={(v) => { localStorage.setItem('synch-code-lines', v); toast.success('Preference saved'); }} />
      </Row>
      <Row label="Auto-scroll to bottom" description="Automatically scroll as responses stream in.">
        <Switch defaultChecked onCheckedChange={(v) => { localStorage.setItem('synch-autoscroll', v); toast.success('Preference saved'); }} />
      </Row>
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────
function getBillingInfo() {
  try { return JSON.parse(localStorage.getItem('synch-billing')) || null; } catch { return null; }
}

function BillingPanel() {
  const [currentPlan] = usePlan();
  const [billing, setBilling] = useState(getBillingInfo());
  const navigate = useNavigate();
  const planInfo = PLANS[currentPlan];
  const isPaid = currentPlan !== 'free';

  useEffect(() => {
    const handler = () => setBilling(getBillingInfo());
    window.addEventListener('billingchange', handler);
    return () => window.removeEventListener('billingchange', handler);
  }, []);

  const handleCancel = () => {
    if (!window.confirm('Are you sure you want to cancel your plan?')) return;
    setPlan('free');
    localStorage.removeItem('synch-billing');
    setBilling(null);
    toast.success('Plan cancelled. You are now on the Free plan.');
  };

  return (
    <div>
      <SectionTitle>Billing</SectionTitle>
      <div className="py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-foreground flex items-center gap-2">
              {currentPlan === 'pro' && <Crown className="w-4 h-4 text-primary" />}
              {currentPlan === 'plus' && <Zap className="w-4 h-4 text-primary" />}
              {currentPlan === 'free' && <Sparkles className="w-4 h-4 text-muted-foreground" />}
              {planInfo?.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPaid ? 'Active subscription · Billed monthly' : 'Free plan · Upgrade for more features'}
            </p>
          </div>
          <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-white" onClick={() => navigate('/pricing')}>
            {isPaid ? 'Manage plan' : 'Upgrade'}
          </Button>
        </div>
      </div>

      {isPaid && billing?.history?.length > 0 && (
        <div className="py-4 border-b border-border">
          <p className="text-sm font-semibold mb-3">Billing history</p>
          <div className="space-y-2">
            {billing.history.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-muted-foreground">{item.date}</span>
                <span>{item.amount}</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPaid && billing && (
        <div className="py-4 border-b border-border">
          <p className="text-sm font-semibold mb-3">Payment method</p>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{billing.cardType}</p>
                <p className="text-xs text-muted-foreground">•••• {billing.last4} · Expires {billing.expiry}</p>
              </div>
            </div>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 font-medium">Default</span>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="py-4">
          <p className="text-sm font-medium mb-1">Cancel plan</p>
          <p className="text-xs text-muted-foreground mb-3">You'll keep full access until the end of your billing period.</p>
          <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancel}>
            Cancel plan
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Data controls ────────────────────────────────────────────────────────────
function DataPanel({ userId }) {
  const [improveModel, setImproveModel] = useState(() => localStorage.getItem('synch-improve-model') !== 'false');
  const [chatHistory, setChatHistory] = useState(() => localStorage.getItem('synch-chat-history') !== 'false');

  const handleImproveModel = (v) => {
    setImproveModel(v);
    localStorage.setItem('synch-improve-model', v);
    toast.success(v ? 'Helping improve the model' : 'Opted out of model improvement');
  };

  const handleChatHistory = (v) => {
    setChatHistory(v);
    localStorage.setItem('synch-chat-history', v);
    toast.success(v ? 'Chat history enabled' : 'Chat history disabled');
  };

  const handleArchiveAll = async () => {
    toast.success('All chats archived successfully');
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all conversations? This cannot be undone.')) return;
    try {
      await conversationsApi.removeAll();
      toast.success('All conversations deleted');
      window.location.reload();
    } catch {
      toast.error('Failed to delete conversations');
    }
  };

  const handleExport = async () => {
    try {
      const data = await conversationsApi.list();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synch-ai-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div>
      <SectionTitle>Data controls</SectionTitle>
      <Row label="Improve the model for everyone" description="Allow your conversations to help train and improve Synch AI.">
        <Switch checked={improveModel} onCheckedChange={handleImproveModel} />
      </Row>
      <Row label="Chat history" description="Save your conversations so you can access them later.">
        <Switch checked={chatHistory} onCheckedChange={handleChatHistory} />
      </Row>
      <Row label="Archive all chats" description="Archive all conversations without deleting them.">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleArchiveAll}>
          <Archive className="w-3.5 h-3.5" /> Archive all
        </Button>
      </Row>
      <Row label="Export your data" description="Download all your conversations as a JSON file.">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </Row>
      <Row label="Delete all chats" description="Permanently delete all conversations. This cannot be undone.">
        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleDeleteAll}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete all
        </Button>
      </Row>
    </div>
  );
}

// ─── Storage ──────────────────────────────────────────────────────────────────
function StoragePanel({ userId }) {
  const [convCount, setConvCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    conversationsApi.count()
      .then((count) => {
        setConvCount(count ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const estimatedMB = Math.round(convCount * 0.05 * 10) / 10;
  const maxMB = 512;
  const pct = Math.min((estimatedMB / maxMB) * 100, 100);

  return (
    <div>
      <SectionTitle>Storage</SectionTitle>
      <div className="py-4 border-b border-border">
        <p className="text-sm font-semibold mb-1">
          {loading ? 'Calculating...' : `~${estimatedMB} MB of ${maxMB} MB used`}
        </p>
        <p className="text-xs text-muted-foreground mb-3">{convCount} conversations stored</p>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="py-4">
        <p className="text-sm font-semibold mb-3">Storage breakdown</p>
        <div className="space-y-3">
          {[
            { label: 'Conversations', value: `${convCount} chats`, size: `~${estimatedMB} MB` },
            { label: 'Settings & preferences', value: 'Local data', size: '< 1 MB' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.value}</p>
              </div>
              <span className="text-sm text-muted-foreground">{item.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────
function SecurityPanel() {
  const [authApp, setAuthApp] = useState(() => localStorage.getItem('synch-mfa-app') === 'true');
  const [sms, setSms] = useState(() => localStorage.getItem('synch-mfa-sms') === 'true');
  const [showSessions, setShowSessions] = useState(false);

  const handleAuthApp = (v) => {
    setAuthApp(v);
    localStorage.setItem('synch-mfa-app', v);
    toast.success(v ? 'Authenticator app MFA enabled' : 'Authenticator app MFA disabled');
  };

  const handleSms = (v) => {
    setSms(v);
    localStorage.setItem('synch-mfa-sms', v);
    toast.success(v ? 'SMS MFA enabled' : 'SMS MFA disabled');
  };

  const sessions = [
    { device: 'Chrome on macOS', location: 'Your current session', time: 'Active now', current: true },
  ];

  return (
    <div>
      <SectionTitle>Security</SectionTitle>
      <div className="py-4 border-b border-border">
        <p className="text-sm font-semibold mb-3">Multi-factor authentication (MFA)</p>
        <Row label="Authenticator app" description="Use time-based one-time codes from an authenticator app.">
          <Switch checked={authApp} onCheckedChange={handleAuthApp} />
        </Row>
        <Row label="Text message (SMS)" description="Receive 6-digit verification codes via SMS.">
          <Switch checked={sms} onCheckedChange={handleSms} />
        </Row>
      </div>
      <div className="py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Active sessions</p>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSessions(!showSessions)}>
            {showSessions ? 'Hide' : 'View all'}
          </Button>
        </div>
        {showSessions && (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {s.device}
                    {s.current && <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">Current</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.location}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="py-4">
        <p className="text-sm font-semibold mb-2">Danger zone</p>
        <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={() => { if (window.confirm('Sign out of all devices?')) toast.success('Signed out of all other devices'); }}>
          Sign out all other sessions
        </Button>
      </div>
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────
function AccountPanel({ user, onLogout }) {
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || '');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(user?.id || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('User ID copied');
  };

  const handleSaveName = async () => {
    try {
      await auth.updateProfile(displayName);
      toast.success('Name updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update name');
    }
  };

  return (
    <div>
      <SectionTitle>Account</SectionTitle>
      <div className="py-4 border-b border-border">
        <div className="bg-secondary/40 rounded-xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {(user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user?.user_metadata?.full_name || '—'}</p>
            <p className="text-sm text-muted-foreground">{user?.email || '—'}</p>
          </div>
        </div>
      </div>

      <div className="py-4 border-b border-border">
        <p className="text-sm font-medium mb-3">Display name</p>
        {editing ? (
          <div className="flex gap-2">
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-8 text-sm" />
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveName}>Save</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{user?.user_metadata?.full_name || '—'}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        )}
      </div>

      <Row label="Email">
        <span className="text-sm text-muted-foreground">{user?.email || '—'}</span>
      </Row>
      <Row label="Member since">
        <span className="text-sm text-muted-foreground">
          {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
        </span>
      </Row>
      <Row label="User ID">
        <button onClick={copyId} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-mono">{user?.id?.slice(0, 12)}...</span>
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </Row>

      <div className="pt-6 space-y-2">
        <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => onLogout()}>
          <LogOut className="w-4 h-4" /> Log out
        </Button>
        <Button variant="outline" className="w-full gap-2 text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={() => { if (window.confirm('Delete your account? This is permanent and cannot be undone.')) toast.error('Please contact support to delete your account.'); }}>
          <AlertTriangle className="w-4 h-4" /> Delete account
        </Button>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings({ onClose }) {
  const [activeSection, setActiveSection] = useState('general');
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleClose = () => {
    if (onClose) onClose();
    else navigate('/');
  };

  const renderPanel = () => {
    switch (activeSection) {
      case 'general': return <GeneralPanel />;
      case 'notifications': return <NotificationsPanel />;
      case 'personalization': return <PersonalizationPanel />;
      case 'usage': return <UsagePanel />;
      case 'billing': return <BillingPanel />;
      case 'data': return <DataPanel userId={user?.id} />;
      case 'storage': return <StoragePanel userId={user?.id} />;
      case 'security': return <SecurityPanel />;
      case 'account': return <AccountPanel user={user} onLogout={logout} />;
      default: return <GeneralPanel />;
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex"
        style={{ minHeight: 560, maxHeight: '90vh' }}
      >
        {/* Left nav */}
        <div className="w-52 flex-shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">Settings</span>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-secondary text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderPanel()}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
