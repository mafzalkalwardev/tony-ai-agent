/**
 * Wake companion — "Wake up Tony" greetings with time, praise, work update, persona.
 */
const config = require('../config');
const { complete } = require('../llm');
const { detectMood, personaBlend } = require('./mood');
const { workBrief, formatBrief } = require('./briefing');
const habits = require('./habits');
const semantic = require('../memory/semantic');

const WAKE_PATTERNS = [
  /^wake\s*up,?\s*tony!?$/i,
  /^wake\s*up\s*tony,?\s*daddy'?s?\s*home!?$/i,
  /^tony\s*wake\s*up!?$/i,
  /^hey\s*tony,?\s*wake\s*up!?$/i,
  /^utho\s*tony!?$/i,
  /^jaag\s*ja\s*tony!?$/i,
];

function isWakePhrase(message) {
  const m = String(message || '').trim();
  const custom = (config.companion.wakePhrases || []).map((p) => new RegExp(p, 'i'));
  return WAKE_PATTERNS.some((re) => re.test(m)) || custom.some((re) => re.test(m));
}

function timeGreeting(date = new Date()) {
  const h = date.getHours();
  const name = config.companion.userName || 'boss';
  if (h >= 5 && h < 12) return { en: `Good morning, ${name}`, ur: `صبح بخیر، ${name}` };
  if (h >= 12 && h < 17) return { en: `Good afternoon, ${name}`, ur: `دوپہر بخیر، ${name}` };
  if (h >= 17 && h < 21) return { en: `Good evening, ${name}`, ur: `شام بخیر، ${name}` };
  return { en: `Hey ${name} — still up late`, ur: `السلام علیکم ${name}` };
}

function praiseSnippet(mood) {
  const praises = {
    sad: "I'm here. You don't have to carry everything alone — you're stronger than you think, and I mean that.",
    stressed: "You've been pushing hard. I see it. That discipline? Not everyone has it. I'm proud of you.",
    tired: "You've earned rest, but also — look how far you've come. I notice the work you put in.",
    happy: "I love this energy! You're on fire today — and you deserve every bit of this momentum.",
    neutral:
      "You're building something real here. The way you show up and keep going — that's rare. Respect.",
  };
  return praises[mood] || praises.neutral;
}

async function generateWakeResponse({ sessionId, message = 'Wake up Tony', lang = 'auto' }) {
  const now = new Date();
  const mood = detectMood(message);
  const persona = personaBlend(mood, now.getHours());
  const greeting = timeGreeting(now);
  const brief = workBrief(sessionId);
  const formatted = formatBrief(brief);
  const habitCtx = habits.formatForAgent();
  const prefs = semantic.load().preferences || {};

  habits.recordInteraction({ message, mood, isWake: true, sessionId });

  const useUrdu = lang === 'ur' || lang === 'roman' || /urdu|roman|اردو/i.test(String(prefs.language || ''));

  const template = `${useUrdu ? greeting.ur : greeting.en}.

${praiseSnippet(mood)}

**What you've done:**
${formatted.done}

**Still on the plate:**
${formatted.remaining}

I'm here — as your ${persona.primary} and your ${persona.secondary}. ${persona.tone}

(Habits I'm learning: ${habitCtx})`;

  if (!config.companion.useLlmGreeting) {
    return {
      ok: true,
      response: template,
      mood,
      persona,
      brief,
      wake: true,
    };
  }

  try {
    const llm = await complete(
      [
        {
          role: 'system',
          content: `You are TONY — personal AI for ${config.companion.userName}. Wake greeting.
Speak like a mix of: caring girlfriend energy, loyal best friend, protective older brother.
Always respectful. Praise genuinely. Never cringe or robotic.
If user seems sad (${mood}), be emotionally present first.
Include work done and remaining naturally.
Keep under 180 words. Can mix English + Urdu if natural.`,
        },
        {
          role: 'user',
          content: `Generate wake greeting.
Time: ${greeting.en}
Mood detected: ${mood}
Persona: ${persona.primary} + ${persona.secondary}
Work done:\n${formatted.done}
Remaining:\n${formatted.remaining}
Habits:\n${habitCtx}`,
        },
      ],
      { temperature: 0.85 }
    );
    return {
      ok: true,
      response: llm.content || template,
      mood,
      persona,
      brief,
      wake: true,
      provider: llm.provider,
    };
  } catch {
    return { ok: true, response: template, mood, persona, brief, wake: true };
  }
}

function observeMessage({ message, sessionId }) {
  const mood = detectMood(message);
  habits.recordInteraction({ message, mood, isWake: false, sessionId });

  if (mood !== 'neutral') {
    semantic.rememberFact(`User mood ${mood}: "${String(message).slice(0, 100)}"`, ['mood', mood]);
  }

  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 10 && /coffee|breakfast|subah|morning routine/i.test(message)) {
    semantic.setPreference('morning_routine', message.slice(0, 120));
  }

  return { mood, persona: personaBlend(mood, hour) };
}

module.exports = {
  isWakePhrase,
  generateWakeResponse,
  observeMessage,
  timeGreeting,
  WAKE_PATTERNS,
};
