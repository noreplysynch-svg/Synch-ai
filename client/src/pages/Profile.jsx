import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, LogOut, Shield, Key, Crown, Zap, ChevronRight, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';
import { usePlan, PLANS } from '@/lib/planStore';
import PlanBadge from '@/components/payment/PlanBadge';
import PaymentModal from '@/components/payment/PaymentModal';
import { useAuth } from '@/lib/AuthContext';

const SETTINGS_SECTIONS = [
  { label: 'Appearance', to: '/settings#appearance' },
  { label: 'AI Model', to: '/settings#ai' },
  { label: 'Chat', to: '/settings#chat' },
  { label: 'Notifications', to: '/settings#notifications' },
  { label: 'Data & Privacy', to: '/settings#privacy' },
];

export default function Profile() {
  const { user, logout, isLoadingAuth } = useAuth();
  const [currentPlan] = usePlan();
  const [payingPlan, setPayingPlan] = useState(null);

  const planInfo = PLANS[currentPlan];
  const isPro = currentPlan === 'pro';
  const isPlus = currentPlan === 'plus';

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Profile</h1>
          <div className="ml-auto">
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-6"
      >
        {/* Avatar & info */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 ${
            isPro ? 'bg-amber-500/10' : isPlus ? 'bg-violet-500/10' : 'bg-primary/10'
          }`}>
            <User className={`w-10 h-10 ${isPro ? 'text-amber-500' : isPlus ? 'text-violet-500' : 'text-primary'}`} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{displayName}</h2>
            <PlanBadge planId={currentPlan} size="md" />
          </div>
          <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
        </div>

        {/* Plan card */}
        <div className={`rounded-xl border-2 p-4 mb-6 ${
          isPro ? 'border-amber-400/40 bg-amber-500/5' :
          isPlus ? 'border-violet-400/40 bg-violet-500/5' :
          'border-border bg-card'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isPro ? 'bg-amber-500/10' : isPlus ? 'bg-violet-500/10' : 'bg-muted'
              }`}>
                {isPro ? <Crown className="w-5 h-5 text-amber-500" /> :
                 isPlus ? <Zap className="w-5 h-5 text-violet-500" /> :
                 <User className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{planInfo?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentPlan === 'free' ? 'Upgrade for more features' : 'Active subscription'}
                </p>
              </div>
            </div>
            <Link to="/pricing">
              <Button size="sm" className={`h-8 text-xs ${
                isPro ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                isPlus ? 'bg-violet-500 hover:bg-violet-600 text-white' :
                'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}>
                {currentPlan === 'free' ? 'Upgrade' : 'Manage Plan'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Account Information
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={displayName} disabled className="mt-1 h-9 text-sm bg-secondary/30" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user?.email || ''} disabled className="mt-1 h-9 text-sm bg-secondary/30" />
            </div>
          </div>
        </div>

        {/* Settings shortcuts */}
        <div className="bg-card rounded-xl border border-border mb-4 divide-y divide-border">
          <h3 className="text-sm font-semibold px-4 pt-4 pb-2 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Settings
          </h3>
          {SETTINGS_SECTIONS.map(s => (
            <Link to="/settings" key={s.label}>
              <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors text-sm">
                <span>{s.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </Link>
          ))}
        </div>

        {/* Security */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Security
          </h3>
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors text-sm">
            <span className="flex items-center gap-2"><Key className="w-4 h-4 text-muted-foreground" /> Change Password</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <Separator className="my-5" />

        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </motion.div>

      <PaymentModal open={!!payingPlan} onClose={() => setPayingPlan(null)} plan={payingPlan} />
    </div>
  );
}
