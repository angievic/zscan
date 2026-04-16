export interface GitMetadata {
    isRepository: boolean;
    /** Directorio de trabajo donde está `.git` (o el worktree). */
    repositoryRoot: string | null;
    /** `refs/heads/...` o SHA corto si se pudo leer sin ejecutar `git`. */
    headLabel: string | null;
    /** Rutas relativas a la raíz del repo según `.gitmodules`. */
    submodulePaths: string[];
}
/** Parseo mínimo de `.gitmodules` (INI-like). */
export declare function parseGitmodules(content: string): string[];
/**
 * Sube directorios desde `startDir` hasta encontrar `.git` (directorio o puntero gitdir).
 */
export declare function analyzeGitRepo(startDir: string): GitMetadata;
export declare function fileInSubmodule(fileAbs: string, repoRoot: string, submodulePaths: string[]): boolean;
