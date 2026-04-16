import { startZscanServer } from "../server/http.js";
export function runServe(host, port) {
    startZscanServer({ host, port });
}
