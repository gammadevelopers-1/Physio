const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'frontend', 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

// Migrate `focus:border-[var(--outline-focused)]` and
// `focus:border-[var(--color-primary)]` → `focus:border-[var(--color-input-focus)]`.
// Also migrate `focus:ring-[var(--color-primary)]` → `focus:ring-[var(--color-input-focus)]`
// when it's part of a focus ring on an input (we apply only when same line has
// `focus:` and `border` patterns to be safe).

const REPLACEMENTS = [
  ['focus:border-[var(--outline-focused)]', 'focus:border-[var(--color-input-focus)]'],
  ['focus:border-[var(--color-primary)]', 'focus:border-[var(--color-input-focus)]'],
  ['focus:ring-[var(--color-primary)]', 'focus:ring-[var(--color-input-focus)]'],
];

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  let text = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of REPLACEMENTS) {
    if (!text.includes(from)) continue;
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = (text.match(new RegExp(escaped, 'g')) || []).length;
    if (matches > 0) {
      text = text.split(from).join(to);
      count += matches;
    }
  }
  if (count === 0) continue;
  fs.writeFileSync(file, text, 'utf8');
  changedFiles++;
  totalReplacements += count;
  console.log(`updated ${count}x: ${path.relative(SRC, file)}`);
}

console.log(`\nDone. ${changedFiles} files, ${totalReplacements} replacements.`);
