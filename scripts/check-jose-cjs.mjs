#!/usr/bin/env node
/**
 * Guard against the production outage fixed in a52bdc4, generalized.
 *
 * firebase-admin -> jwks-rsa -> jose: jose v6+ is ESM-only (its exports map has
 * no `require` condition and ships no CJS build), so on Vercel's serverless
 * runtime a plain `require('jose')` fails with ERR_REQUIRE_ESM — every route
 * importing firebase-admin 500'd at module load in production. Local Node 24
 * tolerated it (require(esm) on by default), which is why it only broke on
 * Vercel.
 *
 * jose is not unique: ANY ESM-only package that lands in the runtime-required
 * dependency tree is the same landmine. This script therefore does three
 * things, all under the `postinstall` hook / `npm run check:jose` / `npm run
 * build`:
 *
 *   1. Dependency-tree scan: reads package-lock.json, checks every installed
 *      package's manifest (the lockfile alone has no `exports`/`type` info)
 *      with Node's real resolver, and flags packages whose exports lack a
 *      `require` condition / ship no CJS build. It FAILS when such a package
 *      is in the runtime-required closure — the transitive deps of
 *      next.config.ts `serverExternalPackages` — because those are require()'d
 *      by Node at runtime on Vercel. A small documented allowlist covers
 *      verified-safe exceptions that are never actually require()'d.
 *   2. Ground truth: loads the real require chain (jwks-rsa + firebase-admin/
 *      auth) with require(esm) explicitly disabled, mirroring Vercel.
 *   3. Bundle scan (--bundle, after `next build`): scans .next/server for any
 *      ESM-only package's files that made it into the shipped output —
 *      Turbopack emits runtime require()s of ESM files it cannot convert,
 *      which is exactly how the jose v6 failure manifested.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, basename } from "node:path";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(join(root, "package.json"));

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Recursively list files under dir. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * Classify a JS file as CJS / ESM / unknown by extension + nearest
 * package.json `type`, mirroring Node's module-format rules.
 */
function fileFormat(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith(".cjs")) return "cjs";
  if (lower.endsWith(".mjs")) return "esm";
  if (
    lower.endsWith(".js") || lower.endsWith(".jsx") ||
    lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")
  ) {
    let d = dirname(file);
    for (let i = 0; i < 16 && d.length > 1; i++, d = dirname(d)) {
      const pj = join(d, "package.json");
      if (existsSync(pj)) {
        try {
          const t = JSON.parse(readFileSync(pj, "utf8")).type;
          if (t === "module") return "esm";
          if (t === "commonjs") return "cjs";
        } catch {
          // unreadable manifest — keep walking
        }
      }
      if (basename(d) === "node_modules") break;
    }
    return "cjs"; // no type field anywhere above -> CJS default
  }
  if (lower.endsWith(".json") || lower.endsWith(".node")) return "cjs";
  return "unknown";
}

const JS_TARGET_RE = /\.(mjs|js|jsx|mts|cts|ts)$/i;
const DT_RE = /\.d\.(mts|cts|ts)$/i;
const CJS_TARGET_RE = /\.(cjs|cts)$/i;

/** Is a JS target in ESM format? (type:module packages treat .js as ESM.) */
function isEsmJsTarget(target, pkgType) {
  if (CJS_TARGET_RE.test(target) || /\.cjs\.js$/i.test(target)) return false;
  if (/\.(mjs|mts)$/i.test(target) || /\.esm\.(js|mjs)$/i.test(target)) return true;
  return pkgType === "module";
}

/** Does the package ship a CJS build anywhere (require conditions / .cjs targets)? */
function hasCjsBuild(pkg) {
  if (!pkg.exports) {
    // Legacy resolution: CJS by default unless type:module with a non-.cjs main.
    return !(pkg.type === "module" && !CJS_TARGET_RE.test(pkg.main || "index.js"));
  }
  let found = false;
  const walkVal = (v, isRequireBranch) => {
    if (found) return;
    if (typeof v === "string") {
      if (CJS_TARGET_RE.test(v) || /\.cjs\.js$/i.test(v)) found = true;
      else if (isRequireBranch && JS_TARGET_RE.test(v) && !DT_RE.test(v) && !isEsmJsTarget(v, pkg.type)) {
        found = true;
      }
    } else if (Array.isArray(v)) {
      for (const x of v) walkVal(x, isRequireBranch);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walkVal(x, isRequireBranch || k === "require");
    }
  };
  walkVal(pkg.exports, false);
  return found;
}

/** All JS entry targets (relative, ./-stripped) in a package.json exports/main. */
function collectJsTargets(pkg) {
  const out = [];
  const walkVal = (v) => {
    if (typeof v === "string") {
      if (JS_TARGET_RE.test(v) && !DT_RE.test(v)) out.push(v.replace(/^\.\//, ""));
    } else if (Array.isArray(v)) {
      for (const x of v) walkVal(x);
    } else if (v && typeof v === "object") {
      for (const x of Object.values(v)) walkVal(x);
    }
  };
  if (pkg.exports) walkVal(pkg.exports);
  if (
    typeof pkg.main === "string" && pkg.main &&
    JS_TARGET_RE.test(pkg.main) && !DT_RE.test(pkg.main)
  ) {
    out.push(pkg.main.replace(/^\.\//, ""));
  }
  return out;
}

/**
 * Is an installed package ESM-only (require()-incompatible)? Uses Node's real
 * resolver (createRequire from inside the package) so conditional exports are
 * interpreted exactly as the runtime would, then checks the resolved file's
 * format. Returns { esmOnly, detail }.
 */
function classifyEsmOnly(pkgDir, pkgName) {
  let entry = null;
  let errCode = null;
  try {
    entry = createRequire(join(pkgDir, "__probe__.cjs")).resolve(pkgName);
  } catch (e) {
    errCode = e.code;
  }
  if (errCode) {
    if (errCode === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
      } catch {
        return { esmOnly: false, detail: "unreadable manifest" };
      }
      const js = collectJsTargets(pkg);
      if (!js.length) {
        return { esmOnly: false, detail: `no require entry and no JS exports (${errCode})` };
      }
      if (hasCjsBuild(pkg)) {
        return {
          esmOnly: false,
          detail:
            `bare require('${pkgName}') is rejected (no \`require\` on the "." export), ` +
            "but a CJS build exists via subpath exports",
        };
      }
      const esmOnlyTargets = js.filter((t) => isEsmJsTarget(t, pkg.type));
      if (esmOnlyTargets.length) {
        return {
          esmOnly: true,
          detail:
            `no \`require\` condition and no CJS build — require('${pkgName}') is rejected ` +
            `with ERR_PACKAGE_PATH_NOT_EXPORTED; JS targets: ${js.join(", ")}`,
        };
      }
      return { esmOnly: false, detail: "bare require rejected, but JS targets are CJS-format" };
    }
    return { esmOnly: false, detail: `unresolvable (${errCode})` };
  }
  const fmt = fileFormat(entry);
  return {
    esmOnly: fmt === "esm",
    detail:
      fmt === "esm"
        ? `require('${pkgName}') resolves to ${relative(root, entry)} — ESM-only, no CJS build`
        : `require('${pkgName}') resolves to ${relative(root, entry)} (${fmt})`,
  };
}

function readLockfile() {
  return JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
}

/** serverExternalPackages from next.config.ts (fallback: the known auth chain). */
function serverExternalRoots() {
  const fallback = ["firebase-admin", "jwks-rsa", "jose"];
  const cfgPath = join(root, "next.config.ts");
  if (!existsSync(cfgPath)) return fallback;
  const m = readFileSync(cfgPath, "utf8").match(/serverExternalPackages\s*:\s*\[([^\]]*)\]/);
  if (!m) return fallback;
  const names = [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]);
  return names.length ? names : fallback;
}

/**
 * Transitive dependency closure of the runtime-required roots, computed from
 * package-lock.json. Returns { required, optionalOnly, chain } keyed by
 * lockfile location ("node_modules/...").
 *  - required: reachable via `dependencies` edges only — loaded eagerly by the
 *    require() chain at runtime.
 *  - optionalOnly: reachable only through an `optionalDependencies` edge —
 *    loaded lazily, only if that optional API (e.g. firestore/storage) is used.
 */
function closureOf(lock, roots) {
  const byName = new Map();
  const nameOf = (loc) => loc.replace(/^node_modules\//, "").split("/node_modules/").pop();
  for (const loc of Object.keys(lock.packages)) {
    if (!loc.startsWith("node_modules/")) continue;
    const name = nameOf(loc);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(loc);
  }
  // npm resolution: a package at fromLoc requiring dep looks in its own
  // node_modules, then each ancestor's node_modules, then the top level —
  // mirroring real hoisting (e.g. ansi-regex@6 nested under @isaacs/cliui).
  const resolveDep = (fromLoc, dep) => {
    let prefix = fromLoc;
    for (;;) {
      const candidate = prefix ? `${prefix}/node_modules/${dep}` : `node_modules/${dep}`;
      if (lock.packages[candidate]) return candidate;
      if (!prefix) break;
      const idx = prefix.lastIndexOf("/node_modules/");
      prefix = idx < 0 ? "" : prefix.slice(0, idx);
    }
    return null;
  };
  const status = new Map(); // loc -> "required" | "optional"
  const chain = new Map();  // loc -> "a → b → c"
  const queue = [];
  for (const r of roots) {
    for (const loc of byName.get(r) || []) {
      if (!status.has(loc)) {
        status.set(loc, "required");
        chain.set(loc, r);
        queue.push([loc, "required"]);
      }
    }
  }
  while (queue.length) {
    const [loc, mode] = queue.shift();
    const entry = lock.packages[loc];
    if (!entry) continue;
    const edges = [];
    for (const d of Object.keys(entry.dependencies || {})) edges.push([d, false]);
    for (const d of Object.keys(entry.optionalDependencies || {})) edges.push([d, true]);
    for (const [dep, isOptional] of edges) {
      const dl = resolveDep(loc, dep);
      if (!dl) continue;
      const childMode = mode === "required" && !isOptional ? "required" : "optional";
      const prev = status.get(dl);
      if (prev === "required") continue;
      const nextChain = `${chain.get(loc)} → ${dep}${isOptional && childMode === "optional" ? " (optional)" : ""}`;
      if (prev === "optional" && childMode === "required") {
        status.set(dl, "required");
        chain.set(dl, nextChain);
        queue.push([dl, "required"]);
      } else if (prev === undefined) {
        status.set(dl, childMode);
        chain.set(dl, nextChain);
        queue.push([dl, childMode]);
      }
    }
  }
  const required = new Set();
  const optionalOnly = new Set();
  for (const [loc, s] of status) (s === "required" ? required : optionalOnly).add(loc);
  return { required, optionalOnly, chain };
}

/**
 * Verified-safe exceptions: ESM-only packages in the runtime-required closure
 * that are never actually require()'d at runtime, so a require(esm)-off
 * runtime (Vercel) never touches them. Each entry documents the verification.
 * The firebase-admin load probe below is the backstop: if any of these ever
 * starts being require()'d, that probe fails and catches the regression.
 */
const NODE_FETCH_SAFE =
  "node-fetch@3.3.2 is reached via google-auth-library → gcp-metadata → gaxios@7, but gaxios@7 only loads it with `await import('node-fetch')` as a last-resort when global fetch is absent (build/cjs/src/gaxios.js). Node 18+/Vercel always have global fetch, so it is never loaded — and dynamic import() of ESM is legal even where require(esm) is disabled. Its deps below are only reachable through that never-taken import().";

const ALLOWLIST = [
  {
    name: "node-fetch",
    version: "3.3.2",
    why: NODE_FETCH_SAFE,
  },
  {
    name: "data-uri-to-buffer",
    version: "4.0.1",
    why: NODE_FETCH_SAFE,
  },
  {
    name: "fetch-blob",
    version: "3.2.0",
    why: NODE_FETCH_SAFE,
  },
  {
    name: "formdata-polyfill",
    version: "4.0.10",
    why: NODE_FETCH_SAFE,
  },
];

function locToDir(loc) {
  return join(root, ...loc.split("/"));
}

/** Distinctive string markers to spot an ESM-only package's files in .next/server. */
function esmMarkers(name, pkgJson) {
  const GENERIC_DIRS = new Set([
    "dist", "src", "lib", "build", "esm", "cjs", "node", "browser",
    "types", "test", "tests", "index", "bin", "out", "output", "generated",
    "gen", "mjs", "module", "umd", "es",
  ]);
  const markers = new Set();
  for (const t of collectJsTargets(pkgJson)) {
    const parts = t.split("/");
    const dirs = parts.slice(0, -1);
    const distinct = dirs.find((p) => !GENERIC_DIRS.has(p));
    if (distinct) markers.add(dirs.slice(0, dirs.indexOf(distinct) + 1).join("/"));
    markers.add(`${name}/${t}`);
  }
  return [...markers];
}

// ── Dependency-tree ESM-only scan ───────────────────────────────────────────

/**
 * Scan package-lock.json + installed manifests for ESM-only packages.
 * Prints a report; returns { allEsmOnly, failCount }. Failing entries are
 * ESM-only packages inside the runtime-required closure that are not in the
 * verified-safe allowlist.
 */
function scanDependencyTree() {
  const lock = readLockfile();
  const roots = serverExternalRoots();
  const { required, optionalOnly, chain } = closureOf(lock, roots);

  const fail = [];        // ESM-only in the runtime-required closure
  const allowlisted = []; // ESM-only in closure but verified never require()'d
  const latent = [];      // ESM-only behind optional deps only
  const info = [];        // ESM-only outside the closure (client-side/dev)
  const allEsmOnly = [];  // every ESM-only package (for the bundle scan)

  const classifyLoc = (loc, bucket) => {
    const pkgDir = locToDir(loc);
    if (!existsSync(join(pkgDir, "package.json"))) return;
    const name = loc.replace(/^node_modules\//, "").split("/node_modules/").pop();
    const version = lock.packages[loc] && lock.packages[loc].version;
    let r;
    try {
      r = classifyEsmOnly(pkgDir, name);
    } catch {
      return; // unreadable manifest — skip
    }
    if (!r.esmOnly) return;
    const rec = { name, version, loc, detail: r.detail, chain: chain.get(loc) };
    allEsmOnly.push(rec);
    const al = ALLOWLIST.find((a) => a.name === name && a.version === version);
    if (al) allowlisted.push({ ...rec, why: al.why });
    else bucket.push(rec);
  };

  for (const loc of required) classifyLoc(loc, fail);
  for (const loc of optionalOnly) classifyLoc(loc, latent);
  for (const [loc] of Object.entries(lock.packages)) {
    if (!loc.startsWith("node_modules/") || required.has(loc) || optionalOnly.has(loc)) continue;
    classifyLoc(loc, info);
  }

  console.log("");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`ESM-only dependency scan — serverExternalPackages: ${roots.join(", ")}`);
  console.log("──────────────────────────────────────────────────────────────");

  for (const f of fail) {
    console.error("");
    console.error("❌ ESM-only package in the runtime-required closure:");
    console.error(`   ${f.name}@${f.version}  (${f.loc})`);
    if (f.chain) console.error(`   chain: ${f.chain}`);
    console.error(`   ${f.detail}`);
    console.error("");
    console.error("   On Vercel's serverless runtime, require() of this package fails with");
    console.error("   ERR_REQUIRE_ESM — any route that loads it 500s at module load while");
    console.error("   passing locally (Node 24 tolerates require(esm) by default).");
    console.error("");
    console.error('   Fix: pin a CJS build via package.json "overrides" (like jose → 5.9.6),');
    console.error("   remove/replace the package, or ensure it is only ever import()ed");
    console.error("   (dynamic import of ESM is legal even with require(esm) disabled).");
  }

  if (allowlisted.length) {
    console.log("⚠️  Verified-safe ESM-only in closure (never require()'d at runtime):");
    for (const a of allowlisted) {
      console.log(`   • ${a.name}@${a.version} (${a.loc})`);
      console.log(`     ${a.why}`);
    }
  }

  if (latent.length) {
    console.log("⚠️  Latent risk — ESM-only behind optional deps (only breaks if used):");
    for (const l of latent) {
      console.log(`   • ${l.name}@${l.version} (${l.loc})`);
      if (l.chain) console.log(`     chain: ${l.chain}`);
    }
    console.log("     These only load if the optional API is actually used (e.g.");
    console.log("     firebase-admin's @google-cloud/firestore / @google-cloud/storage).");
    console.log("     If you enable those, require() of the chain above fails on Vercel.");
  }

  if (info.length) {
    console.log("ℹ️  ESM-only outside the server closure (client-side/dev — fine for bundlers):");
    for (const i of info) console.log(`   • ${i.name}@${i.version}`);
  }

  if (!fail.length && !allowlisted.length && !latent.length && !info.length) {
    console.log("✅ No ESM-only packages found anywhere in the dependency tree.");
  } else if (!fail.length) {
    console.log("✅ No require-incompatible ESM-only packages in the runtime-required closure.");
  }

  return { allEsmOnly, failCount: fail.length };
}

// ── Post-build bundle scan ──────────────────────────────────────────────────

/**
 * Scan .next/server for any ESM-only package's files (markers derived from
 * its manifest's ESM targets). Returns hits: [{ name, version, marker, files }]
 * grouped per package name@version + marker, with deduped file lists.
 *
 * `*.nft.json` files are Next.js file-tracing manifests — they list the file
 * paths the runtime MIGHT touch (including dynamic imports that are guarded,
 * like gaxios's `await import('node-fetch')`), so a path appearing there is
 * metadata, not bundled ESM code. Only real bundled/chunk output counts.
 */
function scanBundleForEsmOnly(allEsmOnly, serverDir) {
  const markerIndex = [];
  for (const pkg of allEsmOnly) {
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync(join(locToDir(pkg.loc), "package.json"), "utf8"));
    } catch {
      continue;
    }
    for (const m of esmMarkers(pkg.name, pkgJson)) {
      markerIndex.push({ name: pkg.name, version: pkg.version, marker: m });
    }
  }
  if (!markerIndex.length) return [];
  const foundFiles = new Map(); // `${name}\0${version}\0${marker}` -> Set(files)
  for (const file of walk(serverDir)) {
    if (file.endsWith(".nft.json")) continue; // file-tracing manifest, not code
    let data;
    try {
      data = readFileSync(file);
    } catch {
      continue;
    }
    for (const { name, version, marker } of markerIndex) {
      if (data.includes(marker) || data.includes(marker.replaceAll("/", "\\"))) {
        const key = `${name}\u0000${version}\u0000${marker}`;
        if (!foundFiles.has(key)) foundFiles.set(key, new Set());
        foundFiles.get(key).add(relative(root, file));
      }
    }
  }
  const hits = [];
  for (const [key, files] of foundFiles) {
    const [name, version, marker] = key.split("\u0000");
    hits.push({ name, version, marker, files: [...files] });
  }
  return hits;
}

// ── Entry point ─────────────────────────────────────────────────────────────

function main() {
  const bundleMode = process.argv.includes("--bundle");
  const { allEsmOnly, failCount } = scanDependencyTree();
  let failed = failCount > 0;

  if (bundleMode) {
    // ── jose-specific post-build scan (proven in a52bdc4) ─────────────────
    // jose v6's dist contains `webapi/` (no CJS build); jose v5 has none, so
    // `dist/webapi` appearing anywhere under .next/server means an ESM-only
    // jose build made it into the shipped output.
    const serverDir = join(root, ".next", "server");
    if (!existsSync(serverDir)) {
      console.log(
        "check-jose: .next/server not found — nothing to scan (run after `next build`)."
      );
      process.exit(failed ? 1 : 0);
    }

    const joseHits = [];
    for (const file of walk(serverDir)) {
      let data;
      try {
        data = readFileSync(file);
      } catch {
        continue;
      }
      if (data.includes("dist/webapi") || data.includes("dist\\webapi")) {
        joseHits.push(relative(root, file));
      }
    }
    if (joseHits.length > 0) {
      failed = true;
      console.error("");
      console.error(
        "❌ check-jose bundle scan FAILED: an ESM-only jose `webapi` build is present in the built server output."
      );
      console.error("");
      console.error(
        "jose v6+ ships only dist/webapi (no CJS build); on Vercel's serverless"
      );
      console.error(
        "runtime this fails at module load with ERR_REQUIRE_ESM — every route"
      );
      console.error("importing firebase-admin 500s in production.");
      console.error("");
      console.error("Files containing it:");
      for (const f of joseHits) console.error(`  ${f}`);
      console.error("");
      console.error(
        'Fix: keep "jose": "5.9.6" in package.json "overrides" (jose v5 ships'
      );
      console.error(
        "a CJS build and has no dist/webapi), and keep"
      );
      console.error(
        "firebase-admin/jwks-rsa/jose in next.config.ts serverExternalPackages so"
      );
      console.error(
        "the require chain resolves through Node at runtime instead of being bundled."
      );
    } else {
      console.log(
        "✅ check-jose bundle scan passed — no ESM-only jose webapi build in .next/server."
      );
    }

    // ── generalized bundle scan: any ESM-only package in the output ────────
    const hits = scanBundleForEsmOnly(allEsmOnly, serverDir);
    if (hits.length) {
      failed = true;
      console.error("");
      console.error(
        "❌ ESM-only bundle scan FAILED: files of ESM-only package(s) found in .next/server."
      );
      console.error("");
      for (const h of hits) {
        console.error(`   ${h.name}@${h.version}  (marker "${h.marker}")`);
        for (const f of h.files) console.error(`     ${f}`);
      }
      console.error("");
      console.error(
        "These packages have no `require` condition / no CJS build. If Turbopack"
      );
      console.error(
        "emits a runtime require() of them (as it did for jose v6), Vercel's"
      );
      console.error(
        "serverless runtime fails with ERR_REQUIRE_ESM. Add them to next.config.ts"
      );
      console.error(
        "serverExternalPackages only if a CJS build exists, pin a CJS version via"
      );
      console.error('package.json "overrides", or remove them from the server graph.');
    } else {
      console.log(
        "✅ ESM-only bundle scan passed — no ESM-only package files in .next/server."
      );
    }
  } else {
    // ── Diagnostics: where does jose resolve for jwks-rsa, and is it CJS? ──
    let jwksInstalled = false;
    try {
      req.resolve("jwks-rsa/package.json");
      jwksInstalled = true;
    } catch {
      // jwks-rsa missing (fresh checkout before install) — handled below.
    }

    let joseDetail = "n/a (jwks-rsa not installed)";
    if (jwksInstalled) {
      try {
        const jwksDir = dirname(req.resolve("jwks-rsa/package.json"));
        // resolve the main entry (uses the `require` condition), not the
        // package.json subpath — exports-mapped packages reject that subpath
        // with ERR_PACKAGE_PATH_NOT_EXPORTED.
        const joseReq = createRequire(join(jwksDir, "noop.js"));
        const joseEntry = joseReq.resolve("jose");
        // Walk up from the resolved entry to the jose package.json — the
        // nesting depth differs by version (v5: dist/node/cjs, v6:
        // dist/webapi), so a fixed ".." count is wrong.
        let josePkg = null;
        for (let dir = dirname(joseEntry); dir.length > 1; dir = dirname(dir)) {
          try {
            const candidate = JSON.parse(
              readFileSync(join(dir, "package.json"), "utf8")
            );
            if (candidate.name === "jose") {
              josePkg = candidate;
              break;
            }
          } catch {
            // keep walking up
          }
        }
        if (!josePkg) throw new Error(`could not locate jose package.json above ${joseEntry}`);
        const requireTarget =
          josePkg.exports?.["."]?.require ??
          josePkg.exports?.["."]?.default ??
          josePkg.main ??
          "unknown";
        joseDetail = `jwks-rsa resolves jose v${josePkg.version}\n  require('jose') -> ${joseEntry}\n  require condition -> ${requireTarget}`;
      } catch (err) {
        joseDetail = `jwks-rsa resolves jose: ${err?.message ?? String(err)}`;
      }
    }

    if (!jwksInstalled) {
      console.log(
        "check-jose: jwks-rsa not installed (node_modules missing?) — skipping."
      );
      process.exit(failed ? 1 : 0);
    }

    // ── Ground truth: load the chain with require(esm) disabled ────────────
    // Node >= 22.12 enables require(esm) by default; Vercel's serverless
    // runtime does not, so force it off to mirror production. On older Node
    // the flag does not exist and require(esm) is already off.
    const probe = `
      try {
        require('jwks-rsa');
        require('firebase-admin/auth');
      } catch (err) {
        console.error(String((err && err.stack) || err));
        process.exit(1);
      }
    `;
    const args = ["-e", probe];
    if (process.features?.require_module === true) {
      args.unshift("--no-experimental-require-module");
    }

    const res = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });

    if (res.status !== 0) {
      failed = true;
      console.error("");
      console.error(
        "❌ check-jose FAILED: jose/firebase-admin no longer load with require(esm) disabled."
      );
      console.error("");
      console.error(
        "This is the exact production outage fixed in a52bdc4: jose v6+ is ESM-only"
      );
      console.error(
        "(no `require` condition, no CJS build), and Vercel's Node runtime rejects"
      );
      console.error(
        "require() of ESM with ERR_REQUIRE_ESM — every route importing firebase-admin"
      );
      console.error("silently 500s in production while passing locally.");
      console.error("");
      console.error(joseDetail);
      console.error("");
      console.error(
        'Fix: keep "jose": "5.9.6" in package.json "overrides" (jose v5 ships a CJS'
      );
      console.error(
        "build), and keep firebase-admin/jwks-rsa/jose in next.config.ts"
      );
      console.error(
        "serverExternalPackages so the require chain resolves through Node at"
      );
      console.error("runtime instead of being bundled.");
      console.error("");
      console.error("Raw error:");
      console.error(res.stderr?.trim() || res.error?.message || "unknown");
    } else {
      console.log(
        "✅ check-jose passed — jwks-rsa + firebase-admin/auth load with require(esm) disabled."
      );
      console.log(`   ${joseDetail}`);
    }
  }

  if (failed) process.exit(1);
  console.log("✅ check-jose passed.");
  process.exit(0);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

export {
  fileFormat,
  isEsmJsTarget,
  hasCjsBuild,
  collectJsTargets,
  classifyEsmOnly,
  closureOf,
  esmMarkers,
  scanDependencyTree,
  scanBundleForEsmOnly,
  ALLOWLIST,
  root,
};
