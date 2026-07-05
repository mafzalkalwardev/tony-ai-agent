require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

function env(key, fallback = '') {
  return process.env[key] ?? fallback;
}

module.exports = {
  port: Number(env('PORT', '8787')),
  dataDir: path.resolve(root, env('TONY_DATA_DIR', './data')),
  llmProvider: env('TONY_LLM_PROVIDER', 'mock'),
  openai: {
    apiKey: env('OPENAI_API_KEY'),
    model: env('OPENAI_MODEL', 'gpt-4o-mini'),
  },
  anthropic: {
    apiKey: env('ANTHROPIC_API_KEY'),
    model: env('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
  },
  groq: {
    apiKey: env('GROQ_API_KEY'),
    model: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    baseUrl: env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
  },
  deepgram: {
    apiKey: env('DEEPGRAM_API_KEY'),
    model: env('DEEPGRAM_MODEL', 'nova-2'),
    baseUrl: env('DEEPGRAM_BASE_URL', 'https://api.deepgram.com/v1'),
  },
  elevenlabs: {
    apiKey: env('ELEVENLABS_API_KEY'),
    voiceId: env('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
    modelId: env('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2'),
    baseUrl: env('ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io/v1'),
  },
  obsidian: {
    vaultPath: env('OBSIDIAN_VAULT_PATH', path.join(root, 'vault')),
    brainFolder: env('OBSIDIAN_BRAIN_FOLDER', 'Agentic Brain'),
  },
  maxIterations: Number(env('TONY_MAX_ITERATIONS', '12')),
  autoReflect: env('TONY_AUTO_REFLECT', 'true') === 'true',
  workspaceRoot: path.resolve(root, env('TONY_WORKSPACE_ROOT', '.')),
  apiToken: env('TONY_API_TOKEN', 'dev_tony_token'),
  signalmint: {
    apiUrl: env('SIGNALMINT_API_URL', 'http://localhost:5000'),
    email: env('SIGNALMINT_EMAIL', ''),
    password: env('SIGNALMINT_PASSWORD', ''),
  },
  githubToken: env('GITHUB_TOKEN', ''),
  identityPath: path.join(root, 'TONY.md'),
  skillsDirs: [
    path.join(root, 'skills'),
  ].filter((d) => fs.existsSync(d)),
};
