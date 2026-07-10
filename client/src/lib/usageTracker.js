// Tracks messages sent this month in localStorage
const KEY = 'synch-usage';

const PLAN_LIMITS = {
  free: 50,
  plus: 500,
  pro: Infinity,
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

function getUsageData() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function getMessageCount() {
  const data = getUsageData();
  return data[getCurrentMonthKey()] || 0;
}

export function incrementMessageCount() {
  const data = getUsageData();
  const key = getCurrentMonthKey();
  data[key] = (data[key] || 0) + 1;
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('usagechange'));
}

export function getLimit(planId) {
  return PLAN_LIMITS[planId] ?? 50;
}

export function useMessageUsage(planId) {
  const [count, setCount] = React.useState(getMessageCount());

  React.useEffect(() => {
    const handler = () => setCount(getMessageCount());
    window.addEventListener('usagechange', handler);
    return () => window.removeEventListener('usagechange', handler);
  }, []);

  const limit = getLimit(planId);
  const pct = limit === Infinity ? 0 : Math.min((count / limit) * 100, 100);
  const remaining = limit === Infinity ? Infinity : Math.max(limit - count, 0);

  return { count, limit, pct, remaining };
}

import React from 'react';