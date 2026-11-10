/**
 * Lightweight parameter extraction for mixed-language operator commands.
 */

function extractSearchQuery(message) {
  const raw = String(message || '').trim();
  const patterns = [
    /(?:browser\s+(?:mein|me)\s+search|search\s+(?:web|karo|for)|google|dhundo)\s*[:\-]?\s*(.+)$/i,
    /search\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return clean(m[1]);
  }
  return '';
}

function extractFilePath(message) {
  const raw = String(message || '').trim();
  const quoted = raw.match(/["'`]([^"'`]+)["'`]/);
  if (quoted?.[1] && /[./\\]/.test(quoted[1])) return quoted[1].trim();
  const pathLike = raw.match(/((?:\.\/|[\w.-]+\/)+[\w.-]+\.[\w]+)/);
  if (pathLike?.[1]) return pathLike[1];
  const after = raw.match(/(?:read|parho|open|file)\s+([^\s]+)/i);
  if (after?.[1] && /\./.test(after[1])) return after[1];
  return '';
}

function extractAppName(message) {
  const raw = String(message || '').toLowerCase();
  const apps = [
    ['vscode', /vs\s*code|vscode|visual studio code/i],
    ['terminal', /terminal|powershell|cmd|command prompt/i],
    ['chrome', /chrome|google chrome/i],
    ['browser', /\bbrowser\b/i],
    ['notepad', /notepad/i],
    ['explorer', /file explorer|explorer|folder/i],
    ['calculator', /calculator|\bcalc\b/i],
  ];
  for (const [name, re] of apps) {
    if (re.test(raw)) return name;
  }
  return '';
}

function extractCommitTopic(message) {
  const raw = String(message || '').trim();
  const m =
    raw.match(/commit\s+message\s+(?:for|banao|about)?\s*[:\-]?\s*(.+)$/i) ||
    raw.match(/(?:about|for)\s+(.+)$/i);
  return m?.[1] ? clean(m[1]) : '';
}

function extractDeliveryTopic(message) {
  const raw = String(message || '').trim();
  const m = raw.match(/(?:client(?:\s+ke\s+liye)?(?:\s+message)?|delivery)\s*(?:about|for|banao)?\s*[:\-]?\s*(.+)$/i);
  if (!m?.[1]) return '';
  const topic = clean(m[1]);
  if (/^(banao|message|note|package|report)$/i.test(topic)) return '';
  return topic;
}

function clean(text) {
  return String(text || '')
    .replace(/^(karo|please|pls)\s+/i, '')
    .replace(/\s+(karo|please|pls)$/i, '')
    .replace(/^(tony[,:]?\s*)/i, '')
    .trim();
}

function extractAll(message) {
  return {
    searchQuery: extractSearchQuery(message),
    filePath: extractFilePath(message),
    appName: extractAppName(message),
    commitTopic: extractCommitTopic(message),
    deliveryTopic: extractDeliveryTopic(message),
  };
}

module.exports = {
  extractSearchQuery,
  extractFilePath,
  extractAppName,
  extractCommitTopic,
  extractDeliveryTopic,
  extractAll,
};
