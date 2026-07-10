// Talks to our own Express backend instead of Supabase.
// In dev, Vite proxies /api and /uploads to the backend (see vite.config.js).
// In production, the backend serves the built frontend itself, so it's same-origin.

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // response wasn't JSON
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  me: () => request('/api/auth/me'),
  signUp: (email, password, fullName, dob) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, fullName, dob }) }),
  signIn: (email, password) =>
    request('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signOut: () => request('/api/auth/signout', { method: 'POST' }),
  updateProfile: (fullName) =>
    request('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName }) }),
  sendOtp: (email) => request('/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email, code) =>
    request('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
  requestPasswordReset: (email) =>
    request('/api/auth/reset-password/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token, newPassword) =>
    request('/api/auth/reset-password/confirm', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  oauthUrl: (provider) => `/api/auth/oauth/${provider}`,
  completeSignup: (token, fullName, dob) =>
    request('/api/auth/complete-signup', { method: 'POST', body: JSON.stringify({ token, fullName, dob }) }),
};

// ── Conversations ────────────────────────────────────────────────────────────
export const conversations = {
  list: () => request('/api/conversations').then((r) => r.data),
  create: (payload) =>
    request('/api/conversations', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.data),
  update: (id, payload) =>
    request(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((r) => r.data),
  remove: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
  removeAll: () => request('/api/conversations', { method: 'DELETE' }),
  count: () => request('/api/conversations/_count').then((r) => r.count),
};

// ── Files ────────────────────────────────────────────────────────────────────
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json(); // { url, name }
}

// ── Chat (streaming) ─────────────────────────────────────────────────────────
// Streams assistant text via Server-Sent Events; calls onDelta(text) per chunk.
export async function streamChat(messages, onDelta) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) throw new Error('Chat request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // keep incomplete chunk for next read
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      const parsed = JSON.parse(payload);
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.delta) onDelta(parsed.delta);
    }
  }
}

export const generateTitle = (text) =>
  request('/api/chat/title', { method: 'POST', body: JSON.stringify({ text }) }).then((r) => r.title);

export async function transcribeAudio(blob) {
  const formData = new FormData();
  formData.append('audio', blob, 'voice.webm');
  const res = await fetch('/api/chat/transcribe', { method: 'POST', credentials: 'include', body: formData });
  if (!res.ok) throw new Error('Transcription failed');
  const data = await res.json();
  return data.text;
}
