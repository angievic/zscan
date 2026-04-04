#!/usr/bin/env node
import { program } from "commander";
import { runInteractiveConfig } from "./commands/configure.js";
import { runInit } from "./commands/init.js";
import { runLlmProbe } from "./commands/llm-probe.js";
import { runPromptScanCommand } from "./commands/prompt-scan.js";
import { runScanAll } from "./commands/scan-all.js";
import { runScan } from "./commands/scan.js";
import { runServe } from "./commands/serve.js";

program
  .name("zscan")
  .description(
    "Escáner local: dependencias multi-ecosistema, OSV, referencias CVE y prompt-scan en un informe"
  )
  .version("0.1.0");

program
  .command("init")
  .description("Crea zscan.yaml por defecto en la raíz del proyecto")
  .option("--root <dir>", "Directorio del proyecto", ".")
  .option("--force", "Sobrescribe zscan.yaml si existe")
  .action((opts: { root: string; force?: boolean }) => {
    runInit(opts.root, Boolean(opts.force));
  });

program
  .command("config")
  .description(
    "Asistente LLM: OpenAI, Ollama, Gemini o Claude; clave en .env.local; luego ping"
  )
  .option("--root <dir>", "Directorio del proyecto", ".")
  .action(async (opts: { root: string }) => {
    await runInteractiveConfig(opts.root);
  });

program
  .command("llm-probe")
  .alias("llm-ping")
  .description(
    "Ping al LLM configurado (Ollama, OpenAI, etc.); lee zscan.yaml + .env.local"
  )
  .option("--root <dir>", "Directorio del proyecto (para leer zscan.yaml)", ".")
  .action(async (opts: { root: string }) => {
    await runLlmProbe(opts.root);
  });

program
  .command("prompt-scan")
  .alias("prompts")
  .description(
    "Evalúa archivos en zscan.yaml (prompts[]): heurísticas, regex en rules[] y, si llm.enabled, modelo local"
  )
  .option("--root <dir>", "Directorio del proyecto", ".")
  .option("--json <file>", "Escribir resultado JSON")
  .option("--markdown <file>", "Escribir informe Markdown")
  .option("--no-print", "No imprimir Markdown a stdout")
  .option(
    "--no-llm",
    "No llamar al modelo aunque llm.enabled sea true (solo regex + heurísticas)"
  )
  .action(
    async (opts: {
      root: string;
      json?: string;
      markdown?: string;
      print?: boolean;
      llm?: boolean;
    }) => {
      await runPromptScanCommand(opts.root, {
        json: opts.json,
        markdown: opts.markdown,
        print: opts.print !== false,
        skipLlm: opts.llm === false,
      });
    }
  );

program
  .command("serve")
  .description("Servidor HTTP local (127.0.0.1): POST /scan, GET /health")
  .option("--host <addr>", "Solo escuchar en esta interfaz", "127.0.0.1")
  .option("--port <n>", "Puerto", "8787")
  .action((opts: { host: string; port: string }) => {
    const port = Number.parseInt(opts.port, 10);
    if (Number.isNaN(port) || port < 1) {
      console.error("Puerto inválido");
      process.exitCode = 1;
      return;
    }
    runServe(opts.host, port);
  });

program
  .command("scan")
  .description(
    "Informe único: lockfiles multi-ecosistema, OSV, scraping de referencias de vulnerabilidades, mapa de imports y prompt-scan (zscan.yaml + LLM si está habilitado)"
  )
  .option("--root <dir>", "Directorio del proyecto", ".")
  .option(
    "--json <file>",
    "Escribir JSON en la ruta indicada (opcional; lo habitual es --report-bundle, que ya incluye report.json en el run)"
  )
  .option(
    "--markdown <file>",
    "Escribir Markdown en la ruta indicada (opcional; lo habitual es --report-bundle con informe.md en el run)"
  )
  .option("--no-print", "No imprimir Markdown a stdout")
  .option(
    "--ignore-submodules",
    "Excluir rutas bajo submódulos Git del mapa de imports (según .gitmodules)"
  )
  .option(
    "--offline",
    "OSV solo desde caché local (ZSCAN_OSV_CACHE_DIR); sin red. También env ZSCAN_OFFLINE=1"
  )
  .option("--refresh-osv", "Ignorar lectura de caché OSV y volver a consultar la API")
  .option(
    "--enrich-docs",
    "Obsoleto: sin efecto; el scraping de referencias OSV ya está activo por defecto (compatibilidad con scripts antiguos)"
  )
  .option(
    "--no-enrich-docs",
    "No descargar ni cachear texto de URLs de referencias OSV (más rápido; por defecto sí se enriquece)"
  )
  .option(
    "--no-prompt-llm",
    "En el prompt-scan integrado, no llamar al modelo (solo heurísticas y reglas con pattern)"
  )
  .option(
    "--no-secret-auth-scan",
    "No ejecutar heurísticas de llaves / autenticación en código fuente"
  )
  .option(
    "--report-bundle [dir]",
    "Escribir run en ./zscan-runs/<id-hex>-scan/ (report.html, report.json, JSON/MD por ecosistema); [dir] = directorio padre (por defecto zscan-runs). Sin esta opción no se crea carpeta de runs"
  )
  .action(
    async (opts: {
      root: string;
      json?: string;
      markdown?: string;
      print?: boolean;
      ignoreSubmodules?: boolean;
      offline?: boolean;
      refreshOsv?: boolean;
      enrichDocs?: boolean;
      promptLlm?: boolean;
      secretAuthScan?: boolean;
      reportBundle?: string | boolean;
    }) => {
      const offline =
        Boolean(opts.offline) || process.env.ZSCAN_OFFLINE === "1";
      let reportBundleParent: string | undefined;
      if (opts.reportBundle !== undefined && opts.reportBundle !== false) {
        reportBundleParent =
          typeof opts.reportBundle === "string" && opts.reportBundle.length
            ? opts.reportBundle
            : "zscan-runs";
      }
      await runScan(opts.root, {
        json: opts.json,
        markdown: opts.markdown,
        print: opts.print !== false,
        ignoreSubmodules: Boolean(opts.ignoreSubmodules),
        offline,
        bypassOsvCache: Boolean(opts.refreshOsv),
        enrichDocs: opts.enrichDocs !== false,
        skipPromptLlm: opts.promptLlm === false,
        secretAuthScan: opts.secretAuthScan !== false,
        reportBundleParent,
      });
    }
  );

program
  .command("scan-all")
  .description(
    "Atajo: mismo análisis que `scan` + siempre escribe un run en disco (equivale a `scan --report-bundle --no-print` por defecto)"
  )
  .option("--root <dir>", "Directorio del proyecto", ".")
  .option(
    "--bundle-parent <dir>",
    "Directorio padre del run (cada ejecución crea <id>-scan dentro)",
    "zscan-runs"
  )
  .option(
    "--json <file>",
    "Además, escribir JSON en esta ruta (opcional)"
  )
  .option(
    "--markdown <file>",
    "Además, escribir Markdown en esta ruta (opcional)"
  )
  .option("--print", "También imprimir el informe Markdown por stdout")
  .option(
    "--ignore-submodules",
    "Excluir rutas bajo submódulos Git del mapa de imports (según .gitmodules)"
  )
  .option(
    "--offline",
    "OSV solo desde caché local (ZSCAN_OSV_CACHE_DIR); sin red. También env ZSCAN_OFFLINE=1"
  )
  .option("--refresh-osv", "Ignorar lectura de caché OSV y volver a consultar la API")
  .option(
    "--enrich-docs",
    "Obsoleto: sin efecto; compatibilidad con scripts antiguos"
  )
  .option(
    "--no-enrich-docs",
    "No descargar ni cachear texto de URLs de referencias OSV (más rápido)"
  )
  .option(
    "--no-prompt-llm",
    "En el prompt-scan integrado, no llamar al modelo (solo heurísticas y reglas con pattern)"
  )
  .option(
    "--no-secret-auth-scan",
    "No ejecutar heurísticas de llaves / autenticación en código fuente"
  )
  .action(
    async (opts: {
      root: string;
      bundleParent: string;
      json?: string;
      markdown?: string;
      print?: boolean;
      ignoreSubmodules?: boolean;
      offline?: boolean;
      refreshOsv?: boolean;
      enrichDocs?: boolean;
      promptLlm?: boolean;
      secretAuthScan?: boolean;
    }) => {
      const offline =
        Boolean(opts.offline) || process.env.ZSCAN_OFFLINE === "1";
      await runScanAll(opts.root, {
        json: opts.json,
        markdown: opts.markdown,
        print: opts.print,
        ignoreSubmodules: Boolean(opts.ignoreSubmodules),
        offline,
        bypassOsvCache: Boolean(opts.refreshOsv),
        enrichDocs: opts.enrichDocs !== false,
        skipPromptLlm: opts.promptLlm === false,
        secretAuthScan: opts.secretAuthScan !== false,
        bundleParent: opts.bundleParent,
      });
    }
  );

program.parse();
