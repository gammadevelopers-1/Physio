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

const FROM = 'hover:bg-[var(--color-surface-page)]';
const TO = 'hover:bg-[var(--color-border-subtle)]';

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(FROM)) continue;
  const escaped = FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (before.match(new RegExp(escaped, 'g')) || []).length;
  if (count === 0) continue;
  const after = before.split(FROM).join(TO);
  fs.writeFileSync(file, after, 'utf8');
  changedFiles++;
  totalReplacements += count;
  console.log(`updated ${count}x: ${path.relative(SRC, file)}`);
}

console.log(`\nDone. ${changedFiles} files, ${totalReplacements} replacements.`);
