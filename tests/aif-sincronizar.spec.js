const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* el service worker de la PWA intercepta los fetch() antes que la ruta
   simulada de Playwright, así que estas pruebas lo bloquean para poder
   simular la respuesta de /api/aif sin depender de la AIF real */
const mockAif = (pg, partidos) => pg.route(/\/api\/aif/, route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ categoria: 'Juveniles', partidos })
}));

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}, serviceWorkers:'block'});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());

await mockAif(pg, [
  { torneo:'CLAUSURA', rival:'MAPUCHE', fecha:'2026-11-14', hora:'14:15', esLocal:false, jugado:true,  golesPropios:0, golesRival:4, cancha:'MAPUCHE (1)', arbitro:'ERAZO ANDREA', pendienteRevision:false },
  { torneo:'CLAUSURA', rival:'CAMPO CHICO VERDE', fecha:'2026-11-21', hora:'14:15', esLocal:true, jugado:false, golesPropios:null, golesRival:null, cancha:null, arbitro:null, pendienteRevision:false },
]);

await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);

// ---- jugador: no ve el botón de sincronizar ----
await entrarComoJugador(pg);
await pg.click('.tabs button:has-text("Fixture")'); await pg.waitForTimeout(300);
t('El jugador no tiene el botón "Sincronizar con AIF"', (await pg.locator('#sincronizarAIF').count())===0);

// ---- DT: sincroniza su categoría ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
await pg.click('.tabs button:has-text("Fixture")'); await pg.waitForTimeout(300);
t('El DT ve el botón "Sincronizar con AIF"', (await pg.locator('#sincronizarAIF').count())===1);
await pg.click('#sincronizarAIF'); await pg.waitForTimeout(800);

t('Trajo los 2 partidos de la AIF al fixture propio', (await pg.evaluate(()=>db.fixture.length))===2);
const mapuche = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='MAPUCHE'));
t('El partido ya jugado según la AIF queda con el gol del rival cargado solo', mapuche && mapuche.golesRival===4 && mapuche.hora==='14:15', JSON.stringify(mapuche));
const campoChico = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='CAMPO CHICO VERDE'));
t('El partido todavía no jugado queda sin resultado (solo agendado)', campoChico && campoChico.golesRival===null, JSON.stringify(campoChico));

t('El ya jugado muestra "? - 4" (se sabe el gol del rival pero falta cargar los datos propios)',
  (await pg.locator('table.cmp').innerText()).includes('? - 4'));
t('El no jugado todavía dice "Programado"', (await pg.locator('table.cmp .pill:has-text("Programado")').count())===1);

// ---- clickear "Sincronizar" de nuevo no duplica nada ----
await pg.click('#sincronizarAIF'); await pg.waitForTimeout(800);
t('Sincronizar de nuevo no duplica los partidos (sigue habiendo 2)', (await pg.evaluate(()=>db.fixture.length))===2);

// ---- el calendario también refleja el "? - 4" ----
await pg.click('[data-fixtureVista="calendario"]'); await pg.waitForTimeout(300);
await pg.evaluate(()=>{ view.fixtureMes='2026-11'; render(); }); await pg.waitForTimeout(300);
t('El calendario muestra el resultado parcial (?-4) del partido ya jugado',
  (await pg.locator('.cal-match:has-text("(?-4)")').count())===1);
await pg.click('[data-fixtureVista="tabla"]'); await pg.waitForTimeout(300);

// ---- el DT carga los datos del partido (Cargar > Partido): el "?" se completa solo ----
await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);
await pg.fill('#p-rival', 'MAPUCHE');
await pg.fill('#p-fecha', '2026-11-14');
const filas = await pg.locator('tr[data-fila]').all();
for (let i=0;i<3;i++){
  const jid = await filas[i].getAttribute('data-fila');
  await pg.fill(`[data-jug="${jid}"][data-campo="minutos"]`, '90');
}
await pg.fill(`[data-jug="${await filas[0].getAttribute('data-fila')}"][data-campo="goles"]`, '1');
await pg.click('#guardarPartidoPlantel'); await pg.waitForTimeout(500);

await pg.click('[data-tab="fixture"]'); await pg.waitForTimeout(400);
const filaMapuche = await pg.locator('table.cmp tr:has-text("MAPUCHE")').innerText();
t('Al cargar el partido, se completa solo: "1 - 4" (el gol del rival ya lo había traído la AIF)',
  filaMapuche.includes('1') && filaMapuche.includes('4') && !filaMapuche.includes('?'), filaMapuche);

// ---- si la AIF corrige después un resultado ya cargado, lo pisa (es la fuente oficial) ----
await mockAif(pg, [
  { torneo:'CLAUSURA', rival:'MAPUCHE', fecha:'2026-11-14', hora:'14:30', esLocal:false, jugado:true, golesPropios:0, golesRival:5, cancha:'MAPUCHE (1)', arbitro:'ERAZO ANDREA', pendienteRevision:false },
]);
await pg.click('#sincronizarAIF'); await pg.waitForTimeout(800);
const mapucheCorregido = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='MAPUCHE'));
t('Si la AIF corrige el resultado (4→5) o el horario, la sincronización lo actualiza',
  mapucheCorregido.golesRival===5 && mapucheCorregido.hora==='14:30', JSON.stringify(mapucheCorregido));
t('La corrección de la AIF no tocó los datos propios ya cargados (minutos, goles de cada jugador)',
  (await pg.evaluate(()=>db.partidos.filter(p=>p.rival==='MAPUCHE' && p.minutos===90).length))===3);

// ---- si la AIF (o la red) falla, avisa y no rompe nada ----
await pg.unroute(/\/api\/aif/);
await pg.route(/\/api\/aif/, route => route.fulfill({
  status: 502, contentType:'application/json', body: JSON.stringify({ error:'No se pudo leer la AIF' })
}));
const antesDelError = await pg.evaluate(()=>db.fixture.length);
await pg.click('#sincronizarAIF'); await pg.waitForTimeout(800);
t('Si la AIF no responde bien, avisa con un toast', (await pg.locator('text=No se pudo sincronizar con la AIF').count())>=1);
t('Y no rompe ni cambia nada del fixture que ya había', (await pg.evaluate(()=>db.fixture.length))===antesDelError);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
