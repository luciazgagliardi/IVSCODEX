const base='Total|Tipo de Documento/Jurisprudencia/Fallo';
const pruebas=[
 ['solo fallo',base],
 ['provincia',base+'|Jurisdicción/Local/Mendoza'],
 ['año 2024',base+'|Fecha/2024'],
 ['mes 2024',base+'|Fecha/2024/06'],
 ['año provincia',base+'|Fecha/2024|Jurisdicción/Local/Mendoza'],
 ['provincia año',base+'|Jurisdicción/Local/Mendoza|Fecha/2024'],
 ['mes provincia',base+'|Fecha/2024/06|Jurisdicción/Local/Mendoza'],
 ['provincia mes',base+'|Jurisdicción/Local/Mendoza|Fecha/2024/06'],
 ['mes reciente',base+'|Fecha/2026/10'],
 ['mes reciente provincia',base+'|Fecha/2026/10|Jurisdicción/Local/Mendoza'],
];
const salida=[];
for(const [nombre,faceta] of pruebas){
 const u=new URL('https://www.saij.gob.ar/busqueda');
 u.search=new URLSearchParams({q:'que la de el y en',o:'0',p:'1',f:faceta}).toString();
 try {
  const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; acervo de jurisprudencia)',Referer:'https://www.saij.gob.ar/'},signal:AbortSignal.timeout(20000)});
  const j=r.ok?await r.json():null;
  const n=j?.searchResults?.categoriesResultList?.find(x=>x.facetName==='Total')?.facetChildren?.[0]?.facetHits??null;
  salida.push({nombre,status:r.status,total:n,devueltos:j?.searchResults?.documentResultList?.length??0,campos:j?.searchResults?Object.keys(j.searchResults).slice(0,8):[]});
 }catch(e){salida.push({nombre,error:String(e.message)})}
}
console.log(JSON.stringify(salida,null,2));
if(salida.every(x=>x.status!==200)) process.exitCode=2;
