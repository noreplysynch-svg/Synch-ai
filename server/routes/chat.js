import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import { searchWeb, formatResultsForPrompt } from '../lib/webSearch.js';
import { UPLOAD_DIR } from './upload.js';

// Groq exposes an OpenAI-compatible API, so we reuse the `openai` SDK and just
// point it at Groq's endpoint. Groq's free tier is what powers this — get a
// key at https://console.groq.com/keys and set GROQ_API_KEY in your env.
let _groq = null;
function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server');
  }
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
}

// Model IDs below as of Aug 2026 — Groq deprecates/renames models over time.
// If any of these ever start erroring, check https://console.groq.com/docs/models
// (or https://console.groq.com/docs/deprecations) for current replacements.
const FAST_MODEL = 'openai/gpt-oss-20b';   // Synch 4 — quick, short, Gemini-Flash-like
const SMART_MODEL = 'openai/gpt-oss-120b'; // Synch 4 Pro / Vision / Search — deeper reasoning
const VISION_MODEL = 'qwen/qwen3.6-27b';   // only vision-capable model in the lineup right now
const TITLE_MODEL = 'openai/gpt-oss-20b';  // small + fast, plenty for a 4-6 word title
const TRANSCRIBE_MODEL = 'whisper-large-v3-turbo';

// The 4 personas in the model picker. Every persona still gets image
// understanding (auto-switches to VISION_MODEL whenever a message has an
// image, regardless of tier) and web search (toggle still works for all of
// them) — `chat` just controls which brain answers, `forceSearch` means this
// persona always searches even if the toggle is off, and `styleNote` nudges
// tone/length to match what each persona is supposed to feel like.
const MODEL_TIERS = {
  'synch-4': {
    chat: FAST_MODEL,
    styleNote: 'Answer quickly and concisely — favor short, direct answers over long ones. Only go in-depth if the user explicitly asks for more detail or the question genuinely requires it.',
  },
  'synch-4-pro': {
    chat: SMART_MODEL,
    styleNote: 'You have more room to reason carefully — think through complex or nuanced questions thoroughly and give well-reasoned, complete answers.',
  },
  'synch-vision': {
    chat: SMART_MODEL,
    forceVision: true,
    styleNote: 'You have more room to reason carefully — think through complex or nuanced questions thoroughly. Pay close, careful attention to visual detail in any images.',
  },
  'synch-search': {
    chat: SMART_MODEL,
    forceSearch: true,
    styleNote: 'You have more room to reason carefully — think through complex or nuanced questions thoroughly and give well-reasoned, complete answers.',
  },
};
const DEFAULT_TIER = MODEL_TIERS['synch-4'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

const IMAGE_EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Turns an uploaded file's URL into a base64 data URI by reading it straight
// off disk. We can't just hand Groq the URL — on localhost it's not reachable
// from Groq's servers, so the actual image bytes have to be inlined instead.
// Returns null for non-image files (docs etc. aren't sent to the model).
function imageUrlToDataUri(fileUrl) {
  try {
    const filename = decodeURIComponent(new URL(fileUrl).pathname.split('/').pop());
    const mime = IMAGE_EXT_MIME[path.extname(filename).toLowerCase()];
    if (!mime) return null;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// Converts stored messages into the shape the model expects. Any message with
// image attachments gets a multi-part content array (text + image_url parts)
// instead of a plain string, which is what triggers vision mode.
function buildModelHistory(rawMessages) {
  let hasImage = false;
  const history = rawMessages.map((m) => {
    const imageUris = (m.file_urls || []).map(imageUrlToDataUri).filter(Boolean);
    if (imageUris.length === 0) return { role: m.role, content: m.content };
    hasImage = true;
    const parts = [];
    if (m.content) parts.push({ type: 'text', text: m.content });
    for (const uri of imageUris) parts.push({ type: 'image_url', image_url: { url: uri } });
    return { role: m.role, content: parts };
  });
  return { history, hasImage };
}

const BASE_SYSTEM_PROMPT =
  'You are Synch AI, a helpful, friendly, and knowledgeable AI assistant created and developed by Synch. ' +
  'You were built by the Synch team — NOT by OpenAI, Google, Anthropic, Meta, or any other company. ' +
  'If anyone asks who made you or what you are, always say you are Synch AI developed by Synch. ' +
  'You provide clear, well-structured responses using markdown formatting when helpful. Be concise but thorough.';

const WEB_SEARCH_OFF_NOTE =
  '\n\nWeb search is currently turned OFF. You do not have live internet access right now and cannot browse ' +
  'the web or fetch current information. If the user asks you to search the internet, or asks about something ' +
  'that would require up-to-date/real-time information, briefly and naturally let them know you don\'t have ' +
  'internet access at the moment and that they can turn on web search using the globe icon in the message box. ' +
  'Then still try to help with whatever general knowledge you do have.';

function buildWebSearchContextMessage(query, resultsText) {
  return {
    role: 'system',
    content:
      `Web search is turned ON. Here are live web search results for the query "${query}":\n\n${resultsText}\n\n` +
      'Use these results to inform your answer where relevant. Synthesize the information in your own words, ' +
      'mention it came from a web search if relevant, and don\'t just list the raw results. If the results don\'t ' +
      'actually answer the question, say so.',
  };
}

// Explicit asks like "search the web for X" or "did you search the web" should
// never depend on a small model correctly guessing intent — check for them
// directly first, and only fall back to the LLM judgment call for ambiguous
// messages where it's not obvious either way.
const EXPLICIT_SEARCH_PHRASES = /\b(search(ed)? (the )?web|search online|search for (this|that|it)|google (it|this|that)|look(ed)? (it |that |this )?up online|check online|browse the (web|internet)|find (this |that |it )?online)\b/i;

// Web search being "on" means it's available, not that every message should
// trigger it — a plain "hello" doesn't need a search. This cheap, fast call
// decides per-message whether one is actually warranted.
//
// NOTE: TITLE_MODEL (gpt-oss) is a reasoning model — it spends tokens on a
// hidden "thinking" pass before writing the actual answer, and that thinking
// still eats into max_completion_tokens. A too-small budget here means the
// call gets cut off *during* the thinking phase and never reaches "YES"/"NO",
// so it always looks like "NO" and search silently never fires. Give it real
// headroom and turn reasoning effort down so it doesn't think for too long.
async function needsWebSearch(query) {
  if (EXPLICIT_SEARCH_PHRASES.test(query)) return true;
  try {
    const result = await getGroq().chat.completions.create({
      model: TITLE_MODEL,
      max_completion_tokens: 100,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            'Decide if answering this message well requires a live web search. Reply with exactly one word: ' +
            'YES or NO — nothing else, no explanation. Say YES for things that genuinely need current, real-time, ' +
            'or specific factual lookups (news, prices, scores, recent events, "latest", specific facts/stats you ' +
            'would not just know, or any explicit request to search). Say NO for greetings, small talk, opinions, ' +
            'general knowledge, coding help, creative writing, or anything answerable without searching.',
        },
        { role: 'user', content: query },
      ],
    });
    const answer = (result.choices[0]?.message?.content || '').trim().toUpperCase();
    if (!answer) console.error('[chat/stream] needsWebSearch got an empty response — treating as NO');
    return answer.includes('YES');
  } catch (err) {
    // If the check itself fails, fail safe — answer normally rather than error out.
    console.error('[chat/stream] needsWebSearch check failed:', err.message);
    return false;
  }
}

// Streams a chat completion back to the client as Server-Sent Events
router.post('/stream', async (req, res) => {
  const { messages, webSearch, model } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

  const tier = MODEL_TIERS[model] || DEFAULT_TIER;
  const effectiveWebSearch = webSearch || !!tier.forceSearch;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const { history, hasImage } = buildModelHistory(messages.slice(-10));
    const systemMessages = [{ role: 'system', content: `${BASE_SYSTEM_PROMPT} ${tier.styleNote}` }];

    if (effectiveWebSearch) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const query = lastUserMsg?.content?.trim();
      if (query && (await needsWebSearch(query))) {
        // Tell the client a search is happening so it can show a "Searching the
        // web..." indicator before any answer text exists.
        send({ search: 'start' });
        try {
          const results = await searchWeb(query);
          // Send just {title, url} for the source chips — keep the scraped
          // content server-side, it's only needed for the model's context.
          send({ search: 'done', sources: results.map((r) => ({ title: r.title, url: r.url })) });
          if (results.length) {
            systemMessages.push(buildWebSearchContextMessage(query, formatResultsForPrompt(results)));
          } else {
            systemMessages.push({
              role: 'system',
              content: 'Web search is turned ON, but no results were found for the query. Let the user know briefly, then answer as best you can from general knowledge.',
            });
          }
        } catch (searchErr) {
          console.error('[chat/stream] web search failed:', searchErr.message);
          send({ search: 'done', sources: [] });
          systemMessages.push({
            role: 'system',
            content: 'Web search is turned ON, but the search didn\'t go through right now. Briefly let the user know, then answer as best you can from general knowledge.',
          });
        }
      } else {
        // Search is available but wasn't triggered for this specific message
        // (it didn't need one). Make sure the model doesn't pretend it
        // searched anyway and invent fake "search results".
        systemMessages.push({
          role: 'system',
          content: 'No web search was run for this specific message. Answer from your own knowledge — do not claim or imply you searched the web, and do not invent search results.',
        });
      }
    } else {
      systemMessages[0].content += WEB_SEARCH_OFF_NOTE;
    }

    const chatModel = (hasImage || tier.forceVision) ? VISION_MODEL : tier.chat;
    // Qwen puts its reasoning inline in the answer (literal <think>...</think>
    // text) unless told not to. gpt-oss models don't support this param at
    // all — sending it there would 400 — so only add it for qwen models.
    const extraParams = chatModel.startsWith('qwen/') ? { reasoning_format: 'hidden' } : {};

    const stream = await getGroq().chat.completions.create({
      model: chatModel,
      stream: true,
      ...extraParams,
      messages: [...systemMessages, ...history],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) send({ delta });
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[chat/stream]', err.status || '', err.message, err.error?.message || '');
    send({ error: 'Something went wrong. Please try again.' });
    res.end();
  }
});

// Generates a short title for a new conversation
router.post('/title', async (req, res) => {
  const { text } = req.body;
  try {
    const result = await getGroq().chat.completions.create({
      model: TITLE_MODEL,
      max_completion_tokens: 60,
      reasoning_effort: 'low',
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

// Transcribes a voice recording (Whisper, via Groq)
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
  try {
    const file = new File([req.file.buffer], 'voice.webm', { type: 'audio/webm' });
    const transcription = await getGroq().audio.transcriptions.create({ file, model: TRANSCRIBE_MODEL });
    res.json({ text: transcription.text || '' });
  } catch (err) {
    console.error('[chat/transcribe]', err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

export default router;