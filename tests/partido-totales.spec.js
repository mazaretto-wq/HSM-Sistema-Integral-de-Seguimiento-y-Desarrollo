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
await pg.reload(); await pg.waitForTimeout(1500);
await entrarComoDT(pg, 'Juveniles');

await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);

t('Arranca con la fila de totales en 0 (nadie jugó todavía)',
  (await pg.locator('#pl-tot-jugaron').innerText())==='0 jugaron'
    && (await pg.locator('#pl-tot-goles').innerText())==='0'
    && (await pg.locator('#pl-tot-asistencias').innerText())==='0'
    && (await pg.locator('#pl-tot-amarillas').innerText())==='0'
    && (await pg.locator('#pl-tot-rojas').innerText())==='0');

const filas = await pg.locator('tr[data-fila]').all();
const jid = i => filas[i].getAttribute('data-fila');

// jugador 1: jugó, 2 goles, 1 asistencia, 1 amarilla
await pg.fill(`[data-jug="${await jid(0)}"][data-campo="minutos"]`, '90');
await pg.fill(`[data-jug="${await jid(0)}"][data-campo="goles"]`, '2');
await pg.fill(`[data-jug="${await jid(0)}"][data-campo="asistencias"]`, '1');
await pg.fill(`[data-jug="${await jid(0)}"][data-campo="amarillas"]`, '1');

t('Al cargar al primer jugador, los totales se actualizan al toque (sin guardar el partido)',
  (await pg.locator('#pl-tot-jugaron').innerText())==='1 jugaron'
    && (await pg.locator('#pl-tot-goles').innerText())==='2'
    && (await pg.locator('#pl-tot-asistencias').innerText())==='1'
    && (await pg.locator('#pl-tot-amarillas').innerText())==='1'
    && (await pg.locator('#pl-tot-rojas').innerText())==='0');

// jugador 2: jugó, 1 gol, 1 roja
await pg.fill(`[data-jug="${await jid(1)}"][data-campo="minutos"]`, '60');
await pg.fill(`[data-jug="${await jid(1)}"][data-campo="goles"]`, '1');
await pg.fill(`[data-jug="${await jid(1)}"][data-campo="rojas"]`, '1');

// jugador 3: cargado con una amarilla pero sin minutos (entró y no sumó, o quedó en el banco): no debería contar como "jugó"
await pg.fill(`[data-jug="${await jid(2)}"][data-campo="amarillas"]`, '1');

t('Con 2 jugadores con minutos y uno sin minutos, los totales suman todo pero "jugaron" solo cuenta a los que tienen minutos',
  (await pg.locator('#pl-tot-jugaron').innerText())==='2 jugaron'
    && (await pg.locator('#pl-tot-goles').innerText())==='3'
    && (await pg.locator('#pl-tot-asistencias').innerText())==='1'
    && (await pg.locator('#pl-tot-amarillas').innerText())==='2'
    && (await pg.locator('#pl-tot-rojas').innerText())==='1');

await pg.click('[data-back]'); await pg.waitForTimeout(300);
await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);
t('Al volver a abrir el formulario (sin guardar), arranca de nuevo en 0',
  (await pg.locator('#pl-tot-jugaron').innerText())==='0 jugaron' && (await pg.locator('#pl-tot-goles').innerText())==='0');

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
