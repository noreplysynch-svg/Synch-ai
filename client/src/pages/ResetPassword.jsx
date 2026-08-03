import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  const handleSubmit = async () => {
    if (!password || password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      await auth.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        {!done ? (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-1 text-center">Choose a new password for your account</p>
            </div>

            {!token ? (
              <p className="text-sm text-destructive text-center">
                This reset link is missing its token. Please use the link from your email.
              </p>
            ) : (
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11 rounded-xl"
                  autoFocus
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="h-11 rounded-xl"
                />
                <Button
                  className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 font-medium"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="h-14 w-14 rounded-full bg-primary flex items-center justify-center mb-4"
            >
              <Check className="w-7 h-7 text-white" strokeWidth={3} />
            </motion.div>
            <h1 className="text-xl font-bold text-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-6">You can now sign in with your new password.</p>
            <Button
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 font-medium"
              onClick={() => navigate('/login')}
            >
              Continue to sign in
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
