/**
 * Keep LLM prompts under provider context limits.
 * Strips base64 blobs, truncates tool results, and trims old turns.
 */

const STRIP_KEYS = new Set([
  'imageBase64',
  'audioBase64',
  'image_base64',
  'audio_base64',
  'screenshot',
  'data',
  'embedding',
  'embeddings',
]);

const DEFAULT_MAX_CONTEXT_TOKENS = 100000;
const DEFAULT_TOOL_RESULT_CHARS = 4000;
const DEFAULT_EPISODE_CHARS = 6000;
const DEFAULT_HISTORY_TURNS = 12;

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function messageTokens(msg) {
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
  return estimateTokens(content) + 4;
}

function truncateText(text, maxChars) {
  const s = String(text || '');
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n…[truncated ${s.length - maxChars} chars]`;
}

function sanitizeValue(value, depth = 0, maxChars = DEFAULT_TOOL_RESULT_CHARS) {
  if (value == null || depth > 6) return value;

  if (typeof value === 'string') {
    if (value.length > maxChars) {
      if (/^[A-Za-z0-9+/=\s]{500,}$/.test(value.replace(/\s/g, ''))) {
        return `[binary/base64 omitted — ${value.length} chars]`;
      }
      return truncateText(value, maxChars);
    }
    return value;
  }

  if (Array.isArray(value)) {
    const maxItems = 20;
    const trimmed = value.slice(0, maxItems).map((v) => sanitizeValue(v, depth + 1, maxChars));
    if (value.length > maxItems) {
      trimmed.push(`…[${value.length - maxItems} more items omitted]`);
    }
    return trimmed;
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (STRIP_KEYS.has(key)) {
        const len = typeof val === 'string' ? val.length : 0;
        out[key] = len ? `[omitted — ${len} chars]` : '[omitted]';
        continue;
      }
      if (key === 'content' && typeof val === 'string' && val.length > maxChars) {
        out[key] = truncateText(val, maxChars);
        continue;
      }
      out[key] = sanitizeValue(val, depth + 1, maxChars);
    }
    return out;
  }

  return value;
}

function sanitizeToolResult(result, maxChars = DEFAULT_TOOL_RESULT_CHARS) {
  return sanitizeValue(result, 0, maxChars);
}

function formatToolResultMessage(toolName, result, maxChars = DEFAULT_TOOL_RESULT_CHARS) {
  const safe = sanitizeToolResult(result, maxChars);
  return `Tool ${toolName} result:\n${JSON.stringify(safe)}`;
}

function trimEpisodeContent(content, maxChars = DEFAULT_EPISODE_CHARS) {
  return truncateText(content, maxChars);
}

function isContextLengthError(err) {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('maximum context length') || msg.includes('context length') || msg.includes('too many tokens');
}

/**
 * Trim messages to fit token budget. Keeps system + latest user turn; drops oldest middle turns first.
 */
function trimMessages(messages, maxTokens = DEFAULT_MAX_CONTEXT_TOKENS) {
  if (!messages?.length) return messages;

  const total = messages.reduce((sum, m) => sum + messageTokens(m), 0);
  if (total <= maxTokens) return messages;

  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');

  if (!rest.length) return messages;

  const lastUserIdx = rest.map((m) => m.role).lastIndexOf('user');
  const anchor =
    lastUserIdx >= 0
      ? rest.slice(lastUserIdx)
      : rest.slice(-2);

  const middle = lastUserIdx > 0 ? rest.slice(0, lastUserIdx) : [];
  const kept = [...middle];
  let dropped = 0;

  while (kept.length > 0) {
    const candidate = [...system, ...kept, ...anchor];
    const tokens = candidate.reduce((sum, m) => sum + messageTokens(m), 0);
    if (tokens <= maxTokens) {
      if (dropped > 0) {
        const note = {
          role: 'user',
          content: `[${dropped} earlier message(s) omitted to fit context window]`,
        };
        return [...system, note, ...kept, ...anchor];
      }
      return candidate;
    }
    dropped += 1;
    kept.shift();
  }

  const compactSystem = system.map((m) => ({
    ...m,
    content: truncateText(m.content, 12000),
  }));
  const compactAnchor = anchor.map((m) => ({
    ...m,
    content: truncateText(m.content, 8000),
  }));
  return [...compactSystem, ...compactAnchor];
}

module.exports = {
  estimateTokens,
  messageTokens,
  truncateText,
  sanitizeToolResult,
  formatToolResultMessage,
  trimEpisodeContent,
  trimMessages,
  isContextLengthError,
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_TOOL_RESULT_CHARS,
  DEFAULT_EPISODE_CHARS,
  DEFAULT_HISTORY_TURNS,
};
