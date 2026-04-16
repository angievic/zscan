import type { DependencyNode, LockfilePackage } from "../types.js";
export type JsLockKind = "npm" | "pnpm" | "yarn";
export interface JsLockRef {
    kind: JsLockKind;
    path: string;
}
/**
 * Prioridad: npm → pnpm → yarn (suele haber un solo lockfile; evita mezclar herramientas).
 */
export declare function findJsLockfile(root: string): JsLockRef | null;
export declare function jsLockfileLabel(kind: JsLockKind): string;
export declare function readJsLockPackages(ref: JsLockRef): LockfilePackage[];
/** npm: árbol transitivo; yarn/pnpm: dependencias directas según package.json + versiones del lock. */
export declare function buildJsDependencyTree(ref: JsLockRef, rootDir: string, rootPackageName: string, rootVersion: string, packages: LockfilePackage[]): DependencyNode | null;
