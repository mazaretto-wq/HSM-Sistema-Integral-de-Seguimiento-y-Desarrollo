const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* el service worker de la PWA intercepta los fetch() antes que la ruta
   simulada de Playwright, así que estas pruebas lo bloquean para poder
   simular la respuesta de /api/aif-historial sin depender de la AIF real */
const mockHistorial = (pg) => pg.route(/\/api\/aif-historial/, route => route.fulfill({
  status:200, contentType:'application/json', body: JSON.stringify({
    categoria:'Promocional', idequipo:'71950475',
    jugadores: [
      { idjugadorAif:'111', nombreAif:'AWADA FELIPE', porAnio: {
        '2021': {pj:20, min:1400, goles:5, ta:1, tr:0},
        '2022': {pj:20, min:1500, goles:10, ta:1, tr:0},
      }},
      { idjugadorAif:'222', nombreAif:'SCHIAGNO LORENZO', porAnio: {
        '2021': {pj:10, min:600, goles:0, ta:2, tr:0},
      }},
    ]
  })
}));

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}, serviceWorkers:'block'});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());

await mockHistorial(pg);
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// jugador de Promocional con nombre que matchee la AIF, para probar el cruce automático
const idAwada = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, apellido:'AWADA', nombre:'Felipe', categorias:['Promocional'] });
  render();
  return id;
});

await pg.click('.tabs button:has-text("Datos")'); await pg.waitForTimeout(300);
t('El bloque "Importar historial AIF" está en Datos', (await pg.locator('.block-title:has-text("Importar historial AIF")').count())===1);
const chipsHistAif = (await pg.locator('[data-histAifCat]').allInnerTexts()).map(x=>x.toUpperCase());
t('Las categorías del filtro son las 4 permitidas, Juveniles no aparece',
  JSON.stringify(chipsHistAif)===JSON.stringify(['PROMOCIONAL','CADETES','JUVENILES B','SELECCIÓN']), chipsHistAif.join(' | '));
t('Promocional arranca elegida por default', (await pg.locator('[data-histAifCat="Promocional"][aria-pressed="true"]').count())===1);
const anioActual = await pg.evaluate(()=>ANIO_ACTUAL);
t('El "hasta" por default es el año anterior al actual (nunca la temporada en curso)',
  (await pg.locator('#hist-aif-desde').inputValue())==='2023' && (await pg.locator('#hist-aif-hasta').inputValue())===String(Number(anioActual)-1),
  await pg.locator('#hist-aif-hasta').inputValue());

await pg.fill('#hist-aif-desde', '2021');
await pg.fill('#hist-aif-hasta', '2022');
await pg.click('#traerHistorialAIF');
await pg.waitForTimeout(1200);

t('Sin errores de JS trayendo el historial', errs.length===0, errs.join(' | '));
t('Pasa a la pantalla de revisión con los 2 jugadores encontrados', (await pg.locator('table.cmp tr').count())===3 /* header + 2 */);

const filaAwada = pg.locator('tr:has-text("AWADA FELIPE")');
t('Muestra el resumen por año, con los minutos reales (ya no en 0)',
  (await filaAwada.innerText()).includes('2021: 20pj/1400min/5g') && (await filaAwada.innerText()).includes('2022: 20pj/1500min/10g'));
t('A "AWADA FELIPE" lo cruza solo con "AWADA, Felipe" de tu plantel (nombre exacto)',
  (await filaAwada.locator('select').inputValue())===idAwada);
t('A "SCHIAGNO LORENZO" (nadie en el plantel se llama así) lo deja sin elegir, no inventa un cruce',
  (await pg.locator('tr:has-text("SCHIAGNO LORENZO") select').inputValue())==='');

// elegir explícitamente "Ignorar" para Schiagno, guardar
await pg.selectOption('tr:has-text("SCHIAGNO LORENZO") select', 'ignorar');
await pg.click('#guardarHistorialAIF'); await pg.waitForTimeout(500);

const awada = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idAwada);
t('A AWADA le queda el historial de los 2 años, con partidos/minutos/goles reales de la AIF',
  JSON.stringify(awada.historial)===JSON.stringify([
    {anio:'2021',categoria:'Promocional',pj:20,goles:5,asis:0,min:1400,ta:1,tr:0},
    {anio:'2022',categoria:'Promocional',pj:20,goles:10,asis:0,min:1500,ta:1,tr:0},
  ]), JSON.stringify(awada.historial));
t('Solo las asistencias quedan en 0 (es lo único que la AIF no tiene)', awada.historial.every(h=>h.asis===0));
t('Los minutos SÍ quedan cargados de verdad (no en 0)', awada.historial.every(h=>h.min>0));
t('Queda vinculado por idjugadorAif para la próxima vez (no hay que volver a elegirlo a mano)', awada.aifId==='111');
t('Volvió a la pantalla inicial (no se queda trabado en la revisión)', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- volver a importar: ahora el cruce ya debería venir solo, por aifId ----
await mockHistorial(pg);
await pg.fill('#hist-aif-desde', '2021');
await pg.fill('#hist-aif-hasta', '2022');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(1200);
t('La segunda vez, a AWADA lo vincula solo por el aifId guardado (no por nombre)',
  (await pg.locator('tr:has-text("AWADA FELIPE") select').inputValue())===idAwada);
t('Lo marca con ✓ en la opción, para que se vea que ya estaba vinculado',
  (await pg.locator('tr:has-text("AWADA FELIPE") select option:has-text("✓")').count())===1);
await pg.click('#cancelarHistorialAIF'); await pg.waitForTimeout(300);
t('"Cancelar" vuelve sin guardar nada de nuevo', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- cambiar de categoría limpia cualquier revisión pendiente ----
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(1200);
await pg.click('[data-histAifCat="Cadetes"]'); await pg.waitForTimeout(300);
t('Cambiar de categoría durante la revisión la cancela (vuelve al formulario)', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- año "desde" mayor que "hasta": no dispara nada ----
await pg.fill('#hist-aif-desde', '2025');
await pg.fill('#hist-aif-hasta', '2021');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(400);
t('No deja traer con "desde" mayor que "hasta"', (await pg.locator('table.cmp').count())===0);

// ---- la temporada en curso NUNCA se guarda en el historial (se arma
//      sola con Cargar > Partido + la base de planilla; guardarla acá
//      la duplicaba - ver migración de limpieza al arrancar) ----
await pg.click('[data-histAifCat="Promocional"]'); await pg.waitForTimeout(200); // el paso anterior había dejado elegida "Cadetes"
// apellido inventado: el seed ya trae un "VANZINI, Francisco" real en
// Promocional, y con el mismo nombre se duplicaría en el desplegable
const idVanzini = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, apellido:'ZZZTESTVANZINI', nombre:'Francisco', categorias:['Promocional'], base:[{categoria:'Promocional', pj:17, goles:38, ta:0, tr:0}] });
  render();
  return id;
});
await pg.unroute(/\/api\/aif-historial/);
await pg.route(/\/api\/aif-historial/, route => route.fulfill({
  status:200, contentType:'application/json', body: JSON.stringify({
    categoria:'Promocional', jugadores: [
      { idjugadorAif:'333', nombreAif:'ZZZTESTVANZINI FRANCISCO', porAnio: {
        '2025': {pj:19, min:1330, goles:0, ta:3, tr:0},
        [anioActual]: {pj:22, min:1540, goles:46, ta:0, tr:0},
      }},
    ]
  })
}));
await pg.fill('#hist-aif-desde', '2025');
await pg.fill('#hist-aif-hasta', anioActual);
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(1200);
const filaVanzini = await pg.locator('tr:has-text("ZZZTESTVANZINI FRANCISCO")').innerText();
t('Muestra la temporada en curso en el resumen, pero avisa que no se va a guardar',
  filaVanzini.includes(`${anioActual}: 22pj/1540min/46g (no se guarda`), filaVanzini);
t('Lo cruza solo con el jugador correcto (nombre único, sin ambigüedad)',
  (await pg.locator('tr:has-text("ZZZTESTVANZINI FRANCISCO") select').inputValue())===idVanzini);
await pg.click('#guardarHistorialAIF'); await pg.waitForTimeout(500);
const vanzini = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idVanzini);
t('Al guardar, la temporada en curso NO se escribe en el historial (solo 2025)',
  (vanzini.historial||[]).length===1 && vanzini.historial[0].anio==='2025', JSON.stringify(vanzini.historial));
t('La base de planilla del año en curso queda intacta (nunca se tocó)',
  JSON.stringify(vanzini.base)===JSON.stringify([{categoria:'Promocional', pj:17, goles:38, ta:0, tr:0}]));

// ---- si la AIF no tiene jugadores para esa categoría, avisa y no rompe nada ----
await pg.unroute(/\/api\/aif-historial/);
await pg.route(/\/api\/aif-historial/, route => route.fulfill({
  status:200, contentType:'application/json', body: JSON.stringify({ categoria:'Cadetes', jugadores: [] })
}));
await pg.fill('#hist-aif-desde', '2020');
await pg.fill('#hist-aif-hasta', '2020');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(800);
t('Sin jugadores encontrados, avisa y vuelve al formulario (no rompe nada)',
  (await pg.locator('text=no tiene datos').count())>=1 && (await pg.locator('#traerHistorialAIF').count())===1);

// ---- si la AIF (o la red) falla, avisa y no rompe nada ----
await pg.unroute(/\/api\/aif-historial/);
await pg.route(/\/api\/aif-historial/, route => route.fulfill({
  status:502, contentType:'application/json', body: JSON.stringify({ error:'No se pudo leer la AIF' })
}));
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(800);
t('Si la AIF no responde bien, avisa con un toast y no rompe nada',
  (await pg.locator('text=No se pudo traer el historial').count())>=1 && (await pg.locator('#traerHistorialAIF').count())===1);

// ---- limpieza de filas con el año en curso puesto a mano (de la versión
//      vieja, antes de este arreglo): corre SIEMPRE al abrir la app, no
//      solo "una vez" (si no, una nube que todavía tiene el dato corrupto
//      -por ejemplo porque la limpieza anterior nunca llegó a subirse-
//      lo volvería a traer y no se corregiría nunca) ----
await pg.evaluate(async (id)=>{
  const j = db.jugadores.find(x=>x.id===id);
  j.historial.push({ anio: ANIO_ACTUAL, categoria:'Promocional', pj:22, goles:46, asis:0, min:1540, ta:0, tr:0 });
  j.historial.push({ anio: ANIO_ACTUAL+' Apertura', categoria:'Promocional', pj:5, goles:1, asis:0, min:300, ta:0, tr:0 });
  await Store.save(db);
}, idVanzini);
await pg.reload(); await pg.waitForTimeout(2000);
const vanziniTrasReabrir = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idVanzini);
t('Al reabrir, la limpieza automática saca la fila con el año en curso puesto a mano',
  !vanziniTrasReabrir.historial.some(h=>h.anio===anioActual), JSON.stringify(vanziniTrasReabrir.historial));
t('Pero no toca una fila legítima tipo "2026 Apertura" (no es el año exacto)',
  vanziniTrasReabrir.historial.some(h=>h.anio===anioActual+' Apertura'), JSON.stringify(vanziniTrasReabrir.historial));
t('La fila de 2025 (la que sí correspondía guardar) sigue estando',
  vanziniTrasReabrir.historial.some(h=>h.anio==='2025'));

// ---- y corre de nuevo sin problema si se repite (abrir dos veces seguidas
//      no debe romper nada ni sacar filas que ya estaban bien) ----
await pg.reload(); await pg.waitForTimeout(2000);
const vanziniSegundaVez = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idVanzini);
t('Correr la limpieza de nuevo no cambia nada más (es segura de repetir)',
  JSON.stringify(vanziniSegundaVez.historial)===JSON.stringify(vanziniTrasReabrir.historial));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
