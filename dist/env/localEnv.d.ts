/**
 * Carga claves `ZSCAN_*` desde `.env.local` en la raíz del proyecto (sin dependencia dotenv).
 * Útil tras `zscan config` cuando la API key se guarda fuera de `zscan.yaml`.
 */
export declare function loadEnvLocalFile(root: string): void;
export declare function upsertEnvLocal(root: string, key: string, value: string): void;
export declare function removeEnvLocalKey(root: string, key: string): void;
