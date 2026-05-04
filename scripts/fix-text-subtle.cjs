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

// text-[var(--color-border-subtle)] → text-[var(--color-text-secondary)]
// This catches both `text-[...]` (icons) and `placeholder:text-[...]` (placeholders).
const FROM = 'text-[var(--color-border-subtle)]';
const TO = 'text-[var(--color-text-secondary)]';

let changedFiles = 0;
let total = 0;
for (const file of walk(SRC)) {
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(FROM)) continue;
  const escaped = FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (before.match(new RegExp(escaped, 'g')) || []).length;
  if (count === 0) continue;
  fs.writeFileSync(file, before.split(FROM).join(TO), 'utf8');
  changedFiles++;
  total += count;
  console.log(`updated ${count}x: ${path.relative(SRC, file)}`);
}
console.log(`\nDone. ${changedFiles} files, ${total} replacements.`);
