import type { GitMetadata } from "../git/metadata.js";
import type { LockfilePackage } from "../types.js";
export interface ScanWalkOptions {
    ignoreSubmodules?: boolean;
    git?: GitMetadata;
}
export declare function collectImportHints(root: string, packages: LockfilePackage[], opts?: ScanWalkOptions): {
    package: string;
    files: {
        path: string;
        line: number;
        snippet: string;
    }[];
}[];
/** Best-effort: coincide import top-level con nombre PyPI (y variante -/_). */
export declare function collectPythonImportHints(root: string, packages: LockfilePackage[], opts?: ScanWalkOptions): {
    package: string;
    files: {
        path: string;
        line: number;
        snippet: string;
    }[];
}[];
/** Pistas de import Go → módulos en go.mod (prefijo más largo). */
export declare function collectGoImportHints(root: string, packages: LockfilePackage[], opts?: ScanWalkOptions): {
    package: string;
    files: {
        path: string;
        line: number;
        snippet: string;
    }[];
}[];
/** require "..." → gemas en Gemfile.lock (best-effort, como PyPI). */
export declare function collectRubyImportHints(root: string, packages: LockfilePackage[], opts?: ScanWalkOptions): {
    package: string;
    files: {
        path: string;
        line: number;
        snippet: string;
    }[];
}[];
/** import paquete.Java → coordenadas Maven si el import empieza por groupId del POM. */
export declare function collectJavaImportHints(root: string, packages: LockfilePackage[], opts?: ScanWalkOptions): {
    package: string;
    files: {
        path: string;
        line: number;
        snippet: string;
    }[];
}[];
