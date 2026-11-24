const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Botón "Registrar partido" en la solapa Partidos: hasta ahora la única
   forma de cargar los datos de un partido jugado (minutos/goles/etc. de
   cada jugador) era la solapa "Cargar", que coordinación no tiene en su
   barra de abajo (solo le queda accesible por atajos como "Agregar
   jugador") — reportado por confundirse con "Cargar partido", el botón
   para AGENDAR un partido futuro en el fixture, que vive en la misma
   pantalla. Ahora hay un botón bien visible para ir directo al
   formulario de carga (formPartido), y cada partido ya agendado en el
   fixture tiene su propio "Registrar partido" que lo precompleta. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
t('Coordinación no tiene la solapa "Cargar" en su barra de navegación (el caso que generó la confusión)',
  (await pg.locator('.tabs button:visible:has-text("Cargar")').count())===0);

await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);
t('El bloque para agendar ya no se llama "Cargar partido" (para no confundirse con registrar lo jugado)',
  (await pg.locator('.block-title:has-text("Agendar partido")').count())===1);
t('Hay un botón bien visible "Registrar partido", separado de "Agendar partido"',
  (await pg.locator('#registrarPartido:has-text("Registrar partido")').count())===1);

// ---- "Registrar partido" general: lleva directo al formulario, sin pasar
//      por la solapa Cargar (que coordinación ni ve) ----
await pg.click('#registrarPartido'); await pg.waitForTimeout(400);
t('Lleva directo al formulario de Partido (el mismo que usa "Cargar")', (await pg.locator('h2.screen-title').innerText())==='PARTIDO');
t('La categoría queda preseleccionada en la que se venía mirando (Juveniles)',
  (await pg.locator('#p-cat').inputValue())==='Juveniles');
await pg.fill('#p-rival', 'Deportivo Prueba');
const filas1 = await pg.locator('tr[data-fila]').all();
for (let i=0;i<3;i++){
  const jid = await filas1[i].getAttribute('data-fila');
  await pg.fill(`[data-jug="${jid}"][data-campo="minutos"]`, '90');
}
await pg.click('#guardarPartidoPlantel'); await pg.waitForTimeout(500);
t('Quedó guardado como un partido real (3 jugadores con minutos)',
  (await pg.evaluate(()=>db.partidos.filter(p=>p.rival==='Deportivo Prueba' && p.minutos===90).length))===3);

// ---- "Registrar partido" de un partido puntual ya agendado: precompleta
//      rival y fecha, no hay que volver a tipearlos ----
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(400);
await pg.fill('#fx-rival', 'Club Andino'); await pg.fill('#fx-fecha', '2026-12-15');
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const fx = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Club Andino'));
t('Antes de registrarlo, dice "Registrar partido" (todavía no tiene datos propios cargados)',
  (await pg.locator(`[data-registrarFixture="${fx.id}"]`).innerText())==='Registrar partido');
await pg.click(`[data-registrarFixture="${fx.id}"]`); await pg.waitForTimeout(400);
t('Lleva al formulario de Partido', (await pg.locator('h2.screen-title').innerText())==='PARTIDO');
t('La fecha queda precompletada con la del partido agendado (2026-12-15)', (await pg.locator('#p-fecha').inputValue())==='2026-12-15');
t('El rival queda precompletado (Club Andino), sin tener que volver a escribirlo', (await pg.locator('#p-rival').inputValue())==='Club Andino');
t('La categoría también queda precompletada (Juveniles)', (await pg.locator('#p-cat').inputValue())==='Juveniles');
const filas2 = await pg.locator('tr[data-fila]').all();
for (let i=0;i<2;i++){
  const jid = await filas2[i].getAttribute('data-fila');
  await pg.fill(`[data-jug="${jid}"][data-campo="minutos"]`, '70');
  await pg.fill(`[data-jug="${jid}"][data-campo="goles"]`, '1');
}
await pg.click('#guardarPartidoPlantel'); await pg.waitForTimeout(500);

// ---- al volver al fixture, el resultado ya no dice "Programado" y el
//      botón ahora ofrece "Editar registro" en vez de "Registrar" ----
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(400);
const filaAndino = await pg.locator(`tr:has-text("Club Andino")`).innerText();
t('El resultado ya no dice "Programado" (se cargaron los goles propios)', !filaAndino.toUpperCase().includes('PROGRAMADO'), filaAndino);
t('Suma los 2 goles cargados (1+1)', filaAndino.includes('2'), filaAndino);
t('Ahora el botón dice "Editar registro" en vez de "Registrar partido"',
  (await pg.locator(`[data-registrarFixture="${fx.id}"]`).innerText())==='Editar registro');

// ---- DT: también puede usar el botón general y el de un partido puntual ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El DT también tiene "Registrar partido"', (await pg.locator('#registrarPartido').count())===1);
t('El DT también puede editar el registro de Club Andino', (await pg.locator(`[data-registrarFixture="${fx.id}"]`).count())===1);

// ---- jugador: no ve ninguno de los dos botones ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El jugador no ve "Registrar partido" en general', (await pg.locator('#registrarPartido').count())===0);
t('El jugador tampoco ve el botón por partido puntual', (await pg.locator('[data-registrarFixture]').count())===0);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
