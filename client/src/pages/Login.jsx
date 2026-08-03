import React, { useState, useEffect, useRef } from 'react';
import { auth } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import BackButton from '@/components/auth/BackButton';
import { Sparkles, Check, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ── Small shared pieces ──────────────────────────────────────────────────────

function Logo({ title = 'Synch AI', subtitle }) {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 text-center">{subtitle}</p>}
    </div>
  );
}

function PrimaryButton({ children, loading = false, loadingText, ...props }) {
  return (
    <Button className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 font-medium gap-2" disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading ? (loadingText || children) : children}
    </Button>
  );
}

// Full-screen "logging in..." popup, used after successful authentication before redirect
function LoadingOverlay({ label = 'Logging in…' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl px-8 py-7 shadow-lg"
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm font-medium text-foreground">{label}</p>
      </motion.div>
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-destructive/15 border border-destructive/30 text-destructive text-sm p-3 rounded-xl flex items-center gap-2 mb-3"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
      <span className="font-medium">{message}</span>
    </motion.div>
  );
}

function SuccessCheck({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="h-14 w-14 rounded-full bg-primary flex items-center justify-center mb-4"
      >
        <Check className="w-7 h-7 text-white" strokeWidth={3} />
      </motion.div>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function Step({ stepKey, children }) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15 }}
      className="w-full max-w-sm space-y-3"
    >
      {children}
    </motion.div>
  );
}

const todayISO = () => new Date().toISOString().split('T')[0];
const settle = () => new Promise(r => setTimeout(r, 400));

// ── Main component ───────────────────────────────────────────────────────────

export default function Login() {
  const { checkUserAuth } = useAuth();

  // Mode & Steps:
  // 'login-email' | 'login-password' | 'login-2fa' | 'login-forgot-sent' | 'login-passwordless-sent'
  // | 'passwordless-confirming' | 'passwordless-success' | 'passwordless-error'
  // | 'signup-email' | 'signup-password' | 'signup-details'
  // | 'oauth-password' | 'oauth-dob'
  const [step, setStep] = useState('login-email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailAccount, setEmailAccount] = useState(null); // result of checkEmail: { exists, hasPassword, provider }

  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState(null);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');

  // Explicit inline error banner state
  const [errorMessage, setErrorMessage] = useState('');

  // OAuth / OTP brand-new-account completion
  const [pendingToken, setPendingToken] = useState(null);

  const [loading, setLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  const passwordlessTokenRef = useRef(null);

  // Clear error message whenever user changes step or inputs
  const clearError = () => setErrorMessage('');

  // Pick up: an OAuth "finish signing up" redirect, a failed-OAuth error, or a passwordless magic-link visit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const completeToken = params.get('completeSignup');
    const authError = params.get('authError');
    const suggestedName = params.get('suggestedName');
    const magicToken = params.get('token');
    const isPasswordlessRoute = window.location.pathname === '/login/passwordless';

    if (completeToken) {
      setPendingToken(completeToken);
      if (suggestedName) setName(suggestedName);
      setStep('oauth-password');
    } else if (authError) {
      const msg = authError === 'workspace_not_supported'
        ? 'Please use a personal account (e.g. name@gmail.com) — work or school accounts aren\'t supported.'
        : 'Sign-in failed. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } else if (isPasswordlessRoute && magicToken) {
      passwordlessTokenRef.current = magicToken;
      setStep('passwordless-confirming');
    }

    if (completeToken || authError || magicToken) {
      window.history.replaceState({}, '', isPasswordlessRoute ? '/login/passwordless' : '/login');
    }
  }, []);

  // Confirm the magic link the moment we land in that step
  useEffect(() => {
    if (step !== 'passwordless-confirming') return;
    (async () => {
      try {
        await auth.confirmPasswordlessLink(passwordlessTokenRef.current);
        setStep('passwordless-success');
        setTimeout(() => checkUserAuth(), 900);
      } catch (err) {
        setErrorMessage(err.message);
        toast.error(err.message);
        setStep('passwordless-error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goToLoginStart = () => {
    clearError();
    setStep('login-email');
    setEmailAccount(null);
    setPassword('');
    setConfirmPassword('');
    setOtp('');
  };

  const goToSignupStart = () => {
    clearError();
    setStep('signup-email');
    setEmailAccount(null);
    setPassword('');
    setConfirmPassword('');
    setName('');
    setDob('');
  };

  // ── Login: check email ─────────────────────────────────────────────────────
  const handleCheckLoginEmail = async () => {
    clearError();
    if (!email.trim()) {
      const msg = 'Please enter your email address';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const result = await auth.checkEmail(email.trim());
      setEmailAccount(result);
      if (!result.exists) {
        setErrorMessage("That email doesn't match our records.");
        return;
      }
      setStep('login-password');
    } catch (err) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Login: password sign in ────────────────────────────────────────────────
  const handleSignIn = async () => {
    clearError();
    if (!password) {
      const msg = 'Please enter your password';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const result = await auth.signIn(email.trim(), password);
      if (result.requires2FA) {
        setTempToken(result.tempToken);
        setStep('login-2fa');
      } else {
        setShowLoadingOverlay(true);
        await checkUserAuth();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password');
      toast.error(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // ── Login: 2FA step ─────────────────────────────────────────────────────────
  const handleVerify2FA = async (code) => {
    clearError();
    setLoading(true);
    try {
      await auth.verify2FA(tempToken, code);
      setShowLoadingOverlay(true);
      await checkUserAuth();
    } catch (err) {
      setErrorMessage(err.message || 'Incorrect 2FA code');
      toast.error(err.message || 'Incorrect 2FA code');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ──────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    clearError();
    setLoading(true);
    try {
      await auth.requestPasswordReset(email);
      setStep('login-forgot-sent');
    } catch (err) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Passwordless (magic link) ─────────────────────────────────────────────
  const handleSendPasswordless = async () => {
    clearError();
    setLoading(true);
    try {
      await auth.sendPasswordlessLink(email);
      setStep('login-passwordless-sent');
    } catch (err) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── NATIVE SIGNUP: Step 1 (Email Check) ──────────────────────────────────
  const handleSignupEmailSubmit = async () => {
    clearError();
    if (!email.trim()) {
      const msg = 'Please enter your email address';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const result = await auth.checkEmail(email.trim());
      if (result.exists) {
        // Prevent duplicate signup!
        const msg = 'An account with this email already exists. Please sign in instead.';
        setErrorMessage(msg);
        toast.error(msg);
        setEmailAccount(result);
        setStep('login-password'); // redirect to sign in screen
        return;
      }
      // Email is available -> move to password creation step
      setStep('signup-password');
    } catch (err) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── NATIVE SIGNUP: Step 2 (Password Creation) ────────────────────────────
  const handleSignupPasswordSubmit = async () => {
    clearError();
    if (!password) {
      const msg = 'Please create a password';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters long';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (!confirmPassword) {
      const msg = 'Please confirm your password';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    await settle();
    setLoading(false);
    setStep('signup-details');
  };

  // ── NATIVE SIGNUP: Step 3 (Name + Birthday on one screen) ─────────────────
  const handleCreateAccount = async () => {
    clearError();
    if (!name.trim()) {
      const msg = 'Please enter your name';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (!dob) {
      const msg = 'Please enter your date of birth';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await auth.signUp(email.trim(), password, name.trim(), dob);
      setShowLoadingOverlay(true);
      toast.success('Account created successfully!');
      await checkUserAuth();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create account. Please try again.');
      toast.error(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── OAUTH SIGNUP: Step 1 (Password creation for new OAuth user) ──────────
  const handleOauthPasswordSubmit = async () => {
    clearError();
    if (password) {
      if (password.length < 6) {
        const msg = 'Password must be at least 6 characters long';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
      if (password !== confirmPassword) {
        const msg = 'Passwords do not match';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
    }
    setLoading(true);
    await settle();
    setLoading(false);
    setStep('oauth-dob');
  };

  // ── OAUTH SIGNUP: Step 2 (Birthday selection & Account Completion) ───────
  const handleCompleteOauthSignup = async () => {
    clearError();
    if (!dob) {
      const msg = 'Please enter your date of birth';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await auth.completeSignup(pendingToken, name.trim(), dob, password || null);
      setShowLoadingOverlay(true);
      toast.success('Account created successfully!');
      await checkUserAuth();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to complete signup.');
      toast.error(err.message || 'Failed to complete signup.');
      if (err.message?.toLowerCase().includes('expired')) {
        setPendingToken(null);
        goToLoginStart();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OAuth Handlers ────────────────────────────────────────────────────────
  const handleGoogle = () => {
    setLoading(true);
    setShowLoadingOverlay(true);
    window.location.href = auth.oauthUrl('google');
  };

  const handleMicrosoft = () => {
    setLoading(true);
    setShowLoadingOverlay(true);
    window.location.href = auth.oauthUrl('microsoft');
  };

  const OAuthButtons = (
    <div className="space-y-2.5">
      <Button variant="outline" className="w-full h-11 rounded-full gap-2 font-medium" onClick={handleGoogle} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </Button>
      <Button variant="outline" className="w-full h-11 rounded-full gap-2 font-medium" onClick={handleMicrosoft} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#F25022" d="M1 1h10v10H1z"/>
            <path fill="#00A4EF" d="M13 1h10v10H13z"/>
            <path fill="#7FBA00" d="M1 13h10v10H1z"/>
            <path fill="#FFB900" d="M13 13h10v10H13z"/>
          </svg>
        )}
        Continue with Microsoft
      </Button>
    </div>
  );

  const Divider = (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {showLoadingOverlay && <LoadingOverlay label="Signing you in…" />}

      <AnimatePresence mode="wait">

        {/* ══ LOGIN: step 1 (Email) ══ */}
        {step === 'login-email' && (
          <Step stepKey="login-email">
            <Logo subtitle="Sign in to your account" />
            <div className="flex rounded-full bg-secondary p-1 mb-6 text-sm">
              <button className="flex-1 py-1.5 rounded-full font-medium bg-background text-foreground shadow-sm">Login</button>
              <button
                onClick={goToSignupStart}
                className="flex-1 py-1.5 rounded-full font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign up
              </button>
            </div>

            <ErrorBanner message={errorMessage} />

            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError(); setEmailAccount(null); }}
              onKeyDown={e => e.key === 'Enter' && handleCheckLoginEmail()}
              className="h-11 rounded-xl"
              disabled={loading}
              autoFocus
            />
            {emailAccount && emailAccount.exists === false && (
              <p className="text-sm text-destructive font-medium">
                That email doesn't match our records.{' '}
                <button
                  className="underline underline-offset-2 hover:text-destructive/80 font-bold"
                  onClick={goToSignupStart}
                >
                  Create an account?
                </button>
              </p>
            )}
            <PrimaryButton onClick={handleCheckLoginEmail} loading={loading} loadingText="Checking…">
              Continue
            </PrimaryButton>

            {Divider}
            {OAuthButtons}
          </Step>
        )}

        {/* ══ LOGIN: step 2 (Password or OAuth Link Notice) ══ */}
        {step === 'login-password' && (
          <Step stepKey="login-password">
            <BackButton onClick={goToLoginStart} />
            <Logo subtitle="Welcome back" />

            <ErrorBanner message={errorMessage} />

            <div className="flex items-center justify-between text-sm bg-secondary rounded-xl px-3 py-2 mb-1">
              <span className="text-muted-foreground truncate">
                Signing in as <span className="text-foreground font-medium">{email}</span>
              </span>
              <button onClick={goToLoginStart} className="text-primary text-xs font-medium shrink-0 ml-2">
                Not you?
              </button>
            </div>

            {emailAccount?.hasPassword === false ? (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground text-center">
                  This account signs in with {emailAccount.provider === 'microsoft' ? 'Microsoft' : 'Google'}.
                </p>
                {emailAccount.provider === 'microsoft' ? (
                  <Button variant="outline" className="w-full h-11 rounded-full gap-2 font-medium" onClick={handleMicrosoft} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : null}
                    Continue with Microsoft
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full h-11 rounded-full gap-2 font-medium" onClick={handleGoogle} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : null}
                    Continue with Google
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  className="h-11 rounded-xl"
                  disabled={loading}
                  autoFocus
                />
                <PrimaryButton onClick={handleSignIn} loading={loading} loadingText="Signing in…">
                  Sign in
                </PrimaryButton>
                <div className="flex justify-between text-xs text-muted-foreground px-1 pt-1">
                  <button onClick={handleForgotPassword} className="hover:text-foreground">Forgot password?</button>
                  <button onClick={handleSendPasswordless} className="hover:text-foreground">Login without password →</button>
                </div>
              </>
            )}
          </Step>
        )}

        {/* ══ LOGIN: 2FA step ══ */}
        {step === 'login-2fa' && (
          <Step stepKey="login-2fa">
            <BackButton onClick={goToLoginStart} />
            <Logo subtitle="Enter the 6-digit code from your authenticator app" />

            <ErrorBanner message={errorMessage} />

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  clearError();
                  if (val.length === 6) handleVerify2FA(val);
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} className="h-12 w-10 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <PrimaryButton onClick={() => handleVerify2FA(otp)} loading={loading} loadingText="Verifying…" disabled={otp.length !== 6}>
              Verify
            </PrimaryButton>
          </Step>
        )}

        {/* ══ LOGIN: forgot-password sent ══ */}
        {step === 'login-forgot-sent' && (
          <Step stepKey="login-forgot-sent">
            <BackButton onClick={() => setStep('login-password')} />
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Check your email</h1>
              <p className="text-sm text-muted-foreground mt-1">
                If an account exists for <span className="text-foreground font-medium">{email}</span>, a reset link is on its way.
              </p>
            </div>
          </Step>
        )}

        {/* ══ LOGIN: passwordless link sent ══ */}
        {step === 'login-passwordless-sent' && (
          <Step stepKey="login-passwordless-sent">
            <BackButton onClick={() => setStep('login-password')} />
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Check your email</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a sign-in link to <span className="text-foreground font-medium">{email}</span>. Open it on this device to finish signing in.
              </p>
            </div>
          </Step>
        )}

        {/* ══ PASSWORDLESS: confirming ══ */}
        {step === 'passwordless-confirming' && (
          <Step stepKey="passwordless-confirming">
            <div className="flex flex-col items-center text-center gap-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </div>
          </Step>
        )}

        {/* ══ PASSWORDLESS: success ══ */}
        {step === 'passwordless-success' && (
          <Step stepKey="passwordless-success">
            <SuccessCheck title="Login successful" subtitle="Taking you in…" />
          </Step>
        )}

        {/* ══ PASSWORDLESS: error ══ */}
        {step === 'passwordless-error' && (
          <Step stepKey="passwordless-error">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-xl font-bold text-foreground">That link didn't work</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-5">It may have expired or already been used.</p>
              <PrimaryButton onClick={goToLoginStart}>Back to sign in</PrimaryButton>
            </div>
          </Step>
        )}

        {/* ══ NATIVE SIGNUP: Step 1 (Email only) ══ */}
        {step === 'signup-email' && (
          <Step stepKey="signup-email">
            <Logo subtitle="Create your account" />
            <div className="flex rounded-full bg-secondary p-1 mb-6 text-sm">
              <button
                onClick={goToLoginStart}
                className="flex-1 py-1.5 rounded-full font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Login
              </button>
              <button className="flex-1 py-1.5 rounded-full font-medium bg-background text-foreground shadow-sm">
                Sign up
              </button>
            </div>

            <ErrorBanner message={errorMessage} />

            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleSignupEmailSubmit()}
              className="h-11 rounded-xl"
              disabled={loading}
              autoFocus
            />
            <PrimaryButton onClick={handleSignupEmailSubmit} loading={loading} loadingText="Checking email…">
              Continue
            </PrimaryButton>

            {Divider}
            {OAuthButtons}
          </Step>
        )}

        {/* ══ NATIVE SIGNUP: Step 2 (Create Password & Confirm Password) ══ */}
        {step === 'signup-password' && (
          <Step stepKey="signup-password">
            <BackButton onClick={() => setStep('signup-email')} />
            <Logo subtitle="Create a password for your account" />
            <div className="text-xs text-muted-foreground mb-1 px-1">
              Signing up with <span className="text-foreground font-medium">{email}</span>
            </div>

            <ErrorBanner message={errorMessage} />

            <Input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={e => { setPassword(e.target.value); clearError(); }}
              className="h-11 rounded-xl"
              disabled={loading}
              autoFocus
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleSignupPasswordSubmit()}
              className="h-11 rounded-xl"
              disabled={loading}
            />
            <PrimaryButton onClick={handleSignupPasswordSubmit} loading={loading} loadingText="Continuing…">
              Continue
            </PrimaryButton>
          </Step>
        )}

        {/* ══ NATIVE SIGNUP: Step 3 (Name AND Birthday on ONE screen, 2 separate fields) ══ */}
        {step === 'signup-details' && (
          <Step stepKey="signup-details">
            <BackButton onClick={() => setStep('signup-password')} />
            <Logo subtitle="Tell us a bit about yourself" />

            <ErrorBanner message={errorMessage} />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block px-1">Your Name</label>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={e => { setName(e.target.value); clearError(); }}
                  className="h-11 rounded-xl"
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block px-1">Date of Birth</label>
                <Input
                  type="date"
                  value={dob}
                  onChange={e => { setDob(e.target.value); clearError(); }}
                  max={todayISO()}
                  className="h-11 rounded-xl"
                  disabled={loading}
                />
              </div>
            </div>
            <PrimaryButton onClick={handleCreateAccount} loading={loading} loadingText="Creating account…">
              Create account
            </PrimaryButton>
            <p className="text-xs text-muted-foreground text-center pt-1">You must be at least 13 years old to use Synch AI.</p>
          </Step>
        )}

        {/* ══ NEW OAUTH SIGNUP: Step 1 (Create Password - Name is skipped) ══ */}
        {step === 'oauth-password' && (
          <Step stepKey="oauth-password">
            <Logo subtitle={`Welcome${name ? `, ${name}` : ''}! Set up a password for your account`} />
            <p className="text-xs text-muted-foreground text-center mb-2">
              (Optional) Create a password to also log in with your email directly.
            </p>

            <ErrorBanner message={errorMessage} />

            <Input
              type="password"
              placeholder="Create a password (optional)"
              value={password}
              onChange={e => { setPassword(e.target.value); clearError(); }}
              className="h-11 rounded-xl"
              disabled={loading}
              autoFocus
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleOauthPasswordSubmit()}
              className="h-11 rounded-xl"
              disabled={loading}
            />
            <PrimaryButton onClick={handleOauthPasswordSubmit} loading={loading} loadingText="Continuing…">
              Continue
            </PrimaryButton>
          </Step>
        )}

        {/* ══ NEW OAUTH SIGNUP: Step 2 (Birthday Selection & Complete Account) ══ */}
        {step === 'oauth-dob' && (
          <Step stepKey="oauth-dob">
            <BackButton onClick={() => setStep('oauth-password')} />
            <Logo subtitle={`When's your birthday${name ? `, ${name}` : ''}?`} />

            <ErrorBanner message={errorMessage} />

            <Input
              type="date"
              value={dob}
              onChange={e => { setDob(e.target.value); clearError(); }}
              max={todayISO()}
              className="h-11 rounded-xl"
              disabled={loading}
              autoFocus
            />
            <PrimaryButton onClick={handleCompleteOauthSignup} loading={loading} loadingText="Creating account…">
              Create account
            </PrimaryButton>
            <p className="text-xs text-muted-foreground text-center">You must be at least 13 years old to use Synch AI.</p>
          </Step>
        )}

      </AnimatePresence>
    </div>
  );
}
