/* Trae de la AIF (aif.org.ar) el fixture/resultados de Haras Santa María
   para una categoría puntual de la app, y se los devuelve ya masticados
   al navegador. Corre en Vercel (no en el navegador del usuario) porque
   la AIF no permite leerla directo desde JS por CORS. Ver api/_lib/aifClient.js
   para el detalle de cómo se lee la AIF (es JSONP, sin API pública documentada). */

const { jsonp, jsonpLista, enSerie, aFechaISO, CATEGORIAS_AIF } = require('./_lib/aifClient');

async function traerPartidosDe(categoriaApp){
  const cfg = CATEGORIAS_AIF[categoriaApp];
  if (!cfg) throw new Error(`Categoría no reconocida: ${categoriaApp}`);

  const temporadas = await jsonpLista('jstemporadas.php', {});
  const temporadaActual = temporadas.reduce((max,t)=> Number(t.id)>Number(max.id)?t:max);

  const torneos = await jsonpLista('jstorneos.php', {
    idtemporada: temporadaActual.id, idcategoria: cfg.idcategoria, iddivision: cfg.iddivision
  });

  const partidos = [];
  await enSerie(torneos, async (torneo) => {
    const fechas = await jsonpLista('jsfechastorneo.php', { idtorneo: torneo.id });
    await enSerie(fechas, async (fecha) => {
      const filas = await jsonpLista('jsfixturetorneo.php', { idtorneo: torneo.id, idfecha: fecha.id });
      filas.forEach(f => {
        const esLocal = (f.equipolocal||'').trim() === cfg.equipo;
        const esVisitante = (f.equipovisitante||'').trim() === cfg.equipo;
        if (!esLocal && !esVisitante) return;
        const jugado = f.esfinalizado==='1' && f.espendienterevision!=='1'
          && f.goleslocal!=null && f.golesvisitantes!=null;
        partidos.push({
          torneo: torneo.torneo,
          rival: esLocal ? f.equipovisitante : f.equipolocal,
          fecha: aFechaISO(f.fechajuego),
          hora: f.hora ? f.hora.slice(0,5) : null,
          esLocal,
          jugado,
          golesPropios: jugado ? Number(esLocal ? f.goleslocal : f.golesvisitantes) : null,
          golesRival:   jugado ? Number(esLocal ? f.golesvisitantes : f.goleslocal) : null,
          cancha: f.cancha || null,
          arbitro: f.arbitro || null,
          pendienteRevision: f.espendienterevision==='1',
        });
      });
    });
  });

  partidos.sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''));
  return partidos;
}

module.exports = async (req, res) => {
  const categoria = (req.query.categoria || '').trim();
  if (!CATEGORIAS_AIF[categoria]){
    res.status(400).json({ error: 'categoria inválida', categorias: Object.keys(CATEGORIAS_AIF) });
    return;
  }
  try{
    const partidos = await traerPartidosDe(categoria);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ categoria, partidos });
  }catch(e){
    res.status(502).json({ error: 'No se pudo leer la AIF', detalle: String(e && e.message || e) });
  }
};

module.exports.traerPartidosDe = traerPartidosDe;
module.exports.CATEGORIAS_AIF = CATEGORIAS_AIF;
/* la AIF es lenta y hay que pedirle las cosas de a una (ver jsonp arriba),
   así que una categoría con varios torneos puede tardar unos 15-20s */
module.exports.config = { maxDuration: 60 };
