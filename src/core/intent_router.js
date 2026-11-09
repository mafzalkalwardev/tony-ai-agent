/**
 * Intent router — classifies mixed English / Urdu / Roman Urdu / Hindi / Hinglish
 * commands into stable categories for the dashboard and agent pipeline.
 */

const { extractAll } = require('./params');

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
    intent: 'summarize_repo',
    patterns: [
      /\b(repo|repository|git)\s+summar(y|ize)\b/i,
      /\bsummarize\s+(repo|repository|git)\b/i,
      /\brepo\s+(ka\s+)?khulasa\b/i,
      /\brepository\s+state\b/i,
    ],
  },
  {
    category: 'github_task',
    intent: 'explain_changes',
    patterns: [
      /\bexplain\s+(changed|changes|diff|files)\b/i,
      /\bchanged\s+files\b/i,
      /\bdiff\s+(samjhao|explain|dikhao)\b/i,
      /\bkya\s+change\s+(hua|kiye)\b/i,
      /\bgit\s+diff\b/i,
    ],
  },
  {
    category: 'github_task',
    intent: 'commit_message',
    patterns: [
      /\bcommit\s+message\b/i,
      /\bgenerate\s+commit\b/i,
      /\bcommit\s+(ka\s+)?message\s+banao\b/i,
    ],
  },
  {
    category: 'github_task',
    intent: 'prepare_pr',
    patterns: [
      /\bprepare\s+(pr|push)\b/i,
      /\bpr\s+(instructions|checklist|prepare)\b/i,
      /\bpush\s+(ke\s+liye|instructions)\b/i,
      /\bpull\s+request\s+(banao|draft|prepare)\b/i,
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
    patterns: [/\bgit\s+commit\b/i, /\bcommit\s+karo\b/i],
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
      /\bdelivery\s+(note|package|report|export)\b/i,
      /\bmessage\s+banao\b/i,
      /\bexport\s+delivery\b/i,
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
      /\b(vs\s*code|vscode|terminal|browser|chrome|notepad|calculator|explorer|file explorer)\b.*\b(kholo|open)\b/i,
      /\b(kholo|open)\b.*\b(vs\s*code|vscode|terminal|browser|chrome|notepad|calculator|explorer|file explorer)\b/i,
    ],
  },
  {
    category: 'file_task',
    intent: 'file_task',
    patterns: [/\b(read|parho)\s+(file|[\w./\\-]+\.[\w]+)\b/i, /\bfile\s+(banao|create|likho)\b/i, /\bcreate\s+file\b/i],
  },
  {
    category: 'settings',
    intent: 'trusted_mode_on',
    patterns: [
      /\btrusted\s+mode\s+on\b/i,
      /\benable\s+trusted\s+mode\b/i,
      /\bfull\s+(control|access|autonomy)\s+on\b/i,
      /\btake\s+(full\s+)?control\b/i,
      /\byou\s+decide\b/i,
      /\bauto\s+approve\s+on\b/i,
    ],
  },
  {
    category: 'settings',
    intent: 'trusted_mode_off',
    patterns: [
      /\btrusted\s+mode\s+off\b/i,
      /\bdisable\s+trusted\s+mode\b/i,
      /\bfull\s+(control|access|autonomy)\s+off\b/i,
      /\bauto\s+approve\s+off\b/i,
    ],
  },
  {
    category: 'search_web',
    intent: 'research_web',
    patterns: [
      /\bresearch\b/i,
      /\bdeep\s+research\b/i,
      /\binvestigate\b/i,
      /\btahqeeq\b/i,
      /\bdhundo\s+aur\s+samjhao\b/i,
    ],
  },
  {
    category: 'open_app',
    intent: 'laptop_control',
    patterns: [
      /\blaptop\s+control\b/i,
      /\bdesktop\s+control\b/i,
      /\bscreen\s+control\b/i,
      /\bmouse\s+control\b/i,
      /\bkeyboard\s+control\b/i,
    ],
  },
  {
    category: 'settings',
    intent: 'settings',
    patterns: [
      /\bwake\s+mode\b/i,
      /\bvoice\s+(settings|setup)\b/i,
      /\b(show|update)\s+preferences\b/i,
      /\bpreferences\b/i,
      /\bsettings\b/i,
      /\balways\s+listen\b/i,
      /\bmic\s+check\b/i,
      /\bproject\s+note\b/i,
    ],
  },
  {
    category: 'chat',
    intent: 'chat',
    patterns: [
      /\b(what|who|how|why|kya|kaise|kon)\b/i,
      /\bmujhe\s+batao\b/i,
      /\bhelp\b/i,
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
  const params = extractAll(raw);
  if (!text) {
    return {
      intent: 'unknown',
      category: 'unknown',
      confidence: 0,
      normalized: '',
      raw,
      params,
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
          params,
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
    params,
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
