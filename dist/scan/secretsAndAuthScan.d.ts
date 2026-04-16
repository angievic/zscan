import type { GitMetadata } from "../git/metadata.js";
import type { SecretAuthScanResult } from "../types.js";
import type { ScanWalkOptions } from "./importHints.js";
/**
 * Escaneo best-effort de patrones de secretos y autenticación en texto fuente.
 * No lee `.env` ni binarios para no volcar secretos reales al informe.
 */
export declare function scanSecretsAndAuth(root: string, opts?: ScanWalkOptions & {
    git?: GitMetadata;
}): SecretAuthScanResult;
