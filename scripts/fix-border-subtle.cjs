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

const FROM = 'border-[var(--color-border-subtle)]';
const TO = 'border-[var(--color-border)]';

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(FROM)) continue;
  // Only replace the border-* version, NOT bg-[var(--color-border-subtle)] (unaffected
  // because that string starts with `bg-` and our FROM starts with `border-`).
  const after = before.split(FROM).join(TO);
  const count = (before.match(new RegExp(FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count === 0) continue;
  fs.writeFileSync(file, after, 'utf8');
  changedFiles++;
  totalReplacements += count;
  console.log(`updated ${count}x: ${path.relative(SRC, file)}`);
}

console.log(`\nDone. ${changedFiles} files, ${totalReplacements} replacements.`);
