import { buildInformeView, type InformeView } from "./informeView.js";
import type { ScanResult } from "../types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function staticSummaryHtml(view: InformeView): string {
  const s = view.resumen.estadisticas;
  const vuln = view.resumen.vulnerabilidades;
  const idsN = vuln.idsVulnerabilidadUnicos.length;
  const vulnLine =
    idsN === 0
      ? "Sin IDs OSV en este run; alcance = todo el lockfile (directas + transitivas)."
      : `${idsN} vulnerabilidad(es) distinta(s) (ID único) · ${vuln.paquetesConVulnerabilidad} paquete(s) afectado(s) de ${vuln.paquetesEscaneados} en lockfile.`;
  const llm = view.llm;
  const llmShort = llm
    ? `LLM: ${llm.proveedor} · modelo ${llm.modelo} · llm.enabled (YAML): ${llm.yaml_llm_enabled ? "sí" : "no"}`
    : "";
  return `<div class="card" id="zscan-static-summary">
    <p><strong>Raíz:</strong> <code>${escapeHtml(view.resumen.root)}</code></p>
    <p class="muted">${s.numEcosistemas} ecosistema(s) · ${s.numPaquetes} paquete(s) · ${s.numPaquetesConOsv} con hallazgos OSV</p>
    <p class="muted">${escapeHtml(vulnLine)}</p>
    ${llmShort ? `<p class="muted">${escapeHtml(llmShort)}</p>` : ""}
    <p class="muted">Generado <code>${escapeHtml(view.generatedAt)}</code>. Sin pestañas interactivas: abrí en un navegador con JavaScript o usá <code>informe.json</code> / <code>report.json</code>.</p>
  </div>
  <noscript>
    <p class="card"><strong>JavaScript desactivado.</strong> Usá <code>informe.json</code> (pestañas en otro visor) o <code>informe.md</code>.</p>
  </noscript>`;
}

function toPayloadB64(view: InformeView): string {
  return Buffer.from(JSON.stringify(view), "utf8").toString("base64");
}

/** HTML autónomo: datos = InformeView (Base64), UI por pestañas. */
export function buildReportHtml(result: ScanResult): string {
  const view = buildInformeView(result);
  const b64 = toPayloadB64(view);
  const staticBlock = staticSummaryHtml(view);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>zscan - Reporte de vulnerabilidades</title>
  <style>
    :root {
      --bg: #faf7f2;
      --bg-deep: #f3ece4;
      --card: #ffffff;
      --text: #1c1917;
      --muted: #57534e;
      --muted-warm: #6b5d4f;
      --code-text: #44403c;
      --accent: #6b4423;
      --accent-mid: #8b5c2e;
      --accent-soft: #a67c52;
      --accent-light: #c4a574;
      --border: #e7e5e4;
      --border-warm: #d4c4b0;
      --code-bg: #f5f0e8;
      --note: #b45309;
      --danger: #b91c1c;
      --ok: #3d6b2e;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: linear-gradient(180deg, #ffffff 0%, var(--bg) 38%, var(--bg-deep) 100%);
      background-attachment: fixed;
      color: var(--text);
      line-height: 1.5;
      margin: 0;
      min-height: 100vh;
      padding: 1.25rem 1.5rem 3rem;
      max-width: 1100px;
      margin-left: auto;
      margin-right: auto;
    }
    h1 {
      font-size: 1.5rem;
      margin-top: 0;
      color: var(--accent);
      font-weight: 700;
      letter-spacing: -0.02em;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--accent-light);
    }
    h2 {
      font-size: 1.1rem;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: var(--accent);
      font-weight: 600;
      border-left: 3px solid var(--accent-light);
      padding-left: 0.5rem;
    }
    h3 { font-size: 1rem; margin-top: 1rem; color: var(--text); }
    h4 { font-size: 0.9rem; margin: 0.75rem 0 0.35rem; color: var(--muted-warm); font-weight: 600; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88em;
      color: var(--code-text);
      background: var(--code-bg);
      padding: 0.12em 0.35em;
      border-radius: 4px;
      border: 1px solid var(--border-warm);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border-warm);
      border-radius: 10px;
      padding: 1rem 1.15rem;
      margin: 1rem 0;
      box-shadow: 0 1px 2px rgba(28, 25, 23, 0.04);
    }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .pill {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      margin-right: 0.35rem;
      background: var(--code-bg);
      border: 1px solid var(--border-warm);
      color: var(--muted-warm);
    }
    .pill.bad {
      background: color-mix(in srgb, var(--danger) 12%, var(--card));
      color: var(--danger);
      border-color: color-mix(in srgb, var(--danger) 35%, var(--border-warm));
    }
    .pill.ok {
      background: color-mix(in srgb, var(--ok) 14%, var(--card));
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 30%, var(--border-warm));
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem;
      margin: 1rem 0 0;
      padding: 0;
      border-bottom: 1px solid var(--border-warm);
      list-style: none;
    }
    .tab-btn {
      padding: 0.5rem 0.75rem;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.88rem;
      margin-bottom: -1px;
    }
    .tab-btn:hover { color: var(--accent-mid); }
    .tab-btn.active {
      background: var(--card);
      color: var(--accent-mid);
      border-color: var(--border-warm);
      border-bottom-color: var(--card);
      font-weight: 600;
    }
    .tab-panel { display: none; padding-top: 0.5rem; }
    .tab-panel.active { display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 0.75rem 0; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted-warm); font-weight: 600; }
    pre.tree, pre.json-dump {
      font-size: 0.78rem;
      overflow: auto;
      max-height: min(70vh, 720px);
      padding: 0.75rem;
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 8px;
      border: 1px solid var(--border-warm);
      white-space: pre-wrap;
      word-break: break-word;
    }
    a { color: var(--accent-mid); text-underline-offset: 2px; }
    a:hover { color: var(--accent); }
    details.snip { margin: 0.5rem 0; }
    details.snip summary { cursor: pointer; color: var(--accent-mid); font-weight: 500; }
    details.snip summary:hover { color: var(--accent); }
    .snippet {
      font-size: 0.82rem;
      white-space: pre-wrap;
      margin: 0.5rem 0;
      padding: 0.5rem;
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    #zscan-err {
      border-color: var(--danger);
      background: color-mix(in srgb, var(--danger) 6%, var(--card));
      color: var(--text);
    }
    #zscan-err strong { color: var(--danger); }
    .note-inline { color: var(--note); font-weight: 500; }
    ul.disc-links { margin: 0.35rem 0 0; padding-left: 1.15rem; }
    ul.disc-links li { margin: 0.45rem 0; }
    ul.disc-links .disc-url { display: block; font-size: 0.78rem; word-break: break-all; margin-top: 0.15rem; }
    .sev-pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      margin-right: 0.3rem;
      margin-bottom: 0.15rem;
      vertical-align: middle;
    }
    .sev-CRITICAL { background: #7f1d1d; color: #fff; }
    .sev-HIGH { background: #c2410c; color: #fff; }
    .sev-MEDIUM { background: #ca8a04; color: #1c1917; }
    .sev-LOW { background: #4d7c0f; color: #fff; }
    .sev-NONE { background: var(--code-bg); color: var(--muted-warm); border: 1px solid var(--border-warm); }
    .sev-UNKNOWN { background: #57534e; color: #fafaf9; }
    .auth-sev {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .auth-sev-high { background: #7f1d1d; color: #fff; }
    .auth-sev-medium { background: #c2410c; color: #fff; }
    .auth-sev-low { background: #57534e; color: #fafaf9; }
  </style>
</head>
<body>
  <h1>zscan - Reporte de vulnerabilidades</h1>
  <div id="app">${staticBlock}</div>
  <template id="zscan-b64">${b64}</template>
  <script>
(function () {
  var app = document.getElementById("app");
  var tpl = document.getElementById("zscan-b64");
  if (!app || !tpl) return;

  /** HTMLTemplateElement: datos en .content; .textContent del elemento suele estar vacío. */
  function readTemplatePayload(el) {
    if (el instanceof HTMLTemplateElement && el.content) {
      var t = el.content.textContent;
      if (t && t.trim()) return t;
    }
    return el.textContent || el.innerHTML || "";
  }

  function b64ToUtf8(b64) {
    var bin = atob(b64.replace(/\\s+/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  var view;
  try {
    view = JSON.parse(b64ToUtf8(readTemplatePayload(tpl)));
  } catch (e) {
    app.innerHTML =
      '<div class="card" id="zscan-err"><strong>No se pudo leer el informe.</strong> Abrí <code>informe.json</code> o <code>report.json</code>. (' +
      String(e && e.message ? e.message : e) +
      ")</div>";
    console.error(e);
    return;
  }

  function esc(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function escPre(s) {
    return esc(s);
  }

  var SEV_SHORT = {
    CRITICAL: "Crítico",
    HIGH: "Alto",
    MEDIUM: "Medio",
    LOW: "Bajo",
    NONE: "Ninguno",
    UNKNOWN: "N/D",
  };

  function sevPillClassified(s) {
    if (!s) return "";
    var q = s.qualitative || "UNKNOWN";
    var txt = SEV_SHORT[q] || q;
    if (s.baseScore != null && typeof s.baseScore === "number") {
      txt += " " + s.baseScore.toFixed(1);
    }
    return (
      '<span class="sev-pill sev-' +
      esc(q) +
      '" title="' +
      esc(s.labelEs || "") +
      '">' +
      esc(txt) +
      "</span>"
    );
  }

  function treeText(node, depth) {
    if (!node) return "";
    depth = depth || 0;
    var pad = new Array(depth + 1).join("  ");
    var nl = String.fromCharCode(10);
    var line = pad + "- " + node.name + " @ " + node.version + nl;
    var ch = node.children || [];
    for (var i = 0; i < ch.length; i++) line += treeText(ch[i], depth + 1);
    return line;
  }

  var r = view.resumen;
  var st = r.estadisticas;

  function renderResumen() {
    var vuln = r.vulnerabilidades || {};
    var h = '<div class="card">';
    h += '<p><strong>Raíz:</strong> <code>' + esc(r.root) + '</code></p>';
    h += '<p class="muted">Generado: <code>' + esc(view.generatedAt) + '</code> · informe v' + esc(view.zscanInformeVersion) + "</p>";
    h += '<p><span class="pill">' + st.numEcosistemas + " runtime(s)</span>";
    h += '<span class="pill">' + st.numPaquetes + " paquetes</span>";
    h += '<span class="pill ' + (st.numPaquetesConOsv ? "bad" : "ok") + '">' + st.numPaquetesConOsv + " con OSV</span></p>";
    if (st.porRuntime && st.porRuntime.length) {
      h += "<h3>Por runtime</h3><table><thead><tr><th>Ecosistema</th><th>Lockfile</th><th>Paquetes</th><th>Con OSV</th></tr></thead><tbody>";
      st.porRuntime.forEach(function (row) {
        h += "<tr><td>" + esc(row.ecosystem) + "</td><td><code>" + esc(row.lockfile) + "</code></td><td>" + row.paquetes + "</td><td>" + row.paquetesConOsv + "</td></tr>";
      });
      h += "</tbody></table>";
    }
    h += "</div>";

    var llm = view.llm;
    if (llm) {
      h += '<div class="card"><h2>Modelo y proveedor LLM</h2>';
      h += "<p class=\\"muted\\">" + esc(llm.proveedor_descripcion) + "</p>";
      h +=
        "<p><strong>Proveedor (resuelto):</strong> <code>" +
        esc(llm.proveedor) +
        "</code> · <strong>Modelo:</strong> <code>" +
        esc(llm.modelo) +
        "</code></p>";
      h += "<p><strong>Base URL:</strong> <code>" + esc(llm.base_url) + "</code></p>";
      h +=
        "<p><span class=\\"pill" +
        (llm.yaml_llm_enabled ? " ok" : "") +
        "\\">llm.enabled en zscan.yaml: " +
        (llm.yaml_llm_enabled ? "sí" : "no") +
        '</span> <span class="pill">' +
        (llm.api_key_configurada ? "API key presente" : "Sin API key en config/env") +
        "</span></p>";
      var envBits = [];
      if (llm.env && llm.env.model) envBits.push("ZSCAN_LLM_MODEL");
      if (llm.env && llm.env.base_url) envBits.push("ZSCAN_LLM_BASE_URL");
      if (llm.env && llm.env.api_key) envBits.push("ZSCAN_LLM_API_KEY");
      if (llm.env && llm.env.provider) envBits.push("ZSCAN_LLM_PROVIDER");
      h +=
        "<p class=\\"muted\\">Variables de entorno que sobrescriben YAML: " +
        (envBits.length ? esc(envBits.join(", ")) : "ninguna detectada en este proceso") +
        "</p>";
      h += "<h3>Catálogo de referencia (proveedores soportados)</h3>";
      h +=
        "<p class=\\"muted\\">Ejemplos documentados por zscan; no implica que estén en uso.</p>";
      h +=
        "<table><thead><tr><th>Proveedor / entorno</th><th>Modelos ejemplo</th><th>Nota</th></tr></thead><tbody>";
      (llm.catalogo_referencia || []).forEach(function (row) {
        h +=
          "<tr><td>" +
          esc(row.nombre) +
          "</td><td>" +
          esc((row.ejemplos_modelo || []).join(", ")) +
          "</td><td class=\\"muted\\">" +
          esc(row.nota || "—") +
          "</td></tr>";
      });
      h += "</tbody></table></div>";
    }

    h += '<div class="card"><h2>Resumen de vulnerabilidades</h2>';
    h += '<p class="muted">' + esc(vuln.alcanceLockfile || "") + "</p>";
    var nIds = (vuln.idsVulnerabilidadUnicos || []).length;
    if (!nIds) {
      h +=
        '<p><span class="pill ok">Sin hallazgos OSV</span> Para las versiones fijadas en el lockfile no hay vulnerabilidades conocidas en OSV en este escaneo.</p>';
    } else {
      h +=
        '<p><span class="pill bad">' +
        nIds +
        " ID(s) únicos</span> afectan <strong>" +
        (vuln.paquetesConVulnerabilidad || 0) +
        "</strong> paquete(s) distinto(s) del lockfile (de <strong>" +
        (vuln.paquetesEscaneados || 0) +
        "</strong> paquetes cuya versión se consultó).</p>";
      h +=
        '<p class="muted"><strong>' +
        esc(vuln.estandarSeveridad || "CVSS (FIRST)") +
        "</strong> — bandas cualitativas según puntuación base publicada por OSV (0–10).</p>";
      if ((vuln.conteoPorSeveridad || []).length) {
        h += "<h3>Por severidad (cualitativa)</h3><p>";
        vuln.conteoPorSeveridad.forEach(function (c) {
          h +=
            '<span class="sev-pill sev-' +
            esc(c.qualitative) +
            '">' +
            esc(c.etiquetaCortaEs) +
            ": " +
            c.count +
            "</span> ";
        });
        h += "</p>";
      }
      h += "<h3>Por vulnerabilidad</h3>";
      h +=
        '<table><thead><tr><th>Severidad</th><th>ID</th><th>Resumen OSV</th><th>Paquetes afectados (lockfile)</th></tr></thead><tbody>';
      (vuln.porVulnerabilidad || []).forEach(function (row) {
        var sum = row.summary ? esc(row.summary) : '<span class="muted">—</span>';
        var pkgs = (row.enPaquetes || [])
          .map(function (p) {
            return (
              "<div><code>" +
              esc(p.package) +
              "</code>@" +
              esc(p.version) +
              ' <span class="muted">(' +
              esc(p.ecosystem) +
              " · <code>" +
              esc(p.lockfile) +
              "</code>)</span></div>"
            );
          })
          .join("");
        var sevCell = row.severidad ? sevPillClassified(row.severidad) : "";
        h +=
          "<tr><td>" +
          sevCell +
          "</td><td><code>" +
          esc(row.id) +
          "</code></td><td>" +
          sum +
          "</td><td>" +
          pkgs +
          "</td></tr>";
      });
      h += "</tbody></table>";
    }
    h += "</div>";

    if (r.git) {
      h += "<h2>Git</h2><div class=\\"card\\">";
      if (r.git.isRepository) {
        h += "<p>Repositorio: sí · <code>" + esc(r.git.repositoryRoot) + "</code></p>";
        if (r.git.headLabel) h += "<p class=\\"muted\\">HEAD: " + esc(r.git.headLabel) + "</p>";
        if (r.git.submodulePaths && r.git.submodulePaths.length) {
          h += "<p class=\\"muted\\">Submódulos: " + r.git.submodulePaths.map(function (p) { return "<code>" + esc(p) + "</code>"; }).join(", ") + "</p>";
        }
      } else {
        h += "<p>No se detectó repositorio Git desde la raíz del escaneo.</p>";
      }
      h += "</div>";
    }

    return h;
  }

  function renderRuntimes() {
    var sevByFinding = {};
    (view.hallazgosOsv || []).forEach(function (row) {
      var k = row.ecosystem + "\\0" + row.package + "\\0" + row.version;
      sevByFinding[k] = row.severidades || [];
    });
    var h = "";
    (view.ecosistemas || []).forEach(function (eco, ecoIdx) {
      var weak = (eco.findings || []).filter(function (f) { return f.vulns && f.vulns.length; });
      h += "<div class=\\"card\\" id=\\"eco-" + ecoIdx + "\\">";
      h += "<h3>" + esc(eco.ecosystem) + " — <code>" + esc(eco.lockfile) + "</code></h3>";
      h +=
        "<p class=\\"muted\\">" +
        (eco.packages || []).length +
        " paquetes en el lockfile (directos y transitivos) · " +
        weak.length +
        " con al menos un hallazgo OSV</p>";
      if (eco.tree) {
        h += "<h4>Árbol</h4><pre class=\\"tree\\">" + esc(treeText(eco.tree)) + "</pre>";
      }
      if (weak.length) {
        h += "<h4>Hallazgos en este runtime</h4><table><thead><tr><th>Paquete</th><th>Versión</th><th>Vulnerabilidades (CVSS / ID)</th></tr></thead><tbody>";
        weak.forEach(function (f) {
          var k = eco.ecosystem + "\\0" + f.package + "\\0" + f.version;
          var sevList = sevByFinding[k] || [];
          var vulns = (f.vulns || [])
            .map(function (v, i) {
              var cl = sevList[i];
              var pill = cl ? sevPillClassified(cl) + " " : "";
              var ref = (v.references || []).find(function (x) { return x.url; });
              var idEsc = esc(v.id);
              var link = ref
                ? " <a href=" + JSON.stringify(ref.url) + ' rel="noopener noreferrer">' + idEsc + "</a>"
                : idEsc;
              var sum = v.summary ? ": " + esc(v.summary) : "";
              return "<div>" + pill + "<strong>" + link + "</strong>" + sum + "</div>";
            })
            .join("");
          h += "<tr><td><code>" + esc(f.package) + "</code></td><td>" + esc(f.version) + "</td><td>" + vulns + "</td></tr>";
        });
        h += "</tbody></table>";
      } else {
        h += "<p class=\\"muted\\">Sin CVE/OSV para las versiones resueltas.</p>";
      }
      var hints = (eco.importHints || []).filter(function (x) { return x.files && x.files.length; });
      var hintRows = hints.filter(function (hh) { return weak.some(function (w) { return w.package === hh.package; }); });
      if (hintRows.length) {
        h += "<h4>Uso en código (paquetes con OSV)</h4><table><thead><tr><th>Paquete</th><th>Ubicación</th></tr></thead><tbody>";
        hintRows.forEach(function (hh) {
          var locs = (hh.files || []).slice(0, 15).map(function (loc) {
            return "<div><code>" + esc(loc.path) + ":" + loc.line + "</code> — <span class=\\"muted\\">" + esc(loc.snippet) + "</span></div>";
          }).join("");
          h += "<tr><td><code>" + esc(hh.package) + "</code></td><td>" + locs + "</td></tr>";
        });
        h += "</tbody></table>";
      }
      h += "</div>";
    });
    if (!(view.ecosistemas || []).length) {
      h = '<p class="muted">No se detectaron lockfiles.</p>';
    }
    return h;
  }

  function renderOsv() {
    var rows = view.hallazgosOsv || [];
    if (!rows.length) {
      return '<p class="muted">No hay paquetes con vulnerabilidades OSV en este escaneo.</p>';
    }
    var h =
      '<p class="muted">Cada fila es un paquete cuya versión aparece en el lockfile (puede ser dependencia transitiva, no solo la app o el framework).</p>';
    h += '<div class="card"><table><thead><tr><th>Runtime</th><th>Paquete</th><th>Versión</th><th>Severidad + vulnerabilidades</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var sevs = row.severidades || [];
      var vulns = (row.vulns || [])
        .map(function (v, i) {
          var cl = sevs[i];
          var pill = cl ? sevPillClassified(cl) + " " : "";
          var ref = (v.references || []).find(function (x) { return x.url; });
          var idEsc = esc(v.id);
          var link = ref
            ? " <a href=" + JSON.stringify(ref.url) + ' rel="noopener noreferrer">' + idEsc + "</a>"
            : idEsc;
          var sum = v.summary ? ": " + esc(v.summary) : "";
          return "<div>" + pill + "<strong>" + link + "</strong>" + sum + "</div>";
        })
        .join("");
      h += "<tr><td><small>" + esc(row.ecosystem) + "</small><br/><code class=\\"muted\\">" + esc(row.lockfile) + "</code></td><td><code>" + esc(row.package) + "</code></td><td>" + esc(row.version) + "</td><td>" + vulns + "</td></tr>";
    });
    h += "</tbody></table></div>";
    return h;
  }

  function renderRefs() {
    var snips = (view.referencias && view.referencias.docSnippets) || [];
    var disc = (view.referencias && view.referencias.webDiscovery) || [];
    var h = "";
    if (snips.length) {
      h += "<h3>Extractos descargados</h3>";
      snips.forEach(function (s) {
        h += "<details class=\\"snip card\\"><summary><strong>" + esc(s.vulnId) + "</strong> — " + esc(s.url) + "</summary>";
        h += "<div class=\\"snippet\\">" + esc(s.excerpt) + "</div></details>";
      });
    } else {
      h +=
        '<p class="muted">Sin extractos descargables en este run (red, bloqueo, texto muy corto o límite de URLs). Igual podés usar el <strong>contexto web</strong> abajo.</p>';
    }
    if (disc.length) {
      h += "<h3>Contexto web (registros, búsqueda, comunidades)</h3>";
      h +=
        '<p class="muted">Enlaces para abrir en el navegador. zscan no ejecuta buscadores ni foros; solo arma URLs de partida (OSV, NVD, Google, DuckDuckGo, Stack Overflow, Reddit).</p>';
      disc.forEach(function (b) {
        h += "<div class=\\"card\\"><h4><code>" + esc(b.vulnId) + "</code>";
        if (b.package) {
          h += ' <span class=\\"muted\\">· paquete <code>' + esc(b.package) + "</code></span>";
        }
        h += "</h4><ul class=\\"disc-links\\">";
        (b.links || []).forEach(function (L) {
          h +=
            "<li><span class=\\"pill\\">" +
            esc(L.kind) +
            "</span> <a href=" +
            JSON.stringify(L.url) +
            ' rel="noopener noreferrer">' +
            esc(L.label) +
            '</a><span class="disc-url muted">' +
            esc(L.url) +
            "</span></li>";
        });
        h += "</ul></div>";
      });
    }
    if (!snips.length && !disc.length) {
      return (
        '<p class="muted">Sin referencias ni contexto web (sin hallazgos OSV o informe incompleto).</p>'
      );
    }
    return h;
  }

  var NIVEL_SECRET_ES = {
    sin_indicios_graves: "Nivel bajo (heurístico)",
    revisar: "Revisar patrones",
    riesgo_alto_heuristico: "Riesgo alto (heurístico)",
  };

  function renderSecretAuth() {
    var s = view.secretAuth;
    if (!s) {
      return '<p class="muted">Sin análisis de secretos (desactivado o no disponible).</p>';
    }
    var nivelLabel = NIVEL_SECRET_ES[s.nivel] || s.nivel;
    var nivelPillCls =
      s.nivel === "riesgo_alto_heuristico"
        ? "pill bad"
        : s.nivel === "revisar"
          ? "pill"
          : "pill ok";
    var h = '<div class="card"><h2>Secretos y autenticación</h2>';
    h += "<p><span class=\\"" + nivelPillCls + "\\">" + esc(nivelLabel) + "</span></p>";
    h += "<p>" + esc(s.resumen) + "</p>";
    h += "<p class=\\"muted\\"><small>" + esc(s.metodo) + "</small></p>";
    h += "<p class=\\"muted\\">Archivos de texto analizados: " + s.archivosAnalizados + "</p>";
    if (!(s.hallazgos && s.hallazgos.length)) {
      h += "<p class=\\"muted\\">Sin coincidencias con los patrones buscados.</p></div>";
      return h;
    }
    h +=
      "<table><thead><tr><th>Severidad</th><th>Categoría</th><th>Ubicación</th><th>Detalle</th><th>Sugerencia</th></tr></thead><tbody>";
    s.hallazgos.forEach(function (x) {
      var sevPill =
        '<span class="auth-sev auth-sev-' + esc(x.severity) + '">' + esc(x.severity) + "</span>";
      h +=
        "<tr><td>" +
        sevPill +
        "</td><td><code>" +
        esc(x.category) +
        "</code></td><td><code>" +
        esc(x.path) +
        ":" +
        x.line +
        "</code></td><td><strong>" +
        esc(x.titulo) +
        '</strong><br/><span class="muted"><code>' +
        esc(x.snippet) +
        "</code></span></td><td>" +
        esc(x.sugerencia) +
        "</td></tr>";
    });
    h += "</tbody></table></div>";
    return h;
  }

  function renderPrompts() {
    var pr = view.prompts && view.prompts.resultado;
    if (pr) {
      var h = '<div class="card">';
      h += "<p class=\\"muted\\">Umbral mínimo: " + esc(pr.minRequiredPercent) + "% · archivos: " + (pr.files || []).length + "</p>";
      if (pr.belowThreshold && pr.belowThreshold.length) {
        h += "<p><span class=\\"pill bad\\">Bajo umbral</span> " + pr.belowThreshold.map(function (p) { return "<code>" + esc(p) + "</code>"; }).join(", ") + "</p>";
      }
      h += "</div>";

      (pr.files || []).forEach(function (f) {
        h += '<div class="card">';
        h += "<h3><code>" + esc(f.relativePath) + "</code></h3>";
        h += "<p class=\\"muted\\">" + esc(f.purpose || "") + "</p>";

        var ds = f.dataSensitivity;
        if (ds) {
          var sensPill =
            ds.nivel === "alta"
              ? "pill bad"
              : ds.nivel === "media"
                ? "pill"
                : ds.nivel === "baja"
                  ? "pill ok"
                  : "pill";
          h += "<h4>Datos enviados al modelo y sensibilidad (heurístico)</h4>";
          h += "<p><span class=\\"" + sensPill + "\\">" + esc(ds.nivel) + "</span> " + esc(ds.resumen) + "</p>";
          h +=
            "<p class=\\"muted\\">Plantilla con sustituciones: " +
            (ds.tiene_sustituciones ? "sí" : "no") +
            "</p>";
          if (ds.datos_inferidos && ds.datos_inferidos.length) {
            h += "<p><strong>Tipos de dato inferidos:</strong></p><ul>";
            ds.datos_inferidos.forEach(function (t) {
              h += "<li>" + esc(t) + "</li>";
            });
            h += "</ul>";
          }
          if (ds.detalles && ds.detalles.length) {
            h +=
              "<table><thead><tr><th>Línea</th><th>Sens.</th><th>Tipo</th><th>Hallazgo</th></tr></thead><tbody>";
            ds.detalles.slice(0, 30).forEach(function (d) {
              h +=
                "<tr><td>" +
                d.line +
                "</td><td>" +
                esc(d.sensibilidad) +
                "</td><td>" +
                esc(d.tipo_inferido) +
                "</td><td>" +
                esc(d.hallazgo) +
                "</td></tr>";
            });
            h += "</tbody></table>";
            if (ds.detalles.length > 30) {
              h += "<p class=\\"muted\\">… +" + (ds.detalles.length - 30) + " más</p>";
            }
          }
          if (ds.sugerencias && ds.sugerencias.length) {
            h += "<p><strong>Sugerencias:</strong></p><ul>";
            ds.sugerencias.forEach(function (s) {
              h += "<li>" + esc(s) + "</li>";
            });
            h += "</ul>";
          }
        }

        h += "<h4>Comprobaciones (inyección / reglas YAML / LLM)</h4>";
        h += "<p><span class=\\"pill " + (f.scorePercent < pr.minRequiredPercent ? "bad" : "ok") + "\\">" + esc(f.scorePercent) + "%</span></p>";
        h += "<table><thead><tr><th>Origen</th><th>Regla</th><th>OK</th><th>Línea</th><th>Cita</th></tr></thead><tbody>";
        (f.checks || []).forEach(function (c) {
          h +=
            "<tr><td>" +
            esc(c.origin) +
            "</td><td><code>" +
            esc(c.ruleId) +
            "</code></td><td>" +
            (c.passed ? "sí" : "no") +
            "</td><td>" +
            (c.line || "—") +
            "</td><td>" +
            esc((c.citation || "").slice(0, 160)) +
            "</td></tr>";
        });
        h += "</tbody></table></div>";
      });

      return h;
    }
    var msg = view.prompts && view.prompts.mensaje;
    if (msg) {
      return '<div class="card"><p class="muted">' + esc(msg) + "</p></div>";
    }
    return '<p class="muted">Sin resultado de prompt-scan.</p>';
  }

  function renderJsonTab() {
    return (
      '<p class="muted">Mismo contenido que <code>informe.json</code> en disco (JSON indentado).</p><pre class="json-dump">' +
      escPre(JSON.stringify(view, null, 2)) +
      "</pre>"
    );
  }

  var tabIds = ["resumen", "runtimes", "osv", "refs", "secretAuth", "prompts", "json"];
  var tabLabels = {
    resumen: "Resumen",
    runtimes: "Runtimes",
    osv: "Hallazgos OSV",
    refs: "Referencias CVE",
    secretAuth: "Secretos / auth",
    prompts: "Prompt-scan",
    json: "JSON informe",
  };

  var panels = {
    resumen: renderResumen(),
    runtimes: renderRuntimes(),
    osv: renderOsv(),
    refs: renderRefs(),
    secretAuth: renderSecretAuth(),
    prompts: renderPrompts(),
    json: renderJsonTab(),
  };

  var nav =
    '<nav role="navigation" aria-label="Secciones"><ul class="tabs">' +
    tabIds
      .map(function (id, i) {
        return (
          '<li><button type="button" class="tab-btn' +
          (i === 0 ? " active" : "") +
          '" data-tab="' +
          id +
          '" role="tab" aria-selected="' +
          (i === 0 ? "true" : "false") +
          '">' +
          tabLabels[id] +
          "</button></li>"
        );
      })
      .join("") +
    "</ul></nav>";

  var body = tabIds
    .map(function (id, i) {
      return (
        '<div id="panel-' +
        id +
        '" class="tab-panel' +
        (i === 0 ? " active" : "") +
        '" role="tabpanel">' +
        panels[id] +
        "</div>"
      );
    })
    .join("");

  app.innerHTML = '<div id="zscan-ui">' + nav + body + "</div>";

  var ui = document.getElementById("zscan-ui");
  ui.querySelector(".tabs").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".tab-btn");
    if (!btn) return;
    var id = btn.getAttribute("data-tab");
    ui.querySelectorAll(".tab-btn").forEach(function (b) {
      var on = b.getAttribute("data-tab") === id;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    ui.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + id);
    });
  });
})();
  </script>
</body>
</html>
`;
}
