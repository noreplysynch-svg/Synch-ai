import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fixed to the top-left of the auth screen, consistent with the back buttons
// used on Profile/Settings. Rendered on every step except the very first.
export default function BackButton({ onClick, label = 'Back' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full border border-border bg-background/80 backdrop-blur-sm text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
