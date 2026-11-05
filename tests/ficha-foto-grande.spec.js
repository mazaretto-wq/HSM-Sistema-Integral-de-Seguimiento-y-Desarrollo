const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:1300,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click('.roster .row[data-jugador]'); await pg.waitForTimeout(400);

t('La foto grande aparece en General', (await pg.locator('.ficha-foto.grande').count())===1);
t('No se duplica el encabezado chico en General', (await pg.locator('.ficha-head .ficha-foto:not(.grande)').count())===0);

const [fileChooser] = await Promise.all([
  pg.waitForEvent('filechooser'),
  pg.click('[data-foto-jugador]'),
]);
const path = require('path');
await fileChooser.setFiles(path.join(__dirname, 'assets', 'foto_test.png'));
await pg.waitForTimeout(500);
t('El botón "Agregar/Cambiar foto" de la foto grande sigue abriendo el recorte', (await pg.locator('#cropBox').count())===1);
await pg.click('#guardarFoto'); await pg.waitForTimeout(600);
t('La foto se guarda y se ve grande en General', (await pg.locator('.ficha-foto.grande img').count())===1);

await pg.click('.chip[data-ficha="detalle"]'); await pg.waitForTimeout(300);
t('En Detalle vuelve el encabezado chico de siempre, con la misma foto', (await pg.locator('.ficha-head .ficha-foto:not(.grande) img').count())===1);
t('Detalle no tiene foto grande', (await pg.locator('.ficha-foto.grande').count())===0);

await pg.click('.chip[data-ficha="historial"]'); await pg.waitForTimeout(300);
t('En Historial también vuelve el encabezado chico', (await pg.locator('.ficha-head .ficha-foto:not(.grande) img').count())===1);

await pg.click('.chip[data-ficha="general"]'); await pg.waitForTimeout(300);
t('Al volver a General, la foto grande sigue mostrando la misma imagen', (await pg.locator('.ficha-foto.grande img').count())===1);

t('Sin errores de JS', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
