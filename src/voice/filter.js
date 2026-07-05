/**
 * Filter fan hum, filler words, and low-confidence STT hallucinations.
 */
const NOISE_PATTERNS = [
  /^(uh+|um+|hmm+|hm+|ah+|oh+|mm+|mhm+|la+\.?|na+\.?)$/i,
  /^(yeah+\.?|okay+\.?|ok+\.?)$/i,
  /^[\W\d]+$/,
  /^(.)\1{3,}$/, // repeated single char
];

const WAKE_OR_COMMAND = /wake\s*up|tony|build|open|run|hey|stop|yes|no|help|automate/i;

function isLikelyNoiseTranscript(transcript, confidence = null, options = {}) {
  const minConfidence = options.minConfidence ?? Number(process.env.TONY_VOICE_MIN_CONFIDENCE || 0.55);
  const t = String(transcript || '').trim();
  if (!t) return { noise: true, reason: 'empty' };
  if (confidence != null && confidence < minConfidence) {
    return { noise: true, reason: 'low_confidence', confidence };
  }
  for (const re of NOISE_PATTERNS) {
    if (re.test(t)) return { noise: true, reason: 'filler' };
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1 && t.length < 5 && !WAKE_OR_COMMAND.test(t)) {
    return { noise: true, reason: 'too_short' };
  }
  if (words.length <= 2 && t.length < 8 && !WAKE_OR_COMMAND.test(t)) {
    return { noise: true, reason: 'short_gibberish' };
  }
  return { noise: false };
}

function applyFilter(result, options = {}) {
  if (!result?.ok || !result.transcript) return result;
  const check = isLikelyNoiseTranscript(result.transcript, result.confidence, options);
  if (check.noise) {
    return {
      ...result,
      transcript: '',
      filtered: true,
      filterReason: check.reason,
    };
  }
  return result;
}

module.exports = { isLikelyNoiseTranscript, applyFilter, NOISE_PATTERNS };
