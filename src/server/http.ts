import * as http from "node:http";
import { URL } from "node:url";
import { performCombinedScan } from "../scan/combinedScan.js";
const JSON_LIMIT = 2_000_000;

export interface ServeOptions {
  host?: string;
  port?: number;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > JSON_LIMIT) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createZscanServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, service: "zscan" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/scan") {
        const raw = await readBody(req);
        let body: {
          root?: string;
          ignoreSubmodules?: boolean;
          offline?: boolean;
          bypassOsvCache?: boolean;
          enrichDocs?: boolean;
          skipPromptLlm?: boolean;
          secretAuthScan?: boolean;
        };
        try {
          body = raw ? (JSON.parse(raw) as typeof body) : {};
        } catch {
          sendJson(res, 400, { error: "invalid JSON" });
          return;
        }

        const root = body.root ? String(body.root) : process.cwd();
        const enrichDocs = body.enrichDocs !== false;
        const { result, errorMessage, promptScanHardFail } =
          await performCombinedScan(
            root,
            {
              ignoreSubmodules: Boolean(body.ignoreSubmodules),
              offline: Boolean(body.offline),
              bypassOsvCache: Boolean(body.bypassOsvCache),
              enrichDocs,
              secretAuthScan: body.secretAuthScan !== false,
            },
            { skipLlm: Boolean(body.skipPromptLlm) }
          );

        if (!result) {
          sendJson(res, 422, { ok: false, error: errorMessage ?? "scan failed" });
          return;
        }

        const vulnCount = result.ecosystems.reduce(
          (n, e) => n + e.findings.filter((f) => f.vulns.length).length,
          0
        );
        const promptChecksFailed = Boolean(
          result.prompts?.files.some((f) =>
            f.checks.some((c) => !c.passed)
          )
        );

        sendJson(res, 200, {
          ok: true,
          vulnCount,
          promptScanHardFail,
          promptChecksFailed,
          result,
        });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (e) {
      sendJson(res, 500, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

export function startZscanServer(opts: ServeOptions): http.Server {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8787;
  const server = createZscanServer();
  server.listen(port, host, () => {
    console.log(`zscan HTTP → http://${host}:${port}  (POST /scan, GET /health)`);
  });
  return server;
}
