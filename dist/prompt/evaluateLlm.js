import { invokeChat } from "../llm/invoke.js";
const MAX_PROMPT_CHARS = 12_000;
function tryParseEvaluationsJson(text) {
    const trimmed = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(trimmed);
    const body = fence ? fence[1].trim() : trimmed;
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        const start = body.indexOf("{");
        const end = body.lastIndexOf("}");
        if (start < 0 || end <= start) {
            throw new Error("No se encontró JSON en la respuesta del modelo");
        }
        parsed = JSON.parse(body.slice(start, end + 1));
    }
    if (typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray(parsed.evaluations)) {
        throw new Error('JSON del modelo sin array "evaluations"');
    }
    return parsed;
}
function normalizeEvaluation(raw, ruleIds) {
    if (typeof raw !== "object" || raw === null)
        return null;
    const o = raw;
    const ruleId = typeof o.ruleId === "string" ? o.ruleId.trim() : "";
    if (!ruleId || !ruleIds.has(ruleId))
        return null;
    const passed = o.passed === true;
    let scorePercent = 100;
    if (typeof o.scorePercent === "number" && Number.isFinite(o.scorePercent)) {
        scorePercent = Math.max(0, Math.min(100, Math.round(o.scorePercent)));
    }
    else {
        scorePercent = passed ? 100 : 0;
    }
    const line = typeof o.line === "number" && Number.isFinite(o.line) && o.line >= 0
        ? Math.floor(o.line)
        : 0;
    const citation = typeof o.citation === "string" && o.citation.trim()
        ? o.citation.trim().slice(0, 500)
        : passed
            ? "(sin detalle del modelo)"
            : "(fallo sin cita)";
    const ruleDescription = typeof o.ruleDescription === "string"
        ? o.ruleDescription.slice(0, 400)
        : undefined;
    return {
        origin: "llm",
        ruleId,
        ruleDescription,
        passed,
        scorePercent,
        line,
        citation,
    };
}
function recalcFileScore(file) {
    const scores = file.checks.map((c) => c.scorePercent);
    file.scorePercent = scores.length ? Math.min(...scores) : 100;
}
/**
 * Añade comprobaciones con origen `llm` según `rules[]` del YAML (id + description,
 * opcionalmente pattern como pista). Requiere `llm.enabled` y API alcanzable.
 */
export async function appendLlmRuleChecks(fileResult, content, cfg, llm) {
    if (!llm.enabled)
        return undefined;
    const rules = cfg.rules ?? [];
    if (!rules.length)
        return undefined;
    const ruleIds = new Set(rules.map((r) => r.id));
    const slice = content.length > MAX_PROMPT_CHARS
        ? content.slice(0, MAX_PROMPT_CHARS) +
            `\n\n[… contenido truncado a ${MAX_PROMPT_CHARS} caracteres …]`
        : content;
    const rulesPayload = rules.map((r) => ({
        id: r.id,
        description: r.description,
        ...(r.pattern?.trim() ? { pattern_hint: r.pattern.trim() } : {}),
    }));
    const userBody = [
        "Evalúa el siguiente archivo de prompt/documentación contra cada regla.",
        "Para cada regla: si el texto INCUMPLE la intención de la regla (riesgo de seguridad o calidad), passed=false y scorePercent bajo; si cumple, passed=true y scorePercent=100.",
        "Si hay evidencia de incumplimiento, indica line (número de línea 1-based) y citation (fragmento breve o explicación). Si passed=true, line puede ser 0.",
        "",
        `Objetivo del grupo (YAML prompts[].purpose): ${fileResult.purpose}`,
        `Archivo: ${fileResult.relativePath}`,
        "",
        "Reglas (desde zscan.yaml):",
        JSON.stringify(rulesPayload, null, 2),
        "",
        "Contenido del archivo:",
        "```",
        slice,
        "```",
        "",
        'Responde ÚNICAMENTE con JSON válido de la forma:',
        '{"evaluations":[{"ruleId":"<id>","passed":true|false,"scorePercent":0-100,"line":0,"citation":"..."}]}',
    ].join("\n");
    let text;
    try {
        text = await invokeChat(llm, [
            {
                role: "system",
                content: "Eres un auditor de prompts y documentación técnica. Respondes solo con JSON válido UTF-8, sin markdown ni texto fuera del objeto.",
            },
            { role: "user", content: userBody },
        ], {
            temperature: 0.1,
            max_tokens: 2048,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fileResult.checks.push({
            origin: "llm",
            ruleId: "_llm_request",
            ruleDescription: "Llamada al modelo para rules[] del YAML",
            passed: false,
            scorePercent: 0,
            line: 0,
            citation: msg.slice(0, 400),
        });
        recalcFileScore(fileResult);
        return msg;
    }
    let evaluations;
    try {
        ({ evaluations } = tryParseEvaluationsJson(text));
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fileResult.checks.push({
            origin: "llm",
            ruleId: "_llm_parse",
            ruleDescription: "Parseo de la respuesta JSON del modelo",
            passed: false,
            scorePercent: 0,
            line: 0,
            citation: msg.slice(0, 400),
        });
        recalcFileScore(fileResult);
        return msg;
    }
    const seen = new Set();
    for (const item of evaluations) {
        const row = normalizeEvaluation(item, ruleIds);
        if (row && !seen.has(row.ruleId)) {
            seen.add(row.ruleId);
            const yamlRule = rules.find((r) => r.id === row.ruleId);
            if (yamlRule && !row.ruleDescription) {
                row.ruleDescription = yamlRule.description;
            }
            fileResult.checks.push(row);
        }
    }
    for (const r of rules) {
        if (!seen.has(r.id)) {
            fileResult.checks.push({
                origin: "llm",
                ruleId: r.id,
                ruleDescription: r.description,
                passed: false,
                scorePercent: 0,
                line: 0,
                citation: "El modelo no devolvió evaluación para esta ruleId",
            });
        }
    }
    recalcFileScore(fileResult);
    return undefined;
}
