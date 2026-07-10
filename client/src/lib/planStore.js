// Plan store — persists to localStorage
const KEY = 'synch-plan';

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    badge: null,
    color: null,
  },
  plus: {
    id: 'plus',
    name: 'Synch Plus',
    badge: 'Plus',
    color: 'bg-violet-500',
    textColor: 'text-violet-500',
    borderColor: 'border-violet-400',
  },
  pro: {
    id: 'pro',
    name: 'Synch Pro',
    badge: 'Pro',
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    borderColor: 'border-amber-400',
  },
};

export function getPlan() {
  return localStorage.getItem(KEY) || 'free';
}

export function setPlan(planId) {
  localStorage.setItem(KEY, planId);
  window.dispatchEvent(new Event('planchange'));
}

export function usePlan() {
  const [plan, setPlanState] = React.useState(getPlan());
  React.useEffect(() => {
    const handler = () => setPlanState(getPlan());
    window.addEventListener('planchange', handler);
    return () => window.removeEventListener('planchange', handler);
  }, []);
  return [plan, setPlan];
}

// make React available
import React from 'react';