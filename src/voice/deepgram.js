const config = require('../config');

/**
 * Deepgram speech-to-text — transcribe audio buffers or base64 payloads.
 */
async function transcribe(audioBuffer, mimeType = 'audio/wav') {
  if (!config.deepgram.apiKey) {
    return { ok: false, error: 'DEEPGRAM_API_KEY not set' };
  }

  const response = await fetch(
    `${config.deepgram.baseUrl}/listen?model=${encodeURIComponent(config.deepgram.model)}&smart_format=true&punctuate=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.deepgram.apiKey}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
      signal: AbortSignal.timeout(60000),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.err_msg || `Deepgram HTTP ${response.status}` };
  }

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? null;

  return { ok: true, transcript, confidence, provider: 'deepgram' };
}

async function transcribeBase64(base64, mimeType = 'audio/wav') {
  const buffer = Buffer.from(base64, 'base64');
  return transcribe(buffer, mimeType);
}

function status() {
  return {
    provider: 'deepgram',
    configured: Boolean(config.deepgram.apiKey),
    model: config.deepgram.model,
  };
}

module.exports = { transcribe, transcribeBase64, status };
