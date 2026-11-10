/**
 * Telegram channel — remote commands + approval prompts.
 * Set TELEGRAM_BOT_TOKEN (+ optional TELEGRAM_CHAT_ID allowlist).
 */
const config = require('../config');

function status() {
  return {
    configured: Boolean(config.telegram?.botToken),
    chatIdConfigured: Boolean(config.telegram?.chatId),
    polling: Boolean(config.telegram?.polling),
  };
}

async function api(method, body = {}) {
  if (!config.telegram?.botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!data.ok) return { ok: false, error: data.description || 'Telegram API error', data };
  return { ok: true, ...data };
}

async function sendMessage(text, chatId = config.telegram?.chatId) {
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID not set' };
  return api('sendMessage', { chat_id: chatId, text: String(text).slice(0, 3900) });
}

function allowedChat(chatId) {
  if (!config.telegram?.chatId) return true;
  return String(chatId) === String(config.telegram.chatId);
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message?.text) return { ok: false, error: 'No text message' };
  if (!allowedChat(message.chat?.id)) {
    return { ok: false, error: 'Unauthorized chat' };
  }

  const text = message.text.trim();
  const sessionId = `telegram-${message.chat.id}`;
  if (/^\/start/i.test(text)) {
    await sendMessage(
      'TONY online. Send commands in English/Roman Urdu.\nTry: trusted mode on · repo status · research … · yes/no for approvals',
      message.chat.id
    );
    return { ok: true, started: true };
  }

  const { runAgent } = require('../core/agent');
  const result = await runAgent({ sessionId, message: text.replace(/^\/tony\s+/i, '') });
  await sendMessage(result.response || '(no response)', message.chat.id);
  return { ok: true, result };
}

let polling = false;
async function startPolling() {
  if (polling) return { ok: true, already: true };
  if (!config.telegram?.botToken || !config.telegram?.polling) {
    return { ok: false, error: 'Telegram polling disabled or token missing' };
  }
  polling = true;
  let offset = 0;
  (async () => {
    while (polling) {
      try {
        const res = await api('getUpdates', { offset, timeout: 20 });
        if (res.ok) {
          for (const update of res.result || []) {
            offset = update.update_id + 1;
            await handleUpdate(update);
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
  return { ok: true, polling: true };
}

function stopPolling() {
  polling = false;
  return { ok: true, polling: false };
}

module.exports = { status, sendMessage, handleUpdate, startPolling, stopPolling, api };
