/**
 * Scraper Media — context-optimized web scraping MCP (cotdp/scraper-mcp).
 * Falls back to Firecrawl when MCP not running.
 */
const config = require('../config');
const hub = require('./hub');

function mcpUrl() {
  return config.mcp.scraperMedia.mcpUrl;
}

function status() {
  return hub.statusFor('scraper-media', mcpUrl(), {
    fallback: 'firecrawl',
  });
}

async function scrape(url, options = {}) {
  const base = mcpUrl();
  if (base) {
    const result = await hub.callServer(base, 'scrape_url', {
      url,
      css_selector: options.css_selector,
      render_js: options.render_js ?? false,
    });
    if (result.ok) return { ok: true, ...result, source: 'scraper-mcp' };
  }

  const firecrawl = require('./firecrawl');
  if (firecrawl.status().configured) {
    const fc = await firecrawl.scrape(url);
    if (fc.ok) return { ...fc, source: 'firecrawl-fallback' };
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { ok: true, url, markdown: text.slice(0, 12000), source: 'fetch-fallback' };
}

async function scrapeBatch(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  const results = [];
  for (const url of list.slice(0, 10)) {
    results.push(await scrape(url, options));
  }
  return { ok: true, results };
}

async function extractLinks(url) {
  const base = mcpUrl();
  if (base) {
    return hub.callServer(base, 'scrape_extract_links', { url });
  }
  const page = await scrape(url);
  const links = [...(page.markdown || '').matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]);
  return { ok: true, links: [...new Set(links)].slice(0, 50) };
}

module.exports = { status, scrape, scrapeBatch, extractLinks };
