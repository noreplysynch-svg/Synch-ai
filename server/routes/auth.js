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
} from '../middleware/auth.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../lib/mailer.js';
import { buildAuthUrl, exchangeCodeForUser } from '../lib/oauth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

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

// ── Sign in (email + password) ──────────────────────────────────────────────
router.post('/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
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
  const { token, fullName, dob } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing signup token' });
  if (!fullName) return res.status(400).json({ error: 'Name is required' });

  let payload;
  try {
    payload = verifyPendingSignupToken(token);
  } catch {
    return res.status(401).json({ error: 'Your signup session expired — please start again' });
  }

  let user;
  try {
    user = await createUserRow({
      email: payload.email,
      fullName,
      dob,
      provider: payload.provider,
      providerId: payload.providerId,
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
    return res.redirect(`${APP_URL}/?authError=${provider}_not_configured`);
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
    res.redirect(`${APP_URL}/?completeSignup=${encodeURIComponent(pendingToken)}`);
  } catch (err) {
    console.error(`[oauth:${provider}]`, err.message);
    res.redirect(`${APP_URL}/?authError=${provider}_failed`);
  }
});

export default router;
