const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);
// la app siembra la base completa del club sola si no hay jugadores: de acá
// en más se trabaja contra esa base real, con deltas en vez de valores
// absolutos (no se puede asumir "0 tomas" de entrada)

await entrarComoDT(pg, 'Juveniles');

const base = await pg.evaluate(()=>({
  tomas: db.tomas.length,
  jugadores: db.jugadores.filter(j=>(j.categorias||[]).includes('Juveniles')).length,
}));
// un jugador fresco, recién creado: ningún valor físico previo posible
const jugId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Fresco', apellido:'SinHistorial', categorias:['Juveniles'] });
  render();
  return id;
});
await pg.waitForTimeout(300);

await pg.click('.tabs button:has-text("Test físicos")'); await pg.waitForTimeout(300);
t('DT ve los 3 test avalados (Cooper, Yo-Yo, Velocidad)', (await pg.locator('[data-testTipo]').count())===3);

await pg.click('[data-testTipo="yoyo"]'); await pg.waitForTimeout(300);
await pg.click('[data-registrarTest]'); await pg.waitForTimeout(300);
t('Pide la fecha', (await pg.locator('#test-fecha').count())===1);
t('Lista a todos los jugadores de Juveniles (incluido el recién creado)',
  (await pg.locator('[data-testValor]').count())===base.jugadores+1);
t('El jugador recién creado arranca sin ningún valor previo', await pg.inputValue(`[data-testValor="${jugId}"]`)==='');

// elegimos un mes que casi seguro no exista en la base (2031) para poder
// afirmar con certeza que se crea UNA sola toma nueva
await pg.fill('#test-fecha','2031-03-10');
await pg.fill(`[data-testValor="${jugId}"]`, '1950');
await pg.click('#guardarTest'); await pg.waitForTimeout(400);

t('Vuelve al detalle del test tras guardar', (await pg.locator('[data-registrarTest]').count())===1);
t('El toast confirma 1 resultado guardado', (await pg.locator('.toast').innerText()).includes('1 resultado'));

const chequeo = await pg.evaluate((jugId)=>{
  const reg = db.evaluaciones.find(e=>e.jugadorId===jugId && typeof e.yoyo==='number');
  const toma = reg ? db.tomas.find(t=>t.id===reg.tomaId) : null;
  return { valor: reg?reg.yoyo:null, fecha: reg?reg.fecha:null, tomaNombre: toma?toma.nombre:null, totalTomas: db.tomas.length };
}, jugId);
t('El valor quedó guardado en evaluaciones.yoyo (el mismo campo de siempre)', chequeo.valor===1950, JSON.stringify(chequeo));
t('La fecha exacta elegida quedó en la evaluación', chequeo.fecha==='2031-03-10');
t('Se creó exactamente UNA toma nueva (nombrada por mes), no una colección aparte',
  chequeo.totalTomas===base.tomas+1 && /marzo/i.test(chequeo.tomaNombre||''), JSON.stringify(chequeo));

// ---- se ve reflejado en la ficha del jugador, en Detalle, como cualquier otro dato físico ----
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, jugId);
await pg.waitForTimeout(300);
const textoDetalle = await pg.locator('#app').innerText();
t('El valor cargado por Test Físicos se ve en la ficha del jugador (Detalle), sin duplicar nada', textoDetalle.includes('1.950'));

// ---- coordinación: filtro por categoría primero, y ve lo que cargó el DT ----
await pg.evaluate(()=>{ view.jugadorId=null; db.config.acceso='coordinacion'; render(); }); await pg.waitForTimeout(300);
await pg.click('.tabs button:has-text("Test físicos")'); await pg.waitForTimeout(300);
t('Coordinación ve primero el filtro por categoría', (await pg.locator('[data-testCat]').count())>0);
await pg.click('[data-testCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click('[data-testTipo="yoyo"]'); await pg.waitForTimeout(300);
const tomasVistasCoord = await pg.locator('.row-name', { hasText: /marzo/i }).count();
t('Coordinación ve la toma de marzo 2031 que cargó el DT', tomasVistasCoord>=1);

// coordinación agrega un segundo valor a la MISMA toma (mismo mes), no crea otra
const jugId2 = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Fresco2', apellido:'SinHistorial', categorias:['Juveniles'] });
  render();
  return id;
});
await pg.waitForTimeout(200);
await pg.click('[data-back]'); await pg.waitForTimeout(200); // vuelve a la lista de test
await pg.click('[data-testTipo="yoyo"]'); await pg.waitForTimeout(300);
await pg.click('[data-registrarTest]'); await pg.waitForTimeout(300);
await pg.fill('#test-fecha','2031-03-20');
await pg.fill(`[data-testValor="${jugId2}"]`, '1700');
await pg.click('#guardarTest'); await pg.waitForTimeout(400);
const totalTomasFinal = await pg.evaluate(()=> db.tomas.length);
t('Registrar otra fecha del mismo mes reusa la misma toma (no duplica)', totalTomasFinal===base.tomas+1, String(totalTomasFinal));
const valor2 = await pg.evaluate((id)=>{
  const reg = db.evaluaciones.find(e=>e.jugadorId===id && typeof e.yoyo==='number');
  return reg ? reg.yoyo : null;
}, jugId2);
t('Coordinación puede registrar en cualquier categoría', valor2===1700);

t('Sin errores de consola', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
