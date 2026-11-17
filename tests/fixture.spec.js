const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

t('"Partidos" aparece en la barra para coordinación (fixture y link, todo junto)', (await pg.locator('.tabs button:has-text("Partidos")').count())===1);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('Coordinación ve el selector de categorías (el primer filtro)', (await pg.locator('[data-fixtureCat]').count())===5);
t('Sin elegir categoría, pide elegir una', (await pg.locator('.empty').count())===1);

// ---- agendar un partido para Juveniles (coordinación) ----
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);
t('Arranca en vista Tabla por default', (await pg.locator('[data-fixtureVista="tabla"][aria-pressed="true"]').count())===1);
t('Coordinación tiene el formulario para agendar un partido', (await pg.locator('#agregarFixture').count())===1);
t('Arranca sin partidos agendados para Juveniles', (await pg.locator('.empty:has-text("no hay partidos programados")').count())===1);

await pg.fill('#fx-rival', 'Club Deportivo Rival');
await pg.fill('#fx-fecha', '2026-12-05');
await pg.fill('#fx-hora', '16:00');
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const fx1 = await pg.evaluate(()=>db.fixture[0]);
t('Quedó agendado con categoría, rival, fecha y hora', fx1.categoria==='Juveniles' && fx1.rival==='Club Deportivo Rival' && fx1.fecha==='2026-12-05' && fx1.hora==='16:00', JSON.stringify(fx1));
t('Se ve en la tabla como "Programado" (todavía no se cargaron las estadísticas)', (await pg.locator('table.cmp .pill:has-text("Programado")').count())===1);
t('No permite agendar el mismo partido dos veces', true);
await pg.fill('#fx-rival', 'Club Deportivo Rival');
await pg.fill('#fx-fecha', '2026-12-05');
await pg.click('#agregarFixture'); await pg.waitForTimeout(300);
t('Efectivamente rechaza el duplicado', (await pg.evaluate(()=>db.fixture.length))===1);

// ---- link para ver ESE partido puntual (ex solapa "Partidos", ahora
//      vive acá, uno por partido del fixture en vez de una lista aparte) ----
t('Sin link todavía, coordinación ve un botón bien visible para cargarlo', (await pg.locator(`[data-cambiarLinkFixture="${fx1.id}"]:has-text("Cargar link")`).count())===1);
t('Sin link, no hay botón "Ver partido" para nadie', (await pg.locator('a:has-text("Ver partido")').count())===0);
await pg.click(`[data-cambiarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fx1.id}`, 'meet.google.com/abc-defg');
await pg.click(`[data-guardarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(400);
const fx1ConLink = await pg.evaluate((id)=>db.fixture.find(f=>f.id===id), fx1.id);
t('Queda guardado con https:// agregado solo', fx1ConLink.link==='https://meet.google.com/abc-defg', JSON.stringify(fx1ConLink));
t('Queda una marca de tiempo de cuándo se cargó el link (para la alerta en Inicio)', typeof fx1ConLink.linkTs==='number' && fx1ConLink.linkTs>0);
const hrefVerPartido = await pg.locator('a:has-text("Ver partido")').first().getAttribute('href');
t('Ahora aparece "Ver partido" apuntando al link real', hrefVerPartido==='https://meet.google.com/abc-defg', String(hrefVerPartido));
await pg.click(`[data-cambiarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fx1.id}`, 'https://zoom.us/j/123456');
await pg.click(`[data-guardarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(400);
const fx1LinkCambiado = await pg.evaluate((id)=>db.fixture.find(f=>f.id===id), fx1.id);
t('"cambiar" permite reemplazar el link (un link que ya tenía https:// queda igual)', fx1LinkCambiado.link==='https://zoom.us/j/123456', fx1LinkCambiado.link);

// ---- vista calendario ----
await pg.click('[data-fixtureVista="calendario"]'); await pg.waitForTimeout(300);
t('El toggle cambia a la vista Calendario', (await pg.locator('.cal-grid').count())===1);
await pg.evaluate(()=>{ view.fixtureMes='2026-12'; render(); }); await pg.waitForTimeout(300);
t('El mes de diciembre 2026 muestra el partido agendado en su celda', (await pg.locator('.cal-match:has-text("Club Deportivo Rival")').count())===1);
t('El calendario también muestra un acceso directo al link del partido', (await pg.locator('.cal-match a[href="https://zoom.us/j/123456"]').count())===1);
t('El título del mes se muestra', (await pg.locator('.block:has-text("DICIEMBRE 2026")').count())===1);
await pg.click('[data-fixtureMes]:has-text("›")'); await pg.waitForTimeout(300);
t('La flecha siguiente avanza a enero 2027', (await pg.locator('.block:has-text("ENERO 2027")').count())===1);
await pg.click('[data-fixtureMes]:has-text("‹")'); await pg.waitForTimeout(300);
await pg.click('[data-fixtureMes]:has-text("‹")'); await pg.waitForTimeout(300);
t('La flecha anterior retrocede (de enero a diciembre a noviembre)', (await pg.locator('.block:has-text("NOVIEMBRE 2026")').count())===1);
await pg.click('[data-fixtureVista="tabla"]'); await pg.waitForTimeout(300);

// ---- categoría distinta: Cadetes no ve el partido de Juveniles ----
await pg.click('[data-fixtureCat="Cadetes"]'); await pg.waitForTimeout(300);
t('Cadetes no ve el fixture de Juveniles (categorías separadas)', (await pg.locator('.empty:has-text("no hay partidos programados")').count())===1);
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);

t('Sin errores de JS hasta acá', errs.length===0, errs.join(' | '));

// ---- DT: también puede cargar y manejar el link de su categoría ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El DT no ve el selector de categorías (va directo a la suya)', (await pg.locator('[data-fixtureCat]').count())===0);
t('El DT SÍ tiene el formulario para agendar', (await pg.locator('#agregarFixture').count())===1);
t('El DT ve el partido ya agendado por coordinación', (await pg.locator('table.cmp:has-text("Club Deportivo Rival")').count())===1);
t('El DT también ve "Ver partido" con el link ya cargado por coordinación', (await pg.locator('a:has-text("Ver partido")').count())===1);
await pg.click(`[data-cambiarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fx1.id}`, 'https://youtube.com/live/xyz');
await pg.click(`[data-guardarLinkFixture="${fx1.id}"]`); await pg.waitForTimeout(400);
t('El DT puede cambiar el link de un partido de su propia categoría',
  (await pg.evaluate((id)=>db.fixture.find(f=>f.id===id).link, fx1.id))==='https://youtube.com/live/xyz');

// ---- el DT carga las estadísticas del partido (Cargar > Partido) con goles del rival ----
await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);
t('El formulario de Partido pide los goles del rival (para el Fixture)', (await pg.locator('#p-golesrival').count())===1);
await pg.fill('#p-rival', 'Club Deportivo Rival');
await pg.fill('#p-fecha', '2026-12-05');
await pg.fill('#p-golesrival', '1');
const filas = await pg.locator('tr[data-fila]').all();
for (let i=0;i<3;i++){
  const jid = await filas[i].getAttribute('data-fila');
  await pg.fill(`[data-jug="${jid}"][data-campo="minutos"]`, '90');
}
const primerId = await filas[0].getAttribute('data-fila');
await pg.fill(`[data-jug="${primerId}"][data-campo="goles"]`, '3');
await pg.click('#guardarPartidoPlantel'); await pg.waitForTimeout(500);

// ---- correlación automática: el Fixture ya muestra el resultado solo ----
await pg.click('[data-tab="fixture"]'); await pg.waitForTimeout(400);
const filaFixture = await pg.locator('table.cmp tr:has-text("Club Deportivo Rival")').innerText();
t('El Fixture ahora muestra el resultado solo (3 propios, sumados de los goles cargados, - 1 del rival)',
  filaFixture.includes('3') && filaFixture.includes('1') && !filaFixture.toUpperCase().includes('PROGRAMADO'), filaFixture);
t('Ya no dice "Programado"', !filaFixture.toUpperCase().includes('PROGRAMADO'));

// ---- corregir el gol del rival desde el propio Fixture ----
const fxId = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Club Deportivo Rival').id);
await pg.click(`[data-corregirGolesRival="${fxId}"]`); await pg.waitForTimeout(300);
t('"Corregir" vuelve a mostrar el campo editable', (await pg.locator(`#gr-${fxId}`).count())===1);
await pg.fill(`#gr-${fxId}`, '2');
await pg.click(`[data-guardarGolesRival="${fxId}"]`); await pg.waitForTimeout(400);
const fxCorregido = await pg.evaluate((id)=>db.fixture.find(f=>f.id===id), fxId);
t('El gol del rival corregido queda guardado', fxCorregido.golesRival===2, JSON.stringify(fxCorregido));
t('El objeto fixture no guarda los goles propios: siempre se recalculan en vivo de los partidos cargados',
  !('golesPropios' in fxCorregido) && !('goles' in fxCorregido), JSON.stringify(fxCorregido));

// ---- eliminar un partido del fixture ----
await pg.click(`[data-borrarFixture="${fxId}"]`); await pg.waitForTimeout(400);
t('"Eliminar" saca ese partido del fixture', (await pg.evaluate((id)=>db.fixture.some(f=>f.id===id), fxId))===false);
t('No tocó los datos de partidos ya cargados (goles, minutos de cada jugador)', (await pg.evaluate(()=>db.partidos.some(p=>p.rival==='Club Deportivo Rival')))===true);

t('Sin errores de JS hasta acá', errs.length===0, errs.join(' | '));

// ---- de paso, se agenda OTRO partido con link, para que el jugador tenga algo que ver ----
await pg.fill('#fx-rival', 'Otro Rival'); await pg.fill('#fx-fecha', '2026-12-20');
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const fxOtro = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Otro Rival'));
await pg.click(`[data-cambiarLinkFixture="${fxOtro.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fxOtro.id}`, 'https://youtube.com/live/otro');
await pg.click(`[data-guardarLinkFixture="${fxOtro.id}"]`); await pg.waitForTimeout(400);

// ---- jugador identificado: solo mira, acotado a su categoría, sin cargar nada ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El jugador tampoco ve el selector de categorías', (await pg.locator('[data-fixtureCat]').count())===0);
t('El jugador NO tiene el formulario para agendar un partido', (await pg.locator('#agregarFixture').count())===0);
t('El jugador NO tiene botón para eliminar', (await pg.locator('[data-borrarFixture]').count())===0);
t('El jugador no tiene forma de cargar o cambiar un link', (await pg.locator('[data-cambiarLinkFixture]').count())===0);
t('El jugador SÍ ve "Ver partido" con el link ya cargado por el DT',
  (await pg.locator('a:has-text("Ver partido")').getAttribute('href'))==='https://youtube.com/live/otro');
t('El jugador puede ver la vista calendario igual que los demás', (await pg.locator('[data-fixtureVista="calendario"]').count())===1);
await pg.click('[data-fixtureVista="calendario"]'); await pg.waitForTimeout(300);
t('El calendario se ve también para el jugador, sin errores', (await pg.locator('.cal-grid').count())===1);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
