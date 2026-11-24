const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Al crear un ejercicio, mínimo/máximo de jugadores y si pide cantidad par
   o impar; al armar una sesión, según cuántos jugadores haya hoy (marcados
   en "Quiénes vinieron" o el número a mano), los ejercicios de la
   biblioteca que encajan con esa cantidad se marcan con ✓ y aparecen
   primero; los que no encajan avisan qué piden. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Entrenos")'); await pg.waitForTimeout(300);
await pg.click('[data-verBiblioteca]'); await pg.waitForTimeout(300);

// ---- crear un ejercicio PAR, de 8 a 12 jugadores ----
await pg.click('[data-go="nuevoEjercicio"]'); await pg.waitForTimeout(300);
await pg.fill('#e-nombre', 'Rondo par 8 a 12');
await pg.fill('#e-jug-min', '8'); await pg.fill('#e-jug-max', '12');
await pg.click('[data-ejParidad="par"]'); await pg.waitForTimeout(200);
t('El chip "Par" queda marcado al tocarlo', (await pg.locator('[data-ejParidad="par"][aria-pressed="true"]').count())===1);
t('"Cualquiera" se desmarca solo (es elegir uno de los tres)', (await pg.locator('[data-ejParidad=""][aria-pressed="true"]').count())===0);
await pg.click('#guardarEjercicio'); await pg.waitForTimeout(400);
const ejPar = await pg.evaluate(()=>db.ejercicios.find(e=>e.nombre==='Rondo par 8 a 12'));
t('Queda guardado con mínimo, máximo y paridad', ejPar.jugadoresMin===8 && ejPar.jugadoresMax===12 && ejPar.paridad==='par', JSON.stringify(ejPar));

// ---- crear un ejercicio IMPAR, de 5 a 7 jugadores ----
await pg.click('[data-go="nuevoEjercicio"]'); await pg.waitForTimeout(300);
await pg.fill('#e-nombre', 'Rondo impar 5 a 7');
await pg.fill('#e-jug-min', '5'); await pg.fill('#e-jug-max', '7');
await pg.click('[data-ejParidad="impar"]'); await pg.waitForTimeout(200);
await pg.click('#guardarEjercicio'); await pg.waitForTimeout(400);

// ---- un ejercicio sin dato de jugadores (ni rango ni paridad) ----
await pg.click('[data-go="nuevoEjercicio"]'); await pg.waitForTimeout(300);
await pg.fill('#e-nombre', 'Ejercicio sin dato de jugadores');
await pg.click('#guardarEjercicio'); await pg.waitForTimeout(400);
const ejSinDato = await pg.evaluate(()=>db.ejercicios.find(e=>e.nombre==='Ejercicio sin dato de jugadores'));
t('Sin completar nada, queda sin mínimo/máximo/paridad (no se inventa un valor)',
  ejSinDato.jugadoresMin===null && ejSinDato.jugadoresMax===null && ejSinDato.paridad==='', JSON.stringify(ejSinDato));

// ---- se ve en la biblioteca y en el detalle (guardarEjercicio ya deja en biblioteca) ----
t('En la biblioteca se ve "8 a 12 (par)" para el primer ejercicio',
  (await pg.locator('.row:has-text("Rondo par 8 a 12")').innerText()).includes('8 a 12 (par)'));
await pg.click('.row:has-text("Rondo par 8 a 12")'); await pg.waitForTimeout(300);
t('En el detalle también se ve "8 a 12 (par) jugadores"', (await pg.locator('.tag:has-text("8 a 12 (par)")').count())===1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);
await pg.click('[data-volverDia]').catch(()=>{});

// ---- armar una sesión: marcar 12 presentes (par) ----
await pg.click('#nuevaSesion'); await pg.waitForTimeout(300);
const chips = await pg.locator('[data-asis]').all();
t('Hay jugadores para marcar presentes en la categoría de la sesión', chips.length>=12, String(chips.length));
for (let i=0;i<12;i++) await chips[i].click();
await pg.waitForTimeout(300);
t('Quedaron 12 marcados', (await pg.locator('[data-asis][aria-pressed="true"]').count())===12);

// con 12 (par): el ejercicio par 8-12 debería "encajar"; el impar 5-7, no
t('El aviso de hoy dice "12 jugadores (par)"', (await pg.locator('text=Hoy tenés').innerText()).includes('12') && (await pg.locator('text=Hoy tenés').innerText()).includes('par'));
const filaParConMatch = await pg.locator('.row:has-text("Rondo par 8 a 12")').innerText();
t('"Rondo par 8 a 12" muestra que encaja con 12 (par, dentro de 8 a 12)', filaParConMatch.includes('Encaja con tus 12'), filaParConMatch);
const filaImparSinMatch = await pg.locator('.row:has-text("Rondo impar 5 a 7")').innerText();
t('"Rondo impar 5 a 7" avisa que no encaja (pide impar, 5 a 7)', filaImparSinMatch.includes('Pide') && filaImparSinMatch.includes('5 a 7 (impar)'), filaImparSinMatch);
const filaSinDato = await pg.locator('.row:has-text("Ejercicio sin dato de jugadores")').innerText();
t('El ejercicio sin dato cargado no dice ni que encaja ni que no', !filaSinDato.includes('Encaja') && !filaSinDato.includes('Pide'), filaSinDato);

// el que encaja aparece antes que el que no, dentro del mismo grupo
// (los tres ejercicios creados quedaron con la fase por default, "Entrada en calor",
// que agrupa como "Ejercicios físicos", no "con pelota")
const nombresEnOrden = await pg.locator('.block:has-text("Ejercicios físicos") .row .row-name').allInnerTexts();
const idxPar = nombresEnOrden.indexOf('Rondo par 8 a 12');
const idxImpar = nombresEnOrden.indexOf('Rondo impar 5 a 7');
t('El que encaja (par 8 a 12) aparece antes que el que no (impar 5 a 7) con 12 jugadores',
  idxPar>=0 && idxImpar>=0 && idxPar<idxImpar, JSON.stringify(nombresEnOrden));

// ---- cambiar a "Ninguno" + cargar 7 a mano (impar): ahora el que encaja es el otro ----
await pg.click('[data-asisNinguno]'); await pg.waitForTimeout(300);
await pg.fill('#s-jug', '7');
await pg.click('[data-asisNinguno]'); await pg.waitForTimeout(300); // dispara guardarBorrador() (sin tocar items) y vuelve a pintar con el nuevo número
const filaImparAhoraSi = await pg.locator('.row:has-text("Rondo impar 5 a 7")').innerText();
t('Con 7 jugadores (impar), ahora "Rondo impar 5 a 7" encaja', filaImparAhoraSi.includes('Encaja con tus 7'), filaImparAhoraSi);
const filaParAhoraNo = await pg.locator('.row:has-text("Rondo par 8 a 12")').innerText();
t('...y "Rondo par 8 a 12" ya no (7 no es par ni está en 8 a 12)', filaParAhoraNo.includes('Pide'), filaParAhoraNo);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
