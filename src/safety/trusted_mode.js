/**
 * Trusted Operator Mode — opt-in elevated autonomy.
 * When enabled, TONY auto-approves most NEEDS_APPROVAL actions and drives
 * laptop/browser research aggressively. Hard BLOCKED patterns still apply
 * (secrets, destructive wipes, voice cloning, payments).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function statePath() {
  return path.join(config.dataDir, 'trusted_mode.json');
}

function defaults() {
  return {
    enabled: config.trustedMode?.enabledByDefault === true,
    enabledAt: null,
    enabledBy: null,
    autoApproveShell: true,
    autoApproveBrowser: true,
    autoApproveDesktop: true,
    autoApproveGitWrite: true,
    autoApproveInstall: true,
    autoApproveBuildTest: true,
    autoDecideRisky: true,
    note: 'Hard blocks (secrets, rm -rf, payments, voice clone) always remain.',
  };
}

function load() {
  try {
    if (!fs.existsSync(statePath())) return defaults();
    return { ...defaults(), ...JSON.parse(fs.readFileSync(statePath(), 'utf8')) };
  } catch {
    return defaults();
  }
}

function save(partial = {}) {
  const next = { ...load(), ...partial };
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function enable({ by = 'user' } = {}) {
  return save({
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy: by,
  });
}

function disable() {
  return save({ enabled: false, enabledAt: null, enabledBy: null });
}

function isEnabled() {
  return Boolean(load().enabled);
}

function canAutoApprove(action = '', command = '') {
  if (!isEnabled()) return false;
  const state = load();
  const a = String(action || '').toLowerCase();
  const c = String(command || '').toLowerCase();

  if (/search_web|browser|playwright|firecrawl|web_fetch|research/.test(a) || /https?:\/\//.test(c)) {
    return state.autoApproveBrowser !== false;
  }
  if (/desktop|open_app|screenshot|mouse|keyboard/.test(a)) {
    return state.autoApproveDesktop !== false;
  }
  if (/git_push|git_commit|prepare_commit|push_branch|github_pr|create_pr/.test(a) || /^git\s+(push|commit)\b/.test(c)) {
    return state.autoApproveGitWrite !== false;
  }
  if (/install|pip install|npm install/.test(a) || /npm\s+i(nstall)?\b|pip\s+install\b/.test(c)) {
    return state.autoApproveInstall !== false;
  }
  if (/run_tests|build_project|npm test|npm run build/.test(a) || /npm\s+(test|run)\b|pytest/.test(c)) {
    return state.autoApproveBuildTest !== false;
  }
  if (/shell|run_shell/.test(a)) {
    return state.autoApproveShell !== false;
  }
  return state.autoDecideRisky !== false;
}

function status() {
  const state = load();
  return {
    ...state,
    active: state.enabled,
    label: state.enabled ? 'TRUSTED OPERATOR ON' : 'APPROVAL REQUIRED',
  };
}

module.exports = {
  load,
  save,
  enable,
  disable,
  isEnabled,
  canAutoApprove,
  status,
  defaults,
};
