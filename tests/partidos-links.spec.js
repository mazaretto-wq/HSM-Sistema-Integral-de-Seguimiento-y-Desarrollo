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

t('"Partidos" aparece en la barra para coordinación', (await pg.locator('.tabs button:has-text("Partidos")').count())===1);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('Coordinación ve el selector de categorías (el primer filtro)', (await pg.locator('[data-partidosCat]').count())===5);
t('Sin elegir categoría, pide elegir una', (await pg.locator('.empty').count())===1);

// ---- cargar un partido (Juveniles) ----
await pg.click('[data-partidosCat="Juveniles"]'); await pg.waitForTimeout(300);
t('Arranca sin partidos cargados para Juveniles', (await pg.locator('.empty:has-text("Todavía no hay partidos")').count())===1);
await pg.fill('#pl-titulo', 'vs Rival A · Fecha 10');
await pg.fill('#pl-link', 'meet.google.com/abc-defg');
await pg.click('#agregarPartidoLink'); await pg.waitForTimeout(400);
const guardado = await pg.evaluate(()=>db.partidosLinks[0]);
t('Quedó guardado con la categoría, el título y el link (con https:// agregado solo)',
  guardado.categoria==='Juveniles' && guardado.titulo==='vs Rival A · Fecha 10' && guardado.link==='https://meet.google.com/abc-defg', JSON.stringify(guardado));
t('Se ve el título en pantalla', (await pg.locator('.block-title:has-text("vs Rival A")').count())===1);
const href = await pg.locator('a:has-text("Ingresar")').first().getAttribute('href');
t('El botón "Ingresar" apunta al link real', href==='https://meet.google.com/abc-defg', String(href));

// ---- un link que ya trae https:// no se altera ----
await pg.fill('#pl-titulo', 'vs Rival B · Fecha 11');
await pg.fill('#pl-link', 'https://zoom.us/j/123456');
await pg.click('#agregarPartidoLink'); await pg.waitForTimeout(400);
const segundo = await pg.evaluate(()=>db.partidosLinks.find(p=>p.titulo.includes('Rival B')));
t('Un link que ya tenía https:// queda igual', segundo.link==='https://zoom.us/j/123456', segundo.link);
t('El más nuevo aparece primero', (await pg.locator('.block-title').nth(1).innerText()).toUpperCase().includes('RIVAL B'));

// ---- categoría distinta: Cadetes no ve los de Juveniles ----
await pg.click('[data-partidosCat="Cadetes"]'); await pg.waitForTimeout(300);
t('Cadetes no ve los partidos de Juveniles (categorías separadas)', (await pg.locator('.empty:has-text("Todavía no hay partidos")').count())===1);

// ---- eliminar un partido ----
await pg.click('[data-partidosCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click(`[data-borrarPartidoLink="${guardado.id}"]`); await pg.waitForTimeout(400);
t('"Eliminar" saca ese partido puntual', (await pg.evaluate((id)=>db.partidosLinks.some(p=>p.id===id), guardado.id))===false);
t('No tocó el otro partido de la misma categoría', (await pg.evaluate((id)=>db.partidosLinks.some(p=>p.id===id), segundo.id))===true);

// ---- DT: solo mira, acotado a su categoría, sin selector ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El DT no ve el selector de categorías (va directo a la suya)', (await pg.locator('[data-partidosCat]').count())===0);
t('El DT ve el partido de su categoría', (await pg.locator('.block-title:has-text("Rival B")').count())===1);
t('El DT NO tiene el formulario para cargar un partido', (await pg.locator('#agregarPartidoLink').count())===0);
t('El DT NO tiene botón para eliminar', (await pg.locator('[data-borrarPartidoLink]').count())===0);

// ---- jugador identificado: también solo mira, acotado a su categoría ----
await pg.click('#salir'); await pg.waitForTimeout(400);
const jugCadetes = await pg.evaluate(()=>db.jugadores.find(j=>(j.categorias||[]).includes('Cadetes')).id);
await entrarComoJugador(pg, jugCadetes);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
t('El jugador tampoco ve el selector de categorías', (await pg.locator('[data-partidosCat]').count())===0);
t('Cae en su propia categoría (Cadetes), sin partidos cargados ahí', (await pg.locator('.empty:has-text("Todavía no hay partidos")').count())===1);
t('El jugador NO tiene el formulario para cargar un partido (eso lo hace coordinación)', (await pg.locator('#agregarPartidoLink').count())===0);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
