import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.use(requireAuth);

// List conversations for the current user
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    [req.userId]
  );
  res.json({ data: rows });
}));

// Create a conversation
router.post('/', asyncHandler(async (req, res) => {
  const { title, messages, model, pinned, is_temporary } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO conversations (user_id, title, messages, model, pinned, is_temporary)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      req.userId,
      title || 'New conversation',
      JSON.stringify(messages || []),
      model || 'synch-4',
      !!pinned,
      !!is_temporary,
    ]
  );
  res.status(201).json({ data: rows[0] });
}));

// Update a conversation (partial)
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = [];
  const values = [];
  let i = 1;

  for (const key of ['title', 'messages', 'model', 'pinned', 'is_temporary']) {
    if (key in req.body) {
      fields.push(`${key} = $${i}`);
      values.push(key === 'messages' ? JSON.stringify(req.body[key]) : req.body[key]);
      i++;
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  fields.push(`updated_at = now()`);
  values.push(id, req.userId);

  const { rows } = await pool.query(
    `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ data: rows[0] });
}));

// Delete a single conversation
router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
}));

// Delete all conversations for the current user
router.delete('/', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE user_id = $1', [req.userId]);
  res.json({ ok: true });
}));

// Count (used by the Storage settings panel)
router.get('/_count', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM conversations WHERE user_id = $1', [req.userId]);
  res.json({ count: rows[0].count });
}));

export default router;
