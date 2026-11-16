/* Cliente compartido para leer datos de la AIF (aif.org.ar). La AIF arma
   sus propias pantallas llamando a este mismo servicio JSON (JSONP)
   desde el navegador; acá lo leemos igual pero del lado del servidor
   (Vercel), porque aif.org.ar no se puede leer directo desde el
   navegador del usuario por CORS. Lo usan tanto api/aif.js (fixture de
   la temporada actual) como api/aif-historial.js (carga de temporadas
   viejas, partido por partido). */

const JSON_BASE = 'https://saupureinconsulting.com.ar/aifzn/json';

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

/* igual que jsonp, pero garantiza un array (la AIF a veces devuelve null
   o un objeto vacío en vez de "[]" cuando no hay nada) */
async function jsonpLista(path, params){
  const d = await jsonp(path, params);
  return Array.isArray(d) ? d : [];
}

/* procesa la lista de a una por vez (no en paralelo: ver jsonp arriba) */
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

module.exports = { jsonp, jsonpLista, esperar, enSerie, aFechaISO, CATEGORIAS_AIF, JSON_BASE };
