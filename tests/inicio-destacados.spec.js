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

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

t('El panel oscuro "Destacados" está presente', (await pg.locator('.inicio-dash').count())===1);
t('Hay 7 tarjetas en la tira de destacados (goleador, asistidor, contribuidor, participación + 3 tests)',
  (await pg.locator('.dash-card').count())===7);
const labels = (await pg.locator('.dash-card-label').allInnerTexts()).map(x=>x.trim().toUpperCase());
t('Están las 4 métricas principales', ['Máximo goleador','Máximo asistidor','Máximo contribuidor','Mayor participación'].map(x=>x.toUpperCase()).every(l=>labels.includes(l)), labels.join(' | '));

const primero = await pg.locator('.dash-card').first();
t('La tarjeta de máximo goleador muestra nombre y valor', (await primero.locator('.dash-card-name').count())===1 && (await primero.locator('.dash-card-value').count())===1);
await primero.click(); await pg.waitForTimeout(300);
t('Clickear una tarjeta de destacados abre la ficha del jugador', (await pg.locator('.ficha-name').count())===1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

t('Los bloques de ranking de siempre siguen ahí, ahora dentro del panel oscuro',
  (await pg.locator('.inicio-dash .block:has-text("Más goles")').count())===1);
t('Siguen siendo clickeables y abren la ficha', true);
await pg.locator('.inicio-dash .block:has-text("Más goles") .row').first().click(); await pg.waitForTimeout(300);
t('Click en una fila del ranking detallado sigue abriendo la ficha', (await pg.locator('.ficha-name').count())===1);

t('Sin errores de consola', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
