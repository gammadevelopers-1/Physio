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

// Strategy: walk each file, find each <input / <textarea / <select tag, then
// scan forward up to MAX_LOOKAHEAD lines (until we hit `>` closing the tag)
// and replace `border-[var(--color-border)]` inside the className.
//
// Also: many lines that are clearly form inputs/dropdowns by their className
// pattern alone (e.g. `outline-none focus:border-[`, `placeholder:`) get
// matched too — same heuristic as v1.

const MAX_LOOKAHEAD = 25;
const ELEMENT_RE = /<(input|textarea|select)\b/i;

function isInputLineByClass(line) {
  if (!line.includes(FROM)) return false;
  return (
    line.includes('outline-none') ||
    line.includes('placeholder:') ||
    line.includes('focus:border-[')
  );
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(FROM)) continue;
  const lines = text.split('\n');
  const replaced = new Set();

  // Pass 1 — element-based: for each line opening <input/textarea/select,
  // mark following lines (until `>` end of tag) as input-tag context.
  for (let i = 0; i < lines.length; i++) {
    if (!ELEMENT_RE.test(lines[i])) continue;
    let j = i;
    let depth = 0;
    while (j < Math.min(lines.length, i + MAX_LOOKAHEAD)) {
      replaced.add(j);
      // crude tag close detection: a line with `>` or `/>` (but not inside {})
      // We need to count nested {} from JSX too, but a simpler approach:
      // stop when we see `/>` or a standalone `>` at the line end.
      const ln = lines[j];
      if (/(\/>|>)\s*$/.test(ln) && depth === 0) break;
      // track expression-only braces to avoid false-positive on `>`
      depth += (ln.match(/\{/g) || []).length;
      depth -= (ln.match(/\}/g) || []).length;
      if (depth < 0) depth = 0;
      j++;
    }
  }

  // Pass 2 — class-based heuristic (same as v1).
  for (let i = 0; i < lines.length; i++) {
    if (isInputLineByClass(lines[i])) replaced.add(i);
  }

  // Apply replacement only on flagged lines.
  let fileReplacements = 0;
  for (const i of replaced) {
    const before = lines[i];
    if (!before.includes(FROM)) continue;
    const count = (before.match(/border-\[var\(--color-border\)\]/g) || []).length;
    lines[i] = before.split(FROM).join(TO);
    fileReplacements += count;
  }

  if (fileReplacements === 0) continue;
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  changedFiles++;
  totalReplacements += fileReplacements;
  console.log(`updated ${fileReplacements}x: ${path.relative(SRC, file)}`);
}

console.log(`\nDone. ${changedFiles} files, ${totalReplacements} replacements.`);
