/**
 * Local web search helper — opens a search URL or returns a DuckDuckGo link.
 * Never auto-submits forms or spends money.
 */
const { spawn } = require('child_process');
const config = require('../config');

function buildSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return `https://duckduckgo.com/?q=${q}`;
}

function openUrl(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
    return { ok: true, opened: true };
  } catch (e) {
    return { ok: false, opened: false, error: e.message };
  }
}

function searchWeb(query, { open = true } = {}) {
  const cleaned = String(query || '').trim();
  if (!cleaned) {
    return { ok: false, error: 'Search query missing. Example: Tony browser mein search karo faster whisper' };
  }
  const url = buildSearchUrl(cleaned);
  const opened = open ? openUrl(url) : { ok: true, opened: false };
  return {
    ok: true,
    query: cleaned,
    url,
    opened: Boolean(opened.opened),
    workspace: config.workspaceRoot,
    note: opened.opened
      ? 'Opened search in your default browser. Review results manually.'
      : `Could not auto-open browser (${opened.error || 'unavailable'}). Open this URL manually: ${url}`,
  };
}

module.exports = { searchWeb, buildSearchUrl, openUrl };
