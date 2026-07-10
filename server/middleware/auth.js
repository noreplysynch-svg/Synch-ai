import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const MIN_SIGNUP_AGE = 13;

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

// Short-lived token for OAuth users who authenticated with Google/Microsoft but
// haven't finished providing name + date of birth yet. Nothing is written to the
// users table until this is exchanged for a real account via /complete-oauth-signup.
export function signPendingSignupToken(profile) {
  return jwt.sign(
    { type: 'pending_oauth_signup', email: profile.email, fullName: profile.fullName, provider: profile.provider, providerId: profile.providerId },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function verifyPendingSignupToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.type !== 'pending_oauth_signup') throw new Error('Invalid token type');
  return payload;
}

export function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Returns an error message if the date of birth is missing/invalid/too young, else null.
export function validateDob(dobString) {
  if (!dobString) return 'Date of birth is required';
  const age = calculateAge(dobString);
  if (age === null) return 'Please enter a valid date of birth';
  if (age < 0 || age > 120) return 'Please enter a valid date of birth';
  if (age < MIN_SIGNUP_AGE) return `You must be at least ${MIN_SIGNUP_AGE} years old to create an account`;
  return null;
}

export function setAuthCookie(res, token) {
  res.cookie('synch_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

export function clearAuthCookie(res) {
  res.clearCookie('synch_session');
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.synch_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Like requireAuth but doesn't fail the request — just attaches userId if present
export function optionalAuth(req, res, next) {
  const token = req.cookies?.synch_session;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
  } catch {
    // ignore invalid token
  }
  next();
}
