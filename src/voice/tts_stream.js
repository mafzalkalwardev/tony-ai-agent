/**
 * Streaming TTS — sentence chunking + ElevenLabs stream when available.
 */
const config = require('../config');
const speakChain = require('./speak');

function splitSentences(text) {
  const parts = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?۔؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(text || '').trim()].filter(Boolean);
}

async function* streamSpeak(text, options = {}) {
  const sentences = splitSentences(text).slice(0, 40);
  const voiceId = options.voiceId || config.elevenlabs?.voiceId;

  if (config.elevenlabs?.apiKey && options.preferStream !== false) {
    try {
      yield* streamElevenLabs(text, { voiceId, modelId: options.modelId });
      return;
    } catch {
      /* fall through to sentence chunks */
    }
  }

  for (let i = 0; i < sentences.length; i++) {
    const spoken = await speakChain.speak(sentences[i], options);
    yield {
      index: i,
      total: sentences.length,
      text: sentences[i],
      ...spoken,
    };
  }
}

async function* streamElevenLabs(text, { voiceId, modelId } = {}) {
  const response = await fetch(
    `${config.elevenlabs.baseUrl}/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(text).slice(0, 5000),
        model_id: modelId || config.elevenlabs.modelId,
      }),
      signal: AbortSignal.timeout(120000),
    }
  );
  if (!response.ok || !response.body) {
    throw new Error(`ElevenLabs stream HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  let index = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.length) continue;
    yield {
      index,
      total: null,
      ok: true,
      provider: 'elevenlabs-stream',
      mimeType: 'audio/mpeg',
      audio: Buffer.from(value).toString('base64'),
      chunkBytes: value.length,
    };
    index += 1;
  }
}

module.exports = { streamSpeak, splitSentences, streamElevenLabs };
