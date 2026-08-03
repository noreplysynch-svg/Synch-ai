import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  validateDob,
  signPendingSignupToken,
  verifyPendingSignupToken,
  signTwoFactorPendingToken,
  verifyTwoFactorPendingToken,
} from '../middleware/auth.js';
import { sendOtpEmail, sendPasswordResetEmail, sendMagicLinkEmail } from '../lib/mailer.js';
import { buildAuthUrl, exchangeCodeForUser } from '../lib/oauth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { generateTotpSecret, verifyTotp, totpKeyUri, formatSecretForDisplay } from '../lib/totp.js';

const router = Router();
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    user_metadata: { full_name: u.full_name || '' },
    provider: u.provider,
    created_at: u.created_at,
  };
}

// Inserts a new user row, enforcing the minimum-age check first. Throws an
// Error with a `.status` code the caller can respond with — 403 for "too young",
// 400 for a missing/invalid date, 409 if the email is already taken.
async function createUserRow({ email, fullName, dob, provider = 'password', providerId = null, passwordHash = null, emailVerified = false }) {
  const dobError = validateDob(dob);
  if (dobError) {
    const err = new Error(dobError);
    err.status = dobError.includes('at least') ? 403 : 400;
    throw err;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('An account with this email already exists');
    err.status = 409;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, date_of_birth, provider, provider_id, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [email, passwordHash, fullName || '', dob, provider, providerId, emailVerified]
  );
  return rows[0];
}

// ── Sign up (email + password) ──────────────────────────────────────────────
router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password, fullName, dob } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (!fullName) return res.status(400).json({ error: 'Name is required' });

  let user;
  try {
    const hash = await bcrypt.hash(password, 10);
    user = await createUserRow({ email, fullName, dob, provider: 'password', passwordHash: hash });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
}));

// ── Check email (drives the progressive login screen) ───────────────────────
// Tells the client whether to show a password field or point the person at
// sign-up / their OAuth provider, before they type anything sensitive.
router.post('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { rows } = await pool.query('SELECT provider, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) return res.json({ exists: false });
  res.json({ exists: true, hasPassword: !!user.password_hash, provider: user.provider });
}));

// ── Sign in (email + password) ──────────────────────────────────────────────
// If the account has 2FA turned on, this doesn't start a session yet — it
// hands back a short-lived tempToken and the client collects the 6-digit code
// next, via /2fa/verify.
router.post('/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.totp_enabled) {
    const tempToken = signTwoFactorPendingToken(user);
    return res.json({ requires2FA: true, tempToken });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
}));

// ── 2FA: verify code and finish signing in ──────────────────────────────────
router.post('/2fa/verify', asyncHandler(async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Code is required' });

  let payload;
  try {
    payload = verifyTwoFactorPendingToken(tempToken);
  } catch {
    return res.status(401).json({ error: 'Your sign-in session expired — please sign in again' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user || !user.totp_enabled || !verifyTotp(user.totp_secret, code)) {
    return res.status(401).json({ error: 'Incorrect code' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
}));

// ── 2FA: setup / enable / disable (used from Settings) ───────────────────────
router.get('/2fa/status', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [req.userId]);
  res.json({ enabled: !!rows[0]?.totp_enabled });
}));

// Generates a new secret and stores it (not yet enabled) so the client can
// show a manual-entry key; nothing is enforced until /2fa/enable confirms it.
router.post('/2fa/setup', requireAuth, asyncHandler(async (req, res) => {
  const secret = generateTotpSecret();
  await pool.query('UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2', [secret, req.userId]);
  const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
  res.json({
    secret: formatSecretForDisplay(secret),
    otpauthUrl: totpKeyUri(secret, rows[0].email),
  });
}));

router.post('/2fa/enable', requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body;
  const { rows } = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.userId]);
  const secret = rows[0]?.totp_secret;
  if (!secret || !verifyTotp(secret, code)) return res.status(401).json({ error: 'Incorrect code' });
  await pool.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [req.userId]);
  res.json({ ok: true });
}));

router.post('/2fa/disable', requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  const user = rows[0];
  if (user?.password_hash) {
    if (!password) return res.status(400).json({ error: 'Enter your password to turn off 2FA' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
  }
  await pool.query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1', [req.userId]);
  res.json({ ok: true });
}));

// ── Sign out ─────────────────────────────────────────────────────────────────
router.post('/signout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ── Current session ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(rows[0]) });
}));

// ── Update profile ──────────────────────────────────────────────────────────
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { fullName } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET full_name = $1 WHERE id = $2 RETURNING *',
    [fullName, req.userId]
  );
  res.json({ user: publicUser(rows[0]) });
}));

// ── OTP: send code ───────────────────────────────────────────────────────────
// Note: this no longer silently creates a user row. New emails complete signup
// (name + date of birth) via /complete-signup after verifying their code.
router.post('/otp/send', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`,
    [email, code, expiresAt]
  );

  await sendOtpEmail(email, code);
  res.json({ ok: true });
}));

// ── OTP: verify code ─────────────────────────────────────────────────────────
// Existing users are logged straight in. Brand-new emails get a short-lived
// pending-signup token instead of an account — the client then collects name +
// date of birth and calls /complete-signup to actually create the row.
router.post('/otp/verify', asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const { rows } = await pool.query('SELECT * FROM otp_codes WHERE email = $1', [email]);
  const record = rows[0];
  if (!record || record.code !== code || new Date(record.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }
  await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);

  const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = userRes.rows[0];

  if (user) {
    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ user: publicUser(user) });
  }

  // New email — needs name + DOB before an account is actually created
  const pendingToken = signPendingSignupToken({ email, fullName: '', provider: 'password', providerId: null });
  res.json({ needsProfile: true, pendingToken });
}));

// ── Complete signup (used after OTP-verify or OAuth for brand-new accounts) ──
router.post('/complete-signup', asyncHandler(async (req, res) => {
  const { token, fullName, dob, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing signup token' });

  let payload;
  try {
    payload = verifyPendingSignupToken(token);
  } catch {
    return res.status(401).json({ error: 'Your signup session expired — please start again' });
  }

  const finalFullName = fullName || payload.fullName || '';

  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  let user;
  try {
    user = await createUserRow({
      email: payload.email,
      fullName: finalFullName,
      dob,
      provider: payload.provider || 'password',
      providerId: payload.providerId || null,
      passwordHash,
      emailVerified: true,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const sessionToken = signToken(user);
  setAuthCookie(res, sessionToken);
  res.json({ user: publicUser(user) });
}));

// ── Passwordless sign-in (magic link) ───────────────────────────────────────
// Deliberately skips 2FA even if the account has it enabled: possession of
// the inbox behind a one-time, 15-minute, single-use link is itself treated
// as the second factor.
router.post('/passwordless/send', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      'INSERT INTO magic_link_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
      [token, email, expiresAt]
    );
    const loginUrl = `${APP_URL}/login/passwordless?token=${token}`;
    await sendMagicLinkEmail(email, loginUrl);
  }
  // Always respond ok — don't leak whether the email exists
  res.json({ ok: true });
}));

router.post('/passwordless/confirm', asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const { rows } = await pool.query('SELECT * FROM magic_link_tokens WHERE token = $1', [token]);
  const record = rows[0];
  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(401).json({ error: 'This link has expired or was already used' });
  }
  await pool.query('DELETE FROM magic_link_tokens WHERE token = $1', [token]);

  const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [record.email]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const sessionToken = signToken(user);
  setAuthCookie(res, sessionToken);
  res.json({ user: publicUser(user) });
}));

// ── Password reset: request ─────────────────────────────────────────────────
router.post('/reset-password/request', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO password_reset_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
      [token, email, expiresAt]
    );
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
  }
  // Always respond ok — don't leak whether the email exists
  res.json({ ok: true });
}));

// ── Password reset: confirm ─────────────────────────────────────────────────
router.post('/reset-password/confirm', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

  const { rows } = await pool.query('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
  const record = rows[0];
  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired reset link' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, record.email]);
  await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
  res.json({ ok: true });
}));

// ── OAuth: Google & Microsoft ────────────────────────────────────────────────
router.get('/oauth/:provider', (req, res) => {
  const { provider } = req.params;
  const state = crypto.randomBytes(16).toString('hex');
  const url = buildAuthUrl(provider, state);
  if (!url) {
    return res.redirect(`${APP_URL}/login?authError=${provider}_not_configured`);
  }
  res.redirect(url);
});

// Existing accounts sign straight in. Brand-new accounts get redirected back
// with a pending-signup token instead of being created immediately — the
// frontend then shows a "finish setting up your account" form for name + DOB.
router.get('/oauth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code } = req.query;
  try {
    const profile = await exchangeCodeForUser(provider, code);
    if (!profile.email) throw new Error('No email returned from provider');

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [profile.email]);
    const user = rows[0];

    if (user) {
      const token = signToken(user);
      setAuthCookie(res, token);
      return res.redirect(APP_URL);
    }

    const pendingToken = signPendingSignupToken({
      email: profile.email,
      fullName: profile.fullName || '',
      provider,
      providerId: profile.providerId,
    });
    const nameParam = profile.fullName ? `&suggestedName=${encodeURIComponent(profile.fullName)}` : '';
    res.redirect(`${APP_URL}/login?completeSignup=${encodeURIComponent(pendingToken)}${nameParam}`);
  } catch (err) {
    console.error(`[oauth:${provider}]`, err.message);
    const reason = err.code === 'workspace_account_not_supported' ? 'workspace_not_supported' : `${provider}_failed`;
    res.redirect(`${APP_URL}/login?authError=${reason}`);
  }
});

export default router;
