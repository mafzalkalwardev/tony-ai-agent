/**
 * Full-web research helpers — any public http(s) URL, multi-source gather.
 * Does not bypass paywalls with stolen credentials. Stops before payment.
 */
const { searchWeb, buildSearchUrl, openUrl } = require('./web_search');

async function fetchUrl(url, { maxChars = 12000 } = {}) {
  const cleaned = String(url || '').trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    return { ok: false, error: 'Only http(s) URLs are allowed' };
  }
  try {
    const response = await fetch(cleaned, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'TONY-Research/2.9 (+local-operator)' },
      redirect: 'follow',
    });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    return {
      ok: true,
      url: cleaned,
      status: response.status,
      contentType,
      body: text.slice(0, maxChars),
      truncated: text.length > maxChars,
    };
  } catch (e) {
    return { ok: false, url: cleaned, error: e.message };
  }
}

async function researchTopic(query, { openBrowser = false, urls = [] } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Research query required' };

  const engines = [
    buildSearchUrl(q),
    `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
  ];

  const pages = [];
  // Always try DDG HTML results page as a free scrape target
  const ddg = await fetchUrl(engines[3], { maxChars: 8000 });
  pages.push({ source: 'duckduckgo-html', ...ddg });

  for (const url of urls.slice(0, 5)) {
    pages.push({ source: 'user-url', ...(await fetchUrl(url)) });
  }

  let opened = null;
  if (openBrowser) {
    opened = searchWeb(q, { open: true });
  }

  const excerpts = pages
    .filter((p) => p.ok)
    .map((p) => `### ${p.source}: ${p.url}\n${stripHtml(p.body).slice(0, 1500)}`)
    .join('\n\n');

  return {
    ok: true,
    query: q,
    engines,
    opened,
    pages: pages.map((p) => ({ source: p.source, url: p.url, ok: p.ok, status: p.status, error: p.error })),
    markdown: `# Research: ${q}

## Search entry points
${engines.map((u) => `- ${u}`).join('\n')}

## Fetched excerpts
${excerpts || '_No page body fetched (network/offline). Use browser tools or open links above._'}

Tony can open/browse any public site for research. Payment/checkout always pauses for you.
`,
  };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function browseSite(url, { open = true } = {}) {
  const fetched = await fetchUrl(url);
  let opened = null;
  if (open) opened = openUrl(url);
  return {
    ok: fetched.ok,
    ...fetched,
    opened: Boolean(opened?.opened),
    markdown: fetched.ok
      ? `# Browsed ${url}\n\nStatus ${fetched.status}\n\n${stripHtml(fetched.body).slice(0, 3000)}`
      : `# Browse failed\n${fetched.error}`,
  };
}

module.exports = { fetchUrl, researchTopic, browseSite, stripHtml };
