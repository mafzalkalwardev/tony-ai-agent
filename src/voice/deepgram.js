const config = require('../config');
const { applyFilter } = require('./filter');

/**
 * Deepgram speech-to-text — transcribe audio buffers or base64 payloads.
 */
async function transcribe(audioBuffer, mimeType = 'audio/wav', options = {}) {
  if (!config.deepgram.apiKey) {
    return { ok: false, error: 'DEEPGRAM_API_KEY not set' };
  }

  const params = new URLSearchParams({
    model: config.deepgram.model,
    smart_format: 'true',
    punctuate: 'true',
    filler_words: 'false',
    utterance_end_ms: '1000',
  });

  const response = await fetch(`${config.deepgram.baseUrl}/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.deepgram.apiKey}`,
      'Content-Type': mimeType,
    },
    body: audioBuffer,
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.err_msg || `Deepgram HTTP ${response.status}` };
  }

  const alt = data.results?.channels?.[0]?.alternatives?.[0] || {};
  const transcript = alt.transcript || '';
  const confidence = alt.confidence ?? null;

  const result = { ok: true, transcript, confidence, provider: 'deepgram' };
  if (options.filter !== false && config.voice?.noiseCancellation) {
    return applyFilter(result, { minConfidence: config.voice.minConfidence });
  }
  return result;
}

async function transcribeBase64(base64, mimeType = 'audio/wav', options = {}) {
  const buffer = Buffer.from(base64, 'base64');
  return transcribe(buffer, mimeType, options);
}

function status() {
  return {
    provider: 'deepgram',
    configured: Boolean(config.deepgram.apiKey),
    model: config.deepgram.model,
  };
}

module.exports = { transcribe, transcribeBase64, status };
