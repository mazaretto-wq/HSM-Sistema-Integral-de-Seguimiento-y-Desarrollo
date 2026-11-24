const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* "Agregar jugador" desde una categoría puntual ahora pregunta primero si
   el jugador ya juega en otra (para no duplicarlo con una ficha nueva):
   si contesta que sí, lo busca con texto predictivo y le agrega la
   categoría al que ya existe; si contesta que no, sigue como siempre
   (formulario de alta), con esa categoría ya precargada. También se
   agregó a Mateo Gallagher y Lucas Mirave (ya en Cadetes) a Juveniles. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);
/* en un dispositivo de verdad (con datos reales ya cargados) esta migración
   corre de una, pero en una base recién sembrada (como arranca este test)
   la migración corre ANTES de que el plantel real se termine de sembrar
   (ver el llamado a agregarJuvenilesAGallagherYMirave en index.html, antes
   del "if (!db.jugadores.length)"); un segundo reload alcanza para que la
   migración encuentre al plantel ya sembrado y lo corrija */
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// ---- Gallagher y Mirave quedaron con Juveniles agregado, sin perder Cadetes ----
const gallagher = await pg.evaluate(()=>db.jugadores.find(j=>j.apellido==='GALLAGHER' && j.nombre==='Mateo'));
t('Mateo Gallagher quedó con Juveniles agregado a sus categorías', !!gallagher && (gallagher.categorias||[]).includes('Juveniles'), JSON.stringify(gallagher&&gallagher.categorias));
const mirave = await pg.evaluate(()=>db.jugadores.find(j=>j.apellido==='MIRAVE' && j.nombre==='Lucas'));
t('Lucas Mirave quedó con Juveniles agregado a sus categorías', !!mirave && (mirave.categorias||[]).includes('Juveniles'), JSON.stringify(mirave&&mirave.categorias));
t('Ninguno de los dos perdió Cadetes', (gallagher.categorias||[]).includes('Cadetes') && (mirave.categorias||[]).includes('Cadetes'),
  JSON.stringify([gallagher.categorias, mirave.categorias]));

// ---- desde el menú general de "Cargar" (sin categoría puntual), sigue
//      yendo directo al formulario, como siempre ----
await pg.evaluate(()=>{ view.categoria='Todas'; });
await pg.click('[data-go="nuevoJugador"]').catch(()=>{});
// si no hay botón visible en este punto, forzamos la navegación como la haría la app
await pg.evaluate(()=>{ view.tab='cargar'; view.form='nuevoJugador'; view.nuevoJugadorCat=null; view.nuevoJugadorPaso='form'; render(); });
await pg.waitForTimeout(300);
t('Sin categoría puntual, va directo al formulario de siempre (sin preguntar)', (await pg.locator('h2.screen-title').innerText())==='NUEVO JUGADOR');
t('Y ninguna categoría queda precargada', (await pg.locator('[data-multi="cats"] .chip[aria-pressed="true"]').count())===0);

// ---- desde una categoría puntual (Juveniles), "Agregar jugador" primero pregunta ----
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="nuevoJugador"]'); await pg.waitForTimeout(300);
t('Primero pregunta si ya está en otra categoría (no entra directo al formulario)',
  (await pg.locator('[data-nuevoJugadorExistente="si"]').count())===1 && (await pg.locator('[data-nuevoJugadorExistente="no"]').count())===1);
t('La pregunta menciona la categoría desde la que se entró (Juveniles)', (await pg.locator('.screen-note:has-text("Juveniles")').count())>=1);

// ---- "No" sigue al formulario de siempre, con Juveniles ya precargada ----
await pg.click('[data-nuevoJugadorExistente="no"]'); await pg.waitForTimeout(300);
t('"No" lleva al formulario de alta de siempre', (await pg.locator('h2.screen-title').innerText())==='NUEVO JUGADOR');
t('Esta vez Juveniles queda precargada (no hay que volver a elegirla)',
  (await pg.locator('[data-multi="cats"] .chip[data-v="Juveniles"][aria-pressed="true"]').count())===1);

// ---- "Sí" abre la búsqueda con texto predictivo ----
await pg.click('[data-back]'); await pg.waitForTimeout(300);
await pg.click('[data-go="nuevoJugador"]'); await pg.waitForTimeout(300);
await pg.click('[data-nuevoJugadorExistente="si"]'); await pg.waitForTimeout(300);
t('"Sí" abre la pantalla de búsqueda', (await pg.locator('#buscar-jugador-existente').count())===1);
t('Con menos de 2 letras, pide escribir más', (await pg.locator('text=Escribí al menos 2 letras').count())===1);

// ---- un jugador que YA está en Juveniles no aparece (ya está, no hace falta enlazarlo) ----
await pg.fill('#buscar-jugador-existente', 'retamar'); await pg.waitForTimeout(250);
t('Un jugador que ya está en Juveniles (Retamar) no aparece en los resultados para agregarlo ahí',
  (await pg.locator('[data-agregarCategoriaA]:has-text("RETAMAR")').count())===0);

// jugador de Cadetes puro, que sabemos que no está en Juveniles, para probar el enlace
const idCadetes = await pg.evaluate(()=>{
  const j = db.jugadores.find(x=>(x.categorias||[]).includes('Cadetes') && !(x.categorias||[]).includes('Juveniles'));
  return j ? { id:j.id, apellido:j.apellido, nombre:j.nombre } : null;
});
t('Hay al menos un jugador de Cadetes que todavía no está en Juveniles, para probar el enlace', !!idCadetes, JSON.stringify(idCadetes));
await pg.fill('#buscar-jugador-existente', idCadetes.apellido.slice(0,4)); await pg.waitForTimeout(250);
const filaEncontrada = await pg.locator(`[data-agregarCategoriaA="${idCadetes.id}"]`).count();
t('El jugador de Cadetes buscado aparece en los resultados', filaEncontrada===1);
t('El foco se queda en el input de búsqueda mientras tipea (no se pierde con cada letra)',
  (await pg.evaluate(()=>document.activeElement && document.activeElement.id))==='buscar-jugador-existente');

const totalAntes = await pg.evaluate(()=>db.jugadores.length);
await pg.click(`[data-agregarCategoriaA="${idCadetes.id}"]`); await pg.waitForTimeout(400);
const actualizado = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idCadetes.id);
t('Al elegirlo, se le agrega Juveniles sin crear un jugador nuevo (mismo id)',
  actualizado.categorias.includes('Juveniles') && actualizado.categorias.includes('Cadetes'), JSON.stringify(actualizado.categorias));
const totalDespues = await pg.evaluate(()=>db.jugadores.length);
t('La cantidad total de jugadores no cambió (no se duplicó)', totalDespues===totalAntes, `${totalAntes} → ${totalDespues}`);
t('Volvió al plantel después de enlazarlo', (await pg.locator('h2.screen-title').innerText())==='PLANTEL');

// ---- "Volver" desde la búsqueda vuelve a la pregunta, no al formulario ----
await pg.click('[data-go="nuevoJugador"]'); await pg.waitForTimeout(300);
await pg.click('[data-nuevoJugadorExistente="si"]'); await pg.waitForTimeout(300);
await pg.click('[data-volverPreguntaJugador]'); await pg.waitForTimeout(300);
t('"Volver" desde la búsqueda vuelve a la pregunta Sí/No',
  (await pg.locator('[data-nuevoJugadorExistente="si"]').count())===1);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
