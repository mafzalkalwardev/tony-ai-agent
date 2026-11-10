/**
 * Memorial voice cloning — personal remembrance of loved ones.
 *
 * Ethical gates (all required before clone/speak):
 * 1. Explicit typed consent phrase
 * 2. Purpose = personal_memorial (not scams / third-party deception)
 * 3. User affirms rights to the reference audio
 * 4. Synthetic/memorial labeling on every speak result
 *
 * Living-person clones require an extra "with_permission" affirmation.
 * This is local-first metadata + optional ElevenLabs Instant Voice Clone when keyed.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storeDir() {
  return path.join(config.dataDir, 'memorial_voices');
}

function registryPath() {
  return path.join(storeDir(), 'registry.json');
}

function loadRegistry() {
  try {
    if (!fs.existsSync(registryPath())) return { voices: [] };
    return JSON.parse(fs.readFileSync(registryPath(), 'utf8'));
  } catch {
    return { voices: [] };
  }
}

function saveRegistry(data) {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(registryPath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function listVoices() {
  return loadRegistry().voices.map(publicVoice);
}

function publicVoice(v) {
  return {
    id: v.id,
    name: v.name,
    relationship: v.relationship,
    memorial: true,
    status: v.personStatus,
    consentAt: v.consentAt,
    elevenLabsVoiceId: v.elevenLabsVoiceId || null,
    sampleCount: (v.samplePaths || []).length,
    label: `Memorial voice: ${v.name} (synthetic remembrance)`,
  };
}

function findVoice(nameOrId) {
  const key = String(nameOrId || '').trim().toLowerCase();
  return loadRegistry().voices.find(
    (v) => v.id === key || v.name.toLowerCase() === key || v.id.toLowerCase() === key
  );
}

function buildConsentRecord({
  name,
  relationship,
  personStatus = 'deceased',
  hasRights = false,
  personalMemorialOnly = false,
  notForDeception = false,
  livingPermission = false,
  consentText = '',
}) {
  const normalized = String(consentText || '').trim();
  const expected = new RegExp(
    `i\\s+consent\\s+to\\s+memorial\\s+voice\\s+for\\s+${escapeRe(name)}`,
    'i'
  );
  if (!name?.trim()) return { ok: false, error: 'Loved one name is required.' };
  if (!relationship?.trim()) return { ok: false, error: 'Relationship is required (e.g. mother, father, spouse).' };
  if (!hasRights) {
    return { ok: false, error: 'You must affirm you have the right to use their recordings.' };
  }
  if (!personalMemorialOnly) {
    return { ok: false, error: 'Consent must be for personal memorial use only.' };
  }
  if (!notForDeception) {
    return { ok: false, error: 'You must affirm this will not be used to deceive others.' };
  }
  if (String(personStatus).toLowerCase() === 'living' && !livingPermission) {
    return {
      ok: false,
      error: 'Living voices require explicit with_permission=true (their permission).',
    };
  }
  if (!expected.test(normalized)) {
    return {
      ok: false,
      error: `Type exactly: I consent to memorial voice for ${name}`,
      requiredPhrase: `I consent to memorial voice for ${name}`,
    };
  }
  return {
    ok: true,
    consent: {
      name: name.trim(),
      relationship: relationship.trim(),
      personStatus: String(personStatus).toLowerCase() === 'living' ? 'living' : 'deceased',
      hasRights: true,
      personalMemorialOnly: true,
      notForDeception: true,
      livingPermission: Boolean(livingPermission),
      consentText: normalized,
      consentAt: new Date().toISOString(),
    },
  };
}

function registerMemorialVoice(input) {
  const built = buildConsentRecord(input);
  if (!built.ok) return built;

  const samples = normalizeSamples(input.samplePaths || input.samples || []);
  if (!samples.length) {
    return {
      ok: false,
      error: 'Provide at least one local audio sample path (wav/mp3/m4a) of their voice.',
    };
  }
  for (const sample of samples) {
    if (!fs.existsSync(sample)) return { ok: false, error: `Sample not found: ${sample}` };
  }

  const id = slug(`${built.consent.name}-${Date.now()}`);
  const voiceDir = path.join(storeDir(), id);
  fs.mkdirSync(voiceDir, { recursive: true });
  const copied = samples.map((src, i) => {
    const dest = path.join(voiceDir, `sample_${i}${path.extname(src) || '.wav'}`);
    fs.copyFileSync(src, dest);
    return dest;
  });

  const voice = {
    id,
    ...built.consent,
    samplePaths: copied,
    elevenLabsVoiceId: null,
    createdAt: new Date().toISOString(),
  };

  const reg = loadRegistry();
  reg.voices.unshift(voice);
  saveRegistry(reg);

  return {
    ok: true,
    voice: publicVoice(voice),
    next: 'Call memorial_voice_clone to create the cloud/local clone, then memorial_voice_speak.',
    reminder:
      'This is a synthetic memorial recreation for private remembrance — not the person themselves.',
  };
}

async function cloneMemorialVoice(nameOrId) {
  const voice = findVoice(nameOrId);
  if (!voice) return { ok: false, error: 'Memorial voice not found. Register + consent first.' };
  if (!hasValidConsent(voice)) {
    return { ok: false, error: 'Consent incomplete. Re-register with full memorial consent.' };
  }
  if (!config.elevenlabs?.apiKey) {
    return {
      ok: false,
      error: 'ELEVENLABS_API_KEY required for Instant Voice Clone. Samples are saved locally.',
      voice: publicVoice(voice),
      localSamplesReady: true,
    };
  }

  try {
    const form = new FormData();
    form.append('name', `Memorial-${voice.name}`);
    form.append(
      'description',
      `Personal memorial voice for ${voice.name} (${voice.relationship}). Synthetic remembrance only.`
    );
    form.append('labels', JSON.stringify({ memorial: 'true', relationship: voice.relationship }));
    for (const sample of voice.samplePaths || []) {
      const buf = fs.readFileSync(sample);
      const blob = new Blob([buf], { type: mimeFor(sample) });
      form.append('files', blob, path.basename(sample));
    }

    const response = await fetch(`${config.elevenlabs.baseUrl}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenlabs.apiKey },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.detail?.message || data.error || `ElevenLabs HTTP ${response.status}` };
    }

    const reg = loadRegistry();
    const idx = reg.voices.findIndex((v) => v.id === voice.id);
    if (idx >= 0) {
      reg.voices[idx].elevenLabsVoiceId = data.voice_id || data.voiceId || null;
      reg.voices[idx].clonedAt = new Date().toISOString();
      saveRegistry(reg);
    }
    return {
      ok: true,
      voice: publicVoice(findVoice(voice.id)),
      provider: 'elevenlabs-instant-clone',
      label: `Memorial voice ready: ${voice.name}`,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function speakMemorial(nameOrId, text) {
  const voice = findVoice(nameOrId);
  if (!voice) return { ok: false, error: 'Memorial voice not found.' };
  if (!hasValidConsent(voice)) return { ok: false, error: 'Consent missing/invalid.' };
  if (!text?.trim()) return { ok: false, error: 'Text required.' };

  const preface = `[Memorial synthetic voice of ${voice.name}] `;
  if (!voice.elevenLabsVoiceId) {
    // Local fallback: speak via default TTS but clearly labeled
    const speakChain = require('./speak');
    const spoken = await speakChain.speak(`${preface}${text}`);
    return {
      ...spoken,
      memorial: true,
      labeled: true,
      voiceName: voice.name,
      note: 'Clone not created yet — used default TTS with memorial label. Run memorial_voice_clone first.',
    };
  }

  const elevenlabs = require('./elevenlabs');
  const result = await elevenlabs.speak(`${text}`, { voiceId: voice.elevenLabsVoiceId });
  return {
    ...result,
    memorial: true,
    labeled: true,
    voiceName: voice.name,
    label: `Memorial synthetic remembrance: ${voice.name}`,
  };
}

function hasValidConsent(voice) {
  return Boolean(
    voice &&
      voice.consentAt &&
      voice.hasRights &&
      voice.personalMemorialOnly &&
      voice.notForDeception &&
      (voice.personStatus !== 'living' || voice.livingPermission)
  );
}

function normalizeSamples(samples) {
  return (Array.isArray(samples) ? samples : [samples])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => path.resolve(config.workspaceRoot, s));
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  return 'audio/wav';
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function status() {
  const voices = listVoices();
  return {
    enabled: true,
    mode: 'memorial-consent-gated',
    voices: voices.length,
    elevenLabs: Boolean(config.elevenlabs?.apiKey),
    store: storeDir(),
  };
}

module.exports = {
  registerMemorialVoice,
  cloneMemorialVoice,
  speakMemorial,
  listVoices,
  findVoice,
  buildConsentRecord,
  hasValidConsent,
  status,
};
