import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSchema } from './db.js';
import authRoutes from './routes/auth.js';
import conversationsRoutes from './routes/conversations.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload.js';
import chatRoutes from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);

// Uploaded files (attach a Railway volume at UPLOAD_DIR for persistence — see README)
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Serve the built frontend ────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Global error handler (must be registered last) ──────────────────────────
// Catches anything asyncHandler forwards via next(err), plus sync errors Express
// already routes here itself. Always responds instead of letting Node crash.
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Last-resort nets: log and keep running rather than let an unhandled error
// take the whole process (and every other user's connection) down with it.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

async function start() {
  try {
    await initSchema();
  } catch (err) {
    console.error('[db] failed to initialize schema:', err.message);
  }
  app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
}

start();
