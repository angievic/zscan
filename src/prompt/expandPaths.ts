import fg from "fast-glob";
import * as path from "node:path";

/** Ignorados al expandir `prompts[]` y al descubrir candidatos en `init`. */
export const PROMPT_PATH_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.venv/**",
  "**/venv/**",
];

/**
 * Resuelve paths/globs del YAML relativos a `root` en rutas absolutas únicas.
 */
export async function expandPromptPaths(
  root: string,
  patterns: string[]
): Promise<string[]> {
  const cwd = path.resolve(root);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const pat of patterns) {
    const hits = await fg(pat.trim(), {
      cwd,
      absolute: true,
      onlyFiles: true,
      ignore: PROMPT_PATH_IGNORE,
      dot: true,
    });
    for (const h of hits) {
      if (!seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
  }

  return out.sort();
}
