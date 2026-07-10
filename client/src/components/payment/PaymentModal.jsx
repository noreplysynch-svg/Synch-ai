import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { setPlan } from '@/lib/planStore';
import { motion, AnimatePresence } from 'framer-motion';

function formatCard(val) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(val) {
  return val.replace(/\D/g, '').slice(0, 4).replace(/(.{2})/, '$1/').trim();
}

export default function PaymentModal({ open, onClose, plan }) {
  const [step, setStep] = useState('form');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const price = plan?.id === 'pro' ? '$19' : '$9';

  const handlePay = (e) => {
    e.preventDefault();
    setStep('processing');
    setTimeout(() => {
      setPlan(plan.id);
      // Save real card info and billing record
      const last4 = card.replace(/\s/g, '').slice(-4);
      const cardType = card.replace(/\s/g, '')[0] === '4' ? 'Visa' : card.replace(/\s/g, '')[0] === '5' ? 'Mastercard' : 'Card';
      const billingInfo = {
        cardType,
        last4,
        expiry,
        cardholderName: name,
        history: [
          { date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), amount: plan.id === 'pro' ? '$19.00' : '$9.00', status: 'Paid' }
        ]
      };
      localStorage.setItem('synch-billing', JSON.stringify(billingInfo));
      window.dispatchEvent(new Event('billingchange'));
      setStep('success');
    }, 2000);
  };

  const handleClose = () => {
    setStep('form');
    setCard(''); setExpiry(''); setCvc(''); setName('');
    onClose();
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Blue header */}
        <div className="bg-primary p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium opacity-75">Upgrading to</p>
              <h3 className="text-lg font-bold">{plan.name}</h3>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold">{price}<span className="text-sm font-normal opacity-75">/mo</span></p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <div className="flex items-center gap-1.5 mb-5 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">Secure payment • Demo mode — any card works</span>
              </div>
              <form onSubmit={handlePay} className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Cardholder Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="mt-1.5 h-10 text-sm focus-visible:ring-primary" required />
                </div>
                <div>
                  <Label className="text-xs font-medium">Card Number</Label>
                  <div className="relative mt-1.5">
                    <Input
                      value={card}
                      onChange={e => setCard(formatCard(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      className="h-10 text-sm pr-10 focus-visible:ring-primary"
                      required
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Expiry</Label>
                    <Input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" className="mt-1.5 h-10 text-sm focus-visible:ring-primary" required />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">CVC</Label>
                    <Input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="123" className="mt-1.5 h-10 text-sm focus-visible:ring-primary" required />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-1 h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm">
                  Pay {price}/month
                </Button>
              </form>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
              <p className="font-semibold text-lg">Processing payment...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait a moment</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-1">Welcome to {plan.name}! 🎉</h3>
              <p className="text-sm text-muted-foreground mb-6">Your plan has been activated successfully.</p>
              <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 text-white px-8">
                Start using {plan.name}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}