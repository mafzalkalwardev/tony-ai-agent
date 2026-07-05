const config = require('../config');
const elevenlabs = require('./elevenlabs');
const localTts = require('../bridge/tts');

/**
 * TTS chain: ElevenLabs → edge-tts/pyttsx3 local → caller uses browser speechSynthesis.
 */
async function speak(text, options = {}) {
  const el = await elevenlabs.speak(text, options);
  if (el.ok) return el;

  const local = localTts.speak(text, options.localVoice || config.tts?.localVoice || 'en-US-GuyNeural');
  if (local.ok) {
    return {
      ...local,
      fallback: true,
      elevenLabsError: el.error?.slice?.(0, 200) || el.error,
    };
  }

  return {
    ok: false,
    error: el.error || local.error,
    hint: 'browser-tts',
    provider: 'none',
  };
}

function status() {
  const el = elevenlabs.status();
  const local = localTts.status();
  return {
    primary: el.configured ? 'elevenlabs' : local.configured ? 'local' : 'browser',
    elevenlabs: el,
    local,
    configured: el.configured || local.configured,
  };
}

module.exports = { speak, status };
