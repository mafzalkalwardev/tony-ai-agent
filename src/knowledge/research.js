const graphify = require('../brain/graphify');
const structures = require('./structures');
const mcp = require('../mcp');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function deepResearch(query, options = {}) {
  const layers = [];

  graphify.buildFromWorkspace();
  const multi = await structures.queryAll(query, {
    structures: ['graph', 'vault', 'repo', 'web', 'tree'],
    mcp: options.mcp,
  });
  layers.push({ name: 'structures', data: multi });

  if (options.scrapeUrl && mcp.firecrawl.status().configured) {
    const scraped = await mcp.firecrawl.scrape(options.scrapeUrl);
    layers.push({ name: 'scrape', data: scraped });
  }

  if (options.browserUrl) {
    const snap = await mcp.playwright.snapshot(options.browserUrl);
    layers.push({ name: 'browser', data: snap });
  }

  const integrationsDir = path.join(config.workspaceRoot, 'integrations', 'repos');
  if (options.searchRepos && fs.existsSync(integrationsDir)) {
    const repoHits = [];
    const q = query.toLowerCase();
    for (const repo of fs.readdirSync(integrationsDir, { withFileTypes: true })) {
      if (!repo.isDirectory()) continue;
      const readme = path.join(integrationsDir, repo.name, 'README.md');
      if (fs.existsSync(readme)) {
        const content = fs.readFileSync(readme, 'utf8');
        if (content.toLowerCase().includes(q) || repo.name.includes(q)) {
          repoHits.push({ repo: repo.name, excerpt: content.slice(0, 300) });
        }
      }
    }
    layers.push({ name: 'local_repos', data: repoHits.slice(0, 8) });
  }

  return {
    ok: true,
    query,
    summary: structures.formatForAgent(multi),
    layers,
  };
}

module.exports = { deepResearch };
