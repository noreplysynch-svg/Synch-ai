import React from 'react';
import { MessageSquare, Zap, Crown, Sparkles } from 'lucide-react';
import { usePlan, PLANS } from '@/lib/planStore';
import { useMessageUsage } from '@/lib/usageTracker';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function SectionTitle({ children }) {
  return <h2 className="text-xl font-semibold text-foreground mb-1 pb-3 border-b border-border">{children}</h2>;
}

export default function UsagePanel() {
  const [currentPlan] = usePlan();
  const { count, limit, pct, remaining } = useMessageUsage(currentPlan);
  const navigate = useNavigate();
  const planInfo = PLANS[currentPlan];
  const isUnlimited = limit === Infinity;

  const planIcon = currentPlan === 'pro'
    ? <Crown className="w-4 h-4 text-amber-400" />
    : currentPlan === 'plus'
    ? <Zap className="w-4 h-4 text-violet-400" />
    : <Sparkles className="w-4 h-4 text-muted-foreground" />;

  const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary';

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div>
      <SectionTitle>Usage</SectionTitle>

      {/* Plan indicator */}
      <div className="flex items-center justify-between py-4 border-b border-border">
        <div className="flex items-center gap-2">
          {planIcon}
          <span className="text-sm font-medium">{planInfo?.name || 'Free'} Plan</span>
        </div>
        {currentPlan === 'free' && (
          <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 text-white" onClick={() => navigate('/pricing')}>
            Upgrade
          </Button>
        )}
      </div>

      {/* Messages sent */}
      <div className="py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Messages — {monthName}</span>
          </div>
          <span className="text-sm font-semibold">
            {count}
            <span className="text-muted-foreground font-normal">
              {isUnlimited ? ' / ∞' : ` / ${limit}`}
            </span>
          </span>
        </div>

        {!isUnlimited && (
          <>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {remaining === 0
                ? 'Monthly limit reached. Upgrade for more.'
                : `${remaining} message${remaining !== 1 ? 's' : ''} remaining this month`}
            </p>
          </>
        )}

        {isUnlimited && (
          <p className="text-xs text-muted-foreground mt-1">Unlimited messages with your Pro plan.</p>
        )}
      </div>

      {/* Limit table */}
      <div className="py-4">
        <p className="text-sm font-medium mb-3">Plan limits</p>
        <div className="space-y-2">
          {[
            { id: 'free', label: 'Free', limit: 50 },
            { id: 'plus', label: 'Synch Plus', limit: 500 },
            { id: 'pro', label: 'Synch Pro', limit: 'Unlimited' },
          ].map(p => (
            <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${currentPlan === p.id ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/40'}`}>
              <span className={currentPlan === p.id ? 'font-medium text-primary' : 'text-muted-foreground'}>{p.label}</span>
              <span className={currentPlan === p.id ? 'font-semibold text-primary' : 'text-muted-foreground'}>{p.limit} msg/mo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}