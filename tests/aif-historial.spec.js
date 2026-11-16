const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* el service worker de la PWA intercepta los fetch() antes que la ruta
   simulada de Playwright, así que estas pruebas lo bloquean para poder
   simular la respuesta de /api/aif-historial sin depender de la AIF real */
const mockHistorial = (pg) => pg.route(/\/api\/aif-historial/, route => {
  const url = new URL(route.request().url());
  const anio = url.searchParams.get('anio');
  const idtorneo = url.searchParams.get('idtorneo');
  if (!idtorneo){
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      categoria:'Promocional', anio, torneos: [{ idtorneo: anio+'1', nombre:'CAMPEONATO', division:'PRIMERA "A"' }]
    })});
  }
  return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
    categoria:'Promocional', anio, partidosEncontrados: 20,
    jugadores: [
      { idjugadorAif:'111', nombreAif:'AWADA FELIPE', pj:20, goles: anio==='2021'?5:10, ta:1, tr:0 },
      { idjugadorAif:null, nombreAif:'SCHIAGNO LORENZO', pj:10, goles:0, ta:2, tr:0 },
    ]
  })});
});

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

await pg.fill('#hist-aif-desde', '2021');
await pg.fill('#hist-aif-hasta', '2022');
await pg.click('#traerHistorialAIF');
await pg.waitForTimeout(1500);

t('Sin errores de JS trayendo el historial', errs.length===0, errs.join(' | '));
t('Pasa a la pantalla de revisión con los 2 jugadores encontrados', (await pg.locator('table.cmp tr').count())===3 /* header + 2 */);

const filaAwada = pg.locator('tr:has-text("AWADA FELIPE")');
t('Muestra el resumen por año (partidos jugados / goles)', (await filaAwada.innerText()).includes('2021: 20pj/5g') && (await filaAwada.innerText()).includes('2022: 20pj/10g'));
t('A "AWADA FELIPE" lo cruza solo con "AWADA, Felipe" de tu plantel (nombre exacto)',
  (await filaAwada.locator('select').inputValue())===idAwada);
t('A "SCHIAGNO LORENZO" (nadie en el plantel se llama así) lo deja sin elegir, no inventa un cruce',
  (await pg.locator('tr:has-text("SCHIAGNO LORENZO") select').inputValue())==='');

// elegir explícitamente "Ignorar" para Schiagno, guardar
await pg.selectOption('tr:has-text("SCHIAGNO LORENZO") select', 'ignorar');
await pg.click('#guardarHistorialAIF'); await pg.waitForTimeout(500);

const awada = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idAwada);
t('A AWADA le queda el historial de los 2 años, con los números reales de la AIF',
  JSON.stringify(awada.historial)===JSON.stringify([
    {anio:'2021',categoria:'Promocional',pj:20,goles:5,asis:0,min:0,ta:1,tr:0},
    {anio:'2022',categoria:'Promocional',pj:20,goles:10,asis:0,min:0,ta:1,tr:0},
  ]), JSON.stringify(awada.historial));
t('Minutos y asistencias quedan en 0 (la AIF no los tiene)', awada.historial.every(h=>h.min===0 && h.asis===0));
t('Queda vinculado por idjugadorAif para la próxima vez (no hay que volver a elegirlo a mano)', awada.aifId==='111');
t('Volvió a la pantalla inicial (no se queda trabado en la revisión)', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- volver a importar: ahora el cruce ya debería venir solo, por aifId ----
await mockHistorial(pg);
await pg.fill('#hist-aif-desde', '2021');
await pg.fill('#hist-aif-hasta', '2022');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(1500);
t('La segunda vez, a AWADA lo vincula solo por el aifId guardado (no por nombre)',
  (await pg.locator('tr:has-text("AWADA FELIPE") select').inputValue())===idAwada);
t('Lo marca con ✓ en la opción, para que se vea que ya estaba vinculado',
  (await pg.locator('tr:has-text("AWADA FELIPE") select option:has-text("✓")').count())===1);
await pg.click('#cancelarHistorialAIF'); await pg.waitForTimeout(300);
t('"Cancelar" vuelve sin guardar nada de nuevo', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- cambiar de categoría limpia cualquier revisión pendiente ----
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(1500);
await pg.click('[data-histAifCat="Cadetes"]'); await pg.waitForTimeout(300);
t('Cambiar de categoría durante la revisión la cancela (vuelve al formulario)', (await pg.locator('#traerHistorialAIF').count())===1);

// ---- año "desde" mayor que "hasta": no dispara nada ----
await pg.fill('#hist-aif-desde', '2025');
await pg.fill('#hist-aif-hasta', '2021');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(400);
t('No deja traer con "desde" mayor que "hasta"', (await pg.locator('table.cmp').count())===0);

// ---- si la AIF no tiene nada para esos años, avisa y no rompe nada ----
await pg.unroute(/\/api\/aif-historial/);
await pg.route(/\/api\/aif-historial/, route => route.fulfill({
  status:200, contentType:'application/json', body: JSON.stringify({ categoria:'Cadetes', anio:'2020', torneos: [] })
}));
await pg.fill('#hist-aif-desde', '2020');
await pg.fill('#hist-aif-hasta', '2020');
await pg.click('#traerHistorialAIF'); await pg.waitForTimeout(800);
t('Sin partidos encontrados, avisa y vuelve al formulario (no rompe nada)',
  (await pg.locator('text=no tiene datos').count())>=1 && (await pg.locator('#traerHistorialAIF').count())===1);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
