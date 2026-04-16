import { BUILTIN_HEURISTICS } from "./builtin-heuristics.js";
import { analyzePromptDataSensitivity, } from "./promptDataSensitivity.js";
function firstMatchLine(lines, pattern) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern.test(line)) {
            return { line: i + 1, citation: line.trim().slice(0, 280) };
        }
    }
    return null;
}
export function evaluatePromptContent(absolutePath, relativePath, purpose, content, cfg, opts) {
    const lines = content.split(/\r?\n/);
    const checks = [];
    const skipped = [];
    const patternErrors = [];
    for (const h of BUILTIN_HEURISTICS) {
        const hit = firstMatchLine(lines, h.pattern);
        if (hit) {
            checks.push({
                origin: "heuristic",
                ruleId: h.id,
                ruleDescription: h.description,
                passed: false,
                scorePercent: 0,
                line: hit.line,
                citation: hit.citation,
            });
        }
        else {
            checks.push({
                origin: "heuristic",
                ruleId: h.id,
                ruleDescription: h.description,
                passed: true,
                scorePercent: 100,
                line: 0,
                citation: "(sin coincidencia en este archivo)",
            });
        }
    }
    const yamlRules = cfg.rules ?? [];
    const llmWillCoverRules = opts?.llmCoversRulesWithoutPattern !== undefined
        ? opts.llmCoversRulesWithoutPattern
        : cfg.llm?.enabled === true;
    for (const r of yamlRules) {
        if (!r.pattern?.trim()) {
            if (!llmWillCoverRules) {
                skipped.push({
                    id: r.id,
                    reason: "sin campo `pattern`; activa `llm.enabled: true` en zscan.yaml para evaluarlas con el modelo",
                });
            }
            continue;
        }
        let re;
        try {
            const raw = r.pattern.trim();
            const body = raw.replace(/^\(\?i\)/, "");
            re = new RegExp(body, "i");
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            patternErrors.push({ ruleId: r.id, message: msg });
            checks.push({
                origin: "yaml_rule",
                ruleId: r.id,
                ruleDescription: r.description,
                passed: false,
                scorePercent: 0,
                line: 0,
                citation: `[regex inválido] ${msg}`,
            });
            continue;
        }
        const hit = firstMatchLine(lines, re);
        if (hit) {
            checks.push({
                origin: "yaml_rule",
                ruleId: r.id,
                ruleDescription: r.description,
                passed: false,
                scorePercent: 0,
                line: hit.line,
                citation: hit.citation,
            });
        }
        else {
            checks.push({
                origin: "yaml_rule",
                ruleId: r.id,
                ruleDescription: r.description,
                passed: true,
                scorePercent: 100,
                line: 0,
                citation: "(sin coincidencia en este archivo)",
            });
        }
    }
    const scores = checks.map((c) => c.scorePercent);
    const fileScore = scores.length ? Math.min(...scores) : 100;
    const dataSensitivity = analyzePromptDataSensitivity(content);
    return {
        fileResult: {
            absolutePath,
            relativePath,
            purpose,
            scorePercent: fileScore,
            checks,
            dataSensitivity,
        },
        skipped,
        patternErrors,
    };
}
export function mergePromptScanMeta(acc, next) {
    const seen = new Set(acc.skipped.map((s) => s.id + s.reason));
    for (const s of next.skipped) {
        const k = s.id + s.reason;
        if (!seen.has(k)) {
            seen.add(k);
            acc.skipped.push(s);
        }
    }
    const seenE = new Set(acc.patternErrors.map((e) => e.ruleId));
    for (const e of next.patternErrors) {
        if (!seenE.has(e.ruleId)) {
            seenE.add(e.ruleId);
            acc.patternErrors.push(e);
        }
    }
}
