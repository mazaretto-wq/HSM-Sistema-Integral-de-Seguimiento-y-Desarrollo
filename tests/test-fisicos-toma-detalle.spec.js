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

await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.selectOption('#ac-cat','Juveniles');
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// dos jugadores frescos para una toma determinista
const ids = await pg.evaluate(()=>{
  const a = uid(), bb = uid(), c = uid();
  db.jugadores.push(
    { id:a, nombre:'Toma', apellido:'Uno', categorias:['Juveniles'] },
    { id:bb, nombre:'Toma', apellido:'Dos', categorias:['Juveniles'] },
    { id:c, nombre:'Toma', apellido:'Tres', categorias:['Juveniles'] },
  );
  render();
  return {a,bb,c};
});
await pg.waitForTimeout(200);

await pg.click('.tabs button:has-text("Test físicos")'); await pg.waitForTimeout(300);
await pg.click('[data-testTipo="cooper"]'); await pg.waitForTimeout(300);
await pg.click('[data-registrarTest]'); await pg.waitForTimeout(300);
await pg.fill('#test-fecha','2032-05-10');
await pg.fill(`[data-testValor="${ids.a}"]`, '1800');
await pg.fill(`[data-testValor="${ids.bb}"]`, '1500');
// Toma.Tres se deja sin valor a propósito
await pg.click('#guardarTest'); await pg.waitForTimeout(400);

t('Vuelve al detalle del test, con la toma de mayo listada', (await pg.locator('[data-testToma]', { hasText: /mayo/i }).count())===1);

await pg.locator('[data-testToma]', { hasText: /mayo/i }).click(); await pg.waitForTimeout(300);
t('Entra al detalle de la toma', (await pg.locator('h2.screen-title').innerText()).toLowerCase().includes('mayo'));
t('Lista a los 3 jugadores (incluido el que no tiene resultado)', (await pg.locator('.roster .row').count())>=3);
t('Toma Uno (1800, el mejor en Cooper) aparece primero', (await pg.locator('.roster .row').first().locator('.row-name').innerText()).includes('UNO'));
t('Toma Uno muestra su valor con unidad (con separador de miles)', (await pg.locator('.roster .row').first().locator('.score').innerText()).includes('1.800'));
const textoCompleto = await pg.locator('.roster').innerText();
t('Toma Tres (sin resultado) aparece como "Sin resultado"', /TRES[\s\S]*Sin resultado/i.test(textoCompleto) || textoCompleto.toUpperCase().includes('SIN RESULTADO'));

// click en un jugador de la toma abre su ficha completa
await pg.locator('.roster .row').first().click(); await pg.waitForTimeout(300);
t('Click en un jugador de la toma abre su ficha', (await pg.locator('.ficha-name').count())===1);

// volver con data-back cae en el detalle de la toma, no en la lista de tomas
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('"Volver" desde la ficha cae de nuevo en el detalle de la toma', (await pg.locator('h2.screen-title').innerText()).toLowerCase().includes('mayo'));
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('"Volver" desde la toma cae en la lista de tomas del test (Cooper)', (await pg.locator('h2.screen-title').innerText()).toUpperCase().includes('COOPER'));

t('Sin errores de consola', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
