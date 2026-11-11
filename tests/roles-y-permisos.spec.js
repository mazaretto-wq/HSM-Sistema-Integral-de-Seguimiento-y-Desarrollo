const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);

// ---- permisos básicos de los 3 roles ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
// la app ya siembra sola la base completa del club al no haber jugadores,
// así que no hace falta pasar por "Datos" (que además ya no tiene solapa visible)
t('Coordinación ve las 6 solapas (con Vs)', (await pg.locator('.tabs button:visible').count())===6);
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.locator('[data-entrarCat]').first().click(); await pg.waitForTimeout(300);
await pg.locator('.roster .row[data-jugador]').first().click(); await pg.waitForTimeout(400);
t('Coordinación puede eliminar jugadores', (await pg.locator('[data-borrar]').count())===1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.selectOption('#ac-cat','Juveniles');
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
t('DT ve 7 solapas (con Vs, sin Datos)', (await pg.locator('.tabs button:visible').count())===7);
t('La primera solapa del DT dice Inicio', (await pg.locator('.tabs button').first().innerText()).toUpperCase()==='INICIO');
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.locator('.roster .row[data-jugador]').first().click(); await pg.waitForTimeout(400);
t('DT puede editar pero no eliminar jugadores', (await pg.locator('[data-editar]').count())>=1 && (await pg.locator('[data-borrar]').count())===0);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-jugador'); await pg.waitForTimeout(700);
t('Jugador también ve 4 solapas (Inicio, Plantel, Rutinas, Vs)', (await pg.locator('.tabs button:visible').count())===4);
t('Jugador aterriza en Inicio', (await pg.locator('h2.screen-title').innerText())==='INICIO');
await pg.click('.tabs button:has-text("Plantel")'); await pg.waitForTimeout(300);
await pg.locator('.roster .row').first().click(); await pg.waitForTimeout(400);
t('Jugador no puede editar nada', (await pg.locator('[data-editar],[data-borrar]').count())===0);

// ---- ficha: tabs Detalle/Historial, edición inline para coordinación ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
const jugId = await pg.evaluate(()=>{
  const j = db.jugadores.find(j=>db.evaluaciones.some(e=>e.jugadorId===j.id));
  return (j||db.jugadores[0]).id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.tab='plantel'; render(); }, jugId);
await pg.waitForTimeout(400);
const chips = await pg.locator('.chips').first().locator('.chip').allInnerTexts();
t('La ficha tiene 4 solapas: General, Detalle, Historial, Lesiones', chips.length===4, JSON.stringify(chips));
await pg.click('.chip[data-ficha="detalle"]'); await pg.waitForTimeout(300);
t('Aparece "Corregir valores de esta solapa"', (await pg.locator('[data-editarFicha]').count())===1);
await pg.click('[data-editarFicha]'); await pg.waitForTimeout(300);
t('Entra en modo edición con inputs', (await pg.locator('table.cmp input[data-editval]').count())>0);
await pg.click('[data-cancelarEdicionFicha]'); await pg.waitForTimeout(300);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

// ---- fotos: fallback local sigue funcionando ----
await pg.evaluate((id)=>{ view.jugadorId=id; render(); }, jugId);
await pg.waitForTimeout(300);
const [fileChooser] = await Promise.all([
  pg.waitForEvent('filechooser'),
  pg.click('[data-foto-jugador]'),
]);
const path = require('path');
await fileChooser.setFiles(path.join(__dirname, 'assets', 'foto_test.png'));
await pg.waitForTimeout(500);
t('Entra a la pantalla de ajustar encuadre', (await pg.locator('#cropBox').count())===1);
await pg.click('#guardarFoto'); await pg.waitForTimeout(600);
t('La foto se guarda (fallback local) y se ve en la ficha', (await pg.locator('.ficha-foto img').count())===1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

// ---- Entrenos: ejercicios con pelota / físicos sigue agrupando ----
await pg.click('.tabs button:has-text("Entrenos")'); await pg.waitForTimeout(300);
await pg.click('#nuevaSesion'); await pg.waitForTimeout(300);
t('Sigue existiendo "Agregar de la biblioteca" agrupada', (await pg.locator('.block-title:has-text("Ejercicios con pelota"), .block-title:has-text("Ejercicios físicos"), .block-title:has-text("Agregar de la biblioteca")').count())>=1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

// ---- pizarra: herramientas de cuadrado siguen ahí ----
await pg.click('.chip:has-text("Ejercicios")'); await pg.waitForTimeout(300);
await pg.click('button:has-text("Crear ejercicio")'); await pg.waitForTimeout(250);
await pg.click('.piz-tipo:has-text("Ejercicios con pelota")'); await pg.waitForTimeout(200);
await pg.click('.roster .row:has-text("Ejercicios de definición")'); await pg.waitForTimeout(300);
t('Las herramientas de cuadrado siguen en la paleta', (await pg.locator('.chip[data-piz="herr"][data-v="cuadrado"]').count())===1);
t('Las 10 herramientas entran sin desplazarse (wrap)', (await pg.locator('.piz-herramientas').evaluate(el=>getComputedStyle(el).flexWrap))==='wrap');

t('Sin errores de consola en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
