/* Trae de la AIF el historial de UNA categoría en UNA temporada puntual:
   por cada jugador de Haras Santa María que encuentre, cuántos partidos
   jugó, goles, amarillas y rojas. No incluye Juveniles (esa categoría
   ya tiene su propio historial cargado a mano, no hay que tocarlo).

   A diferencia de api/aif.js (fixture de la temporada EN CURSO, con
   división fija), acá se recorren TODAS las divisiones de esa categoría
   en esa temporada, porque en 6 años para atrás no se puede asumir que
   el equipo siempre jugó en la misma ("Primera A").

   La AIF no da los minutos jugados de cada uno (solo quién jugó, no
   cuánto rato) ni las asistencias: por eso esos dos campos siempre
   vuelven en 0, para que quien revise sepa que faltan y los complete. */

const { jsonp, jsonpLista, enSerie, CATEGORIAS_AIF } = require('./_lib/aifClient');

/* Juveniles queda afuera a propósito: ese historial ya está cargado a
   mano y no hay que pisarlo con los datos (incompletos) de la AIF */
const CATEGORIAS_HISTORIAL = Object.fromEntries(
  Object.entries(CATEGORIAS_AIF).filter(([cat]) => cat!=='Juveniles')
);

function normNombre(s){
  return (s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/,/g,' ').replace(/\s+/g,' ').trim();
}

/* un año entero (varias divisiones × varios torneos × ~10 fechas, con 3
   pedidos extra por partido) tarda demasiado para una sola invocación:
   se mide en minutos, no en segundos. Por eso esto se separa en dos
   pasos que el cliente encadena: primero "listarTorneosDe" (rápido, solo
   descubre qué torneos hay esa temporada) y después UN pedido de
   "traerHistorialDe" POR TORNEO, que es lo que de verdad recorre
   partido por partido y sí entra cómodo en el límite de un ratito. */
async function listarTorneosDe(categoriaApp, anio){
  const cfg = CATEGORIAS_HISTORIAL[categoriaApp];
  if (!cfg) throw new Error(`Categoría no reconocida para historial: ${categoriaApp}`);

  const temporadas = await jsonpLista('jstemporadas.php', {});
  const temporada = temporadas.find(t => String(t.temporada)===String(anio));
  if (!temporada) return [];

  const divisiones = await jsonpLista('jsdivisiones.php', { idtemporada: temporada.id, idcategoria: cfg.idcategoria });
  const torneos = [];
  await enSerie(divisiones, async (div) => {
    const deEsaDivision = await jsonpLista('jstorneos.php', {
      idtemporada: temporada.id, idcategoria: cfg.idcategoria, iddivision: div.id
    });
    deEsaDivision.forEach(t => torneos.push({ idtorneo: t.id, nombre: t.torneo, division: div.division }));
  });
  return torneos;
}

async function traerHistorialDe(categoriaApp, anio, idtorneo){
  const cfg = CATEGORIAS_HISTORIAL[categoriaApp];
  if (!cfg) throw new Error(`Categoría no reconocida para historial: ${categoriaApp}`);

  const porPersona = {};
  let partidosEncontrados = 0;

  /* junta por idjugador cuando lo hay; si no, por nombre normalizado (ver
     notas en el script de investigación: formación/goles dan idjugador
     confiable, pero los que entran de cambio solo traen el nombre) */
  const obtenerPersona = (nombreCrudo, idjugador) => {
    const nombreNorm = normNombre(nombreCrudo);
    if (idjugador){
      const keyId = 'id:'+idjugador;
      if (porPersona[keyId]) return porPersona[keyId];
      const porNombre = Object.entries(porPersona).find(([,p])=>normNombre(p.nombre)===nombreNorm);
      if (porNombre){
        const [keyViejo, p] = porNombre;
        delete porPersona[keyViejo];
        p.idjugador = idjugador;
        porPersona[keyId] = p;
        return p;
      }
      return (porPersona[keyId] = { nombre:nombreCrudo, idjugador, partidos:new Set(), goles:0, ta:0, tr:0 });
    }
    const porNombre = Object.values(porPersona).find(p=>normNombre(p.nombre)===nombreNorm);
    if (porNombre) return porNombre;
    const keyNombre = 'nombre:'+nombreNorm;
    return (porPersona[keyNombre] = { nombre:nombreCrudo, idjugador:null, partidos:new Set(), goles:0, ta:0, tr:0 });
  };

  const fechas = await jsonpLista('jsfechastorneo.php', { idtorneo });
  await enSerie(fechas, async (fecha) => {
    const filas = await jsonpLista('jsfixturetorneo.php', { idtorneo, idfecha: fecha.id });
    await enSerie(filas, async (f) => {
      const esLocal = (f.equipolocal||'').trim() === cfg.equipo;
      const esVisitante = (f.equipovisitante||'').trim() === cfg.equipo;
      if (!esLocal && !esVisitante) return;
      if (f.esfinalizado !== '1') return; // solo partidos ya jugados/confirmados
      partidosEncontrados++;
      const localiaBuscada = esLocal ? 'local' : 'visitante';
      const ordenBuscado = esLocal ? '1' : '2';

      const formacion = await jsonpLista('jsresultadosformacion.php', { idfixture: f.id });
      formacion.filter(x=>x.orden===ordenBuscado).forEach(x=>{
        obtenerPersona(x.jugador, x.idjugador).partidos.add(f.id);
      });

      const cambios = await jsonpLista('jsresultadosformacioncambios.php', { idfixture: f.id });
      cambios.filter(x=>x.orden===ordenBuscado).forEach(x=>{
        obtenerPersona(x.jugadorentra, null).partidos.add(f.id);
      });

      const detalle = await jsonpLista('jsfixturedetalle.php', { idfixture: f.id, idtorneo });
      detalle.filter(x=>x.localia===localiaBuscada).forEach(x=>{
        const p = obtenerPersona((x.jugador||'').replace(',', ' '), x.idjugador);
        p.partidos.add(f.id);
        p.goles += Number(x.goles||0);
        p.ta += Number(x.amonestados||0) + Number(x.dobleamarilla||0);
        p.tr += Number(x.expulsados||0) + Number(x.dobleamarilla||0);
      });
    });
  });

  const jugadores = Object.values(porPersona).map(p => ({
    idjugadorAif: p.idjugador, nombreAif: p.nombre,
    pj: p.partidos.size, goles: p.goles, ta: p.ta, tr: p.tr
  })).sort((a,b)=>b.pj-a.pj);

  return { categoria: categoriaApp, anio: String(anio), partidosEncontrados, jugadores };
}

/* dos modos, según venga o no "idtorneo":
   - sin idtorneo: devuelve la LISTA de torneos de esa categoría/año (rápido)
   - con idtorneo: recorre ESE torneo partido por partido (lo que tarda) */
module.exports = async (req, res) => {
  const categoria = (req.query.categoria || '').trim();
  const anio = (req.query.anio || '').trim();
  const idtorneo = (req.query.idtorneo || '').trim();
  if (!CATEGORIAS_HISTORIAL[categoria]){
    res.status(400).json({ error: 'categoria inválida', categorias: Object.keys(CATEGORIAS_HISTORIAL) });
    return;
  }
  if (!/^\d{4}$/.test(anio)){
    res.status(400).json({ error: 'año inválido' });
    return;
  }
  try{
    if (!idtorneo){
      const torneos = await listarTorneosDe(categoria, anio);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ categoria, anio, torneos });
      return;
    }
    const resultado = await traerHistorialDe(categoria, anio, idtorneo);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(resultado);
  }catch(e){
    res.status(502).json({ error: 'No se pudo leer la AIF', detalle: String(e && e.message || e) });
  }
};

module.exports.listarTorneosDe = listarTorneosDe;
module.exports.traerHistorialDe = traerHistorialDe;
module.exports.CATEGORIAS_HISTORIAL = CATEGORIAS_HISTORIAL;
/* un torneo puede tener ~10 fechas con 3 pedidos extra cada partido:
   normalmente entra en un rato, pero por las dudas queda con margen */
module.exports.config = { maxDuration: 60 };
