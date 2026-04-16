/**
 * Construye URLs de registros oficiales, búsqueda web y comunidades (foros)
 * para que el informe muestre puntos de partida humanos.
 */
export function buildWebDiscoveryLinks(vulnId, packageName) {
    const id = vulnId.trim();
    const qBase = `${id} vulnerability`;
    const qStack = packageName
        ? `${id} ${packageName} security`
        : qBase;
    const enc = (s) => encodeURIComponent(s);
    const links = [
        {
            label: "OSV (ficha pública)",
            url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}`,
            kind: "registry",
        },
    ];
    if (/^GHSA-/i.test(id)) {
        links.push({
            label: "GitHub Security Advisory",
            url: `https://github.com/advisories/${id}`,
            kind: "registry",
        });
    }
    if (/^CVE-\d{4}-\d+$/i.test(id)) {
        links.push({
            label: "NVD (NIST)",
            url: `https://nvd.nist.gov/vuln/detail/${id}`,
            kind: "registry",
        });
    }
    links.push({
        label: "Google (búsqueda web)",
        url: `https://www.google.com/search?q=${enc(qBase)}`,
        kind: "search",
    }, {
        label: "DuckDuckGo",
        url: `https://duckduckgo.com/?q=${enc(qBase)}`,
        kind: "search",
    }, {
        label: "Stack Overflow",
        url: `https://stackoverflow.com/search?q=${enc(qStack)}`,
        kind: "community",
    }, {
        label: "Reddit",
        url: `https://www.reddit.com/search/?q=${enc(qBase)}`,
        kind: "community",
    });
    return links;
}
