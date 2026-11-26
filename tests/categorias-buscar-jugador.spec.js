const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* En la solapa Categorías, antes de elegir una categoría puntual, ahora se
   puede buscar un jugador por nombre con texto predictivo (misma base de
   jugadores que usa "agregar jugador existente") para ir directo a su
   ficha sin tener que entrar primero a su categoría y buscarlo ahí. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);

t('Hay un buscador por nombre', (await pg.locator('#buscar-jugador-cat').count())===1);
t('Sin escribir nada, no se muestran resultados (ni se rompe el listado de categorías)',
  (await pg.locator('#resultados-busqueda-cat').innerText())==='' && (await pg.locator('[data-entrarCat]').count())>=5);

await pg.fill('#buscar-jugador-cat', 'r'); await pg.waitForTimeout(200);
t('Con 1 letra, pide escribir más', (await pg.locator('#resultados-busqueda-cat').innerText()).includes('al menos 2 letras') || (await pg.locator('#resultados-busqueda-cat').innerText())==='');

const algunJugador = await pg.evaluate(()=>{
  const j = db.jugadores.find(x=>(x.categorias||[]).length);
  return { id:j.id, nombre:j.nombre, apellido:j.apellido, categorias:j.categorias };
});
const letras = algunJugador.apellido.slice(0,3);
await pg.fill('#buscar-jugador-cat', letras); await pg.waitForTimeout(250);
t('Aparece como resultado', (await pg.locator(`[data-jugador="${algunJugador.id}"]`).count())===1);
t('El foco se queda en el input mientras tipea (no se pierde con cada letra)',
  (await pg.evaluate(()=>document.activeElement && document.activeElement.id))==='buscar-jugador-cat');
t('El listado de categorías sigue visible debajo (no lo tapa la búsqueda)', (await pg.locator('[data-entrarCat]').count())>=5);

await pg.click(`[data-jugador="${algunJugador.id}"]`); await pg.waitForTimeout(300);
t('Tocar el resultado abre directo la ficha del jugador (sin pasar por su categoría)',
  (await pg.locator('.ficha-name').innerText()).toUpperCase().includes(algunJugador.apellido.toUpperCase()));

await pg.click('[data-back]'); await pg.waitForTimeout(300);
await pg.fill('#buscar-jugador-cat', 'zzzznadie'); await pg.waitForTimeout(250);
t('Un nombre que no existe avisa que no encontró a nadie', (await pg.locator('#resultados-busqueda-cat').innerText()).includes('No encontramos'));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
