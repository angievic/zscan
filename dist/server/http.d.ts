import * as http from "node:http";
export interface ServeOptions {
    host?: string;
    port?: number;
}
export declare function createZscanServer(): http.Server;
export declare function startZscanServer(opts: ServeOptions): http.Server;
