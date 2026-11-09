/**
 * Client delivery helper — prepares content only. Never sends messages.
 * Auto-attaches the latest test report when available under data/reports.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const projectScanner = require('./project_scanner');

function prepareDeliveryPackage({ projectPath = '.', completedWork = '', limitations = '' } = {}) {
  const scan = projectScanner.scan(projectPath);
  const work =
    completedWork ||
    'Core requested features implemented and verified locally with automated checks where available.';
  const knownLimitations =
    limitations ||
    [
      'Delivery content is generated locally and may need manual polish.',
      'TONY does not auto-send this message.',
      'Secrets must stay in .env and are never included here.',
    ].join('\n- ');

  const testReport = loadLatestTestReport();

  const clientMessage = `Hi,

Here is a delivery update for ${pathBasename(scan.projectPath)}.

Project type: ${scan.projectType}
Completed work:
- ${work}

Setup:
1. Install dependencies (npm install or pip install -r requirements.txt)
2. Copy .env.example to .env and fill required keys
3. Run tests: ${scan.testCommand || 'see README'}
4. Start the app per README instructions

Testing checklist:
- [ ] Dependencies install cleanly
- [ ] Tests pass (${scan.testCommand || 'manual'})
- [ ] Main flows verified manually
- [ ] No secrets committed

${
  testReport
    ? `Latest automated test report (${testReport.file}):
\`\`\`
${testReport.excerpt}
\`\`\`
`
    : 'Latest automated test report: not found yet (run tests first).\n'
}
Known limitations:
- ${knownLimitations}

Please review and share feedback.

Best regards,
Muhammad Afzal`;

  return {
    ok: true,
    draftOnly: true,
    projectSummary: {
      path: scan.projectPath,
      type: scan.projectType,
      hasTestsFolder: scan.hasTestsFolder,
      testCommand: scan.testCommand,
      buildCommand: scan.buildCommand,
    },
    completedWork: work,
    testReportAttached: Boolean(testReport),
    testReport: testReport
      ? { file: testReport.file, excerpt: testReport.excerpt, at: testReport.at }
      : null,
    setupInstructions: [
      'Clone or open the project folder',
      'Install dependencies',
      'Configure .env from .env.example (never commit secrets)',
      `Run tests: ${scan.testCommand || 'manual verification'}`,
      'Follow README for run/start commands',
    ],
    testingChecklist: [
      `Tests folder present: ${scan.hasTestsFolder ? 'yes' : 'review manually'}`,
      `Recommended test command: ${scan.testCommand || 'not detected'}`,
      testReport ? `Attached latest test report: ${testReport.file}` : 'Attach test output / screenshots as proof',
      'Verify primary user flows manually',
    ],
    knownLimitations: knownLimitations.split('\n- ').filter(Boolean),
    clientMessage,
    markdown: toMarkdown({ scan, work, knownLimitations, clientMessage, testReport }),
  };
}

function reportsDir() {
  return path.join(config.dataDir, 'reports');
}

function saveTestReport({ command, ok, output = '', error = '' } = {}) {
  fs.mkdirSync(reportsDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(reportsDir(), `test_${stamp}.txt`);
  const body = [
    `# TONY test report`,
    `at: ${new Date().toISOString()}`,
    `ok: ${Boolean(ok)}`,
    `command: ${command || ''}`,
    '',
    String(output || error || '').slice(0, 20000),
  ].join('\n');
  fs.writeFileSync(file, body, 'utf8');
  fs.writeFileSync(path.join(reportsDir(), 'last_test.txt'), body, 'utf8');
  return { ok: true, file: path.relative(config.workspaceRoot, file) };
}

function loadLatestTestReport() {
  try {
    const dir = reportsDir();
    const last = path.join(dir, 'last_test.txt');
    if (fs.existsSync(last)) {
      const text = fs.readFileSync(last, 'utf8');
      return {
        file: 'last_test.txt',
        excerpt: text.slice(0, 2500),
        at: fs.statSync(last).mtime.toISOString(),
      };
    }
    if (!fs.existsSync(dir)) return null;
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^test_.*\.txt$/i.test(f))
      .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (!files.length) return null;
    const text = fs.readFileSync(path.join(dir, files[0].f), 'utf8');
    return {
      file: files[0].f,
      excerpt: text.slice(0, 2500),
      at: new Date(files[0].m).toISOString(),
    };
  } catch {
    return null;
  }
}

function pathBasename(p) {
  return String(p || '').split(/[\\/]/).filter(Boolean).pop() || 'project';
}

function toMarkdown({ scan, work, knownLimitations, clientMessage, testReport }) {
  return `# Client Delivery Package

## Project summary
- Path: ${scan.projectPath}
- Type: ${scan.projectType}
- Tests folder: ${scan.hasTestsFolder ? 'yes' : 'no'}
- Test command: ${scan.testCommand || 'n/a'}
- Build command: ${scan.buildCommand || 'n/a'}

## Completed work
- ${work}

## Setup instructions
1. Install dependencies
2. Configure .env from .env.example
3. Run tests
4. Start per README

## Testing proof / checklist
- [ ] Dependencies install
- [ ] Tests pass
- [ ] Manual flows verified
- [ ] No secrets in repo
${
  testReport
    ? `
## Attached latest test report (\`${testReport.file}\`)
\`\`\`
${testReport.excerpt}
\`\`\`
`
    : '\n## Attached latest test report\n- None yet — run tests first.\n'
}
## Known limitations
- ${knownLimitations}

## Professional client message (draft only)
\`\`\`
${clientMessage}
\`\`\`

Draft only. Review and send manually.
`;
}

module.exports = { prepareDeliveryPackage, saveTestReport, loadLatestTestReport };
