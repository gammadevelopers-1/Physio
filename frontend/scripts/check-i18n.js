#!/usr/bin/env node
/**
 * Static i18n guard. Run before build to fail fast on raw-key bugs.
 *
 * What it checks:
 *  1. Drift between messages/en.json and messages/ar.json — any key
 *     present in one locale but not the other is reported.
 *  2. Every static `t("key.path")` call across src/ resolves to a key
 *     that exists in BOTH locales. `useTranslations("namespace")` is
 *     tracked so `t("child.key")` correctly resolves to
 *     `namespace.child.key`.
 *
 * What it doesn't check:
 *  - Dynamic keys like t(`prefix.${var}`) — skipped with a warning.
 *  - Server-side getTranslations() / getMessages() — same regex as t().
 *  - Typos that happen to exist in both locale files (rare).
 *
 * Exit codes: 0 = clean, 1 = drift/missing keys, 2 = parser failure.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const MESSAGES_DIR = path.join(ROOT, "messages");
const LOCALES = ["en", "ar"];

// ----- Color helpers (no deps) -----
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ----- Load locale files -----
function loadMessages(locale) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.error(c.red(`Missing locale file: ${file}`));
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Flatten { a: { b: "x" } } → ["a.b"]. Skips ICU-message leaves that
// happen to be arrays (not used here, but defensive).
function flattenKeys(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenKeys(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}

// ----- Walk src/ -----
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip generated / test output dirs
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "__tests__" ||
        entry.name === "__mocks__"
      ) {
        continue;
      }
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ----- Find t() usages bound to useTranslations() namespaces -----
//
// Strategy:
//   1. For each file, find all `const t = useTranslations("ns")` (and
//      variants like `const tCommon = useTranslations("common")`).
//      Map variable name → namespace.
//   2. Find all `<varName>("static.key")` calls. Skip template literals.
//   3. Also catch the namespace-less form `useTranslations()` → root.
//   4. Also catch getTranslations({ namespace: "ns" }) on the server.

const USE_TRANSLATIONS_RE =
  /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:locale\s*:\s*[^,}]+,\s*)?namespace\s*:\s*(?:"([^"]*)"|'([^']*)')\s*[^}]*\}|)\s*\)/g;

const T_CALL_RE = /\b(\w+)\s*\(\s*(?:"([^"]+)"|'([^']+)')\s*[,)]/g;

const TEMPLATE_T_CALL_RE = /\b(\w+)\s*\(\s*`/g;

function extractUsagesFromFile(file) {
  const src = fs.readFileSync(file, "utf8");

  // Collect ALL useTranslations()/getTranslations() declarations with
  // their character position. A single file (or even a single variable
  // name like `t`) can be re-bound in multiple component closures, so
  // we resolve each t() call by walking back to the most recent
  // declaration of that variable name. Cheap stand-in for real scope
  // tracking that handles the React component pattern accurately.
  const bindings = []; // { pos, varName, ns }
  let m;
  USE_TRANSLATIONS_RE.lastIndex = 0;
  while ((m = USE_TRANSLATIONS_RE.exec(src)) !== null) {
    bindings.push({
      pos: m.index,
      varName: m[1],
      ns: m[2] ?? m[3] ?? m[4] ?? m[5] ?? "",
    });
  }

  if (bindings.length === 0) return { staticKeys: [], dynamicHits: [] };
  const knownVars = new Set(bindings.map((b) => b.varName));

  const resolveNs = (varName, pos) => {
    // Walk backwards to find the most recent binding of this varName
    // that appears before `pos`.
    for (let i = bindings.length - 1; i >= 0; i--) {
      const b = bindings[i];
      if (b.varName === varName && b.pos < pos) return b.ns;
    }
    return null;
  };

  const staticKeys = [];
  T_CALL_RE.lastIndex = 0;
  while ((m = T_CALL_RE.exec(src)) !== null) {
    const varName = m[1];
    if (!knownVars.has(varName)) continue;
    const ns = resolveNs(varName, m.index);
    if (ns === null) continue;
    const rawKey = m[2] ?? m[3];
    const fullKey = ns ? `${ns}.${rawKey}` : rawKey;
    const line = src.slice(0, m.index).split("\n").length;
    staticKeys.push({ file, line, key: fullKey, ns, rawKey });
  }

  const dynamicHits = [];
  TEMPLATE_T_CALL_RE.lastIndex = 0;
  while ((m = TEMPLATE_T_CALL_RE.exec(src)) !== null) {
    const varName = m[1];
    if (!knownVars.has(varName)) continue;
    const ns = resolveNs(varName, m.index);
    if (ns === null) continue;
    const line = src.slice(0, m.index).split("\n").length;
    dynamicHits.push({ file, line, ns });
  }

  return { staticKeys, dynamicHits };
}

// ----- Run -----
console.log(c.bold("🌐 i18n key check"));
console.log("");

const messages = {};
const keysByLocale = {};
for (const locale of LOCALES) {
  messages[locale] = loadMessages(locale);
  keysByLocale[locale] = flattenKeys(messages[locale]);
  console.log(
    c.dim(`  ${locale}.json: ${keysByLocale[locale].size.toLocaleString()} keys`),
  );
}
console.log("");

let errors = 0;
let warnings = 0;

// ----- Check 1: locale drift -----
const onlyInEn = [...keysByLocale.en].filter((k) => !keysByLocale.ar.has(k));
const onlyInAr = [...keysByLocale.ar].filter((k) => !keysByLocale.en.has(k));

if (onlyInEn.length > 0) {
  errors += onlyInEn.length;
  console.log(c.red(`✗ ${onlyInEn.length} key(s) in en.json but missing in ar.json:`));
  for (const k of onlyInEn.slice(0, 30)) console.log(`    ${k}`);
  if (onlyInEn.length > 30) console.log(c.dim(`    … and ${onlyInEn.length - 30} more`));
  console.log("");
}
if (onlyInAr.length > 0) {
  errors += onlyInAr.length;
  console.log(c.red(`✗ ${onlyInAr.length} key(s) in ar.json but missing in en.json:`));
  for (const k of onlyInAr.slice(0, 30)) console.log(`    ${k}`);
  if (onlyInAr.length > 30) console.log(c.dim(`    … and ${onlyInAr.length - 30} more`));
  console.log("");
}
if (onlyInEn.length === 0 && onlyInAr.length === 0) {
  console.log(c.green("✓ en.json and ar.json have identical key sets"));
  console.log("");
}

// ----- Check 2: keys referenced in source resolve in both locales -----
const files = walk(SRC_DIR);
const allUsages = [];
const allDynamic = [];
for (const file of files) {
  const { staticKeys, dynamicHits } = extractUsagesFromFile(file);
  allUsages.push(...staticKeys);
  allDynamic.push(...dynamicHits);
}

console.log(
  c.dim(
    `  Scanned ${files.length.toLocaleString()} source files → ${allUsages.length.toLocaleString()} static t() calls, ${allDynamic.length.toLocaleString()} dynamic`,
  ),
);
console.log("");

const missingByLocale = { en: [], ar: [] };
for (const usage of allUsages) {
  for (const locale of LOCALES) {
    if (!keysByLocale[locale].has(usage.key)) {
      missingByLocale[locale].push(usage);
    }
  }
}

for (const locale of LOCALES) {
  const missing = missingByLocale[locale];
  if (missing.length === 0) continue;

  errors += missing.length;
  // Group by key so the same missing key isn't printed N times
  const byKey = new Map();
  for (const m of missing) {
    if (!byKey.has(m.key)) byKey.set(m.key, []);
    byKey.get(m.key).push(m);
  }

  console.log(
    c.red(
      `✗ ${byKey.size} key(s) used in code but missing in ${locale}.json (${missing.length} reference${missing.length === 1 ? "" : "s"}):`,
    ),
  );
  for (const [key, refs] of byKey) {
    const sample = refs[0];
    const rel = path.relative(ROOT, sample.file).replace(/\\/g, "/");
    console.log(`    ${c.bold(key)}`);
    console.log(c.dim(`      ${rel}:${sample.line}${refs.length > 1 ? ` (+${refs.length - 1} more)` : ""}`));
  }
  console.log("");
}

if (missingByLocale.en.length === 0 && missingByLocale.ar.length === 0) {
  console.log(c.green("✓ Every static t() call resolves in both locales"));
  console.log("");
}

// ----- Dynamic keys — warning only -----
if (allDynamic.length > 0) {
  warnings += allDynamic.length;
  const byFile = new Map();
  for (const d of allDynamic) {
    if (!byFile.has(d.file)) byFile.set(d.file, []);
    byFile.get(d.file).push(d);
  }
  console.log(
    c.yellow(
      `⚠ ${allDynamic.length} dynamic t(\`...\`) call(s) in ${byFile.size} file(s) — skipped (can't statically verify):`,
    ),
  );
  let shown = 0;
  for (const [file, hits] of byFile) {
    if (shown >= 10) {
      console.log(c.dim(`    … and ${byFile.size - shown} more files`));
      break;
    }
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    console.log(c.dim(`    ${rel} (lines: ${hits.map((h) => h.line).join(", ")})`));
    shown++;
  }
  console.log("");
}

// ----- Result -----
if (errors > 0) {
  console.log(c.red(c.bold(`✗ FAIL — ${errors} i18n issue${errors === 1 ? "" : "s"} found.`)));
  console.log(
    c.dim(
      "  Fix by adding the missing keys to messages/en.json and messages/ar.json, then re-run `npm run check:i18n`.",
    ),
  );
  process.exit(1);
}

console.log(c.green(c.bold(`✓ PASS${warnings > 0 ? ` (with ${warnings} dynamic-call warning${warnings === 1 ? "" : "s"})` : ""}.`)));
process.exit(0);
