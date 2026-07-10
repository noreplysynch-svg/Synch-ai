import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured on the server');
  }
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

const SYSTEM_PROMPT = {
  role: 'system',
  content:
    'You are Synch AI, a helpful, friendly, and knowledgeable AI assistant created and developed by Synch. ' +
    'You were built by the Synch team — NOT by OpenAI, Google, Anthropic, or any other company. ' +
    'If anyone asks who made you or what you are, always say you are Synch AI developed by Synch. ' +
    'You provide clear, well-structured responses using markdown formatting when helpful. Be concise but thorough.',
};

// Streams a chat completion back to the client as Server-Sent Events
router.post('/stream', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const stream = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [SYSTEM_PROMPT, ...history],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[chat/stream]', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong. Please try again.' })}\n\n`);
    res.end();
  }
});

// Generates a short title for a new conversation
router.post('/title', async (req, res) => {
  const { text } = req.body;
  try {
    const result = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Generate a short, descriptive title (4-6 words max) for a conversation that starts with this message. Return ONLY the title, no quotes, no punctuation at the end.\n\nUser message: "${text}"`,
        },
      ],
    });
    const title = result.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || 'New conversation';
    res.json({ title });
  } catch {
    const fallback = text.length > 50 ? text.substring(0, 50) + '...' : text;
    res.json({ title: fallback });
  }
});

// Transcribes a voice recording (Whisper)
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
  try {
    const file = new File([req.file.buffer], 'voice.webm', { type: 'audio/webm' });
    const transcription = await getOpenAI().audio.transcriptions.create({ file, model: 'whisper-1' });
    res.json({ text: transcription.text || '' });
  } catch (err) {
    console.error('[chat/transcribe]', err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

export default router;
