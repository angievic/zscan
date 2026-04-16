import type { LockfilePackage } from "../types.js";
export declare function findMavenPom(root: string): string | null;
export declare function mavenPomLabel(): string;
/**
 * Dependencias con versión literal o ${property} resoluble desde <properties>.
 * Nombre OSV Maven: `groupId:artifactId`.
 */
export declare function parseMavenPomDependencies(text: string): LockfilePackage[];
export declare function readMavenPomPackages(root: string): LockfilePackage[];
export declare function readMavenProjectLabel(root: string): string;
