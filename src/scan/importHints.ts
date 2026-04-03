import * as fs from "node:fs";
import * as path from "node:path";
import type { GitMetadata } from "../git/metadata.js";
import { fileInSubmodule } from "../git/metadata.js";
import type { LockfilePackage } from "../types.js";

export interface ScanWalkOptions {
  ignoreSubmodules?: boolean;
  git?: GitMetadata;
}

function filterSubmoduleAbsPaths(
  absPaths: string[],
  opts?: ScanWalkOptions
): string[] {
  if (!opts?.ignoreSubmodules || !opts.git?.isRepository || !opts.git.repositoryRoot) {
    return absPaths;
  }
  const rr = path.resolve(opts.git.repositoryRoot);
  return absPaths.filter(
    (abs) => !fileInSubmodule(path.resolve(abs), rr, opts.git!.submodulePaths)
  );
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  "build",
]);

const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir: string, out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, out);
    } else if (EXT.has(path.extname(e.name))) {
      out.push(p);
    }
  }
}

const importRe =
  /(?:from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

function topLevelName(spec: string): string | null {
  if (!spec || spec.startsWith(".") || spec.startsWith("/")) return null;
  if (spec.startsWith("node:")) return null;
  const parts = spec.split("/");
  if (parts[0]?.startsWith("@") && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? null;
}

export function collectImportHints(
  root: string,
  packages: LockfilePackage[],
  opts?: ScanWalkOptions
): { package: string; files: { path: string; line: number; snippet: string }[] }[] {
  const rootAbs = path.resolve(root);
  const names = new Set(packages.map((p) => p.name));
  const files: string[] = [];
  const src = path.join(rootAbs, "src");
  const start = fs.existsSync(src) ? src : rootAbs;
  walk(start, files);
  const filtered = filterSubmoduleAbsPaths(files, opts);

  const byPkg = new Map<
    string,
    { path: string; line: number; snippet: string }[]
  >();

  for (const file of filtered) {
    const rel = path.relative(rootAbs, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let m: RegExpExecArray | null;
      importRe.lastIndex = 0;
      while ((m = importRe.exec(line)) !== null) {
        const spec = m[1] ?? m[2];
        if (!spec) continue;
        const tl = topLevelName(spec);
        if (tl && names.has(tl)) {
          const arr = byPkg.get(tl) ?? [];
          arr.push({ path: rel, line: i + 1, snippet: line.trim().slice(0, 200) });
          byPkg.set(tl, arr);
        }
      }
    }
  }

  return [...byPkg.entries()].map(([pkg, files]) => ({ package: pkg, files }));
}

/** Nombres de módulo candidatos para un paquete PyPI (best-effort; p. ej. python-dateutil → dateutil). */
function moduleAliases(pkgName: string): string[] {
  const out = new Set<string>();
  const norm = pkgName.trim();
  if (!norm) return [];
  out.add(norm);
  out.add(norm.replace(/-/g, "_"));
  out.add(norm.replace(/_/g, "-"));
  const parts = norm.toLowerCase().split("-");
  if (parts.length > 1) {
    out.add(parts[parts.length - 1]!);
  }
  return [...out];
}

/** Best-effort: coincide import top-level con nombre PyPI (y variante -/_). */
export function collectPythonImportHints(
  root: string,
  packages: LockfilePackage[],
  opts?: ScanWalkOptions
): { package: string; files: { path: string; line: number; snippet: string }[] }[] {
  const rootAbs = path.resolve(root);
  const files: string[] = [];
  const src = path.join(rootAbs, "src");
  const start = fs.existsSync(src) ? src : rootAbs;
  walkPy(start, files);
  const filtered = filterSubmoduleAbsPaths(files, opts);

  const byPkg = new Map<
    string,
    { path: string; line: number; snippet: string }[]
  >();

  const fromRe = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\b/;
  const importReLine = /^\s*import\s+(.+)$/;

  function resolveTopLevel(mod: string): string | null {
    const first = mod.split(".")[0]!;
    if (!first) return null;
    const fl = first.toLowerCase();
    for (const p of packages) {
      const aliases = moduleAliases(p.name).map((a) => a.toLowerCase());
      if (aliases.includes(fl)) return p.name;
    }
    return null;
  }

  for (const file of filtered) {
    const rel = path.relative(rootAbs, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const fm = line.match(fromRe);
      if (fm) {
        const pkg = resolveTopLevel(fm[1]!);
        if (pkg) {
          const arr = byPkg.get(pkg) ?? [];
          arr.push({ path: rel, line: i + 1, snippet: line.trim().slice(0, 200) });
          byPkg.set(pkg, arr);
        }
        continue;
      }
      const im = line.match(importReLine);
      if (im) {
        const rhs = im[1]!.split("#")[0]!.trim();
        const parts = rhs.split(",").map((s) => s.trim().split(/\s+as\s+/)[0]!.trim());
        for (const part of parts) {
          if (!part) continue;
          const mod = part.split(".")[0]!;
          const pkg = resolveTopLevel(mod);
          if (pkg) {
            const arr = byPkg.get(pkg) ?? [];
            arr.push({ path: rel, line: i + 1, snippet: line.trim().slice(0, 200) });
            byPkg.set(pkg, arr);
          }
        }
      }
    }
  }

  return [...byPkg.entries()].map(([pkg, files]) => ({ package: pkg, files }));
}

const EXT_PY = new Set([".py"]);

function walkPy(dir: string, out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkPy(p, out);
    } else if (EXT_PY.has(path.extname(e.name))) {
      out.push(p);
    }
  }
}

const EXT_GO = new Set([".go"]);
const EXT_RUBY = new Set([".rb", ".rake"]);
const EXT_JAVA = new Set([".java", ".kt"]);

function walkExt(dir: string, exts: Set<string>, out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkExt(p, exts, out);
    } else if (exts.has(path.extname(e.name))) {
      out.push(p);
    }
  }
}

function extractGoImportStrings(content: string): string[] {
  const out: string[] = [];
  const blockRe = /\bimport\s*\(\s*([\s\S]*?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    const body = m[1]!;
    const strRe = /"((?:\\.|[^"\\])*)"/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(body)) !== null) {
      out.push(s[1]!.replace(/\\"/g, '"'));
    }
  }
  const lineRe =
    /^\s*import\s+(?:\.\s+|_\s+|\w+\s+)?"((?:\\.|[^"\\])*)"/gm;
  while ((m = lineRe.exec(content)) !== null) {
    out.push(m[1]!.replace(/\\"/g, '"'));
  }
  return out;
}

function longestGoModuleMatch(importPath: string, modules: Set<string>): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const mod of modules) {
    if (importPath === mod || importPath.startsWith(`${mod}/`)) {
      if (mod.length > bestLen) {
        bestLen = mod.length;
        best = mod;
      }
    }
  }
  return best;
}

/** Pistas de import Go → módulos en go.mod (prefijo más largo). */
export function collectGoImportHints(
  root: string,
  packages: LockfilePackage[],
  opts?: ScanWalkOptions
): { package: string; files: { path: string; line: number; snippet: string }[] }[] {
  const rootAbs = path.resolve(root);
  const modules = new Set(packages.map((p) => p.name));
  const files: string[] = [];
  const src = path.join(rootAbs, "src");
  const start = fs.existsSync(src) ? src : rootAbs;
  walkExt(start, EXT_GO, files);
  const filtered = filterSubmoduleAbsPaths(files, opts);

  const byPkg = new Map<
    string,
    { path: string; line: number; snippet: string }[]
  >();

  const pushHit = (
    mod: string,
    rel: string,
    lineNo: number,
    snippet: string
  ) => {
    const arr = byPkg.get(mod) ?? [];
    arr.push({
      path: rel,
      line: lineNo,
      snippet: snippet.trim().slice(0, 200),
    });
    byPkg.set(mod, arr);
  };

  for (const file of filtered) {
    const rel = path.relative(rootAbs, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i]!;
      if (/^\s*import\s*\(/.test(line)) {
        let chunk = line;
        const start = i;
        while (!chunk.includes(")") && i + 1 < lines.length) {
          i++;
          chunk += "\n" + lines[i]!;
        }
        const imports = extractGoImportStrings(chunk);
        const snip = lines[start]!.trim().slice(0, 200);
        for (const ip of imports) {
          const mod = longestGoModuleMatch(ip, modules);
          if (mod) pushHit(mod, rel, start + 1, snip);
        }
        i++;
        continue;
      }
      if (/^\s*import\s/.test(line) && !/^\s*import\s*\(/.test(line)) {
        const imports = extractGoImportStrings(line);
        for (const ip of imports) {
          const mod = longestGoModuleMatch(ip, modules);
          if (mod) pushHit(mod, rel, i + 1, line);
        }
      }
      i++;
    }
  }

  return [...byPkg.entries()].map(([pkg, files]) => ({ package: pkg, files }));
}

function rubyRequireFragments(line: string): string[] {
  const out: string[] = [];
  const re =
    /\brequire(?:_dependency)?\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

function gemRequireCandidates(gemName: string): string[] {
  const s = new Set<string>();
  const n = gemName.toLowerCase();
  s.add(n);
  s.add(n.replace(/-/g, "_"));
  s.add(n.replace(/_/g, "-"));
  const parts = n.split("-");
  if (parts.length > 1) {
    s.add(parts[parts.length - 1]!);
  }
  return [...s];
}

function resolveRubyGem(
  requirePath: string,
  packages: LockfilePackage[]
): string | null {
  const first = requirePath.split("/")[0]!.replace(/\.rb$/, "").toLowerCase();
  if (!first) return null;
  const fl = first.toLowerCase();
  for (const p of packages) {
    for (const c of gemRequireCandidates(p.name)) {
      if (c === fl) return p.name;
    }
  }
  return null;
}

/** require "..." → gemas en Gemfile.lock (best-effort, como PyPI). */
export function collectRubyImportHints(
  root: string,
  packages: LockfilePackage[],
  opts?: ScanWalkOptions
): { package: string; files: { path: string; line: number; snippet: string }[] }[] {
  const rootAbs = path.resolve(root);
  const files: string[] = [];
  const src = path.join(rootAbs, "src");
  const start = fs.existsSync(src) ? src : rootAbs;
  walkExt(start, EXT_RUBY, files);
  const filtered = filterSubmoduleAbsPaths(files, opts);

  const byPkg = new Map<
    string,
    { path: string; line: number; snippet: string }[]
  >();

  for (const file of filtered) {
    const rel = path.relative(rootAbs, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!/\brequire/.test(line)) continue;
      for (const frag of rubyRequireFragments(line)) {
        if (frag.startsWith(".") || frag.startsWith("/")) continue;
        const gem = resolveRubyGem(frag, packages);
        if (gem) {
          const arr = byPkg.get(gem) ?? [];
          arr.push({
            path: rel,
            line: i + 1,
            snippet: line.trim().slice(0, 200),
          });
          byPkg.set(gem, arr);
        }
      }
    }
  }

  return [...byPkg.entries()].map(([pkg, files]) => ({ package: pkg, files }));
}

function javaImportLines(content: string): { line: number; fqcn: string }[] {
  const out: { line: number; fqcn: string }[] = [];
  const lines = content.split(/\r?\n/);
  const re = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(re);
    if (m) out.push({ line: i + 1, fqcn: m[1]! });
  }
  return out;
}

function mavenCoords(p: LockfilePackage): { groupId: string; artifactId: string } | null {
  const idx = p.name.indexOf(":");
  if (idx < 0) return null;
  return {
    groupId: p.name.slice(0, idx),
    artifactId: p.name.slice(idx + 1),
  };
}

/** import paquete.Java → coordenadas Maven si el import empieza por groupId del POM. */
export function collectJavaImportHints(
  root: string,
  packages: LockfilePackage[],
  opts?: ScanWalkOptions
): { package: string; files: { path: string; line: number; snippet: string }[] }[] {
  const rootAbs = path.resolve(root);
  const coords = packages
    .map((p) => ({ p, c: mavenCoords(p) }))
    .filter((x): x is { p: LockfilePackage; c: { groupId: string; artifactId: string } } => x.c !== null)
    .sort((a, b) => b.c.groupId.length - a.c.groupId.length);

  const files: string[] = [];
  const src = path.join(rootAbs, "src");
  const start = fs.existsSync(src) ? src : rootAbs;
  walkExt(start, EXT_JAVA, files);
  const filtered = filterSubmoduleAbsPaths(files, opts);

  const byPkg = new Map<
    string,
    { path: string; line: number; snippet: string }[]
  >();

  for (const file of filtered) {
    const rel = path.relative(rootAbs, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (const { line, fqcn } of javaImportLines(content)) {
      const lineText = lines[line - 1] ?? "";
      for (const { p, c } of coords) {
        if (fqcn === c.groupId || fqcn.startsWith(`${c.groupId}.`)) {
          const arr = byPkg.get(p.name) ?? [];
          arr.push({
            path: rel,
            line,
            snippet: lineText.trim().slice(0, 200),
          });
          byPkg.set(p.name, arr);
          break;
        }
      }
    }
  }

  return [...byPkg.entries()].map(([pkg, files]) => ({ package: pkg, files }));
}
