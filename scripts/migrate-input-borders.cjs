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

const FROM = 'border-[var(--color-border)]';
const TO = 'border-[var(--color-input-border)]';

// A line is an input/textarea/select if it has BOTH:
//   - border-[var(--color-border)]
//   - one of: outline-none | placeholder: | focus:border-[ | <input  | <textarea | <select
function isInputLine(line) {
  if (!line.includes(FROM)) return false;
  return (
    line.includes('outline-none') ||
    line.includes('placeholder:') ||
    line.includes('focus:border-[') ||
    /<input\b/.test(line) ||
    /<textarea\b/.test(line) ||
    /<select\b/.test(line)
  );
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(FROM)) continue;
  const lines = text.split('\n');
  let fileReplacements = 0;
  const newLines = lines.map((line) => {
    if (!isInputLine(line)) return line;
    const before = line;
    const after = line.split(FROM).join(TO);
    if (before !== after) {
      const count = (before.match(/border-\[var\(--color-border\)\]/g) || []).length;
      fileReplacements += count;
    }
    return after;
  });
  if (fileReplacements === 0) continue;
  fs.writeFileSync(file, newLines.join('\n'), 'utf8');
  changedFiles++;
  totalReplacements += fileReplacements;
  console.log(`updated ${fileReplacements}x: ${path.relative(SRC, file)}`);
}

console.log(`\nDone. ${changedFiles} files, ${totalReplacements} replacements.`);
