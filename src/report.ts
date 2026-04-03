import { promptScanToMarkdown } from "./prompt/reportPrompt.js";
import type {
  DependencyNode,
  EcosystemScanResult,
  OsvEcosystem,
  ScanResult,
} from "./types.js";

function ecosystemCodeLabel(eco: OsvEcosystem): string {
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

function treeLines(node: DependencyNode, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const line = `${pad}- **${node.name}** @ \`${node.version}\``;
  const rest = node.children.flatMap((c) => treeLines(c, depth + 1));
  return [line, ...rest];
}

function affectedDownstream(
  tree: DependencyNode | null,
  weakPackages: Set<string>
): { summary: string[]; paths: string[][] } {
  if (!tree) return { summary: [], paths: [] };
  const summary: string[] = [];
  const paths: string[][] = [];

  const walk = (node: DependencyNode, ancestors: string[]) => {
    const chain = [...ancestors, node.name];
    if (weakPackages.has(node.name)) {
      const tip = chain[chain.length - 1]!;
      summary.push(
        `El paquete **${tip}** tiene hallazgos en OSV en esta versión; los dependientes en esta rama quedan expuestos en la cadena: \`${chain.join(" → ")}\`.`
      );
      paths.push(chain);
    }
    for (const c of node.children) walk(c, chain);
  };

  for (const c of tree.children) walk(c, [tree.name]);
  return { summary, paths };
}

export function buildPropagationNotes(
  tree: DependencyNode | null,
  vulnerableNames: Set<string>
): string[] {
  const { summary } = affectedDownstream(tree, vulnerableNames);
  if (!summary.length && vulnerableNames.size) {
    return [
      "Hay paquetes con hallazgos OSV en el lockfile; revisa el árbol o la lista para ver el alcance transitivo.",
    ];
  }
  return summary;
}

function ecosystemMarkdown(eco: EcosystemScanResult): string[] {
  const weak = new Set(eco.findings.filter((f) => f.vulns.length).map((f) => f.package));

  const lines: string[] = [
    `### ${eco.ecosystem} — \`${eco.lockfile}\``,
    "",
    `- **Paquetes únicos:** ${eco.packages.length}`,
    "",
    "#### Árbol de dependencias",
    "",
  ];

  if (eco.tree) {
    lines.push(...treeLines(eco.tree, 0), "");
  } else {
    lines.push("_Sin árbol resuelto._", "", "");
  }

  lines.push("#### Propagación / consecuencia (MVP)", "");
  lines.push(
    ...buildPropagationNotes(eco.tree, weak).map((s) => `- ${s}`),
    ""
  );

  lines.push("#### Hallazgos OSV", "");
  const withVulns = eco.findings.filter((f) => f.vulns.length);
  if (!withVulns.length) {
    lines.push("No se reportaron vulnerabilidades conocidas en OSV para las versiones resueltas.", "");
  } else {
    for (const f of withVulns) {
      lines.push(`##### \`${f.package}@${f.version}\``, "");
      for (const v of f.vulns) {
        lines.push(`- **${v.id}**${v.summary ? `: ${v.summary}` : ""}`);
        if (v.references?.length) {
          const url = v.references.find((r) => r.url)?.url;
          if (url) lines.push(`  - Referencia: ${url}`);
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
  } else {
    for (const h of hints) {
      const hitVuln = withVulns.some((x) => x.package === h.package);
      if (!hitVuln) continue;
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

export function toMarkdown(result: ScanResult): string {
  const totalPkgs = result.ecosystems.reduce((n, e) => n + e.packages.length, 0);
  const lines: string[] = [
    "# zscan — informe de seguridad",
    "",
    `- **Raíz del proyecto:** \`${result.root}\``,
    `- **Ecosistemas analizados:** ${result.ecosystems.map((e) => e.ecosystem).join(", ") || "(ninguno)"}`,
    `- **Paquetes totales:** ${totalPkgs}`,
    "",
    "## Dependencias (lockfiles + OSV)",
    "",
    "### Repositorio Git",
    "",
  ];

  if (result.git.isRepository) {
    lines.push(
      `- **Es repositorio Git:** sí`,
      `- **Raíz del repo detectada:** \`${result.git.repositoryRoot}\``
    );
    if (result.git.headLabel) {
      lines.push(`- **HEAD:** ${result.git.headLabel}`);
    }
    if (result.git.submodulePaths.length) {
      lines.push(
        `- **Submódulos (.gitmodules):** ${result.git.submodulePaths.map((p) => `\`${p}\``).join(", ")}`
      );
    }
  } else {
    lines.push(
      "- **Es repositorio Git:** no (no se encontró `.git` al subir desde `--root`)"
    );
  }
  lines.push("");

  const meta = result.meta;
  if (meta && (meta.offline || meta.osvWarnings?.length || meta.enrichErrors?.length)) {
    lines.push("### Modo y avisos", "");
    if (meta.offline) {
      lines.push("- **OSV:** modo offline (solo caché en disco; sin red).");
    }
    meta.osvWarnings?.forEach((w) => lines.push(`- ⚠ ${w}`));
    meta.enrichErrors?.forEach((w) => lines.push(`- ⚠ enriquecimiento: ${w}`));
    lines.push("");
  }

  if (meta?.docSnippets?.length) {
    lines.push("### Referencias (texto en caché, scraping best-effort)", "");
    for (const s of meta.docSnippets) {
      lines.push(`#### ${s.vulnId}`, "", `**Fuente:** ${s.url}`, "", s.excerpt, "", "");
    }
  }

  for (const eco of result.ecosystems) {
    lines.push(...ecosystemMarkdown(eco), "");
  }

  lines.push("", "---", "");

  if (result.prompts) {
    lines.push(
      promptScanToMarkdown(result.prompts, { embedInScanReport: true }),
      ""
    );
  } else if (result.promptScanMessage) {
    lines.push(
      "## Prompts y reglas (`zscan.yaml`)",
      "",
      result.promptScanMessage,
      ""
    );
  }

  lines.push(
    "---",
    "",
    "Puedes pegar este reporte en tu asistente de IA para planear bumps o reemplazos; zscan no modifica el repo."
  );

  return lines.join("\n");
}

export function toJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
