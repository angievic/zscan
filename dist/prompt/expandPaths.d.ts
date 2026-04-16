/** Ignorados al expandir `prompts[]` y al descubrir candidatos en `init`. */
export declare const PROMPT_PATH_IGNORE: string[];
/**
 * Resuelve paths/globs del YAML relativos a `root` en rutas absolutas únicas.
 */
export declare function expandPromptPaths(root: string, patterns: string[]): Promise<string[]>;
