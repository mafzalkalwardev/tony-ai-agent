/**
 * Read-only project scanner — file tree, package/requirements, tests, configs.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const IGNORED = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  'data',
  'data-test',
  'uploads',
  '.cursor',
]);

const IMPORTANT = [
  'README.md',
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'TONY.md',
  'ROADMAP.md',
  'TODO.md',
  '.env.example',
  'vite.config.js',
  'vite.config.ts',
  'pytest.ini',
];

function detectProjectType(root) {
  if (fs.existsSync(path.join(root, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.vite || deps.react) return deps.vite ? 'react-vite' : 'react';
      return 'node';
    } catch {
      return 'node';
    }
  }
  if (fs.existsSync(path.join(root, 'manage.py'))) return 'django';
  if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) {
    return 'python';
  }
  if (fs.existsSync(path.join(root, '.git'))) return 'git-repo';
  return 'unknown';
}

function readPackageScripts(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {};
  } catch {
    return {};
  }
}

function detectTestCommand(root, projectType, scripts) {
  if (scripts.test) return 'npm test';
  if (projectType === 'python' || projectType === 'django') {
    if (fs.existsSync(path.join(root, 'pytest.ini')) || fs.existsSync(path.join(root, 'tests'))) {
      return 'python -m pytest';
    }
    if (projectType === 'django') return 'python manage.py test';
  }
  return '';
}

function detectBuildCommand(root, projectType, scripts) {
  if (scripts.build) return 'npm run build';
  if (projectType === 'react-vite') return 'npm run build';
  return '';
}

function buildTree(dir, depth = 2, level = 0, prefix = '') {
  if (level >= depth) return [];
  let entries = [];
  let children;
  try {
    children = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return entries;
  }
  children
    .filter((c) => !IGNORED.has(c.name) && !c.name.startsWith('.'))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .forEach((child) => {
      const label = `${prefix}${child.name}${child.isDirectory() ? '/' : ''}`;
      entries.push(label);
      if (child.isDirectory()) {
        entries = entries.concat(buildTree(path.join(dir, child.name), depth, level + 1, `${prefix}${child.name}/`));
      }
    });
  return entries;
}

function readImportantFiles(root) {
  const out = {};
  for (const name of IMPORTANT) {
    const full = path.join(root, name);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    try {
      out[name] = fs.readFileSync(full, 'utf8').slice(0, 2500);
    } catch {
      /* skip */
    }
  }
  return out;
}

function scan(projectPath = '.') {
  const root = path.resolve(config.workspaceRoot, projectPath);
  const projectType = detectProjectType(root);
  const scripts = readPackageScripts(root);
  const hasTestsFolder = fs.existsSync(path.join(root, 'tests')) || fs.existsSync(path.join(root, 'test'));
  const result = {
    projectPath: root,
    projectType,
    fileTree: buildTree(root, 2),
    importantFiles: Object.keys(readImportantFiles(root)),
    importantPreviews: readImportantFiles(root),
    packageScripts: scripts,
    testCommand: detectTestCommand(root, projectType, scripts),
    buildCommand: detectBuildCommand(root, projectType, scripts),
    hasTestsFolder,
    hasGit: fs.existsSync(path.join(root, '.git')),
    notes: [],
  };

  if (!result.testCommand) result.notes.push('No test command detected.');
  if (!fs.existsSync(path.join(root, 'README.md'))) result.notes.push('README.md missing.');
  if (projectType === 'node' && !fs.existsSync(path.join(root, 'package-lock.json'))) {
    result.notes.push('Node project has no package-lock.json.');
  }
  return result;
}

function scanAsText(projectPath = '.') {
  const s = scan(projectPath);
  const lines = [
    `# Project Scan: ${s.projectPath}`,
    `Project type: ${s.projectType}`,
    `Git: ${s.hasGit ? 'yes' : 'no'}`,
    `Tests folder: ${s.hasTestsFolder ? 'yes' : 'no'}`,
    '',
    '## File tree',
    ...s.fileTree.slice(0, 50).map((f) => `- ${f}`),
    '',
    '## Important files',
    ...(s.importantFiles.length ? s.importantFiles.map((f) => `- ${f}`) : ['- none']),
    '',
    '## Commands',
    `Test: ${s.testCommand || 'none detected'}`,
    `Build: ${s.buildCommand || 'none detected'}`,
    `Scripts: ${Object.keys(s.packageScripts).join(', ') || 'none'}`,
  ];
  if (s.notes.length) {
    lines.push('', '## Notes', ...s.notes.map((n) => `- ${n}`));
  }
  return lines.join('\n');
}

module.exports = {
  scan,
  scanAsText,
  detectProjectType,
  detectTestCommand,
  detectBuildCommand,
};
