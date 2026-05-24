// One-shot reporter: dumps missing-in-locale keys with file:line for each.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const LOCALES = ['en', 'ar'];

function flat(o, p = '', out = new Set()) {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else out.add(key);
  }
  return out;
}
const msg = {
  en: JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/en.json'), 'utf8')),
  ar: JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/ar.json'), 'utf8')),
};
const keys = { en: flat(msg.en), ar: flat(msg.ar) };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', '__tests__', '__mocks__'].includes(e.name)) continue;
      walk(f, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(f);
  }
  return out;
}

const USE_T = /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:locale\s*:\s*[^,}]+,\s*)?namespace\s*:\s*(?:"([^"]*)"|'([^']*)')\s*[^}]*\}|)\s*\)/g;
const T_CALL = /\b(\w+)\s*\(\s*(?:"([^"]+)"|'([^']+)')\s*[,)]/g;

const usages = [];
for (const f of walk(SRC)) {
  const s = fs.readFileSync(f, 'utf8');
  const bindings = []; // { pos, varName, ns }
  let m;
  USE_T.lastIndex = 0;
  while ((m = USE_T.exec(s)) !== null) {
    bindings.push({ pos: m.index, varName: m[1], ns: m[2] ?? m[3] ?? m[4] ?? m[5] ?? '' });
  }
  if (bindings.length === 0) continue;
  const knownVars = new Set(bindings.map((b) => b.varName));
  const resolveNs = (v, pos) => {
    for (let i = bindings.length - 1; i >= 0; i--) {
      const b = bindings[i];
      if (b.varName === v && b.pos < pos) return b.ns;
    }
    return null;
  };
  T_CALL.lastIndex = 0;
  while ((m = T_CALL.exec(s)) !== null) {
    if (!knownVars.has(m[1])) continue;
    const ns = resolveNs(m[1], m.index);
    if (ns === null) continue;
    const rk = m[2] ?? m[3];
    const full = ns ? `${ns}.${rk}` : rk;
    const line = s.slice(0, m.index).split('\n').length;
    usages.push({ file: f, line, key: full });
  }
}

const missing = { en: new Map(), ar: new Map() };
for (const u of usages) {
  for (const L of LOCALES) {
    if (!keys[L].has(u.key)) {
      if (!missing[L].has(u.key)) missing[L].set(u.key, []);
      missing[L].get(u.key).push(u);
    }
  }
}

for (const L of LOCALES) {
  console.log(`=== MISSING IN ${L} (${missing[L].size} unique) ===`);
  for (const [k, refs] of missing[L]) {
    const r = refs[0];
    const rel = path.relative(ROOT, r.file).replace(/\\/g, '/');
    console.log(`${k}\t${rel}:${r.line}${refs.length > 1 ? ` (+${refs.length - 1})` : ''}`);
  }
}
