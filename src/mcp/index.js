const perplexity = require('./perplexity');
const firecrawl = require('./firecrawl');
const quickbooks = require('./quickbooks');
const higgsfield = require('./higgsfield');
const playwright = require('./playwright');
const openwiki = require('./openwiki');
const scraperMedia = require('./scraper-media');
const motiongraph = require('./motiongraph');
const obsidianSkills = require('./obsidian-skills');
const graphify = require('../brain/graphify');
const structures = require('../knowledge/structures');

const providers = {
  perplexity,
  firecrawl,
  quickbooks,
  higgsfield,
  playwright,
  openwiki,
  'scraper-media': scraperMedia,
  motiongraph,
  'obsidian-skills': obsidianSkills,
};

function statusAll() {
  return Object.fromEntries(Object.entries(providers).map(([name, mod]) => [name, mod.status()]));
}

/** Local-first research — no paid API required */
async function localResearch(query) {
  graphify.buildFromWorkspace();
  const multi = await structures.queryAll(query, {
    structures: ['graph', 'vault', 'repo', 'tree'],
  });

  const sources = [{ type: 'local', structures: multi }];

  if (firecrawl.status().configured) {
    const f = await firecrawl.search(query);
    if (f.ok) sources.push({ type: 'firecrawl', ...f });
  }

  return {
    ok: true,
    query,
    mode: 'local-first',
    sources,
    summary: structures.formatForAgent(multi),
  };
}

async function research(query, options = {}) {
  const results = { query, sources: [] };

  if (options.perplexity !== false && perplexity.status().configured) {
    const p = await perplexity.search(query);
    if (p.ok) results.sources.push({ type: 'perplexity', ...p });
  }

  if (options.firecrawl !== false && firecrawl.status().configured) {
    const f = await firecrawl.search(query);
    if (f.ok) results.sources.push({ type: 'firecrawl', ...f });
  }

  if (results.sources.length) {
    return { ok: true, mode: 'api', ...results };
  }

  return localResearch(query);
}

module.exports = {
  providers,
  statusAll,
  research,
  localResearch,
  perplexity,
  firecrawl,
  quickbooks,
  higgsfield,
  playwright,
  openwiki,
  scraperMedia,
  motiongraph,
  obsidianSkills,
};
