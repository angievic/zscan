import type { ZscanConfig } from "../config.js";
import { type PromptDataSensitivityAssessment } from "./promptDataSensitivity.js";
export type { PromptDataSensitivityAssessment, PromptDataSensitivityDetail, PromptDataSensitivityLevel, } from "./promptDataSensitivity.js";
export type PromptFindingOrigin = "yaml_rule" | "heuristic" | "llm";
/** Resultado de una comprobación (pasa o falla) sobre un archivo. */
export interface PromptRuleResult {
    origin: PromptFindingOrigin;
    ruleId: string;
    ruleDescription?: string;
    passed: boolean;
    /** 100 si pasa, 0 si falla esta comprobación. */
    scorePercent: number;
    line: number;
    /** Fragmento de línea o mensaje corto. */
    citation: string;
}
export interface PromptFileResult {
    absolutePath: string;
    relativePath: string;
    purpose: string;
    /** Mínimo de los scorePercent de cada check (estricto). */
    scorePercent: number;
    checks: PromptRuleResult[];
    /** Qué tipo de datos parece entrar al prompt y sensibilidad inferida (heurístico). */
    dataSensitivity: PromptDataSensitivityAssessment;
}
export interface PromptScanResult {
    root: string;
    minRequiredPercent: number;
    files: PromptFileResult[];
    /** Relativas a root por debajo del umbral. */
    belowThreshold: string[];
    /** Reglas YAML sin `pattern` cuando el LLM está desactivado (no evaluadas). */
    skippedYamlRules: {
        id: string;
        reason: string;
    }[];
    /** Errores de red/parseo al llamar al LLM (un elemento por archivo si aplica). */
    llmErrors?: string[];
    /** Errores al compilar regex de reglas YAML. */
    patternErrors: {
        ruleId: string;
        message: string;
    }[];
}
export declare function evaluatePromptContent(absolutePath: string, relativePath: string, purpose: string, content: string, cfg: ZscanConfig, opts?: {
    llmCoversRulesWithoutPattern?: boolean;
}): {
    fileResult: PromptFileResult;
    skipped: {
        id: string;
        reason: string;
    }[];
    patternErrors: {
        ruleId: string;
        message: string;
    }[];
};
export declare function mergePromptScanMeta(acc: {
    skipped: {
        id: string;
        reason: string;
    }[];
    patternErrors: {
        ruleId: string;
        message: string;
    }[];
}, next: {
    skipped: {
        id: string;
        reason: string;
    }[];
    patternErrors: {
        ruleId: string;
        message: string;
    }[];
}): void;
