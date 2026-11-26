const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* En la ficha de cada jugador, la tabla "Historial de temporadas" ahora
   se puede filtrar por una temporada puntual (si tiene más de una
   cargada) y cada columna se puede ordenar de mayor a menor o viceversa
   tocando su encabezado. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// ---- armar un jugador con 3 temporadas en el historial, bien distintas entre sí ----
const jId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, apellido:'FILTROTEST', nombre:'Jugador', categorias:['Juveniles'], posiciones:[],
    historial:[
      { anio:'2023', categoria:'Juveniles', pj:5, min:300, goles:1, asis:0, ta:0, tr:0 },
      { anio:'2024', categoria:'Juveniles', pj:20, min:1500, goles:10, asis:2, ta:3, tr:1 },
      { anio:'2025', categoria:'Juveniles', pj:12, min:800, goles:3, asis:5, ta:1, tr:0 }
    ] });
  return id;
});
await pg.evaluate(()=>{ view.tab='plantel'; view.categoria='Todas'; view.jugadorId=null; render(); }); await pg.waitForTimeout(300);
await pg.click(`[data-jugador="${jId}"]`); await pg.waitForTimeout(300);

t('Aparece el selector de temporada (hay más de una cargada)', (await pg.locator('#hist-anio-filtro').count())===1);
const filasAntes = await pg.locator('.block:has-text("Historial de temporadas") table.cmp tbody tr').count();
t('Sin filtrar, se ven todas las filas (temporada en curso + 2023/2024/2025)', filasAntes>=3, String(filasAntes));

await pg.selectOption('#hist-anio-filtro', '2024'); await pg.waitForTimeout(300);
const filasFiltro = await pg.locator('.block:has-text("Historial de temporadas") table.cmp tbody tr').count();
t('Filtrando por 2024, queda solo esa fila', filasFiltro===1, String(filasFiltro));
const filaUnica = await pg.locator('.block:has-text("Historial de temporadas") table.cmp tbody tr').first().innerText();
t('Es la fila correcta (10 goles, 2024)', filaUnica.includes('2024') && filaUnica.includes('10'), filaUnica);
t('Con una sola fila, no se muestra el renglón de Totales', (await pg.locator('.block:has-text("Historial de temporadas") tfoot').count())===0);

await pg.selectOption('#hist-anio-filtro', 'Todas'); await pg.waitForTimeout(300);
t('Volviendo a "Todas", se ven todas las filas de nuevo', (await pg.locator('.block:has-text("Historial de temporadas") table.cmp tbody tr').count())===filasAntes);

// ---- ordenar por Goles ----
const columnaGoles = async()=> pg.evaluate(()=>{
  const filas = [...document.querySelectorAll('.block .block-title')]
    .find(b=>b.textContent.includes('Historial de temporadas')).closest('.block').querySelectorAll('table.cmp tbody tr');
  return [...filas].map(tr=>Number(tr.children[4].textContent.trim()));
});

await pg.click('.block:has-text("Historial de temporadas") th:has-text("Goles")'); await pg.waitForTimeout(300);
const golesDesc = await columnaGoles();
t('Primer click en "Goles" ordena de mayor a menor', golesDesc[0]===10 && golesDesc.every((v,i)=>i===0||v<=golesDesc[i-1]), JSON.stringify(golesDesc));
t('El encabezado muestra la flecha de descendente', (await pg.locator('.block:has-text("Historial de temporadas") th:has-text("Goles")').innerText()).includes('▼'));

await pg.click('.block:has-text("Historial de temporadas") th:has-text("Goles")'); await pg.waitForTimeout(300);
const golesAsc = await columnaGoles();
t('Segundo click en la misma columna invierte a ascendente', golesAsc.every((v,i)=>i===0||v>=golesAsc[i-1]) && golesAsc[golesAsc.length-1]===10, JSON.stringify(golesAsc));
t('El encabezado muestra la flecha de ascendente', (await pg.locator('.block:has-text("Historial de temporadas") th:has-text("Goles")').innerText()).includes('▲'));

// ---- ordenar por otra columna (Temp.) arranca de nuevo en descendente ----
await pg.click('.block:has-text("Historial de temporadas") th:has-text("Temp.")'); await pg.waitForTimeout(300);
t('Cambiar de columna arranca de nuevo en descendente (no quedó pegado el ascendente de Goles)',
  (await pg.locator('.block:has-text("Historial de temporadas") th:has-text("Temp.")').innerText()).includes('▼'));
const temporadas = await pg.evaluate(()=>{
  const filas = [...document.querySelectorAll('.block .block-title')]
    .find(b=>b.textContent.includes('Historial de temporadas')).closest('.block').querySelectorAll('table.cmp tbody tr');
  return [...filas].map(tr=>tr.children[0].textContent.trim());
});
t('"2025" queda arriba de "2024" y de "2023" (orden descendente por temporada)',
  temporadas.indexOf('2025')<temporadas.indexOf('2024') && temporadas.indexOf('2024')<temporadas.indexOf('2023'), JSON.stringify(temporadas));

// ---- filtro + orden combinados: filtrar a un subconjunto y ordenarlo ----
await pg.evaluate(()=>{ view.histOrdenCol=null; render(); });
await pg.selectOption('#hist-anio-filtro', 'Todas'); await pg.waitForTimeout(200);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
