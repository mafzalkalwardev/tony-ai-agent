/**
 * Optional encrypted preference vault (AES-256-GCM).
 * Set TONY_PREFS_SECRET to enable. Never encrypts API keys into prefs —
 * preferences still reject secret-like fields; this protects notes/settings at rest.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

function vaultFile() {
  return path.join(config.dataDir, 'preferences.vault');
}

function secret() {
  return String(config.prefsVault?.secret || '').trim();
}

function enabled() {
  return Boolean(secret());
}

function status() {
  return {
    enabled: enabled(),
    fileExists: fs.existsSync(vaultFile()),
    algorithm: 'aes-256-gcm',
  };
}

function deriveKey(pass) {
  return crypto.scryptSync(pass, 'tony-prefs-vault-v1', 32);
}

function seal(plainObject) {
  if (!enabled()) return { ok: false, error: 'TONY_PREFS_SECRET not set' };
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret());
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(plainObject || {});
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
    at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(vaultFile()), { recursive: true });
  fs.writeFileSync(vaultFile(), JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, sealed: true, at: payload.at };
}

function open() {
  if (!enabled()) return { ok: false, error: 'TONY_PREFS_SECRET not set' };
  if (!fs.existsSync(vaultFile())) return { ok: false, error: 'No vault file yet' };
  try {
    const payload = JSON.parse(fs.readFileSync(vaultFile(), 'utf8'));
    const key = deriveKey(secret());
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(payload.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return { ok: true, preferences: JSON.parse(plain), at: payload.at };
  } catch (e) {
    return { ok: false, error: `Vault open failed: ${e.message}` };
  }
}

function sealFromLivePrefs() {
  const prefs = require('./preferences').load();
  return seal(prefs);
}

function restoreIntoLivePrefs() {
  const opened = open();
  if (!opened.ok) return opened;
  const saved = require('./preferences').save(opened.preferences || {});
  return { ok: true, restored: true, preferences: saved };
}

module.exports = { enabled, status, seal, open, sealFromLivePrefs, restoreIntoLivePrefs };
