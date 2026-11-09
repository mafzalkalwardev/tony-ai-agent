/**
 * Nova voice lane — Deepgram STT + optional faster-whisper local fallback + TTS + agent.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config');
const deepgram = require('../voice/deepgram');
const localStt = require('../voice/local_stt');
const speakChain = require('../voice/speak');
const architectures = require('../brain/architectures');
const { runAgent } = require('../core/agent');

async function voiceStatus() {
  const arch = architectures.status();
  return {
    enabled: deepgram.status().configured || speakChain.status().configured || localStt.status().configured,
    pattern: 'nova',
    stt: {
      ...arch.voice.stt,
      local: localStt.status(),
      preferLocalStt: Boolean(config.voice?.preferLocalStt),
      silenceStopSeconds: config.voice?.silenceStopSeconds,
      silenceThreshold: config.voice?.silenceThreshold,
    },
    tts: arch.voice.tts,
    endpoints: {
      transcribe: `POST http://localhost:${config.port}/api/voice/transcribe`,
      speak: `POST http://localhost:${config.port}/api/voice/speak`,
      converse: `POST http://localhost:${config.port}/api/voice/converse`,
      websocket: `ws://localhost:${config.port}/ws`,
    },
  };
}

async function transcribeWithFallback({ audioBase64, mimeType = 'audio/wav' }) {
  const preferLocal = Boolean(config.voice?.preferLocalStt);
  if (preferLocal) {
    const local = await transcribeLocal(audioBase64, mimeType);
    if (local.ok) return local;
  }

  const primary = await deepgram.transcribeBase64(audioBase64, mimeType);
  if (primary.ok) return primary;

  const local = await transcribeLocal(audioBase64, mimeType);
  if (local.ok) {
    return { ...local, fallbackFrom: primary.error || 'deepgram-failed' };
  }

  return {
    ok: false,
    error: primary.error || local.error || 'No STT provider available',
    deepgram: primary,
    local,
  };
}

async function transcribeLocal(audioBase64, mimeType = 'audio/wav') {
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mpeg') ? 'mp3' : 'wav';
  const tmp = path.join(os.tmpdir(), `tony-stt-${Date.now()}.${ext}`);
  try {
    fs.writeFileSync(tmp, Buffer.from(audioBase64, 'base64'));
    return localStt.transcribeFile(tmp);
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function transcribeAudio({ audioBase64, mimeType = 'audio/wav' }) {
  return transcribeWithFallback({ audioBase64, mimeType });
}

async function speakText(text, options = {}) {
  return speakChain.speak(text, options);
}

async function voiceConverse({ sessionId, audioBase64, mimeType, speak = true }) {
  let stt = await transcribeWithFallback({ audioBase64, mimeType });
  if (!stt.ok) {
    // Keep architectures path as secondary attempt for filter/metadata compatibility.
    const perception = await architectures.perceiveVoice({ audioBase64, mimeType });
    if (!perception.stt.ok) return { ok: false, error: stt.error || perception.stt.error, layer: 'perception' };
    stt = perception.stt;
  }

  const transcript = stt.transcript;
  const agentResult = await runAgent({ sessionId, message: transcript });

  let expression = null;
  if (speak && agentResult.response) {
    expression = await architectures.expressVoice(agentResult.response);
  }

  return {
    ok: true,
    transcript,
    stt,
    agent: agentResult,
    intent: agentResult.intent,
    safety: agentResult.safety,
    audio: expression?.tts?.ok ? expression.tts : null,
  };
}

module.exports = {
  voiceStatus,
  transcribeAudio,
  speakText,
  voiceConverse,
  transcribeWithFallback,
};
