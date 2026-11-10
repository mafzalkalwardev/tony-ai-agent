/**
 * Discord remote channel — webhook outbound + optional bot inbound webhook.
 * Set DISCORD_WEBHOOK_URL for outbound. Optional DISCORD_BOT_TOKEN + public interactions URL.
 */
const config = require('../config');

function status() {
  return {
    configured: Boolean(config.discord?.webhookUrl || config.discord?.botToken),
    webhook: Boolean(config.discord?.webhookUrl),
    botToken: Boolean(config.discord?.botToken),
  };
}

async function sendMessage(text, { username = 'TONY' } = {}) {
  const url = config.discord?.webhookUrl;
  if (!url) return { ok: false, error: 'DISCORD_WEBHOOK_URL not set' };
  const content = String(text || '').slice(0, 1900);
  if (!content.trim()) return { ok: false, error: 'Empty message' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => '');
      return { ok: false, error: `Discord HTTP ${response.status}: ${err.slice(0, 200)}` };
    }
    return { ok: true, sent: true, length: content.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function handleIncoming({ content, author, channelId } = {}) {
  const text = String(content || '').trim();
  if (!text) return { ok: false, error: 'No content' };
  if (config.discord?.allowedUser && author && String(author) !== String(config.discord.allowedUser)) {
    return { ok: false, error: 'Unauthorized Discord user' };
  }
  if (/^\/start|^!tony\s+help/i.test(text)) {
    const help =
      'TONY online. Prefix with `!tony ` or just send a command.\nTry: trusted mode on · repo status · research … · memorial voice · reminders';
    await sendMessage(help);
    return { ok: true, help: true };
  }

  const message = text.replace(/^!tony\s+/i, '').trim();
  const sessionId = `discord-${channelId || author || 'main'}`;
  const { runAgent } = require('../core/agent');
  const result = await runAgent({ sessionId, message });
  await sendMessage(result.response || '(no response)');
  return { ok: true, result };
}

module.exports = { status, sendMessage, handleIncoming };
