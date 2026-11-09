/**
 * Intent router — classifies mixed English / Urdu / Roman Urdu / Hindi / Hinglish
 * commands into stable categories for the dashboard and agent pipeline.
 */

const CATEGORIES = [
  'chat',
  'open_app',
  'search_web',
  'copy_paste',
  'file_task',
  'github_task',
  'project_scan',
  'run_tests',
  'build_project',
  'client_delivery',
  'settings',
  'unknown',
];

const RULES = [
  {
    category: 'github_task',
    intent: 'git_status',
    patterns: [
      /\brepo\s+(check|status)\b/i,
      /\bgit\s+status\b/i,
      /\bstatus\s+(dikhao|batao|show)\b/i,
      /\bmujhe\s+status\s+batao\b/i,
      /\brepo\s+check\s+karo\b/i,
    ],
  },
  {
    category: 'github_task',
    intent: 'git_push',
    patterns: [/\bgit\s+push\b/i, /\bpush\s+karo\b/i, /\bpush\s+(code|repo)\b/i],
  },
  {
    category: 'github_task',
    intent: 'git_commit',
    patterns: [/\bgit\s+commit\b/i, /\bcommit\s+(karo|message)\b/i],
  },
  {
    category: 'github_task',
    intent: 'github_pr',
    patterns: [/\b(create|open)\s+pr\b/i, /\bpull\s+request\b/i, /\bpr\s+(banao|create)\b/i],
  },
  {
    category: 'run_tests',
    intent: 'run_tests',
    patterns: [
      /\btest(s)?\s+(run|chalao)\b/i,
      /\b(run|chalao)\s+test(s)?\b/i,
      /\bnpm\s+test\b/i,
      /\bpytest\b/i,
      /\btest\s+run\s+karo\b/i,
    ],
  },
  {
    category: 'build_project',
    intent: 'build_project',
    patterns: [/\bbuild\s+(project|karo)\b/i, /\bproject\s+build\b/i, /\bnpm\s+run\s+build\b/i],
  },
  {
    category: 'project_scan',
    intent: 'project_scan',
    patterns: [
      /\bproject\s+(scan|analyze|check)\b/i,
      /\b(scan|analyze)\s+(project|repo)\b/i,
      /\brepo\s+(scan|analyze)\b/i,
    ],
  },
  {
    category: 'client_delivery',
    intent: 'client_delivery',
    patterns: [
      /\bclient\s+(ke\s+liye\s+)?message\b/i,
      /\bclient\s+ko\b/i,
      /\bdelivery\s+(note|package|report)\b/i,
      /\bmessage\s+banao\b/i,
    ],
  },
  {
    category: 'search_web',
    intent: 'search_web',
    patterns: [
      /\bbrowser\s+(mein|me)\s+search\b/i,
      /\b(search|google)\s+(web|karo|for)\b/i,
      /\bweb\s+search\b/i,
      /\bdhundo\b/i,
    ],
  },
  {
    category: 'copy_paste',
    intent: 'copy_paste',
    patterns: [/\b(ye|yeh|is\s+ko)\s+copy\b/i, /\bcopy\s+karo\b/i, /\bcopy\s+paste\b/i, /\bpaste\s+karo\b/i],
  },
  {
    category: 'open_app',
    intent: 'open_app',
    patterns: [
      /\b(vs\s*code|vscode|terminal|browser|chrome|notepad)\b.*\b(kholo|open)\b/i,
      /\b(kholo|open)\b.*\b(vs\s*code|vscode|terminal|browser|chrome|notepad)\b/i,
    ],
  },
  {
    category: 'file_task',
    intent: 'file_task',
    patterns: [/\b(read|parho)\s+file\b/i, /\bfile\s+(banao|create|likho)\b/i, /\bcreate\s+file\b/i],
  },
  {
    category: 'settings',
    intent: 'settings',
    patterns: [
      /\bwake\s+mode\b/i,
      /\bvoice\s+(settings|setup)\b/i,
      /\bsettings\b/i,
      /\balways\s+listen\b/i,
      /\bmic\s+check\b/i,
    ],
  },
  {
    category: 'chat',
    intent: 'chat',
    patterns: [
      /\b(what|who|how|why|kya|kaise|kon)\b/i,
      /\bmujhe\s+batao\b/i,
      /\bhelp\b/i,
      /\bexplain\b/i,
      /\bsamjhao\b/i,
      /\?$/,
    ],
  },
];

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[!,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(hey\s+)?tony[,:]?\s+/i, '')
    .trim();
}

function route(message) {
  const raw = String(message || '').trim();
  const text = normalize(raw);
  if (!text) {
    return {
      intent: 'unknown',
      category: 'unknown',
      confidence: 0,
      normalized: '',
      raw,
    };
  }

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text) || pattern.test(raw)) {
        return {
          intent: rule.intent,
          category: rule.category,
          confidence: 0.9,
          normalized: text,
          raw,
        };
      }
    }
  }

  return {
    intent: 'unknown',
    category: 'unknown',
    confidence: 0.2,
    normalized: text,
    raw,
  };
}

function describeRoute(routeResult) {
  return `${routeResult.category}/${routeResult.intent} (${Math.round((routeResult.confidence || 0) * 100)}%)`;
}

module.exports = {
  CATEGORIES,
  RULES,
  normalize,
  route,
  describeRoute,
};
