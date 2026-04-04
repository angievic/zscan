import fg from "fast-glob";
import * as fs from "node:fs";
import * as path from "node:path";
import { mayContainEmbeddedPromptLiterals } from "./embeddedPromptHeuristic.js";
import { PROMPT_PATH_IGNORE } from "../prompt/expandPaths.js";

type Bucket = { globs: string[]; purpose: string };

/**
 * Orden: carpetas habituales primero, luego convenciones de agentes y README.
 */
const BUCKETS: Bucket[] = [
  {
    globs: ["docs/**/*.md"],
    purpose: "Documentación del proyecto (Markdown bajo docs/)",
  },
  {
    globs: ["prompts/**/*.md"],
    purpose: "Prompts y especificaciones para IA (carpeta prompts/)",
  },
  {
    globs: [".cursor/**/*.md"],
    purpose: "Reglas y prompts de Cursor (.cursor/)",
  },
  {
    globs: ["**/*.prompt.md"],
    purpose: "Archivos con sufijo .prompt.md",
  },
  {
    globs: ["**/AGENTS.md", "**/AGENT.md", "**/CLAUDE.md", "**/GEMINI.md"],
    purpose: "Convenciones de instrucciones para agentes (AGENTS.md, etc.)",
  },
  {
    globs: ["README.md"],
    purpose: "README principal del repositorio",
  },
  {
    globs: ["contrib/**/*.md"],
    purpose: "Documentación bajo contrib/",
  },
];

const EXTRA_IGNORE = [
  "**/zscan-runs/**",
  "**/zscan-self-report.md",
  "**/zscan-report.md",
  "**/examples/**",
];

/** Raíces habituales donde vive código con prompts en strings. */
const CODE_ROOTS = ["src", "lib", "app", "cmd", "pkg", "internal"] as const;

/** Extensiones: TS/JS, Python, Ruby, Go, Java, Kotlin. */
const CODE_GLOB_EXTENSIONS =
  "ts,tsx,js,jsx,mjs,cjs,py,rb,go,java,kt";

const MAX_CODE_FILES_TO_SAMPLE = 350;
const MAX_CODE_BYTES_READ = 160_000;

function readHeadUtf8(abs: string, maxBytes: number): string | null {
  try {
    const buf = fs.readFileSync(abs);
    const n = Math.min(buf.length, maxBytes);
    const slice = buf.subarray(0, n);
    if (slice.includes(0)) return null;
    return slice.toString("utf8");
  } catch {
    return null;
  }
}

function discoverCodePromptBuckets(
  cwd: string,
  ignore: string[]
): { paths: string[]; purpose: string }[] {
  const groups: { paths: string[]; purpose: string }[] = [];

  for (const dir of CODE_ROOTS) {
    if (!fs.existsSync(path.join(cwd, dir))) continue;
    const pattern = `${dir}/**/*.{${CODE_GLOB_EXTENSIONS}}`;
    const files = fg.sync(pattern, {
      cwd,
      onlyFiles: true,
      ignore,
      dot: true,
    });
    let hit = false;
    for (const rel of files.slice(0, MAX_CODE_FILES_TO_SAMPLE)) {
      const abs = path.join(cwd, rel);
      const text = readHeadUtf8(abs, MAX_CODE_BYTES_READ);
      if (text && mayContainEmbeddedPromptLiterals(text)) {
        hit = true;
        break;
      }
    }
    if (hit) {
      groups.push({
        paths: [pattern],
        purpose: `Código fuente bajo ${dir}/ (TypeScript/JavaScript, Python, Ruby, Go, Java, Kotlin, …) con literales que podrían ser prompts para IA`,
      });
    }
  }

  return groups;
}

/**
 * Recorre el repo (sin node_modules, dist, .git, …) y arma entradas `prompts[]`
 * con globs que **sí** coinciden hoy con al menos un fichero.
 */
export function discoverPromptGroupsForInit(root: string): {
  paths: string[];
  purpose: string;
}[] {
  const cwd = path.resolve(root);
  const ignore = [...PROMPT_PATH_IGNORE, ...EXTRA_IGNORE];
  const out: { paths: string[]; purpose: string }[] = [];

  for (const bucket of BUCKETS) {
    const matchedGlobs: string[] = [];
    for (const g of bucket.globs) {
      const hits = fg.sync(g, {
        cwd,
        onlyFiles: true,
        ignore,
        dot: true,
      });
      if (hits.length > 0) matchedGlobs.push(g);
    }
    if (matchedGlobs.length > 0) {
      out.push({ paths: matchedGlobs, purpose: bucket.purpose });
    }
  }

  out.push(...discoverCodePromptBuckets(cwd, ignore));

  if (out.length === 0) {
    return [
      {
        paths: ["docs/**/*.md", "prompts/**/*.md"],
        purpose:
          "Sin coincidencias: ajusta estos globs a tus carpetas de documentación o prompts",
      },
    ];
  }

  return out;
}
