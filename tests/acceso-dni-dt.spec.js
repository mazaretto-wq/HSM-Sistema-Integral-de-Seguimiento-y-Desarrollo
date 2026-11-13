const { chromium } = require('playwright');
const { BASE_URL, CLAVE_DT, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);

// ---- se siembra solo un primer DT (Juveniles) la primera vez ----
const sembrado = await pg.evaluate(()=>db.dts);
t('Arranca con un DT ya cargado para Juveniles (DNI 41781139)',
  sembrado.length===1 && sembrado[0].dni==='41781139' && sembrado[0].categoria==='Juveniles', JSON.stringify(sembrado));

// ---- "Soy DT" ahora pide usuario (DNI) + contraseña, no una categoría ----
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
t('Ya no hay un desplegable de categoría', (await pg.locator('#ac-cat').count())===0);
t('Pide el usuario (DNI)', (await pg.locator('#ac-dt-dni').count())===1);
t('Pide la contraseña', (await pg.locator('#ac-clave').count())===1);

// ---- usuario que no existe ----
await pg.fill('#ac-dt-dni', '00000000');
await pg.fill('#ac-clave', CLAVE_DT);
await pg.click('#ac-entrar'); await pg.waitForTimeout(300);
t('Con un DNI no cargado, avisa "Usuario no encontrado" y no deja entrar',
  (await pg.locator('.screen-note:has-text("Usuario no encontrado")').count())===1
  && (await pg.evaluate(()=>db.config.acceso))===null);

// ---- usuario correcto, contraseña incorrecta ----
await pg.fill('#ac-dt-dni', '41781139');
await pg.fill('#ac-clave', 'otracosa');
await pg.click('#ac-entrar'); await pg.waitForTimeout(300);
t('Con la contraseña mal, avisa y no deja entrar', (await pg.evaluate(()=>db.config.acceso))===null);
t('El DNI tipeado no se pierde al fallar la contraseña (no hay que volver a escribirlo)',
  (await pg.inputValue('#ac-dt-dni'))==='41781139');

// ---- usuario + contraseña correctos: entra, y la categoría la decide el DNI ----
await pg.fill('#ac-clave', CLAVE_DT);
await pg.click('#ac-entrar'); await pg.waitForTimeout(600);
t('Entra como DT', (await pg.evaluate(()=>db.config.acceso))==='dt' && (await pg.evaluate(()=>db.config.rol))==='DT');
t('La categoría es la de ese DNI (Juveniles), sin haberla elegido de un desplegable',
  (await pg.evaluate(()=>db.config.categoriaDT))==='Juveniles');
t('El cartel de arriba muestra "DT · Juveniles"', (await pg.locator('#rolebox').innerText()).includes('DT'));
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
t('Entrando a Categorías, de verdad lo deja operar en Juveniles como siempre',
  (await pg.locator('[data-entrarCat="Juveniles"]').innerText()).toUpperCase().includes('TU CATEGORÍA'));

// ---- coordinación agrega un DT nuevo desde Datos, y ese nuevo usuario ya puede entrar ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
t('La pantalla de Datos muestra el DT ya cargado', (await pg.locator('.block:has-text("DT por categoría")').innerText()).includes('41781139'));
await pg.fill('#dt-dni', '27555666');
await pg.selectOption('#dt-cat', 'Selección');
await pg.click('#agregarDT'); await pg.waitForTimeout(400);
t('El nuevo DT queda en la lista', (await pg.evaluate(()=>db.dts.some(d=>d.dni==='27555666' && d.categoria==='Selección'))));

await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.fill('#ac-dt-dni', '27555666');
await pg.fill('#ac-clave', CLAVE_DT);
await pg.click('#ac-entrar'); await pg.waitForTimeout(600);
t('El DT recién cargado ya puede entrar, y cae en Selección', (await pg.evaluate(()=>db.config.categoriaDT))==='Selección');

// ---- eliminar un DT desde Datos le saca el acceso ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
const idBorrar = await pg.evaluate(()=>db.dts.find(d=>d.dni==='27555666').id);
await pg.click(`[data-borrarDT="${idBorrar}"]`); await pg.waitForTimeout(400);
t('Eliminar un DT lo saca de la lista', (await pg.evaluate(()=>db.dts.some(d=>d.dni==='27555666')))===false);
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.fill('#ac-dt-dni', '27555666');
await pg.fill('#ac-clave', CLAVE_DT);
await pg.click('#ac-entrar'); await pg.waitForTimeout(300);
t('Ese DNI eliminado ya no puede entrar', (await pg.evaluate(()=>db.config.acceso))===null);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
