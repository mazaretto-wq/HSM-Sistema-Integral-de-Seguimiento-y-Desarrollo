/* Trae de la AIF (aif.org.ar) el fixture/resultados de Haras Santa María
   para una categoría puntual de la app, y se los devuelve ya masticados
   al navegador. Corre en Vercel (no en el navegador del usuario) porque
   la AIF no permite leerla directo desde JS por CORS.

   La AIF no tiene una API pública documentada: arma sus propias pantallas
   llamando a este mismo servicio JSON (JSONP) desde el navegador. Lo
   leemos del mismo modo, pero del lado del servidor. */

const JSON_BASE = 'https://saupureinconsulting.com.ar/aifzn/json';

/* categoría de la app -> cómo pedirla en la AIF. "equipo" es el nombre
   EXACTO con el que la AIF identifica a Haras Santa María en esa
   categoría (confirmado contra la API real: Juveniles B juega como
   "HARAS SANTA MARIA B", todo el resto como "HARAS SANTA MARIA") */
const CATEGORIAS_AIF = {
  'Promocional':  { idcategoria: 6, iddivision: 1, equipo: 'HARAS SANTA MARIA' },
  'Cadetes':      { idcategoria: 7, iddivision: 1, equipo: 'HARAS SANTA MARIA' },
  'Juveniles':    { idcategoria: 1, iddivision: 1, equipo: 'HARAS SANTA MARIA' },
  'Juveniles B':  { idcategoria: 1, iddivision: 3, equipo: 'HARAS SANTA MARIA B' },
  'Selección':    { idcategoria: 8, iddivision: 3, equipo: 'HARAS SANTA MARIA' },
};

const esperar = ms => new Promise(r => setTimeout(r, ms));

/* el servidor de la AIF se cuelga (devuelve vacío) si le llegan varios
   pedidos a la vez, así que va uno por vez, con un par de reintentos */
async function jsonp(path, params, intentos = 4){
  const qs = new URLSearchParams({ ...params, callback: 'cb' });
  const url = `${JSON_BASE}/${path}?${qs}`;
  for (let i=1; i<=intentos; i++){
    try{
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`respondió ${r.status}`);
      const texto = await r.text();
      const ini = texto.indexOf('(');
      const fin = texto.lastIndexOf(')');
      if (ini===-1 || fin===-1) throw new Error('no devolvió JSONP válido (vacío o caído)');
      await esperar(120); // un respiro entre pedidos: el servidor de la AIF se cae si lo saturan
      return JSON.parse(texto.slice(ini+1, fin));
    }catch(e){
      if (i===intentos) throw new Error(`${path}: ${e.message}`);
      await esperar(400*i);
    }
  }
}

/* procesa la lista de a una por vez (no en paralelo, ver jsonp arriba) */
async function enSerie(items, fn){
  const resultados = [];
  for (const item of items) resultados.push(await fn(item));
  return resultados;
}

function aFechaISO(fechajuego){
  // la AIF manda "DD-MM-YYYY"
  const [d,m,a] = (fechajuego||'').split('-');
  if (!d||!m||!a) return null;
  return `${a}-${m}-${d}`;
}

async function traerPartidosDe(categoriaApp){
  const cfg = CATEGORIAS_AIF[categoriaApp];
  if (!cfg) throw new Error(`Categoría no reconocida: ${categoriaApp}`);

  const temporadas = await jsonp('jstemporadas.php', {});
  const temporadaActual = temporadas.reduce((max,t)=> Number(t.id)>Number(max.id)?t:max);

  const torneos = await jsonp('jstorneos.php', {
    idtemporada: temporadaActual.id, idcategoria: cfg.idcategoria, iddivision: cfg.iddivision
  });

  const partidos = [];
  await enSerie(torneos, async (torneo) => {
    const fechas = await jsonp('jsfechastorneo.php', { idtorneo: torneo.id });
    await enSerie(fechas, async (fecha) => {
      const filas = await jsonp('jsfixturetorneo.php', { idtorneo: torneo.id, idfecha: fecha.id });
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
