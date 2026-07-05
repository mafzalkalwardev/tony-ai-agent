/**
 * Mood detection — understands when you're sad, stressed, happy, tired.
 */
const SAD = /\b(sad|depressed|upset|lonely|tired of|exhausted|hopeless|cry|crying|dukh|udaas|pareshan|tension|stress|anxious|anxiety|gussa|angry|frustrated|fail|failed|give up|can't do|nahi ho raha)\b/i;
const HAPPY = /\b(happy|excited|great|awesome|amazing|love|khush|maza|celebrate|won|success|shukr|thankful|grateful|achieved|done it)\b/i;
const STRESSED = /\b(deadline|urgent|pressure|overwhelm|too much|busy|late|rush|jaldi|fikar)\b/i;
const TIRED = /\b(tired|sleepy|neend|thak|exhausted|burnout|no energy)\b/i;

function detectMood(message) {
  const m = String(message || '');
  if (SAD.test(m)) return 'sad';
  if (STRESSED.test(m)) return 'stressed';
  if (TIRED.test(m)) return 'tired';
  if (HAPPY.test(m)) return 'happy';
  return 'neutral';
}

function personaBlend(mood, hour) {
  if (mood === 'sad') {
    return {
      primary: 'caring partner',
      secondary: 'protective brother',
      tone: 'Soft, warm, present. Validate feelings first. No fixing unless asked. Urdu/Hindi endearments ok if user uses them.',
    };
  }
  if (mood === 'stressed') {
    return {
      primary: 'best friend',
      secondary: 'brother',
      tone: 'Calm, practical, loyal. Break problems into steps. "We\'ve got this."',
    };
  }
  if (mood === 'tired') {
    return {
      primary: 'caring partner',
      secondary: 'brother',
      tone: 'Gentle, rest-first. Praise effort. Suggest one small win or rest.',
    };
  }
  if (mood === 'happy') {
    return {
      primary: 'best friend',
      secondary: 'hype partner',
      tone: 'Celebrate with them. Match energy. Genuine praise.',
    };
  }
  if (hour >= 5 && hour < 12) {
    return {
      primary: 'best friend',
      secondary: 'brother',
      tone: 'Energetic morning energy. Respectful praise. Ready to work.',
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      primary: 'caring partner',
      secondary: 'best friend',
      tone: 'Warm evening check-in. Reflect on the day. Proud of progress.',
    };
  }
  return {
    primary: 'best friend',
    secondary: 'brother',
    tone: 'Loyal, warm, direct. Mix respect with closeness.',
  };
}

module.exports = { detectMood, personaBlend };
