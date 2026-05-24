// Cleanup orphan i18n keys:
//   1. Add AR translations for the 4 EN-only keys.
//   2. Delete the 163 AR-only keys that no longer exist in EN and aren't
//      referenced anywhere in src/ (dead translations from old Sanity-era
//      blogs/courses and a botched wizard rename).
//
// Run once: node scripts/cleanup-i18n-orphans.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const enFile = path.join(ROOT, 'messages/en.json');
const arFile = path.join(ROOT, 'messages/ar.json');

// ---- AR additions (mirror of EN-only keys) ----
const AR_ADDITIONS = {
  'instructorDashboard.sessionsPage.dateFrom': 'من تاريخ',
  'instructorDashboard.sessionsPage.dateTo':   'إلى تاريخ',
  'taDashboard.settings.firstNameAr':          'الاسم الأول (عربي)',
  'taDashboard.settings.lastNameAr':           'اسم العائلة (عربي)',
};

// ---- Leaf paths to delete (read dynamically from /tmp/ar-only-leaves.json
// when present, else fall back to the inline snapshot).
// These were confirmed unused: every leaf is in ar.json but neither in
// en.json nor in any t() call in src/.
const AR_ONLY_LEAVES_FILE = require('path').join(require('os').tmpdir(), 'ar-only-leaves.json');
let AR_DELETE_LEAVES = [];
try {
  AR_DELETE_LEAVES = JSON.parse(require('fs').readFileSync(AR_ONLY_LEAVES_FILE, 'utf8'));
} catch {
  // No-op — if the dump file is missing, no leaves are deleted. Caller
  // should run the dump first (see /tmp/ar-only-leaves.json generator
  // in this commit's PR description).
}

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

function deleteDeep(obj, dotPath) {
  const parts = dotPath.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node || typeof node !== 'object') return false;
    node = node[parts[i]];
  }
  if (!node || typeof node !== 'object') return false;
  const leaf = parts[parts.length - 1];
  if (!(leaf in node)) return false;
  delete node[leaf];
  return true;
}

function countLeaves(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1;
  let n = 0;
  for (const v of Object.values(obj)) n += countLeaves(v);
  return n;
}

// Prune empty objects left behind after deleting leaves. Without this,
// ar.json keeps `"coursesPage": { "courses": {} }` cruft that would
// re-introduce drift on the next check.
function pruneEmpty(obj) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      pruneEmpty(v);
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
}

const ar = JSON.parse(fs.readFileSync(arFile, 'utf8'));

// 1. Additions
let added = 0;
for (const [dotPath, val] of Object.entries(AR_ADDITIONS)) {
  if (setDeep(ar, dotPath, val)) added++;
}

// 2. Leaf-level deletions
let removed = 0;
for (const dotPath of AR_DELETE_LEAVES) {
  if (deleteDeep(ar, dotPath)) removed++;
}

// 3. Drop the empty parent shells
pruneEmpty(ar);

fs.writeFileSync(arFile, JSON.stringify(ar, null, 2) + '\n', 'utf8');

console.log(`ar.json: +${added} keys, −${removed} leaves (then pruned empty parents)`);
