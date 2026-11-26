const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Además de "con pelota" / "físicos", el DT quiere poder taguear un
   ejercicio (de biblioteca o de pizarra) con una segmentación amplia por
   posición (Defensores / Mediocampistas / Delanteros) para después poder
   filtrar la lista y encontrar rápido "ejercicios para defensores". No es
   para asignar jugadores ni para el match de "Armar sesión": es solo para
   encontrar y filtrar en las dos pantallas de biblioteca. */

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

// ---- crear un ejercicio de biblioteca marcado para Defensores ----
await pg.click('[data-go="nuevoEjercicio"]'); await pg.waitForTimeout(300);
t('Por defecto la posición queda en "Todas"', (await pg.locator('[data-ejPosicion=""][aria-pressed="true"]').count())===1);
await pg.fill('#e-nombre', 'Salida en línea de 4');
await pg.click('[data-ejPosicion="Defensores"]'); await pg.waitForTimeout(200);
t('Al tocar "Defensores" queda marcado', (await pg.locator('[data-ejPosicion="Defensores"][aria-pressed="true"]').count())===1);
t('"Todas" se desmarca solo', (await pg.locator('[data-ejPosicion=""][aria-pressed="true"]').count())===0);
await pg.click('#guardarEjercicio'); await pg.waitForTimeout(400);
const ejDef = await pg.evaluate(()=>db.ejercicios.find(e=>e.nombre==='Salida en línea de 4'));
t('Queda guardado con posicion "Defensores"', ejDef.posicion==='Defensores', JSON.stringify(ejDef));

// ---- otro, sin marcar nada (para todas) ----
await pg.click('[data-go="nuevoEjercicio"]'); await pg.waitForTimeout(300);
await pg.fill('#e-nombre', 'Rondo general');
await pg.click('#guardarEjercicio'); await pg.waitForTimeout(400);
const ejGeneral = await pg.evaluate(()=>db.ejercicios.find(e=>e.nombre==='Rondo general'));
t('Sin tocar nada, queda sin posición (para todas)', ejGeneral.posicion==='', JSON.stringify(ejGeneral));

// ---- se ve en la biblioteca y en el detalle ----
// (".pill" lo muestra en mayúsculas por CSS; ":has-text" de Playwright no distingue mayúsculas)
t('En la biblioteca se ve la etiqueta "Defensores"',
  (await pg.locator('.row:has-text("Salida en línea de 4") .pill:has-text("Defensores")').count())===1);
await pg.click('.row:has-text("Salida en línea de 4")'); await pg.waitForTimeout(300);
t('En el detalle también se ve la etiqueta "Defensores"', (await pg.locator('.tag:has-text("Defensores")').count())===1);
await pg.click('[data-back]'); await pg.waitForTimeout(300);

// ---- filtro por posición en la biblioteca ----
await pg.click('.chip:has-text("Defensores")'); await pg.waitForTimeout(300);
t('Filtrando por "Defensores" solo aparece ese ejercicio', await pg.locator('.row:has-text("Salida en línea de 4")').isVisible());
t('"Rondo general" no aparece filtrando por Defensores', (await pg.locator('.row:has-text("Rondo general")').count())===0);
await pg.click('.chip:has-text("Todas")').catch(()=>{});
// hay dos chips "Todas" (fase y posición); nos asegura volver a ver ambos ejercicios eligiendo el segundo
await pg.evaluate(()=>{ view.bibPosicionFiltro='Todas'; render(); }); await pg.waitForTimeout(300);
t('Sin filtro de posición, vuelven a verse los dos', (await pg.locator('.row:has-text("Rondo general")').count())===1 && (await pg.locator('.row:has-text("Salida en línea de 4")').count())===1);

// ---- lo mismo, pero en un ejercicio de pizarra ----
await pg.click('[data-volverDia]'); await pg.waitForTimeout(300);
await pg.click('.chip:has-text("Ejercicios")'); await pg.waitForTimeout(300);

// uno viejo, sin posición (para comparar el filtro contra él)
const pizViejoId = await pg.evaluate(()=>{
  const id = uid();
  db.pizarra.push({ id, categoria:'pelota', subcategoria:'', nombre:'Ejercicio pizarra sin posicion',
    duracion:'10 min', explicacion:'', creado:new Date().toISOString(), modificado:null, elementos:[], trazos:[] });
  return id;
});
await pg.evaluate(()=>render());

await pg.click('button:has-text("Crear ejercicio")'); await pg.waitForTimeout(250);
await pg.click('.piz-tipo:has-text("Ejercicios con pelota")'); await pg.waitForTimeout(200);
await pg.click('.roster .row:has-text("Ejercicios de definición")'); await pg.waitForTimeout(300);
await pg.fill('#piz-nombre', 'Finalización 1v1 vs arquero');
t('El editor de pizarra también tiene el campo de posición, en "Todas" por defecto',
  (await pg.locator('[data-ejPosicion=""][aria-pressed="true"]').count())===1);
await pg.click('[data-ejPosicion="Delanteros"]'); await pg.waitForTimeout(200);

// elegir una herramienta dispara un render: la posición elegida no se debe perder
await pg.click('.chip[data-piz="herr"][data-v="cono"]'); await pg.waitForTimeout(200);
t('Después de elegir una herramienta, "Delanteros" sigue marcado (no se borró con el render)',
  (await pg.locator('[data-ejPosicion="Delanteros"][aria-pressed="true"]').count())===1);

await pg.click('#piz-guardar'); await pg.waitForTimeout(500);
const pizDel = await pg.evaluate(()=>db.pizarra.find(p=>p.nombre==='Finalización 1v1 vs arquero'));
t('El ejercicio de pizarra queda guardado con posicion "Delanteros"', pizDel.posicion==='Delanteros', JSON.stringify(pizDel));
t('Se ve la etiqueta en la tarjeta de la lista',
  (await pg.locator('.piz-card:has-text("Finalización 1v1 vs arquero") .pill:has-text("Delanteros")').count())===1);

await pg.click('[data-piz="abrir"][data-id="'+pizDel.id+'"]'); await pg.waitForTimeout(300);
t('Se ve la etiqueta en el detalle del ejercicio de pizarra', (await pg.locator('.screen-note').first().innerText()).includes('Delanteros'));
await pg.click('[data-piz="volver"]'); await pg.waitForTimeout(300);

// ---- "Ejercicios por posición" es un 4° filtro general (con Todos / con
//      pelota / físicos), excluyente con esos otros: solo al elegirlo
//      aparecen las 3 macroposiciones como sub-filtro ----
t('Con "Todos" elegido, por defecto no se ven los sub-filtros de posición',
  (await pg.locator('.chip:has-text("Defensores")').count())===0);
await pg.click('.chip:has-text("Ejercicios con pelota")'); await pg.waitForTimeout(300);
t('Con "Ejercicios con pelota" elegido, se ven las subcategorías de siempre, no las posiciones',
  (await pg.locator('.chip:has-text("Ejercicios de definición")').count())===1 &&
  (await pg.locator('.chip:has-text("Defensores")').count())===0);

await pg.click('.chip:has-text("Ejercicios por posición")'); await pg.waitForTimeout(300);
t('Al elegir "Ejercicios por posición" aparecen las 3 macroposiciones (y no las subcategorías de con pelota/físicos)',
  (await pg.locator('.chip:has-text("Defensores")').count())===1 &&
  (await pg.locator('.chip:has-text("Mediocampistas")').count())===1 &&
  (await pg.locator('.chip:has-text("Delanteros")').count())===1 &&
  (await pg.locator('.chip:has-text("Ejercicios de definición")').count())===0);
t('En "Ejercicios por posición" con "Todas" (default), se ven los que tienen alguna posición marcada, pero no el que no tiene ninguna',
  (await pg.locator('.piz-card:has-text("Finalización 1v1 vs arquero")').count())===1 &&
  (await pg.locator('.piz-card:has-text("Ejercicio pizarra sin posicion")').count())===0);

await pg.click('.chip:has-text("Delanteros")'); await pg.waitForTimeout(300);
t('Filtrando por "Delanteros" aparece el ejercicio recién creado',
  await pg.locator('.piz-card:has-text("Finalización 1v1 vs arquero")').isVisible());

await pg.click('.chip:has-text("Todos")'); await pg.waitForTimeout(300);
t('Volviendo a "Todos" se vuelven a ver los dos (con o sin posición marcada)',
  (await pg.locator('.piz-card:has-text("Finalización 1v1 vs arquero")').count())===1 &&
  (await pg.locator('.piz-card:has-text("Ejercicio pizarra sin posicion")').count())===1);

// ---- un ejercicio viejo de pizarra, sin el campo, no rompe nada al editarlo ----
await pg.click(`[data-piz="editar"][data-id="${pizViejoId}"]`); await pg.waitForTimeout(300);
t('Editando un ejercicio viejo de pizarra sin el dato, queda "Todas" marcado (no se inventa un valor)',
  (await pg.locator('[data-ejPosicion=""][aria-pressed="true"]').count())===1);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
