import React from 'react';
import { Sparkles, Code, Lightbulb, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

const suggestions = [
  { icon: Code, text: 'Write a Python script to sort files', color: 'text-blue-500' },
  { icon: Lightbulb, text: 'Explain quantum computing simply', color: 'text-amber-500' },
  { icon: BookOpen, text: 'Summarize the latest tech news', color: 'text-green-500' },
  { icon: Sparkles, text: 'Help me brainstorm app ideas', color: 'text-purple-500' },
];

export default function EmptyState({ onSuggestionClick }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">Synch AI</h1>
        <p className="text-sm text-muted-foreground">How can I help you today?</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => onSuggestionClick(s.text)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/20 transition-all text-left group"
            >
              <Icon className={`w-4 h-4 ${s.color} flex-shrink-0`} />
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">{s.text}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}