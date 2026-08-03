import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground mb-6">This page doesn't exist</p>
      <Link to="/">
        <Button className="bg-primary hover:bg-primary/90">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Synch AI
        </Button>
      </Link>
    </div>
  );
}