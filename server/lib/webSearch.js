// Lightweight web search helper (Tavily). Free tier: ~1000 searches/month.
// Get a key at https://tavily.com — set TAVILY_API_KEY in your env.

export async function searchWeb(query, { maxResults = 5 } = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured on the server');
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status})`);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  // Structured, so the server can send {title,url} to the client for source
  // chips AND build a text context block for the model, from the same data.
  return results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    content: (r.content || '').slice(0, 600),
  }));
}

// Turns structured results into a compact context block the model can ground answers in.
export function formatResultsForPrompt(results) {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n');
}
