/* Trae de la AIF el historial de los jugadores ACTUALES del plantel de
   una categoría: primero el plantel de Haras Santa María en esa
   categoría (vía el equipo de la temporada en curso) y, jugador por
   jugador, su historial completo temporada a temporada (partidos
   jugados, minutos, goles, amarillas, rojas). No incluye Juveniles
   (esa categoría ya tiene su propio historial cargado a mano).

   A diferencia del fixture/resultados (api/aif.js), esto usa la ficha
   de cada jugador en la AIF (equipos/jugadores/?id_jugador=X), que SÍ
   trae los minutos jugados por temporada — el fixture partido a partido
   no los tiene. Lo único que la AIF nunca da son las asistencias.

   Mucho más rápido que recorrer partido por partido: un pedido para el
   plantel + uno por jugador (bastante menos de un minuto en total para
   todo un plantel), así que no hace falta trocearlo por torneo/año. */

const { jsonp, jsonpLista, enSerie, CATEGORIAS_AIF } = require('./_lib/aifClient');

/* Juveniles queda afuera a propósito: ese historial ya está cargado a
   mano y no hay que pisarlo con los datos (sin asistencias) de la AIF */
const CATEGORIAS_HISTORIAL = Object.fromEntries(
  Object.entries(CATEGORIAS_AIF).filter(([cat]) => cat!=='Juveniles')
);

async function traerIdEquipo(cfg, idtemporada){
  const equipos = await jsonpLista('jsequipos.php', { idtemporada, idcategoria: cfg.idcategoria, iddivision: cfg.iddivision });
  const match = equipos.find(e => (e.equipo||'').replace(/^\d+\s*-\s*/,'').trim() === cfg.equipo);
  return match ? match.id : null;
}

async function traerHistorialDe(categoriaApp, desde, hasta){
  const cfg = CATEGORIAS_HISTORIAL[categoriaApp];
  if (!cfg) throw new Error(`Categoría no reconocida para historial: ${categoriaApp}`);

  const temporadas = await jsonpLista('jstemporadas.php', {});
  const temporadaActual = temporadas.reduce((max,t)=> Number(t.id)>Number(max.id)?t:max);

  const idequipo = await traerIdEquipo(cfg, temporadaActual.id);
  if (!idequipo) return { categoria: categoriaApp, jugadores: [] }; // ese equipo no existe esta temporada en la AIF

  const plantel = await jsonpLista('jsequiposplantel.php', { idequipo });

  const jugadores = await enSerie(plantel, async (p) => {
    const historial = await jsonpLista('jsjugadorestadisticatemporada' + 'todas.php', { idjugador: p.id });
    const porAnio = {};
    historial.forEach(h => {
      const anio = Number(h.temporada);
      if (!anio || (desde && anio<desde) || (hasta && anio>hasta)) return;
      porAnio[h.temporada] = {
        pj: Number(h.pj||0), min: Number(h.minutos||0),
        goles: Number(h.goles||0), ta: Number(h.amonestaciones||0), tr: Number(h.expulsiones||0)
      };
    });
    return { idjugadorAif: p.id, apellido: p.apellido, nombre: p.nombre,
      nombreAif: `${p.apellido} ${p.nombre}`, porAnio };
  });

  return { categoria: categoriaApp, idequipo, jugadores: jugadores.filter(j=>Object.keys(j.porAnio).length) };
}

module.exports = async (req, res) => {
  const categoria = (req.query.categoria || '').trim();
  const desde = req.query.desde ? Number(req.query.desde) : null;
  const hasta = req.query.hasta ? Number(req.query.hasta) : null;
  if (!CATEGORIAS_HISTORIAL[categoria]){
    res.status(400).json({ error: 'categoria inválida', categorias: Object.keys(CATEGORIAS_HISTORIAL) });
    return;
  }
  try{
    const resultado = await traerHistorialDe(categoria, desde, hasta);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json(resultado);
  }catch(e){
    res.status(502).json({ error: 'No se pudo leer la AIF', detalle: String(e && e.message || e) });
  }
};

module.exports.traerHistorialDe = traerHistorialDe;
module.exports.CATEGORIAS_HISTORIAL = CATEGORIAS_HISTORIAL;
/* un plantel de ~25 jugadores es un pedido por jugador + un par de
   pedidos para resolver el equipo: unos 15-20s en total */
module.exports.config = { maxDuration: 60 };
