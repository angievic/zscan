/** Enlace sugerido para investigar una vulnerabilidad (sin scrape automático del buscador). */
export type EnrichWebDiscoveryLink = {
    label: string;
    url: string;
    kind: "registry" | "search" | "community";
};
/**
 * Construye URLs de registros oficiales, búsqueda web y comunidades (foros)
 * para que el informe muestre puntos de partida humanos.
 */
export declare function buildWebDiscoveryLinks(vulnId: string, packageName?: string): EnrichWebDiscoveryLink[];
