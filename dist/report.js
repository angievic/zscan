import { loadConfig } from "./config.js";
import { loadEnvLocalFile } from "./env/localEnv.js";
import { buildLlmUsageSnapshot } from "./llm/usageSnapshot.js";
import { promptScanToMarkdown } from "./prompt/reportPrompt.js";
import { classifyOsvSeverities } from "./report/cvssSeverity.js";
import { buildVulnResumen } from "./report/informeView.js";
function llmSnapshotForMarkdown(result) {
    if (result.llmUsage)
        return result.llmUsage;
    loadEnvLocalFile(result.root);
    return buildLlmUsageSnapshot(loadConfig(result.root));
}
function ecosystemCodeLabel(eco) {
    switch (eco) {
        case "npm":
            return "JS/TS";
        case "PyPI":
            return "Python";
        case "RubyGems":
            return "Ruby";
        case "Go":
            return "Go";
        case "Maven":
            return "Java/Kotlin";
    }
}
function treeLines(node, depth) {
    const pad = "  ".repeat(depth);
    const line = `${pad}- **${node.name}** @ \`${node.version}\``;
    const rest = node.children.flatMap((c) => treeLines(c, depth + 1));
    return [line, ...rest];
}
function affectedDownstream(tree, weakPackages) {
    if (!tree)
        return { summary: [], paths: [] };
    const summary = [];
    const paths = [];
    const walk = (node, ancestors) => {
        const chain = [...ancestors, node.name];
        if (weakPackages.has(node.name)) {
            const tip = chain[chain.length - 1];
            summary.push(`El paquete **${tip}** tiene hallazgos en OSV en esta versión; los dependientes en esta rama quedan expuestos en la cadena: \`${chain.join(" → ")}\`.`);
            paths.push(chain);
        }
        for (const c of node.children)
            walk(c, chain);
    };
    for (const c of tree.children)
        walk(c, [tree.name]);
    return { summary, paths };
}
export function buildPropagationNotes(tree, vulnerableNames) {
    const { summary } = affectedDownstream(tree, vulnerableNames);
    if (!summary.length && vulnerableNames.size) {
        return [
            "Hay paquetes con hallazgos OSV en el lockfile; revisa el árbol o la lista para ver el alcance transitivo.",
        ];
    }
    return summary;
}
function ecosystemMarkdown(eco) {
    const weak = new Set(eco.findings.filter((f) => f.vulns.length).map((f) => f.package));
    const lines = [
        `### ${eco.ecosystem} — \`${eco.lockfile}\``,
        "",
        `- **Paquetes únicos:** ${eco.packages.length}`,
        "",
        "#### Árbol de dependencias",
        "",
    ];
    if (eco.tree) {
        lines.push(...treeLines(eco.tree, 0), "");
    }
    else {
        lines.push("_Sin árbol resuelto._", "", "");
    }
    lines.push("#### Propagación / consecuencia (MVP)", "");
    lines.push(...buildPropagationNotes(eco.tree, weak).map((s) => `- ${s}`), "");
    lines.push("#### Hallazgos OSV", "");
    const withVulns = eco.findings.filter((f) => f.vulns.length);
    if (!withVulns.length) {
        lines.push("No se reportaron vulnerabilidades conocidas en OSV para las versiones resueltas.", "");
    }
    else {
        for (const f of withVulns) {
            lines.push(`##### \`${f.package}@${f.version}\``, "");
            for (const v of f.vulns) {
                const sev = classifyOsvSeverities(v.severity);
                lines.push(`- **${v.id}**${v.summary ? `: ${v.summary}` : ""} — _${sev.labelEs}_`);
                if (v.references?.length) {
                    const url = v.references.find((r) => r.url)?.url;
                    if (url)
                        lines.push(`  - Referencia: ${url}`);
                }
            }
            lines.push("");
        }
    }
    const langLabel = ecosystemCodeLabel(eco.ecosystem);
    lines.push(`#### Uso en código (${langLabel}, best-effort)`, "");
    const hints = eco.importHints.filter((h) => h.files.length);
    if (!hints.length) {
        lines.push("_Sin coincidencias bajo `src/` o sin archivos escaneados._", "");
    }
    else {
        for (const h of hints) {
            const hitVuln = withVulns.some((x) => x.package === h.package);
            if (!hitVuln)
                continue;
            lines.push(`##### \`${h.package}\``, "");
            for (const loc of h.files.slice(0, 20)) {
                lines.push(`- \`${loc.path}:${loc.line}\` — \`${loc.snippet}\``);
            }
            if (h.files.length > 20) {
                lines.push(`- _… y ${h.files.length - 20} más_`);
            }
            lines.push("");
        }
    }
    return lines;
}
/** Markdown de un solo ecosistema (mismo bloque que en el informe completo). */
export function ecosystemToMarkdown(eco) {
    return ecosystemMarkdown(eco).join("\n");
}
export function toMarkdown(result) {
    const totalPkgs = result.ecosystems.reduce((n, e) => n + e.packages.length, 0);
    const pkgsConOsv = result.ecosystems.reduce((n, e) => n + e.findings.filter((f) => f.vulns.length).length, 0);
    const vulnRes = buildVulnResumen(result.ecosystems, totalPkgs, pkgsConOsv);
    const llm = llmSnapshotForMarkdown(result);
    const lines = [
        "# zscan - Reporte de vulnerabilidades",
        "",
        `- **Raíz del proyecto:** \`${result.root}\``,
        `- **Ecosistemas analizados:** ${result.ecosystems.map((e) => e.ecosystem).join(", ") || "(ninguno)"}`,
        `- **Paquetes totales (lockfile, directos + transitivos):** ${totalPkgs}`,
        "",
        "## Modelo y proveedor LLM",
        "",
        llm.proveedor_descripcion,
        "",
        `- **Proveedor resuelto:** \`${llm.proveedor}\``,
        `- **Modelo:** \`${llm.modelo}\``,
        `- **Base URL:** \`${llm.base_url}\``,
        `- **\`llm.enabled\` en zscan.yaml:** ${llm.yaml_llm_enabled ? "sí" : "no"}`,
        `- **API key configurada (env o YAML, sin mostrar valor):** ${llm.api_key_configurada ? "sí" : "no"}`,
        "",
    ];
    const envOv = [];
    if (llm.env.model)
        envOv.push("`ZSCAN_LLM_MODEL`");
    if (llm.env.base_url)
        envOv.push("`ZSCAN_LLM_BASE_URL`");
    if (llm.env.api_key)
        envOv.push("`ZSCAN_LLM_API_KEY`");
    if (llm.env.provider)
        envOv.push("`ZSCAN_LLM_PROVIDER`");
    lines.push(`- **Variables de entorno que pisan el YAML:** ${envOv.length ? envOv.join(", ") : "ninguna detectadas en este proceso"}`, "", "### Catálogo de referencia (proveedores soportados por zscan)", "", "Ejemplos documentados; el modelo en uso es el indicado arriba.", "");
    for (const c of llm.catalogo_referencia) {
        lines.push(`- **${c.nombre}:** ${c.ejemplos_modelo.join(", ")}${c.nota ? ` — _${c.nota}_` : ""}`);
    }
    lines.push("", "## Resumen de vulnerabilidades", "");
    lines.push("", vulnRes.alcanceLockfile, "", `- **Paquetes con versión consultada en OSV:** ${vulnRes.paquetesEscaneados}`, `- **Paquetes con al menos un hallazgo:** ${vulnRes.paquetesConVulnerabilidad}`, `- **IDs de vulnerabilidad únicos (GHSA/CVE/OSV):** ${vulnRes.idsVulnerabilidadUnicos.length}`, `- **Severidad (estándar):** ${vulnRes.estandarSeveridad} — bandas cualitativas según puntuación base cuando OSV la publica como número.`, "");
    if (vulnRes.conteoPorSeveridad.length) {
        lines.push("**Conteo por severidad (CVSS cualitativo):**", "");
        for (const c of vulnRes.conteoPorSeveridad) {
            lines.push(`- **${c.etiquetaCortaEs}** (\`${c.qualitative}\`): ${c.count} vulnerabilidad(es) distinta(s)`);
        }
        lines.push("");
    }
    if (vulnRes.porVulnerabilidad.length === 0) {
        lines.push("No hay vulnerabilidades conocidas en OSV para las versiones fijadas en este escaneo.", "");
    }
    else {
        lines.push("### Por vulnerabilidad", "");
        for (const row of vulnRes.porVulnerabilidad) {
            lines.push(`#### \`${row.id}\``, "");
            lines.push(`- **Severidad:** ${row.severidad.labelEs}`, "");
            if (row.summary) {
                lines.push(row.summary, "");
            }
            for (const p of row.enPaquetes) {
                lines.push(`- \`${p.package}@${p.version}\` · ${p.ecosystem} · \`${p.lockfile}\``);
            }
            lines.push("");
        }
    }
    lines.push("## Dependencias (lockfiles + OSV)", "", "### Repositorio Git", "");
    if (result.git.isRepository) {
        lines.push(`- **Es repositorio Git:** sí`, `- **Raíz del repo detectada:** \`${result.git.repositoryRoot}\``);
        if (result.git.headLabel) {
            lines.push(`- **HEAD:** ${result.git.headLabel}`);
        }
        if (result.git.submodulePaths.length) {
            lines.push(`- **Submódulos (.gitmodules):** ${result.git.submodulePaths.map((p) => `\`${p}\``).join(", ")}`);
        }
    }
    else {
        lines.push("- **Es repositorio Git:** no (no se encontró `.git` al subir desde `--root`)");
    }
    lines.push("");
    if (result.secretAuthScan) {
        const sa = result.secretAuthScan;
        lines.push("## Secretos y autenticación (heurístico)", "", sa.metodo, "", `- **Nivel práctico (heurístico):** \`${sa.nivel}\``, "", sa.resumen, "");
        if (sa.hallazgos.length) {
            lines.push("### Hallazgos y sugerencias", "");
            for (const h of sa.hallazgos) {
                lines.push(`#### ${h.titulo}`, "", `- **Severidad:** ${h.severity} · **Categoría:** \`${h.category}\``, `- **Ubicación:** \`${h.path}:${h.line}\``, `- **Fragmento enmascarado:** \`${h.snippet}\``, `- **Sugerencia:** ${h.sugerencia}`, "");
            }
        }
        else {
            lines.push("_Sin coincidencias con los patrones buscados._", "");
        }
    }
    const meta = result.meta;
    if (meta?.docSnippets?.length) {
        lines.push("### Referencias (texto en caché, scraping best-effort)", "");
        for (const s of meta.docSnippets) {
            lines.push(`#### ${s.vulnId}`, "", `**Fuente:** ${s.url}`, "", s.excerpt, "", "");
        }
    }
    if (meta?.enrichWebDiscovery?.length) {
        lines.push("### Contexto web sugerido (OSV, NVD, búsqueda, foros)", "", "Enlaces para abrir en el navegador; zscan no consulta buscadores ni foros por ti, solo los lista.", "");
        for (const b of meta.enrichWebDiscovery) {
            lines.push(`#### ${b.vulnId}${b.package ? ` · paquete \`${b.package}\`` : ""}`, "");
            for (const L of b.links) {
                lines.push(`- **${L.label}** (\`${L.kind}\`): ${L.url}`);
            }
            lines.push("");
        }
    }
    for (const eco of result.ecosystems) {
        lines.push(...ecosystemMarkdown(eco), "");
    }
    lines.push("", "---", "");
    if (result.prompts) {
        lines.push(promptScanToMarkdown(result.prompts, { embedInScanReport: true }), "");
    }
    else if (result.promptScanMessage) {
        lines.push("## Prompts y reglas (`zscan.yaml`)", "", result.promptScanMessage, "");
    }
    lines.push("---", "", "Puedes pegar este reporte en tu asistente de IA para planear bumps o reemplazos; zscan no modifica el repo.");
    return lines.join("\n");
}
export function toJson(result) {
    return JSON.stringify(result, null, 2);
}
