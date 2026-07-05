const config = require('../config');

/**
 * ElevenLabs text-to-speech — returns MP3 audio buffer.
 */
async function speak(text, options = {}) {
  if (!config.elevenlabs.apiKey) {
    return { ok: false, error: 'ELEVENLABS_API_KEY not set' };
  }

  const voiceId = options.voiceId || config.elevenlabs.voiceId;
  const modelId = options.modelId || config.elevenlabs.modelId;

  const response = await fetch(
    `${config.elevenlabs.baseUrl}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: modelId,
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return { ok: false, error: err || `ElevenLabs HTTP ${response.status}` };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    audio: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
    provider: 'elevenlabs',
    voiceId,
  };
}

function status() {
  return {
    provider: 'elevenlabs',
    configured: Boolean(config.elevenlabs.apiKey),
    voiceId: config.elevenlabs.voiceId,
    modelId: config.elevenlabs.modelId,
  };
}

module.exports = { speak, status };
