/**
 * Nova voice lane — Deepgram STT + ElevenLabs TTS + agent brain loop.
 */

const config = require('../config');
const deepgram = require('../voice/deepgram');
const elevenlabs = require('../voice/elevenlabs');
const architectures = require('../brain/architectures');
const { runAgent } = require('../core/agent');

async function voiceStatus() {
  const arch = architectures.status();
  return {
    enabled: deepgram.status().configured || elevenlabs.status().configured,
    pattern: 'nova',
    stt: arch.voice.stt,
    tts: arch.voice.tts,
    endpoints: {
      transcribe: `POST http://localhost:${config.port}/api/voice/transcribe`,
      speak: `POST http://localhost:${config.port}/api/voice/speak`,
      converse: `POST http://localhost:${config.port}/api/voice/converse`,
      websocket: `ws://localhost:${config.port}/ws`,
    },
  };
}

async function transcribeAudio({ audioBase64, mimeType = 'audio/wav' }) {
  return deepgram.transcribeBase64(audioBase64, mimeType);
}

async function speakText(text, options = {}) {
  return elevenlabs.speak(text, options);
}

async function voiceConverse({ sessionId, audioBase64, mimeType, speak = true }) {
  const perception = await architectures.perceiveVoice({ audioBase64, mimeType });
  if (!perception.stt.ok) return { ok: false, error: perception.stt.error, layer: 'perception' };

  const transcript = perception.stt.transcript;
  const agentResult = await runAgent({ sessionId, message: transcript });

  let expression = null;
  if (speak && agentResult.response) {
    expression = await architectures.expressVoice(agentResult.response);
  }

  return {
    ok: true,
    transcript,
    agent: agentResult,
    audio: expression?.tts?.ok ? expression.tts : null,
  };
}

module.exports = { voiceStatus, transcribeAudio, speakText, voiceConverse };
