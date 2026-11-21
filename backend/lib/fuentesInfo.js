/**
 * Metadatos de autoridad, procedencia y alcance de las fuentes automáticas.
 *
 * La clasificación describe qué es realmente cada repositorio. No convierte
 * un sumario en sentencia, una base agregadora en tribunal ni doctrina en
 * precedente. Se devuelve en cada respuesta para que la interfaz pueda
 * explicar al usuario qué está mirando.
 */
import { PROVINCIAS_PRIORIZADAS } from './indiceProvincialSaij.js';

const INFO = {
  mendoza: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Fallos y sumarios judiciales',
    procedencia: 'Poder Judicial de Mendoza',
    jurisdiccion: 'Mendoza, Argentina',
    cobertura: 'Suprema Corte y tribunales provinciales que publica el buscador; la cobertura depende del tribunal y del material cargado.',
    modalidad: 'buscador_oficial',
    limite: 'La búsqueda automática reproduce los campos públicos del buscador. No garantiza cobertura integral de todos los fueros ni de primera instancia.',
    url: 'https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/consultar.php',
  },
  caba: {
    linea: 'Jurisprudencia local',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Tribunal Superior de Justicia',
    tipo: 'Sentencias judiciales',
    procedencia: 'Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires',
    jurisdiccion: 'Ciudad Autónoma de Buenos Aires, Argentina',
    cobertura: 'Decisiones publicadas por el TSJ de CABA.',
    modalidad: 'buscador_oficial',
    limite: 'No representa por sí solo a todos los juzgados y cámaras de la Ciudad. Algunos documentos se sirven como archivos descargables.',
    url: 'https://jurisprudencia.tsjbaires.gov.ar/jurisprudencia/resultadoBusqueda.asp',
  },
  saij: {
    linea: 'Jurisprudencia y documentación nacional',
    lineas: ['jurisprudencia', 'nacional', 'agregador', 'normativa', 'doctrina'],
    autoridad: 'Repositorio oficial agregador',
    tipo: 'Jurisprudencia, sumarios, legislación, doctrina y dictámenes',
    procedencia: 'Sistema Argentino de Información Jurídica (SAIJ)',
    jurisdiccion: 'Nacional y 24 jurisdicciones locales, según la faceta consultada',
    cobertura: 'Documentos publicados y clasificados por SAIJ. El volumen y tipo de documento varían por jurisdicción, tribunal y período.',
    modalidad: 'agregador_oficial',
    limite: 'No sustituye la ficha ni el documento del tribunal de origen. La faceta, el tipo documental y el enlace original deben conservarse.',
    url: 'https://www.saij.gob.ar/',
  },
  csjn: {
    linea: 'Jurisprudencia de tribunal superior',
    lineas: ['jurisprudencia', 'nacional', 'primaria'],
    autoridad: 'Corte Suprema de Justicia de la Nación; copia consultada vía agregador',
    tipo: 'Fichas de fallos y sumarios atribuidos a la CSJN',
    procedencia: 'SAIJ, con faceta de tribunal CSJN',
    jurisdiccion: 'Federal, Argentina',
    cobertura: 'Documentos que SAIJ atribuye a la Corte Suprema y que devuelve su faceta pública.',
    modalidad: 'agregador_oficial',
    limite: 'La consulta no se realiza en el portal directo de la CSJN. Verificar el fallo original antes de citar y no confundir sumario con sentencia.',
    url: 'https://sjservicios.csjn.gov.ar/sj/',
  },
  dialnet: {
    linea: 'Doctrina académica',
    lineas: ['doctrina', 'academica', 'comparada'],
    autoridad: 'Índice académico',
    tipo: 'Artículos, revistas, tesis y referencias bibliográficas',
    procedencia: 'Dialnet · Universidad de La Rioja',
    jurisdiccion: 'Internacional, con importante producción en español',
    cobertura: 'Referencias académicas indexadas; el texto completo depende del repositorio/editor.',
    modalidad: 'indice_academico',
    limite: 'No es una base de sentencias ni confirma expedientes, hechos procesales o jurisprudencia vigente.',
    url: 'https://dialnet.unirioja.es/',
  },
  mendozalegal: {
    linea: 'Jurisprudencia seleccionada y comentario',
    lineas: ['jurisprudencia', 'doctrina', 'editorial'],
    autoridad: 'Publicación editorial',
    tipo: 'Fallos seleccionados y sumarios editoriales',
    procedencia: 'Mendoza Legal',
    jurisdiccion: 'Mendoza, Argentina',
    cobertura: 'Selección editorial de decisiones y comentarios publicados por la revista.',
    modalidad: 'seleccion_editorial',
    limite: 'La selección no es exhaustiva ni equivale a una base institucional. Confirmar cada fallo en el tribunal de origen.',
    url: 'https://mendozalegal.com/',
  },
  corteidh: {
    linea: 'Derechos humanos e internacional',
    lineas: ['jurisprudencia', 'internacional', 'ddhh', 'primaria'],
    autoridad: 'Tribunal internacional oficial',
    tipo: 'Sentencias, opiniones consultivas y resoluciones',
    procedencia: 'Corte Interamericana de Derechos Humanos',
    jurisdiccion: 'Sistema Interamericano de Derechos Humanos',
    cobertura: 'Decisiones y documentos publicados por la Corte IDH.',
    modalidad: 'buscador_oficial',
    limite: 'No es jurisprudencia de tribunales argentinos. La fuerza y los efectos de cada decisión deben analizarse según el instrumento y el caso.',
    url: 'https://www.corteidh.or.cr/',
  },
  rionegro: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Sentencias judiciales con texto y documentos asociados',
    procedencia: 'Poder Judicial de Río Negro',
    jurisdiccion: 'Río Negro, Argentina',
    cobertura: 'Protocolo web del Poder Judicial, con las instancias y organismos que expone el buscador.',
    modalidad: 'buscador_oficial',
    limite: 'La consulta depende de la cobertura publicada y de los filtros que ofrece el portal.',
    url: 'https://jusrionegro.gov.ar/',
  },
  juristeca: {
    linea: 'Jurisprudencia de cámaras',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Repositorio institucional del Consejo de la Magistratura',
    tipo: 'Sentencias de cámaras y tribunales de la Ciudad',
    procedencia: 'Juristeca · Consejo de la Magistratura de CABA',
    jurisdiccion: 'Ciudad Autónoma de Buenos Aires, Argentina',
    cobertura: 'Decisiones de las cámaras y fueros incluidos en el repositorio.',
    modalidad: 'buscador_oficial',
    limite: 'No sustituye al buscador del TSJ ni comprende necesariamente todos los tribunales de CABA.',
    url: 'https://juristeca.jusbaires.gob.ar/',
  },
  santafe: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Sumarios y sentencias',
    procedencia: 'Corte Suprema de Justicia de Santa Fe',
    jurisdiccion: 'Santa Fe, Argentina',
    cobertura: 'Material jurisprudencial publicado por la Corte Suprema provincial.',
    modalidad: 'buscador_oficial',
    limite: 'La cobertura se circunscribe al repositorio y a los períodos publicados.',
    url: 'https://www.justiciasantafe.gov.ar/',
  },
  jujuy: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Sumarios oficiales y sentencias a texto completo',
    procedencia: 'Poder Judicial de Jujuy · Sistema de Jurisprudencia',
    jurisdiccion: 'Jujuy, Argentina',
    cobertura: 'Sentencias y autos de los organismos jurisdiccionales de Jujuy y dictámenes de la Fiscalía General ante el STJ.',
    modalidad: 'buscador_oficial',
    limite: 'Según su aviso legal, no incluye los tribunales de Familia, Menores y Penales. El texto es informativo: sólo los protocolos de sentencias y sus copias fieles agregadas al expediente son documentos auténticos.',
    url: 'https://jurisprudencia.justiciajujuy.gov.ar/',
  },
  catamarca: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria', 'acervo_local'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Sentencias y sumarios',
    procedencia: 'Poder Judicial de Catamarca',
    jurisdiccion: 'Catamarca, Argentina',
    cobertura: 'Material institucional incorporado por tandas al acervo propio.',
    modalidad: 'cosecha_local',
    limite: 'La búsqueda se ejecuta sobre la copia jurisprudencial indexada, no sobre una API oficial en vivo. Mostrar siempre su fecha y alcance de actualización.',
    url: 'https://www.justiciacatamarca.gob.ar/',
  },
  chubut: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Superior Tribunal de Justicia de Chubut',
    tipo: 'Sentencias anonimizadas y sumarios',
    procedencia: 'Poder Judicial de Chubut · Eureka!',
    jurisdiccion: 'Chubut, Argentina',
    cobertura: 'Documentos públicos del sistema Eureka! accesibles en modo anónimo: sentencias anonimizadas y sumarios.',
    modalidad: 'api_publica_anonima',
    limite: 'No se accede a fallos sin anonimizar ni a expedientes reservados. El endpoint de PDF se ofrece sólo en modo público.',
    url: 'https://apps1cloud.juschubut.gov.ar/eureka',
  },
  tfn: {
    linea: 'Jurisprudencia administrativa tributaria',
    lineas: ['jurisprudencia', 'administrativo', 'tributario', 'primaria'],
    autoridad: 'Tribunal administrativo con funciones jurisdiccionales',
    tipo: 'Resoluciones y fallos tributarios y aduaneros',
    procedencia: 'Tribunal Fiscal de la Nación · API de jurisprudencia',
    jurisdiccion: 'Nacional, Argentina',
    cobertura: 'Resoluciones, fallos del TFN y decisiones de la CNCAF que expone la API pública.',
    modalidad: 'api_publica_con_ia',
    limite: 'La API no documenta paginación; los resultados por término son muestras. Parte de los objetos y doctrinas son extraídos o clasificados con IA y se identifican como tales.',
    url: 'https://jurisprudenciatfn.mecon.gob.ar/',
  },
  santacruz: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Tribunal Superior de Justicia de Santa Cruz',
    tipo: 'Fallos, sumarios y extractos temáticos asistidos por IA',
    procedencia: 'Tribunal Superior de Justicia de Santa Cruz · buscador inteligente',
    jurisdiccion: 'Santa Cruz, Argentina',
    cobertura: 'Fallos, sumarios y extractos temáticos expuestos por el buscador oficial.',
    modalidad: 'api_publica_con_ia',
    limite: 'Los extractos y doctrinas generados o clasificados por IA no son texto literal de la sentencia. La API no documenta paginación; cada búsqueda entrega una muestra.',
    url: 'https://jurisprudencia.jussantacruz.gob.ar/',
  },
  hudoc: {
    linea: 'Jurisprudencia internacional · derechos humanos',
    lineas: ['jurisprudencia', 'internacional', 'ddhh', 'primaria'],
    autoridad: 'Tribunal Europeo de Derechos Humanos',
    tipo: 'Sentencias, decisiones y casos comunicados',
    procedencia: 'TEDH · base oficial HUDOC',
    jurisdiccion: 'Consejo de Europa',
    cobertura: 'Documentos del Tribunal Europeo de Derechos Humanos indexados por HUDOC, con filtros de tipo e idioma.',
    modalidad: 'api_publica',
    limite: 'No es jurisprudencia argentina. Los títulos y metadatos no sustituyen la lectura de la sentencia oficial; los textos pueden estar en inglés o francés.',
    url: 'https://hudoc.echr.coe.int/',
  },
  scba: {
    linea: 'Jurisprudencia provincial',
    lineas: ['jurisprudencia', 'provincial', 'primaria'],
    autoridad: 'Órgano judicial oficial',
    tipo: 'Sumarios de jurisprudencia y enlaces a sentencias',
    procedencia: 'Suprema Corte de Justicia de la Provincia de Buenos Aires · JUBA',
    jurisdiccion: 'Provincia de Buenos Aires, Argentina',
    cobertura: 'Sumarios de la Suprema Corte y cámaras que se encuentran publicados en JUBA.',
    modalidad: 'buscador_oficial',
    limite: 'El sumario y el fallo íntegro son objetos distintos. La lista de sentencias propias de la SCBA es un complemento, no un reemplazo del material de cámaras.',
    url: 'https://www.scba.gov.ar/',
  },
};

for (const [slug, provincia] of Object.entries(PROVINCIAS_PRIORIZADAS)) {
  INFO[slug] = {
    linea: 'Jurisprudencia provincial vía agregador',
    lineas: ['jurisprudencia', 'provincial', 'agregador'],
    autoridad: 'Repositorio oficial agregador; no es el poder judicial provincial',
    tipo: 'Sumarios y documentos jurisprudenciales publicados por SAIJ',
    procedencia: 'SAIJ · faceta de jurisdicción local',
    jurisdiccion: provincia + ', Argentina',
    cobertura: 'Documentación de ' + provincia + ' incluida en la faceta provincial de SAIJ.',
    modalidad: 'agregador_oficial',
    limite: 'No es una conexión directa al poder judicial de ' + provincia + '. Verificar el documento en el tribunal de origen.',
    url: 'https://www.saij.gob.ar/',
  };
}

export function informacionFuente(slug, opciones = {}) {
  const info = INFO[String(slug || '')];
  if (!info) return null;
  const salida = { slug, ...info };

  // SAIJ no es una sola línea de investigación: el selector del buscador
  // puede pedir jurisprudencia, legislación, doctrina o dictámenes. La
  // metadata debe reflejar el carril realmente consultado.
  if (slug === 'saij') {
    const tipo = String(opciones.tribunal || 'sumarios').toLowerCase();
    const porTipo = {
      legislacion: { linea: 'Normativa', tipo: 'Legislación y texto normativo', lineas: ['normativa', 'agregador'] },
      doctrina: { linea: 'Doctrina jurídica', tipo: 'Doctrina y comentarios', lineas: ['doctrina', 'academica', 'agregador'] },
      dictamenes: { linea: 'Derecho administrativo y dictámenes', tipo: 'Dictámenes de organismos públicos', lineas: ['administrativo', 'agregador'] },
      fallos: { linea: 'Jurisprudencia · fichas de fallos', tipo: 'Fichas de sentencias judiciales', lineas: ['jurisprudencia', 'nacional', 'agregador'] },
      sumarios: { linea: 'Jurisprudencia · sumarios', tipo: 'Sumarios jurisprudenciales', lineas: ['jurisprudencia', 'nacional', 'agregador'] },
      todo: { linea: 'Jurisprudencia y documentación nacional', tipo: 'Jurisprudencia y documentación jurídica', lineas: ['jurisprudencia', 'normativa', 'doctrina', 'administrativo', 'agregador'] },
    };
    Object.assign(salida, porTipo[tipo] || porTipo.sumarios);
    const provincia = String(opciones.provincia || '').trim();
    if (provincia) {
      salida.linea = 'Jurisprudencia provincial · ' + provincia;
      salida.jurisdiccion = provincia + ', Argentina';
      salida.lineas = ['jurisprudencia', 'provincial', 'agregador'];
      salida.cobertura = 'Documentación de ' + provincia + ' devuelta por la faceta territorial de SAIJ; el alcance depende del material publicado.';
    }
  }
  return salida;
}

export function catalogoFuentesIntegradas() {
  return Object.entries(INFO).map(([slug]) => informacionFuente(slug));
}

export function anotarProcedencia(slug, resultados = [], opciones = {}) {
  const info = informacionFuente(slug, opciones);
  if (!info) return resultados;
  return resultados.map((r) => ({
    ...r,
    fuenteSlug: r.fuenteSlug || slug,
    procedencia: r.procedencia || info.procedencia,
    tipoDocumento: r.tipoDocumento || info.tipo,
    nivelAutoridad: r.nivelAutoridad || info.autoridad,
    jurisdiccion: r.jurisdiccion || info.jurisdiccion,
    lineaInvestigacion: r.lineaInvestigacion || info.linea,
  }));
}
