const fs = require('fs');
const path = require('path');
const config = require('../config');

function screenshotDir() {
  return path.join(config.dataDir, 'screenshots');
}

function screenshotBasename(filePath) {
  return path.basename(String(filePath || '').replace(/\\/g, '/'));
}

function isScreenshotFilename(name) {
  return /^screenshot-\d{8}-\d{6}\.png$/i.test(name);
}

function extractAttachments(toolResults = []) {
  const attachments = [];
  const seen = new Set();

  for (const tr of toolResults) {
    const r = tr?.result;
    if (!r?.ok || r.action !== 'screenshot' || !r.path) continue;

    const name = screenshotBasename(r.path);
    if (!isScreenshotFilename(name) || seen.has(name)) continue;

    seen.add(name);
    attachments.push({
      type: 'screenshot',
      name,
      path: r.path.replace(/\\/g, '/'),
      width: r.width || null,
      height: r.height || null,
      url: `/api/screenshots/${encodeURIComponent(name)}`,
    });
  }

  return attachments;
}

function resolveScreenshotFile(name) {
  if (!isScreenshotFilename(name)) return null;

  const dir = path.resolve(screenshotDir());
  const full = path.resolve(dir, name);
  if (!full.startsWith(dir + path.sep) && full !== dir) return null;
  if (!fs.existsSync(full)) return null;

  return full;
}

module.exports = {
  screenshotDir,
  extractAttachments,
  resolveScreenshotFile,
  isScreenshotFilename,
};
