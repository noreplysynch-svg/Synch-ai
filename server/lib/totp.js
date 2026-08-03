// Minimal RFC 4226 / RFC 6238 (HOTP/TOTP) implementation using Node's built-in
// crypto module only — no extra dependency required. Compatible with Google
// Authenticator, Authy, 1Password, etc.
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

// Generates a random 20-byte secret, base32-encoded (the format authenticator
// apps expect when you type in a "manual entry" key).
export function generateTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

// Verifies a 6-digit code against a base32 secret, allowing the previous and
// next 30s windows to absorb clock drift between the phone and the server.
export function verifyTotp(base32Secret, token) {
  if (!base32Secret || !token) return false;
  const clean = String(token).replace(/\D/g, '');
  if (clean.length !== DIGITS) return false;
  const secretBuffer = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift++) {
    if (hotp(secretBuffer, counter + drift) === clean) return true;
  }
  return false;
}

// otpauth:// URI for QR-code generation, and a spaced-out manual entry key
// for apps where the user types the secret in by hand.
export function totpKeyUri(secret, email, issuer = 'Synch AI') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export function formatSecretForDisplay(secret) {
  return secret.match(/.{1,4}/g)?.join(' ') || secret;
}
