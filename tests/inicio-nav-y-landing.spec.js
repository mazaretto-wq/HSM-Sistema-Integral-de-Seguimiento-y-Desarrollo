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
await pg.reload(); await pg.waitForTimeout(2200);

// ---- coordinación: nav y landing ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
t('Coordinación aterriza en Inicio al loguearse', (await pg.locator('h2.screen-title').innerText())==='INICIO');
const tabsCoord = await pg.locator('.tabs button:visible').allInnerTexts();
t('Coordinación ve 8 solapas: Inicio, Categorías, Entrenos, Test físicos, Rutinas, Partidos, Vs, Datos',
  tabsCoord.length===8 && tabsCoord.map(x=>x.toUpperCase()).join('|')==='INICIO|CATEGORÍAS|ENTRENOS|TEST FÍSICOS|RUTINAS|PARTIDOS|VS|DATOS',
  tabsCoord.join(' | '));

// ---- el roster completo sigue estando, solo que vía Categorías ----
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
t('Entrar a una categoría sigue llevando al Plantel filtrado', (await pg.locator('h2.screen-title').innerText())==='PLANTEL');
await pg.click('.chip[data-cat="Todas"]').catch(()=>{});
await pg.waitForTimeout(200);
t('Desde ahí, el chip "Todas" sigue mostrando el plantel completo', (await pg.locator('.chip[aria-pressed="true"]').first().innerText()).toUpperCase()==='TODAS');

// ---- "Agregar jugador" (deep link) sigue funcionando aunque no haya solapa Cargar ----
await pg.click('[data-go="nuevoJugador"]'); await pg.waitForTimeout(300);
t('"Agregar jugador" sigue abriendo el formulario aunque no haya solapa Cargar visible',
  (await pg.locator('h2.screen-title').innerText()).includes('JUGADOR') || (await pg.locator('#j-apellido, [id*="apellido"]').count())>0);
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('Al volver, cae en el menú de Cargar con un botón para salir a Inicio', (await pg.locator('[data-irTab="inicio"]').count())===1);
await pg.click('[data-irTab="inicio"]'); await pg.waitForTimeout(300);
t('Ese botón efectivamente vuelve a Inicio', (await pg.locator('h2.screen-title').innerText())==='INICIO');

// ---- DT: nav y landing ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
t('DT también aterriza en Inicio', (await pg.locator('h2.screen-title').innerText())==='INICIO');
const tabsDT = await pg.locator('.tabs button:visible').allInnerTexts();
t('DT ve 8 solapas: Inicio, Categorías, Entrenos, Test físicos, Rutinas, Partidos, Vs, Cargar',
  tabsDT.length===8 && tabsDT.map(x=>x.toUpperCase()).join('|')==='INICIO|CATEGORÍAS|ENTRENOS|TEST FÍSICOS|RUTINAS|PARTIDOS|VS|CARGAR',
  tabsDT.join(' | '));
t('El Inicio del DT dice "Los mejores de Juveniles" (solo su equipo)', (await pg.locator('.screen-note').first().innerText()).includes('Juveniles'));
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
t('El plantel del DT (antes "Inicio") sigue estando, vía Categorías', (await pg.locator('h2.screen-title').innerText())==='PLANTEL');

// ---- jugador: nav y landing sin cambios (el login ahora pide DNI, ver entrarComoJugador) ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
t('Jugador también aterriza en Inicio', (await pg.locator('h2.screen-title').innerText())==='INICIO');
const tabsJug = await pg.locator('.tabs button:visible').allInnerTexts();
t('Jugador ve 5 solapas: Inicio, Plantel, Rutinas, Partidos, Vs',
  tabsJug.length===5 && tabsJug.map(x=>x.toUpperCase()).join('|')==='INICIO|PLANTEL|RUTINAS|PARTIDOS|VS',
  tabsJug.join(' | '));
t('El Inicio del jugador dice "todas las categorías" (igual que coordinación)',
  (await pg.locator('.screen-note').first().innerText()).includes('todas las categorías'));

// ================= CORRECTITUD DEL RANKING (datos controlados) =================
// re-entramos como coordinación por la UI real (no a mano con evaluate), para
// no dejar colgado el rol/categoría del DT de la prueba anterior
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
const setup = await pg.evaluate(()=>{
  const a = uid(), bb = uid(), c = uid();
  db.jugadores.push(
    { id:a, nombre:'Alfa', apellido:'Rank', categorias:['Cadetes'] },
    { id:bb, nombre:'Beta', apellido:'Rank', categorias:['Cadetes'] },
    { id:c, nombre:'Gama', apellido:'Rank', categorias:['Cadetes'] },
  );
  // valores deliberadamente imposibles de superar: la base ya trae
  // jugadores reales con estadísticas altas (goles, minutos), así que
  // no alcanza con números "normales" para garantizar el 1er puesto
  db.partidos.push(
    { id:uid(), jugadorId:a, categoria:'Cadetes', fecha:'2031-04-01', jugo:true, goles:99999, asistencias:1, minutos:300, amarillas:0, rojas:0 },
    { id:uid(), jugadorId:bb, categoria:'Cadetes', fecha:'2031-04-01', jugo:true, goles:3, asistencias:99999, minutos:200, amarillas:0, rojas:0 },
    { id:uid(), jugadorId:c, categoria:'Cadetes', fecha:'2031-04-01', jugo:true, goles:1, asistencias:1, minutos:999999, amarillas:0, rojas:0 },
  );
  const toma = { id:uid(), nombre:'Abril 2031', fecha:'2031-04-01' };
  db.tomas.push(toma);
  db.evaluaciones.push(
    { id:uid(), jugadorId:a, tomaId:toma.id, fecha:'2031-04-01', v30:4.10 },
    { id:uid(), jugadorId:bb, tomaId:toma.id, fecha:'2031-04-01', v30:0.01 },
    { id:uid(), jugadorId:c, tomaId:toma.id, fecha:'2031-04-01', v30:4.50 },
  );
  render();
  return {a,bb,c};
});
await pg.waitForTimeout(300);
await pg.click('.tabs button:has-text("Inicio")'); await pg.waitForTimeout(300);

t('"Alfa Rank" (99999 goles, imposible de superar) queda primero en Más goles', (await pg.locator('.block:has-text("Más goles") .row-name').first().innerText()).includes('Alfa'));
t('"Beta Rank" (99999 asistencias) queda primero en Más asistencias', (await pg.locator('.block:has-text("Más asistencias") .row-name').first().innerText()).includes('Beta'));
t('"Gama Rank" (999999 minutos) queda primero en Más minutos', (await pg.locator('.block:has-text("Más minutos") .row-name').first().innerText()).includes('Gama'));
// velocidad 30m: "mejor cuanto más bajo" -> Beta (0.01, imposible de superar) debería ser 1°
t('En Velocidad 30m (mejor el más bajo), "Beta Rank" con 0.01 queda primero',
  (await pg.locator('.block:has-text("Mejores · Velocidad 30 m") .row-name').first().innerText()).includes('Beta'));

// clickear un jugador del ranking abre su ficha
await pg.locator('.block:has-text("Más goles") .row').first().click(); await pg.waitForTimeout(300);
t('Click en una fila del ranking abre la ficha del jugador', (await pg.locator('.ficha-name').count())===1);

t('Sin errores de consola en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
