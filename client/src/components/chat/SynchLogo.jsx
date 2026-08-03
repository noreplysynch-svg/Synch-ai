import React from 'react';
import { Sparkles } from 'lucide-react';

export default function SynchLogo({ size = 'md' }) {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <div className={`${sizes[size]} rounded-xl bg-primary flex items-center justify-center`}>
      <Sparkles className="text-primary-foreground" style={{ width: '60%', height: '60%' }} />
    </div>
  );
}