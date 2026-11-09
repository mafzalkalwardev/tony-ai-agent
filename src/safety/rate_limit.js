/**
 * Per-tool rate limits — soft throttle for shell and outbound messaging.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'rate_limits.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { windows: {} };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { windows: {} };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
}

function limitsFor(tool) {
  const defaults = {
    shell: { max: config.rateLimits?.shellMax ?? 30, windowMs: config.rateLimits?.shellWindowMs ?? 60000 },
    telegram_send: { max: 20, windowMs: 60000 },
    discord_send: { max: 20, windowMs: 60000 },
  };
  return defaults[tool] || { max: 60, windowMs: 60000 };
}

function check(tool) {
  const { max, windowMs } = limitsFor(tool);
  const now = Date.now();
  const data = load();
  const key = String(tool || 'unknown');
  const bucket = (data.windows[key] || []).filter((t) => now - t < windowMs);
  if (bucket.length >= max) {
    const retryAfterMs = windowMs - (now - bucket[0]);
    return {
      allowed: false,
      tool: key,
      max,
      windowMs,
      retryAfterMs,
      error: `Rate limit: ${key} allows ${max}/${Math.round(windowMs / 1000)}s. Retry in ${Math.ceil(retryAfterMs / 1000)}s.`,
    };
  }
  bucket.push(now);
  data.windows[key] = bucket;
  save(data);
  return { allowed: true, tool: key, remaining: max - bucket.length, max, windowMs };
}

function status() {
  return {
    shell: limitsFor('shell'),
    telegram_send: limitsFor('telegram_send'),
    discord_send: limitsFor('discord_send'),
  };
}

module.exports = { check, status, limitsFor };
