#!/usr/bin/env node
/**
 * check-mineral-css.mjs
 *
 * Regression guard for the Assay Ledger status-color palette.
 *
 * The mineral status retones live in globals.css as ONE shared rule for both
 * themes plus two small theme-specific rules for the sky/blue/purple (info/
 * processing) contrast pair:
 *
 *   [data-theme="dark"] .dashboard-scope, [data-theme="light"] .dashboard-scope {
 *     --color-emerald-400/500, green, teal: #5F8B6E   (patina)
 *     --color-red-300/400/500: #B4633F                 (rust)
 *     --color-amber-400/500, yellow-500: #C8A24B       (gold)
 *     --color-gray-500: #8C8272
 *   }
 *   [data-theme="dark"] .dashboard-scope  { --color-sky/blue/purple: #E3C878 }
 *   [data-theme="light"] .dashboard-scope { --color-sky/blue/purple: #8E6B2A }
 *
 * This script fails (exit 1) if any of those blocks/values are missing from
 * the source globals.css and — with --compiled — from the compiled CSS
 * emitted by next build (where a compiler/minifier bug could silently drop
 * them even when the source looks fine).
 *
 * Usage:
 *   node scripts/check-mineral-css.mjs            # source only
 *   node scripts/check-mineral-css.mjs --compiled # source + built CSS (.next)
 */

import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOURCE = join(ROOT, 'src', 'app', 'globals.css');
const COMPILED_GLOBS = ['static/chunks/*.css', 'static/css/**/*.css'];

const wantsCompiled = process.argv.includes('--compiled');

// The exact values we must never lose.
const SHARED_REQUIRED = [
  ['--color-emerald-400', '#5f8b6e'],
  ['--color-red-400', '#b4633f'],
  ['--color-amber-400', '#c8a24b'],
  ['--color-gray-500', '#8c8272'],
];
const DARK_SKY = [['--color-sky-400', '#e3c878']];
const LIGHT_SKY = [['--color-sky-400', '#8e6b2a']];

/** Lowercase, strip comments, collapse whitespace, drop spaces around colons. */
function normalize(css) {
  return css
    .toLowerCase()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\{\s*/g, '{')
    .replace(/\s*\}\s*/g, '}');
}

const themeAttr = (v) => `data-theme=["']?${v}["']?`;
const SCOPE = '\\.dashboard-scope';

/** Extract the contents of the block for a selector, or null. */
function blockFor(norm, selectorRe) {
  const m = norm.match(selectorRe);
  if (!m || !m[1]) return null;
  return m[1];
}

function hasVars(block, vars) {
  return vars.every(([name, value]) => block.includes(`${name}:${value}`));
}

function checkCss(css, label, errors) {
  const norm = normalize(css);

  // 1. Shared mineral block (both themes in ONE selector list).
  const sharedRe = new RegExp(
    `\\[${themeAttr('dark')}\\][^{}]*${SCOPE},\\[${themeAttr('light')}\\][^{}]*${SCOPE}\\{([^}]*)\\}`
  );
  const shared = blockFor(norm, sharedRe);
  if (!shared) {
    errors.push(`${label}: shared mineral status block missing — expected a combined [data-theme="dark"] .dashboard-scope, [data-theme="light"] .dashboard-scope { ... } rule`);
  } else if (!hasVars(shared, SHARED_REQUIRED)) {
    const missing = SHARED_REQUIRED.filter(([n, v]) => !shared.includes(`${n}:${v}`));
    errors.push(`${label}: shared mineral block missing ${missing.map(([n, v]) => `${n}: ${v}`).join(', ')}`);
  }

  // 2. Dark-specific sky/blue/purple contrast value.
  const darkRe = new RegExp(`\\[${themeAttr('dark')}\\][^{}]*${SCOPE}\\{([^}]*--color-sky-400:[^}]*)\\}`);
  const darkBlock = blockFor(norm, darkRe);
  if (!darkBlock) {
    errors.push(`${label}: dark sky/processing value missing — expected [data-theme="dark"] .dashboard-scope { --color-sky-400: #E3C878 ... }`);
  } else if (!hasVars(darkBlock, DARK_SKY)) {
    errors.push(`${label}: dark sky/processing value wrong — expected ${DARK_SKY[0][0]}: ${DARK_SKY[0][1]}`);
  }

  // 3. Light-specific sky/blue/purple contrast value.
  const lightRe = new RegExp(`\\[${themeAttr('light')}\\][^{}]*${SCOPE}\\{([^}]*--color-sky-400:[^}]*)\\}`);
  const lightBlock = blockFor(norm, lightRe);
  if (!lightBlock) {
    errors.push(`${label}: light sky/processing value missing — expected [data-theme="light"] .dashboard-scope { --color-sky-400: #8E6B2A ... }`);
  } else if (!hasVars(lightBlock, LIGHT_SKY)) {
    errors.push(`${label}: light sky/processing value wrong — expected ${LIGHT_SKY[0][0]}: ${LIGHT_SKY[0][1]}`);
  }
}

const errors = [];
const checked = [];

// Source CSS — always checked.
if (existsSync(SOURCE)) {
  checkCss(readFileSync(SOURCE, 'utf8'), 'src/app/globals.css', errors);
  checked.push('src/app/globals.css');
} else {
  errors.push('source not found: src/app/globals.css');
}

// Compiled CSS — only with --compiled (CI runs this after next build).
let compiledFiles = [];
if (wantsCompiled) {
  compiledFiles = COMPILED_GLOBS.flatMap((g) => globSync(g, { cwd: join(ROOT, '.next'), nodir: true }).map((f) => join(ROOT, '.next', f)));
  if (compiledFiles.length === 0) {
    errors.push('--compiled requested but no compiled CSS found under .next (did next build run?)');
  }
  for (const f of compiledFiles) {
    checkCss(readFileSync(f, 'utf8'), `compiled ${f.replace(ROOT, '')}`, errors);
    checked.push(f.replace(ROOT, ''));
  }
}

if (errors.length > 0) {
  console.error('❌ Mineral status CSS check FAILED:');
  for (const e of errors) console.error('   - ' + e);
  console.error(`   checked: ${checked.length ? checked.join(', ') : 'none'}`);
  process.exit(1);
}

console.log(`✅ Mineral status CSS check passed (${checked.length} file${checked.length === 1 ? '' : 's'}: ${checked.join(', ')})`);
