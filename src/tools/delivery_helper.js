/**
 * Client delivery helper — prepares content only. Never sends messages.
 */
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
      'Attach test output / screenshots as proof',
      'Verify primary user flows manually',
    ],
    knownLimitations: knownLimitations.split('\n- ').filter(Boolean),
    clientMessage,
    markdown: toMarkdown({ scan, work, knownLimitations, clientMessage }),
  };
}

function pathBasename(p) {
  return String(p || '').split(/[\\/]/).filter(Boolean).pop() || 'project';
}

function toMarkdown({ scan, work, knownLimitations, clientMessage }) {
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

## Known limitations
- ${knownLimitations}

## Professional client message (draft only)
\`\`\`
${clientMessage}
\`\`\`

Draft only. Review and send manually.
`;
}

module.exports = { prepareDeliveryPackage };
