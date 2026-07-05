const dns = require('dns').promises;

let cached = { online: true, checkedAt: 0 };
const CACHE_MS = 15000;

async function isOnline(force = false) {
  const now = Date.now();
  if (!force && now - cached.checkedAt < CACHE_MS) return cached.online;

  try {
    await Promise.race([
      dns.lookup('google.com'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    cached = { online: true, checkedAt: now };
  } catch {
    cached = { online: false, checkedAt: now };
  }
  return cached.online;
}

function status() {
  return { online: cached.online, lastChecked: cached.checkedAt ? new Date(cached.checkedAt).toISOString() : null };
}

module.exports = { isOnline, status };
