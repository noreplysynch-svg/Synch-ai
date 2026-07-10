import React from 'react';
import { PLANS } from '@/lib/planStore';
import { Crown, Zap } from 'lucide-react';

export default function PlanBadge({ planId, size = 'sm' }) {
  const plan = PLANS[planId];
  if (!plan || planId === 'free') return null;

  const isPro = planId === 'pro';
  const Icon = isPro ? Crown : Zap;

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-semibold bg-primary/10 text-primary border border-primary/20 ${sizes[size]}`}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
      {plan.badge}
    </span>
  );
}