import React from 'react';
import { ChevronDown, Zap, Brain, Sparkles, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const MODELS = [
  { id: 'synch-4', name: 'Synch 4', desc: 'Fast & capable', icon: Zap, badge: null },
  { id: 'synch-4-pro', name: 'Synch 4 Pro', desc: 'Advanced reasoning', icon: Brain, badge: 'Pro' },
  { id: 'synch-vision', name: 'Synch Vision', desc: 'Image understanding', icon: Sparkles, badge: 'New' },
  { id: 'synch-search', name: 'Synch Search', desc: 'Web-connected', icon: Globe, badge: null },
];

export default function ModelSelector({ selectedModel, onModelChange }) {
  const current = MODELS.find(m => m.id === selectedModel) || MODELS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium text-foreground">
          <Icon className="w-4 h-4 text-primary" />
          <span>{current.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Select Model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODELS.map(model => {
          const MIcon = model.icon;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onModelChange(model.id)}
              className="flex items-start gap-3 py-2.5 cursor-pointer"
            >
              <MIcon className={`w-4 h-4 mt-0.5 ${selectedModel === model.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${selectedModel === model.id ? 'text-primary' : ''}`}>
                    {model.name}
                  </span>
                  {model.badge && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {model.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{model.desc}</p>
              </div>
              {selectedModel === model.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}