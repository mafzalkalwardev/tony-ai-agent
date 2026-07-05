#!/usr/bin/env node
/**
 * Initialize bundled GitHub integration repos (shallow clone).
 * Run: node scripts/init-integrations.js [--status]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'integrations', 'manifest.json'), 'utf8'));
const reposDir = path.join(root, 'integrations', 'repos');

if (process.argv.includes('--status')) {
  const cloned = fs.existsSync(reposDir)
    ? fs.readdirSync(reposDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  console.log('Integration repos:', cloned.length ? cloned.join(', ') : '(none — run npm run integrations:init)');
  process.exit(0);
}

fs.mkdirSync(reposDir, { recursive: true });

console.log('=== TONY Integration Init ===\n');

let cloned = 0;
let skipped = 0;
let failed = 0;

for (const repo of manifest.repos) {
  const target = path.join(reposDir, repo.name);
  if (fs.existsSync(path.join(target, '.git'))) {
    console.log(`  skip ${repo.name} (already cloned)`);
    skipped += 1;
    continue;
  }

  try {
    console.log(`  clone ${repo.clone} → integrations/repos/${repo.name}`);
    execSync(`git clone --depth 1 https://github.com/${repo.clone}.git "${target}"`, {
      stdio: 'pipe',
      timeout: 180000,
    });
    cloned += 1;
  } catch (e) {
    console.error(`  FAIL ${repo.name}: ${e.message?.slice(0, 120)}`);
    failed += 1;
  }
}

console.log(`\n=== Done: ${cloned} cloned, ${skipped} skipped, ${failed} failed ===`);
