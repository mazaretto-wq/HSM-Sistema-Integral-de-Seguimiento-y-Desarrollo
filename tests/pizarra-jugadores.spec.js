const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Los ejercicios de pizarra (dibujados sobre la cancha) también necesitan
   mínimo/máximo de jugadores y paridad para que el match de "Armar sesión"
   funcione con ellos, no solo con los de la biblioteca de texto. Reportado:
   se había agregado el campo a los ejercicios de texto, pero los de
   pizarra (que es por donde entró coordinación) seguían sin el campo. */

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
await pg.click('.chip:has-text("Ejercicios")'); await pg.waitForTimeout(300);

// ---- crear un ejercicio de pizarra con mínimo/máximo, sin paridad (como el de la captura: 9 a 15) ----
await pg.click('button:has-text("Crear ejercicio")'); await pg.waitForTimeout(250);
await pg.click('.piz-tipo:has-text("Ejercicios con pelota")'); await pg.waitForTimeout(200);
await pg.click('.roster .row:has-text("Ejercicios de definición")'); await pg.waitForTimeout(300);
t('El formulario de pizarra tiene los campos de mínimo y máximo de jugadores',
  (await pg.locator('#piz-jug-min').count())===1 && (await pg.locator('#piz-jug-max').count())===1);
await pg.fill('#piz-nombre', 'Recuperación tras pérdida');
await pg.fill('#piz-explicacion', 'Es un ejercicio de recuperación tras pérdida, son 3 colores...');
await pg.fill('#piz-jug-min', '9'); await pg.fill('#piz-jug-max', '15');
t('"Cualquiera" queda marcado por default (no fuerza a elegir par o impar)',
  (await pg.locator('[data-ejParidad=""][aria-pressed="true"]').count())===1);

// ---- elegir una herramienta de la paleta (dispara un render de la cancha):
//      lo ya tipeado en mínimo/máximo no se tiene que borrar ----
await pg.click('.chip[data-piz="herr"][data-v="cono"]'); await pg.waitForTimeout(200);
t('Después de elegir una herramienta, el mínimo sigue en 9 (no se borró con el render)', (await pg.locator('#piz-jug-min').inputValue())==='9');
t('...y el máximo sigue en 15', (await pg.locator('#piz-jug-max').inputValue())==='15');

await pg.click('#piz-guardar'); await pg.waitForTimeout(500);
const ejPiz = await pg.evaluate(()=>db.pizarra.find(p=>p.nombre==='Recuperación tras pérdida'));
t('Queda guardado con mínimo, máximo y sin paridad (cualquiera)', ejPiz.jugadoresMin===9 && ejPiz.jugadoresMax===15 && ejPiz.paridad==='', JSON.stringify(ejPiz));

// ---- se ve en la tarjeta de la lista y en el detalle ----
t('Se ve "9 a 15 jug." en la tarjeta de la lista', (await pg.locator('.piz-card:has-text("Recuperación tras pérdida")').innerText()).includes('9 a 15 jug.'));
await pg.click('[data-piz="abrir"][data-id="'+ejPiz.id+'"]'); await pg.waitForTimeout(300);
t('Se ve "9 a 15 jugadores" en el detalle', (await pg.locator('.screen-note').first().innerText()).includes('9 a 15 jugadores'));
await pg.click('[data-piz="volver"]'); await pg.waitForTimeout(300);

// ---- editar un ejercicio VIEJO de pizarra (sin estos campos) ----
const ejViejoId = await pg.evaluate(()=>{
  const id = uid();
  db.pizarra.push({ id, categoria:'pelota', subcategoria:'', nombre:'Ejercicio viejo sin dato',
    duracion:'10 min', explicacion:'', creado:new Date().toISOString(), modificado:null, elementos:[], trazos:[] });
  return id;
});
await pg.evaluate(()=>{ view.pizSub='lista'; render(); }); await pg.waitForTimeout(300);
await pg.click(`[data-piz="editar"][data-id="${ejViejoId}"]`); await pg.waitForTimeout(300);
t('Un ejercicio viejo sin el dato lo muestra vacío al editar (no se inventa un valor)',
  (await pg.locator('#piz-jug-min').inputValue())==='' && (await pg.locator('#piz-jug-max').inputValue())==='');
t('...y queda "Cualquiera" marcado (no par ni impar al azar)', (await pg.locator('[data-ejParidad=""][aria-pressed="true"]').count())===1);
await pg.fill('#piz-jug-min', '6'); await pg.fill('#piz-jug-max', '6');
await pg.click('[data-ejParidad="par"]'); await pg.waitForTimeout(200);
await pg.click('#piz-guardar'); await pg.waitForTimeout(500);
const ejViejoActualizado = await pg.evaluate((id)=>db.pizarra.find(p=>p.id===id), ejViejoId);
t('Al completarlo y guardar, queda con el dato nuevo (coordinación lo agregó a mano, como se pidió)',
  ejViejoActualizado.jugadoresMin===6 && ejViejoActualizado.jugadoresMax===6 && ejViejoActualizado.paridad==='par', JSON.stringify(ejViejoActualizado));

// ---- el match en "Armar sesión" también corre para ejercicios de pizarra ----
await pg.click('.chip:has-text("Día a día")'); await pg.waitForTimeout(300);
await pg.click('#nuevaSesion'); await pg.waitForTimeout(300);
await pg.fill('#s-jug', '12'); await pg.waitForTimeout(200);
await pg.click('[data-asisNinguno]'); await pg.waitForTimeout(300); // sincroniza el borrador con el 12 recién tipeado
const filaRecuperacion = await pg.locator('.row:has-text("Recuperación tras pérdida")').innerText();
t('Con 12 jugadores, "Recuperación tras pérdida" (9 a 15, cualquiera) encaja', filaRecuperacion.includes('Encaja con tus 12'), filaRecuperacion);
const filaViejo = await pg.locator('.row:has-text("Ejercicio viejo sin dato")').innerText();
t('"Ejercicio viejo sin dato" (ahora 6, par) con 12 jugadores no encaja (12 no es 6, aunque sí es par)', filaViejo.includes('Pide'), filaViejo);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
