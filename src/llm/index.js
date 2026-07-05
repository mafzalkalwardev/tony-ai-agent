const fs = require('fs');
const config = require('../config');
const { isOnline } = require('../local/connectivity');
const ollama = require('./ollama');

function createProvider(kind) {
  if (kind === 'openai') return require('./openai');
  if (kind === 'anthropic') return require('./anthropic');
  if (kind === 'groq') return require('./groq');
  if (kind === 'gemini') return require('./gemini');
  if (kind === 'ollama') return ollama;
  return require('./mock');
}

function buildChain() {
  const chain = [];
  const p = config.llmProvider;

  if (p === 'groq' && config.groq.apiKey) chain.push('groq');
  if (p === 'gemini' && config.gemini.apiKey) chain.push('gemini');
  if (p === 'openai' && config.openai.apiKey) chain.push('openai');
  if (p === 'anthropic' && config.anthropic.apiKey) chain.push('anthropic');
  if (p === 'ollama') chain.push('ollama');

  if (config.groq.apiKey && !chain.includes('groq')) chain.push('groq');
  if (config.gemini.apiKey && !chain.includes('gemini')) chain.push('gemini');
  if (config.openai.apiKey && !chain.includes('openai')) chain.push('openai');
  if (config.anthropic.apiKey && !chain.includes('anthropic')) chain.push('anthropic');
  if (config.ollama.enabled) chain.push('ollama');

  if (!chain.length) chain.push('mock');
  return [...new Set(chain)];
}

const chain = buildChain();

function isRateLimit(err) {
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('rate limit') || msg.includes('429') || msg.includes('tpm');
}

function isNetworkError(err) {
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout')
  );
}

async function complete(messages, options = {}) {
  const online = await isOnline();
  if (!online && config.offline.forceLocal) {
    throw new Error('OFFLINE_MODE');
  }

  let lastError;
  const providers = online ? chain : ['ollama', 'mock'].filter((k) => k === 'ollama' || k === 'mock');

  for (const kind of providers) {
    if (kind === 'ollama') {
      const avail = await ollama.isAvailable();
      if (!avail) continue;
    }
    if (kind !== 'mock' && kind !== 'ollama') {
      const cfg = config[kind];
      if (cfg && !cfg.apiKey) continue;
    }

    try {
      const result = await createProvider(kind).complete(messages, options);
      return { ...result, provider: kind, online };
    } catch (e) {
      lastError = e;
      if ((isRateLimit(e) || isNetworkError(e)) && providers.indexOf(kind) < providers.length - 1) {
        continue;
      }
      if (kind === 'mock') throw e;
    }
  }
  throw lastError || new Error('No LLM provider available');
}

function getProvider() {
  return createProvider(config.llmProvider);
}

function loadIdentity() {
  try {
    return fs.readFileSync(config.identityPath, 'utf8');
  } catch {
    return 'You are TONY, a helpful autonomous AI agent.';
  }
}

function providerStatus() {
  return {
    chain,
    gemini: Boolean(config.gemini.apiKey),
    groq: Boolean(config.groq.apiKey),
    openai: Boolean(config.openai.apiKey),
    ollama: config.ollama.enabled,
  };
}

module.exports = { complete, getProvider, loadIdentity, providerStatus, buildChain };
