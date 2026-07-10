import React, { useState } from 'react';
import { ArrowLeft, Check, Crown, Zap, Sparkles, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { usePlan } from '@/lib/planStore';
import PaymentModal from '@/components/payment/PaymentModal';
import PlanBadge from '@/components/payment/PlanBadge';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    features: ['50 messages/day', 'Synch 4 model', 'Basic chat history', 'Web access'],
    missing: ['Advanced models', 'Priority speed', 'File uploads', 'Voice mode'],
  },
  {
    id: 'plus',
    name: 'Synch Plus',
    price: '$9',
    period: '/month',
    icon: Zap,
    highlight: true,
    features: ['Unlimited messages', 'Synch 4 & 4 Pro models', 'Full chat history', 'File & image uploads', 'Voice mode', 'Priority speed'],
    missing: ['Synch Vision model', 'API access'],
  },
  {
    id: 'pro',
    name: 'Synch Pro',
    price: '$19',
    period: '/month',
    icon: Crown,
    features: ['Everything in Plus', 'All models incl. Vision', 'Web Search mode', 'API access', 'Custom instructions', 'Early access to features'],
    missing: [],
  },
];

export default function Pricing() {
  const [currentPlan] = usePlan();
  const [payingPlan, setPayingPlan] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold">Plans & Pricing</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Synch AI Plans
          </div>
          <h2 className="text-3xl font-bold mb-2">Choose your plan</h2>
          <p className="text-muted-foreground text-sm">Unlock more with Synch Plus or Synch Pro</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isActive = currentPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative bg-card rounded-2xl border-2 p-6 flex flex-col transition-all ${
                  plan.highlight
                    ? 'border-primary shadow-lg shadow-primary/10'
                    : isActive
                    ? 'border-primary/50'
                    : 'border-border'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow">Most Popular</span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  plan.id === 'pro' ? 'bg-primary/10' : plan.id === 'plus' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon className={`w-5 h-5 ${plan.id === 'free' ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  {plan.id !== 'free' && <PlanBadge planId={plan.id} size="sm" />}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isActive ? (
                  <Button disabled className="w-full" variant="secondary">Current Plan</Button>
                ) : plan.id === 'free' ? (
                  <Button disabled className="w-full" variant="secondary">Free Plan</Button>
                ) : (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => setPayingPlan(plan)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mt-8 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5" /> Secure payments • Cancel anytime • This is a demo
        </div>
      </div>

      <PaymentModal open={!!payingPlan} onClose={() => setPayingPlan(null)} plan={payingPlan} />
    </div>
  );
}