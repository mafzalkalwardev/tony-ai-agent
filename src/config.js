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
  gemini: {
    apiKey: env('GOOGLE_AI_API_KEY'),
    model: env('GEMINI_MODEL', 'gemini-2.0-flash'),
    baseUrl: env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
  },
  ollama: {
    baseUrl: env('OLLAMA_BASE_URL', 'http://localhost:11434'),
    model: env('OLLAMA_MODEL', 'llama3.2'),
    enabled: env('OLLAMA_ENABLED', 'true') === 'true',
  },
  offline: {
    forceLocal: env('TONY_OFFLINE_FORCE', 'false') === 'true',
    autoDetect: env('TONY_OFFLINE_AUTO', 'true') === 'true',
  },
  tasks: {
    autoRecord: env('TONY_AUTO_RECORD_TASKS', 'true') === 'true',
    minStepsToRecord: Number(env('TONY_TASK_MIN_STEPS', '2')),
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
  mcp: {
    perplexity: {
      apiKey: env('PERPLEXITY_API_KEY'),
      model: env('PERPLEXITY_MODEL', 'sonar'),
      baseUrl: env('PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
    },
    firecrawl: {
      apiKey: env('FIRECRAWL_API_KEY'),
      baseUrl: env('FIRECRAWL_BASE_URL', 'https://api.firecrawl.dev/v1'),
    },
    quickbooks: {
      clientId: env('QUICKBOOKS_CLIENT_ID'),
      clientSecret: env('QUICKBOOKS_CLIENT_SECRET'),
      refreshToken: env('QUICKBOOKS_REFRESH_TOKEN'),
      realmId: env('QUICKBOOKS_REALM_ID'),
      sandbox: env('QUICKBOOKS_SANDBOX', 'true') === 'true',
    },
    higgsfield: {
      apiKey: env('HIGGSFIELD_API_KEY'),
      baseUrl: env('HIGGSFIELD_BASE_URL', 'https://platform.higgsfield.ai'),
    },
    playwright: {
      mcpUrl: env('PLAYWRIGHT_MCP_URL', 'http://localhost:8931/mcp'),
      port: Number(env('PLAYWRIGHT_MCP_PORT', '8931')),
      headless: env('PLAYWRIGHT_MCP_HEADLESS', 'true') === 'true',
    },
    openwiki: {
      mcpUrl: env('OPENWIKI_MCP_URL', ''),
      docsUrl: env('OPENWIKI_DOCS_URL', 'http://localhost:8090'),
    },
    scraperMedia: {
      mcpUrl: env('SCRAPER_MEDIA_MCP_URL', ''),
    },
    motiongraph: {
      mcpUrl: env('MOTIONGRAPH_MCP_URL', ''),
    },
  },
  daemon: {
    enabled: env('TONY_DAEMON_ENABLED', 'false') === 'true',
    autoGoals: env('TONY_DAEMON_AUTO_GOALS', 'true') === 'true',
    intervalMs: Number(env('TONY_DAEMON_INTERVAL_MS', '300000')),
  },
  /** Prefer local/free tools when paid MCP keys missing */
  localFirst: env('TONY_LOCAL_FIRST', 'true') === 'true',
  goals: {
    maxRounds: Number(env('TONY_GOAL_MAX_ROUNDS', '10')),
    autoRun: env('TONY_GOAL_AUTO_RUN', 'true') === 'true',
  },
  integrationsDir: path.join(root, 'integrations'),
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
  tonyDesktop: {
    path: env('TONY_DESKTOP_PATH', ''),
    enabled: env('TONY_DESKTOP_ENABLED', 'true') === 'true',
  },
  shellUnsafe: env('TONY_SHELL_UNSAFE', 'false') === 'true',
  identityPath: path.join(root, 'TONY.md'),
  skillsDirs: [
    path.join(root, 'skills'),
    path.join(root, 'integrations', 'skills'),
  ].filter((d) => fs.existsSync(d)),
};
