import * as fs from "node:fs";
import * as path from "node:path";
import { fileInSubmodule } from "../git/metadata.js";
const SKIP_DIRS = new Set([
    "node_modules",
    "dist",
    ".git",
    "coverage",
    "vendor",
    ".venv",
    "venv",
    "__pycache__",
    "target",
    "build",
    "zscan-runs",
    ".next",
    "out",
]);
const TEXT_EXT = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rb",
    ".java",
    ".kt",
    ".kts",
    ".yaml",
    ".yml",
    ".tf",
    ".properties",
    ".sh",
]);
const MAX_FILE_BYTES = 400_000;
const MAX_FILES = 800;
function filterSubmoduleAbsPaths(absPaths, opts) {
    if (!opts?.ignoreSubmodules || !opts.git?.isRepository || !opts.git.repositoryRoot) {
        return absPaths;
    }
    const rr = path.resolve(opts.git.repositoryRoot);
    return absPaths.filter((abs) => !fileInSubmodule(path.resolve(abs), rr, opts.git.submodulePaths));
}
function walkCodeFiles(rootAbs, out) {
    const scanRoots = [];
    const src = path.join(rootAbs, "src");
    if (fs.existsSync(src) && fs.statSync(src).isDirectory())
        scanRoots.push(src);
    scanRoots.push(rootAbs);
    const seen = new Set();
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            if (e.name === "." || e.name === "..")
                continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (SKIP_DIRS.has(e.name))
                    continue;
                if (e.name.startsWith(".") && e.name !== ".github")
                    continue;
                walk(p);
            }
            else {
                const ext = path.extname(e.name);
                if (!TEXT_EXT.has(ext))
                    continue;
                const low = e.name.toLowerCase();
                if (low.endsWith(".min.js") ||
                    low.endsWith(".bundle.js") ||
                    low.endsWith(".map")) {
                    continue;
                }
                if (!seen.has(p)) {
                    seen.add(p);
                    out.push(p);
                }
            }
        }
    }
    for (const r of scanRoots)
        walk(r);
}
function looksLikePlaceholder(line) {
    const l = line.toLowerCase();
    return (l.includes("your_") ||
        l.includes("changeme") ||
        l.includes("example.com") ||
        l.includes("placeholder") ||
        l.includes("todo:") ||
        l.includes("xxx") ||
        l.includes("<replace") ||
        l.includes("${") ||
        l.includes("process.env") ||
        l.includes("os.environ") ||
        l.includes("getenv(") ||
        l.includes("import.meta.env"));
}
/** Enmascara el centro de una cadena larga. */
function maskMiddle(s, keep = 6) {
    const t = s.trim();
    if (t.length <= keep * 2)
        return t.slice(0, 3) + "…";
    return `${t.slice(0, keep)}…${t.slice(-keep)}`;
}
function pushFinding(out, f) {
    out.push({
        category: f.category,
        severity: f.severity,
        path: f.path,
        line: f.line,
        snippet: maskMiddle(f.rawLine, 8).slice(0, 120),
        titulo: f.titulo,
        sugerencia: f.sugerencia,
    });
}
function scanLine(relPath, lineNum, line, findings) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#"))
        return;
    if (looksLikePlaceholder(line))
        return;
    if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Posible clave privada PEM en código",
            sugerencia: "No versionar claves privadas: usá un gestor de secretos (Vault, cloud KMS), variables de entorno en runtime o archivos fuera del repo con .gitignore.",
        });
        return;
    }
    if (/\bAKIA[0-9A-Z]{16}\b/.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Patrón de Access Key ID de AWS",
            sugerencia: "Rotá las claves expuestas, usá IAM roles / OIDC para CI y `aws configure` local sin pegar IDs en el repositorio.",
        });
        return;
    }
    if (/\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{20,}/i.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Asignación sospechosa de secreto AWS",
            sugerencia: "Tratá `AWS_SECRET_ACCESS_KEY` como material sensible: solo variables de entorno o secret store, nunca literal en git.",
        });
        return;
    }
    if (/\bghp_[a-zA-Z0-9]{20,}\b/.test(line) || /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Token de GitHub en texto",
            sugerencia: "Revocá el token en GitHub → Settings → Tokens y usá `GITHUB_TOKEN` en CI o credenciales del SO.",
        });
        return;
    }
    if (/\bsk-[a-zA-Z0-9]{20,}\b/.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Posible clave API estilo OpenAI (`sk-…`)",
            sugerencia: "Mové la clave a `.env.local` (ignorado) o al secret manager del proveedor; rotá si llegó a commitearse.",
        });
        return;
    }
    if (/\bBearer\s+[A-Za-z0-9._-]{24,}\b/.test(line)) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Cabecera Bearer con token largo en código",
            sugerencia: "Los tokens deben obtenerse en runtime (OAuth, sesión). Evitá literales en fuentes; si es de prueba, usá fixtures sin secretos reales.",
        });
        return;
    }
    const basicUrl = /https?:\/\/([^/\s:]+):([^@\s]+)@/i.exec(line);
    if (basicUrl && basicUrl[2] && basicUrl[2].length > 2) {
        pushFinding(findings, {
            category: "auth_pattern",
            severity: "high",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Credenciales embebidas en URL (Basic en línea)",
            sugerencia: "Usá variables de entorno, `.netrc` local ignorado o mecanismos del gestor de paquetes; las URLs con `user:pass@` suelen filtrarse en logs.",
        });
        return;
    }
    const apiKeyAssign = /\b(?:api[_-]?key|apikey|secret[_-]?key|client[_-]?secret)\s*[:=]\s*['"]([^'"\\]{12,})['"]/i.exec(line);
    if (apiKeyAssign && !/^(test|demo|fake|null|undefined)$/i.test(apiKeyAssign[1])) {
        pushFinding(findings, {
            category: "secret_material",
            severity: "medium",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Literal largo junto a api_key / client_secret",
            sugerencia: "Sustituí por `process.env` / secret manager y validá que `.env*` esté en `.gitignore`.",
        });
        return;
    }
    const pwdAssign = /\bpassword\s*[:=]\s*['"]([^'"\\]{10,})['"]/i.exec(line);
    if (pwdAssign &&
        !/password\s*[:=]\s*['"]\s*['"]/i.test(line) &&
        !/^(password|secret|test|admin|123456|changeme)\b/i.test(pwdAssign[1])) {
        pushFinding(findings, {
            category: "auth_pattern",
            severity: "medium",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Contraseña o string largo en asignación `password`",
            sugerencia: "Para apps: hash con bcrypt/argon2 en servidor; para clientes: flujos OAuth; nunca contraseñas en claro en repo.",
        });
        return;
    }
    if (/\bjwt\.sign\s*\([^)]*['"][^'"]{16,}['"]/i.test(line)) {
        pushFinding(findings, {
            category: "auth_pattern",
            severity: "medium",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "Posible secreto JWT hardcodeado en `jwt.sign`",
            sugerencia: "El secreto de firma debe venir de variable de entorno (`JWT_SECRET`) con entropía fuerte y rotación planificada.",
        });
        return;
    }
    if (/\bhttp:\/\/[a-zA-Z0-9.-]+\.(?:api|auth|login|oauth)/i.test(line)) {
        pushFinding(findings, {
            category: "config_risk",
            severity: "low",
            path: relPath,
            line: lineNum,
            rawLine: line,
            titulo: "URL HTTP (no TLS) hacia servicio de API/auth",
            sugerencia: "Preferí `https://` para credenciales y tokens en tránsito; HTTP solo en desarrollo local explícito.",
        });
    }
}
function nivelFromFindings(findings) {
    const high = findings.filter((f) => f.severity === "high").length;
    const med = findings.filter((f) => f.severity === "medium").length;
    const low = findings.filter((f) => f.severity === "low").length;
    if (high >= 1)
        return "riesgo_alto_heuristico";
    if (med >= 1 || low >= 2)
        return "revisar";
    if (low === 1 && findings.length === 1)
        return "sin_indicios_graves";
    if (findings.length >= 1)
        return "revisar";
    return "sin_indicios_graves";
}
function resumenTexto(nivel, findings) {
    const h = findings.filter((x) => x.severity === "high").length;
    const m = findings.filter((x) => x.severity === "medium").length;
    const l = findings.filter((x) => x.severity === "low").length;
    if (nivel === "sin_indicios_graves") {
        if (findings.length === 0) {
            return ("Heurísticas estáticas: no se detectaron patrones típicos de llaves/tokens en claro en los archivos analizados. " +
                "Eso no sustituye auditoría manual ni escaneo de secretos en historial git.");
        }
        return (`${findings.length} aviso menor (p. ej. presencia de .env o HTTP en desarrollo). ` +
            "Revisá la tabla; el nivel global queda bajo porque no hay indicios de alta severidad.");
    }
    if (nivel === "riesgo_alto_heuristico") {
        return (`Se hallaron ${h} indicio(s) de alta severidad (y ${m} medio(s), ${l} bajo(s)). ` +
            "Priorizá rotación de credenciales y eliminación del historial si ya se commitearon.");
    }
    return (`Hay ${findings.length} hallazgo(s) para revisar (${h} alto(s), ${m} medio(s), ${l} bajo(s)). ` +
        "Muchos son falsos positivos en tests; validá contexto antes de actuar.");
}
/**
 * Escaneo best-effort de patrones de secretos y autenticación en texto fuente.
 * No lee `.env` ni binarios para no volcar secretos reales al informe.
 */
export function scanSecretsAndAuth(root, opts) {
    const rootAbs = path.resolve(root);
    const files = [];
    walkCodeFiles(rootAbs, files);
    const filtered = filterSubmoduleAbsPaths(files, opts).slice(0, MAX_FILES);
    const findings = [];
    let analyzed = 0;
    for (const abs of filtered) {
        let st;
        try {
            st = fs.statSync(abs);
        }
        catch {
            continue;
        }
        if (!st.isFile() || st.size > MAX_FILE_BYTES)
            continue;
        let content;
        try {
            content = fs.readFileSync(abs, "utf8");
        }
        catch {
            continue;
        }
        analyzed++;
        const rel = path.relative(rootAbs, abs).replace(/\\/g, "/");
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            scanLine(rel, i + 1, lines[i], findings);
        }
    }
    const envFile = path.join(rootAbs, ".env");
    if (fs.existsSync(envFile) && fs.statSync(envFile).isFile()) {
        pushFinding(findings, {
            category: "config_risk",
            severity: "low",
            path: ".env",
            line: 1,
            rawLine: "(archivo presente en el árbol del proyecto)",
            titulo: "Archivo `.env` visible para el escaneo",
            sugerencia: "Confirmá que `.env` está en `.gitignore` y no en el remoto; si se versiona por error, rotá todos los valores sensibles.",
        });
    }
    const nivel = nivelFromFindings(findings);
    const metodo = "Análisis local por expresiones regulares sobre código y YAML (sin ejecutar la app). " +
        "Puede haber falsos positivos y no ve secretos solo en historial git.";
    return {
        archivosAnalizados: analyzed,
        hallazgos: findings,
        nivel,
        resumen: resumenTexto(nivel, findings),
        metodo,
    };
}
