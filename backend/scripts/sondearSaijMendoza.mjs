const u = new URL('https://www.saij.gob.ar/busqueda');
u.search = new URLSearchParams({q:'que la de el y en',o:'0',p:'1',f:'Total|Tipo de Documento/Jurisprudencia/Fallo|Jurisdicción/Local/Mendoza'}).toString();
try {
 const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'IVS-CODEX jurisprudence research' }, signal: AbortSignal.timeout(15000) });
 const j = r.ok ? await r.json() : null;
 const n = j?.searchResults?.categoriesResultList?.find(x => x.facetName === 'Total')?.facetChildren?.[0]?.facetHits;
 console.log(JSON.stringify({status:r.status,totalFuente:n??null,registros:j?.searchResults?.documentResultList?.length??0}));
 if (!r.ok || !j?.searchResults || n == null) process.exitCode = 2;
} catch(e) { console.error(String(e)); process.exitCode = 2; }
