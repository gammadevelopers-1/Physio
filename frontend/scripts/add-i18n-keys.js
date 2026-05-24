#!/usr/bin/env node
/**
 * One-shot patch: deep-merges a flat dot-path map into messages/en.json
 * and messages/ar.json. Re-running is idempotent — existing values are
 * NOT overwritten.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const enFile = path.join(ROOT, 'messages/en.json');
const arFile = path.join(ROOT, 'messages/ar.json');

const ADDITIONS = {
  // ── Forgot / Reset password — reCAPTCHA required toast ──
  'forgotPasswordPage.errors.recaptchaRequired': {
    en: 'Please complete the reCAPTCHA',
    ar: 'يرجى إكمال reCAPTCHA',
  },
  'resetPasswordPage.errors.recaptchaRequired': {
    en: 'Please complete the reCAPTCHA',
    ar: 'يرجى إكمال reCAPTCHA',
  },
};

function setDeep(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (node[k] === undefined || typeof node[k] !== 'object' || Array.isArray(node[k])) {
      node[k] = {};
    }
    node = node[k];
  }
  const leaf = parts[parts.length - 1];
  if (node[leaf] !== undefined) return false;
  node[leaf] = value;
  return true;
}

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arFile, 'utf8'));

let addedEn = 0, addedAr = 0, skippedEn = 0, skippedAr = 0;
for (const [dotPath, { en: enVal, ar: arVal }] of Object.entries(ADDITIONS)) {
  if (setDeep(en, dotPath, enVal)) addedEn++; else skippedEn++;
  if (setDeep(ar, dotPath, arVal)) addedAr++; else skippedAr++;
}

fs.writeFileSync(enFile, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(arFile, JSON.stringify(ar, null, 2) + '\n', 'utf8');

console.log(`en.json: +${addedEn} keys (${skippedEn} already present)`);
console.log(`ar.json: +${addedAr} keys (${skippedAr} already present)`);
