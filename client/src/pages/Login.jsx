import React, { useState, useEffect } from 'react';
import { auth } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const { checkUserAuth } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [useOtp, setUseOtp] = useState(false);

  // Profile completion — used both for brand-new OTP signups and brand-new
  // Google/Microsoft signups, since neither hands us a name we can trust or a
  // date of birth at all.
  const [pendingToken, setPendingToken] = useState(null);
  const [completeName, setCompleteName] = useState('');
  const [completeDob, setCompleteDob] = useState('');

  // Pick up an OAuth "finish signing up" redirect, or a failed-OAuth error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('completeSignup');
    const authError = params.get('authError');

    if (token) {
      setPendingToken(token);
    }
    if (authError) {
      toast.error('Sign-in failed. Please try again.');
    }
    if (token || authError) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSendOtp = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      await auth.sendOtp(email);
      setOtpSent(true);
      toast.success('Check your email for the code!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) { toast.error('Enter the code'); return; }
    setLoading(true);
    try {
      const result = await auth.verifyOtp(email, otp);
      if (result.needsProfile) {
        setPendingToken(result.pendingToken);
      } else {
        await checkUserAuth();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      await auth.signIn(email, password);
      await checkUserAuth();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) { toast.error('Enter email and password'); return; }
    if (!name.trim()) { toast.error('Enter your name'); return; }
    if (!dob) { toast.error('Enter your date of birth'); return; }
    setLoading(true);
    try {
      await auth.signUp(email, password, name, dob);
      toast.success('Account created!');
      await checkUserAuth();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    if (!completeName.trim()) { toast.error('Enter your name'); return; }
    if (!completeDob) { toast.error('Enter your date of birth'); return; }
    setLoading(true);
    try {
      await auth.completeSignup(pendingToken, completeName, completeDob);
      toast.success('Account created!');
      await checkUserAuth();
    } catch (err) {
      toast.error(err.message);
      // An expired/invalid token can't be recovered — send them back to start
      if (err.message.toLowerCase().includes('expired')) {
        setPendingToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      await auth.requestPasswordReset(email);
      toast.success('If that email has an account, a reset link is on the way');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = auth.oauthUrl('google');
  };

  const handleMicrosoft = () => {
    window.location.href = auth.oauthUrl('microsoft');
  };

  const resetOtp = () => { setOtpSent(false); setOtp(''); setUseOtp(false); };

  // ── Profile completion screen (new OTP or OAuth signups) ─────────────────
  if (pendingToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Finish setting up</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">Just need your name and date of birth to create your account</p>
          </div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Your name"
              value={completeName}
              onChange={e => setCompleteName(e.target.value)}
            />
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Date of birth</label>
              <Input
                type="date"
                value={completeDob}
                onChange={e => setCompleteDob(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleCompleteSignup} disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">You must be at least 13 years old to use Synch AI.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Synch AI</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg bg-secondary p-1 mb-6 text-sm">
          {[{ id: 'login', label: 'Login' }, { id: 'signup', label: 'Sign up' }].map(t => (
            <button
              key={t.id}
              onClick={() => { setMode(t.id); resetOtp(); }}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${mode === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="wait">

            {/* ── Login mode ── */}
            {mode === 'login' && !useOtp && !otpSent && (
              <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleSignIn} disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <button onClick={handlePasswordReset} className="hover:text-foreground">Forgot password?</button>
                  <button onClick={() => setUseOtp(true)} className="hover:text-foreground">Login without password →</button>
                </div>
              </motion.div>
            )}

            {/* ── OTP send ── */}
            {mode === 'login' && useOtp && !otpSent && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                />
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleSendOtp} disabled={loading}>
                  {loading ? 'Sending...' : 'Send code'}
                </Button>
                <button onClick={resetOtp} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
                  ← Back to password login
                </button>
              </motion.div>
            )}

            {/* ── OTP verify ── */}
            {mode === 'login' && otpSent && (
              <motion.div key="otp-verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to <strong>{email}</strong></p>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  className="text-center text-lg tracking-widest font-mono"
                />
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleVerifyOtp} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify code'}
                </Button>
                <button onClick={resetOtp} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
                  ← Use a different email
                </button>
              </motion.div>
            )}

            {/* ── Sign up ── */}
            {mode === 'signup' && (
              <motion.div key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <Input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date of birth</label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <Input type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleSignUp} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create account'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">You must be at least 13 years old to use Synch AI.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google */}
          <Button variant="outline" className="w-full gap-2" onClick={handleGoogle}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          {/* Microsoft */}
          <Button variant="outline" className="w-full gap-2" onClick={handleMicrosoft}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#00A4EF" d="M13 1h10v10H13z"/>
              <path fill="#7FBA00" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            Continue with Microsoft
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
