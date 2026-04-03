import { startZscanServer } from "../server/http.js";

export function runServe(host: string, port: number): void {
  startZscanServer({ host, port });
}
