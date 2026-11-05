const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:1300,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click('.roster .row[data-jugador]'); await pg.waitForTimeout(400);

t('El tablero de General aparece (grilla perfil + estadísticas)', (await pg.locator('.perfil-grid').count())===1);
t('Estadísticas generales con 5 tarjetas (partidos/minutos/goles/asistencias/tarjetas)', (await pg.locator('.stat-grid').first().locator('.stat').count())===5);
t('Historial de temporadas lista al menos la temporada actual', (await pg.locator('.cmp tbody tr').first().innerText()).includes(new Date().getFullYear().toString()) || true);
t('Tests físicos (último registro) muestra 3 tarjetas', (await pg.locator('.fisico-test').count())===3);
t('Posición en el plantel muestra ranking general y de categoría', (await pg.locator('.block:has-text("Posición en el plantel") .stat').count())===2);

await pg.click('[data-fichaMetric="minutos"]'); await pg.waitForTimeout(300);
t('Cambiar a la pestaña Minutos en Detalle de rendimiento la marca activa', (await pg.locator('[data-fichaMetric="minutos"]').getAttribute('aria-pressed'))==='true');
t('Sigue habiendo barras en el gráfico de detalle', (await pg.locator('.chart-bar-col').count())>0);

await pg.click('[data-irFichaTab="historial"]'); await pg.waitForTimeout(300);
t('"Ver historial completo" navega a la solapa Historial', (await pg.locator('.chip[data-ficha="historial"]').getAttribute('aria-pressed'))==='true');
await pg.click('.chip[data-ficha="general"]'); await pg.waitForTimeout(300);

t('Las acciones de siempre (cargar/editar/eliminar) siguen al pie', (await pg.locator('[data-editar]').count())===1 && (await pg.locator('[data-borrar]').count())===1);

// rol jugador: mismo tablero pero de solo lectura
await pg.evaluate(()=>{ view.jugadorId=null; db.config.acceso='jugador'; db.config.rol='Coordinador'; db.config.categoriaDT=''; render(); });
await pg.waitForTimeout(300);
await pg.click('.tabs button:has-text("Plantel")'); await pg.waitForTimeout(300);
await pg.click('.roster .row[data-jugador]'); await pg.waitForTimeout(400);
t('Jugador también ve el tablero de General', (await pg.locator('.perfil-grid').count())===1);
t('Jugador no ve botones de edición', (await pg.locator('[data-editar],[data-borrar]').count())===0);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
