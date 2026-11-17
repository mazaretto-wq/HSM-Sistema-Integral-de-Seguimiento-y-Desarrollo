const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Bloque "Próximos partidos" en Inicio: categoría vs rival, horario y
   condición (local/visitante), para los partidos del fixture de hoy en
   adelante. El DT ve solo los de su categoría; coordinación y jugador ven
   de todas (igual que el resto de Inicio). La condición se puede cargar a
   mano al agendar, o la trae sola la sincronización con la AIF. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Inicio")'); await pg.waitForTimeout(300);
t('Sin partidos agendados, el bloque "Próximos partidos" no aparece', (await pg.locator('text=Próximos partidos').count())===0);

await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('Sin partidos todavía, tampoco aparece en la solapa Partidos (antes de elegir categoría)',
  (await pg.locator('text=Próximos partidos').count())===0);
t('Pero SÍ siguen estando los chips para elegir cualquier categoría',
  (await pg.locator('[data-fixtureCat]').count())===5);

// ---- Promocional vs Mapuche, a las 11:00, Local (justo como pidió el ejemplo) ----
await pg.click('[data-fixtureCat="Promocional"]'); await pg.waitForTimeout(300);
await pg.fill('#fx-rival', 'Mapuche'); await pg.fill('#fx-fecha', '2099-01-10'); await pg.fill('#fx-hora', '11:00');
await pg.click('[data-fxLocal="local"]'); await pg.waitForTimeout(200);
t('El chip "Local" queda marcado al tocarlo', (await pg.locator('[data-fxLocal="local"][aria-pressed="true"]').count())===1);
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const mapuche = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Mapuche'));
t('Queda guardado con esLocal=true', mapuche.esLocal===true, JSON.stringify(mapuche));
t('El chip se resetea después de agregar (no queda pegado para el próximo partido)',
  (await pg.locator('[data-fxLocal][aria-pressed="true"]').count())===0);

// ---- Cadetes vs Visitante, a las 16:30, Visitante ----
await pg.click('[data-fixtureCat="Cadetes"]'); await pg.waitForTimeout(300);
await pg.fill('#fx-rival', 'Club Andino'); await pg.fill('#fx-fecha', '2099-01-05'); await pg.fill('#fx-hora', '16:30');
await pg.click('[data-fxLocal="visitante"]'); await pg.waitForTimeout(200);
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const andino = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Club Andino'));
t('Queda guardado con esLocal=false', andino.esLocal===false, JSON.stringify(andino));

// ---- un partido YA JUGADO (fecha pasada) no debería listarse como "próximo" ----
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.fill('#fx-rival', 'Rival Viejo'); await pg.fill('#fx-fecha', '2020-01-01');
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);

// ---- el mismo pantallazo general (de TODAS las categorías, no solo la
//      elegida) también se ve arriba de la solapa Partidos, mientras
//      coordinación tiene seleccionada una categoría puntual (Juveniles) ----
const filasEnPartidos = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('En la solapa Partidos (con Juveniles elegida) el pantallazo general igual muestra TODAS las categorías',
  filasEnPartidos.some(f=>f.includes('Mapuche')) && filasEnPartidos.some(f=>f.includes('Club Andino')), JSON.stringify(filasEnPartidos));

await pg.click('.tabs button:has-text("Inicio")'); await pg.waitForTimeout(300);
t('Ahora SÍ aparece el bloque "Próximos partidos"', (await pg.locator('text=Próximos partidos').count())>=1);
const filas = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('Formato exacto pedido: "Promocional vs Mapuche - 11hs - Local" (sin :00 cuando es en punto)',
  filas.some(f=>f.includes('Promocional vs Mapuche - 11hs - Local')), JSON.stringify(filas));
t('Con minutos, se muestra "16:30hs" (no se pierden los minutos)',
  filas.some(f=>f.includes('Cadetes vs Club Andino - 16:30hs - Visitante')), JSON.stringify(filas));
t('El partido con fecha pasada (2020) no aparece en "Próximos partidos"',
  !filas.some(f=>f.includes('Rival Viejo')), JSON.stringify(filas));
t('El más próximo en el tiempo aparece primero (Club Andino el 5/1 antes que Mapuche el 10/1)',
  filas.findIndex(f=>f.includes('Club Andino')) < filas.findIndex(f=>f.includes('Mapuche')), JSON.stringify(filas));

// ---- DT: solo ve los próximos partidos de su propia categoría ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Promocional');
const filasDT = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('El DT de Promocional ve su partido (Mapuche)', filasDT.some(f=>f.includes('Mapuche')), JSON.stringify(filasDT));
t('El DT de Promocional NO ve el de Cadetes (Club Andino)', !filasDT.some(f=>f.includes('Club Andino')), JSON.stringify(filasDT));
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
const filasDTPartidos = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('Lo mismo se ve arriba de la solapa Partidos del DT (acotado a su categoría)',
  filasDTPartidos.some(f=>f.includes('Mapuche')) && !filasDTPartidos.some(f=>f.includes('Club Andino')), JSON.stringify(filasDTPartidos));

// ---- jugador: ve de todas las categorías, como coordinación ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
const filasJug = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('El jugador ve los próximos partidos de todas las categorías (Mapuche y Club Andino)',
  filasJug.some(f=>f.includes('Mapuche')) && filasJug.some(f=>f.includes('Club Andino')), JSON.stringify(filasJug));
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
const filasJugPartidos = await pg.locator('.block:has-text("Próximos partidos") .roster .row').allInnerTexts();
t('Lo mismo se ve arriba de la solapa Partidos del jugador (de todas las categorías)',
  filasJugPartidos.some(f=>f.includes('Mapuche')) && filasJugPartidos.some(f=>f.includes('Club Andino')), JSON.stringify(filasJugPartidos));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
