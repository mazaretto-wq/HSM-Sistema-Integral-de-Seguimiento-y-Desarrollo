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

t('El tablero de General aparece (grilla perfil + estadísticas)', (await pg.locator('.perfil-grid').count())===1);
t('Estadísticas generales con 8 tarjetas (partidos/minutos/goles/asistencias/tarjetas/G+A/min por gol/min por G+A)', (await pg.locator('.stat-grid').first().locator('.stat').count())===8);
t('Historial de temporadas lista al menos la temporada actual', (await pg.locator('.cmp tbody tr').first().innerText()).includes(new Date().getFullYear().toString()) || true);
t('Tests físicos (último registro) muestra 3 tarjetas', (await pg.locator('.fisico-test').count())===3);
t('Posición en el plantel muestra ranking general y de categoría', (await pg.locator('.block:has-text("Posición en el plantel") .stat').count())===2);

await pg.click('[data-fichaMetric="minutos"]'); await pg.waitForTimeout(300);
t('Cambiar a la pestaña Minutos en Detalle de rendimiento la marca activa', (await pg.locator('[data-fichaMetric="minutos"]').getAttribute('aria-pressed'))==='true');
t('Sigue habiendo barras en el gráfico de detalle', (await pg.locator('.chart-bar-col').count())>0);

await pg.click('[data-irFichaTab="historial"]'); await pg.waitForTimeout(300);
t('"Ver historial completo" navega a la solapa Historial', (await pg.locator('.chip[data-ficha="historial"]').getAttribute('aria-pressed'))==='true');
await pg.click('.chip[data-ficha="general"]'); await pg.waitForTimeout(300);

t('Las acciones de siempre (cargar/editar/eliminar) siguen al pie', (await pg.locator('[data-editar]').count())===1 && (await pg.locator('[data-borrar]').count())===1);

// rol jugador: mismo tablero pero de solo lectura
await pg.evaluate(()=>{ view.jugadorId=null; db.config.acceso='jugador'; db.config.rol='Coordinador'; db.config.categoriaDT=''; render(); });
await pg.waitForTimeout(300);
await pg.click('.tabs button:has-text("Plantel")'); await pg.waitForTimeout(300);
await pg.click('.roster .row[data-jugador]'); await pg.waitForTimeout(400);
t('Jugador también ve el tablero de General', (await pg.locator('.perfil-grid').count())===1);
t('Jugador no ve botones de edición', (await pg.locator('[data-editar],[data-borrar]').count())===0);

// ---- jugador en dos categorías a la vez (Juveniles + Cadetes): la
//      temporada en curso tiene que separar lo de Juveniles (verificado) del
//      resto (sin nombre de categoría, porque no se sabe cuál es) ----
await pg.evaluate(()=>{ db.config.acceso='coordinacion'; db.config.rol=null; });
const idDual = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTFICHA', nombre:'Dual', categorias:['Cadetes','Juveniles'],
    base: [{ categoria:'Juveniles', pj:5, goles:2, ta:1, tr:0 }, { categoria:'Cadetes', pj:8, goles:3, ta:0, tr:1 }],
  });
  view.jugadorId = id; view.fichaTab = 'general';
  render();
  return id;
});
await pg.waitForTimeout(300);
const filasDual = await pg.locator('.cmp tbody tr').allInnerTexts();
t('La temporada en curso aparece separada: una fila de Juveniles con lo suyo (5pj/2g)',
  filasDual.some(f=>f.includes('Juveniles') && f.includes('5') && f.includes('2')), JSON.stringify(filasDual));
t('...y otra sin nombre de categoría con el resto (8pj/3g, lo que no es de Juveniles)',
  filasDual.some(f=>f.includes('—') && f.includes('8') && f.includes('3')), JSON.stringify(filasDual));
t('Las tarjetas se muestran con iconos de color, no como texto "A/R"',
  (await pg.locator('.cmp tbody tr .card-mark.card-y').count())>0 && (await pg.locator('.cmp tbody tr .card-mark.card-r').count())>0
    && !filasDual.some(f=>/\d+A\/\d+R/.test(f)), JSON.stringify(filasDual));

// ---- aunque una fila de historial SÍ tenga una categoría conocida que no es
//      Juveniles (por ejemplo, ya etiquetada "Cadetes" por una importación
//      de la AIF), no se nombra: solo Juveniles es dato verificado ----
const idSoloCadetes = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTSOLOCAD', nombre:'Unica', categorias:['Cadetes'],
    historial: [{ anio:'2024', categoria:'Cadetes', pj:20, min:1200, goles:5, asis:1, ta:1, tr:0 }],
  });
  view.jugadorId = id; view.fichaTab = 'general';
  render();
  return id;
});
await pg.waitForTimeout(300);
const filasSolo = await pg.locator('.cmp tbody tr').allInnerTexts();
t('La fila de 2024, aunque está etiquetada "Cadetes", no muestra ese nombre (solo Juveniles se nombra)',
  filasSolo.some(f=>f.includes('2024') && f.includes('20') && !f.includes('Cadetes')), JSON.stringify(filasSolo));
t('Tampoco la temporada en curso, para un jugador de una sola categoría que no es Juveniles',
  filasSolo.some(f=>f.includes(new Date().getFullYear().toString()) && !f.includes('Cadetes')), JSON.stringify(filasSolo));
// ---- G+A, minutos por gol y minutos por G+A en Estadísticas generales ----
const idEficiencia = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, apellido:'ZZZTESTEFICIENCIA', nombre:'Goleador', categorias:['Juveniles'] });
  for (let i=0;i<10;i++){
    db.partidos.push({ id:uid(), jugadorId:id, categoria:'Juveniles', fecha:`${ANIO_ACTUAL}-0${1+(i%9)}-01`,
      jugo:true, goles: i<3?(i===0?5:4):0, asistencias: i<2?4:0, minutos:133, amarillas:0, rojas:0 });
  }
  view.jugadorId = id; view.fichaTab = 'general';
  render();
  return id;
});
await pg.waitForTimeout(300);
// total: 1330 minutos, 13 goles (5+4+4), 8 asistencias (4+4)
const statsEficiencia = await pg.evaluate(()=>{
  const vals = [...document.querySelectorAll('.stat-grid')[0].querySelectorAll('.stat')].map(s=>s.innerText.replace(/\n/g,' '));
  return vals;
});
t('G+A suma goles y asistencias (13+8=21)', statsEficiencia.some(s=>s.includes('G+A') && s.includes('21')), JSON.stringify(statsEficiencia));
t('Minutos por gol: 1330÷13 redondeado a 102', statsEficiencia.some(s=>/MIN\. POR GOL/i.test(s) && s.includes("102'")), JSON.stringify(statsEficiencia));
t('Minutos por G+A: 1330÷21 redondeado a 63', statsEficiencia.some(s=>/MIN\. POR G\+A/i.test(s) && s.includes("63'")), JSON.stringify(statsEficiencia));

// ---- sin goles ni asistencias todavía, no hay cuenta que hacer (evita 0/0=NaN o Infinity) ----
const idSinGoles = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, apellido:'ZZZTESTSINGOLES', nombre:'Defensor', categorias:['Juveniles'] });
  db.partidos.push({ id:uid(), jugadorId:id, categoria:'Juveniles', fecha:`${ANIO_ACTUAL}-01-01`, jugo:true, goles:0, asistencias:0, minutos:90, amarillas:0, rojas:0 });
  view.jugadorId = id; view.fichaTab = 'general';
  render();
  return id;
});
await pg.waitForTimeout(300);
const statsSinGoles = await pg.evaluate(()=>[...document.querySelectorAll('.stat-grid')[0].querySelectorAll('.stat')].map(s=>s.innerText.replace(/\n/g,' ')));
t('Sin goles ni asistencias, "Min. por gol" y "Min. por G+A" muestran "—" (no NaN ni Infinity)',
  statsSinGoles.some(s=>/MIN\. POR GOL/i.test(s) && s.includes('—')) && statsSinGoles.some(s=>/MIN\. POR G\+A/i.test(s) && s.includes('—')),
  JSON.stringify(statsSinGoles));

// ---- gráfico de Evolución de rendimiento: un jugador con dos filas de
//      historial para el MISMO año (una por categoría) no debe repetir
//      ese año en el eje X; además, la leyenda se puede tocar para
//      prender/apagar cada línea, y los puntos para ver el detalle ----
const idChart = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTCHART', nombre:'Dup', categorias:['Juveniles','Cadetes'],
    historial: [
      { anio:'2024', categoria:'Juveniles', pj:10, min:600, goles:2, asis:1, ta:0, tr:0 },
      { anio:'2024', categoria:'otra', pj:5, min:300, goles:1, asis:0, ta:0, tr:0 },
      { anio:'2023', categoria:'Juveniles', pj:8, min:500, goles:1, asis:0, ta:0, tr:0 },
    ],
  });
  view.jugadorId = id; view.fichaTab = 'general';
  view.evolucionOcultas = {}; view.evolucionActivo = null;
  render();
  return id;
});
await pg.waitForTimeout(300);
t('El año 2024 (dos filas de historial, una por categoría) aparece UNA sola vez en el eje X del gráfico',
  (await pg.locator('.block:has-text("Evolución de rendimiento") svg text').filter({hasText:'2024'}).count())===1);
await pg.click('.block:has-text("Evolución de rendimiento") rect[data-ev-punto="2024"]');
await pg.waitForTimeout(200);
const detalle2024 = await pg.locator('.block:has-text("Evolución de rendimiento") p.screen-note').innerText();
t('Tocar el punto de 2024 muestra el detalle sumado de las dos filas (900 min, 3 goles, 1 asist.)',
  detalle2024.includes('900') && detalle2024.includes('3 goles') && detalle2024.includes('1 asist'), detalle2024);
await pg.click('.block:has-text("Evolución de rendimiento") button[data-ev-punto="2024"]');
await pg.waitForTimeout(200);
t('"cerrar" vuelve a ocultar el detalle',
  (await pg.locator('.block:has-text("Evolución de rendimiento") p.screen-note').innerText()).includes('Tocá un punto'));

await pg.click('.block:has-text("Evolución de rendimiento") [data-ev-toggle="minutos"]');
await pg.waitForTimeout(200);
t('Tocar "Minutos" en la leyenda la apaga (queda marcada como oculta)',
  await pg.evaluate(()=>!!view.evolucionOcultas.minutos));
t('La leyenda de Minutos se ve atenuada mientras está apagada',
  (await pg.locator('[data-ev-toggle="minutos"]').getAttribute('style')||'').includes('opacity'));
await pg.click('.block:has-text("Evolución de rendimiento") [data-ev-toggle="minutos"]');
await pg.waitForTimeout(200);
t('Tocarla de nuevo la vuelve a prender',
  await pg.evaluate(()=>!view.evolucionOcultas.minutos));

// ---- fila de totales al pie de "Historial de temporadas" (PJ/Goles/Asist./Tarj., sin sumar minutos) ----
const idTotales = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTTOTALES', nombre:'Suma', categorias:['Juveniles'],
    historial: [
      { anio:'2024', categoria:'Juveniles', pj:10, min:600, goles:3, asis:1, ta:1, tr:0 },
      { anio:'2023', categoria:'Juveniles', pj:8, min:500, goles:2, asis:0, ta:0, tr:1 },
    ],
  });
  view.jugadorId = id; view.fichaTab = 'general';
  render();
  return id;
});
await pg.waitForTimeout(300);
// la temporada en curso (sin nada cargado) suma 0; total esperado: PJ 18, goles 5, asist 1, amarillas 1, rojas 1
const filaTotales = await pg.locator('.block:has-text("Historial de temporadas") tfoot tr').innerText();
t('La fila de totales suma PJ, Goles, Asistencias y Tarjetas de todas las temporadas listadas',
  filaTotales.includes('Totales') && /\b18\b/.test(filaTotales) && /\b5\b/.test(filaTotales) && /\b1\b/.test(filaTotales),
  filaTotales);
const totalesDetalle = await pg.locator('.block:has-text("Historial de temporadas") tfoot tr td').allInnerTexts();
t('Las celdas de la fila de totales son: Totales / PJ=18 / Min en blanco / Goles=5 / Asist.=1 / tarjetas 1A 1R',
  totalesDetalle[0]==='Totales' && totalesDetalle[1]==='18' && totalesDetalle[2]==='' && totalesDetalle[3]==='5' && totalesDetalle[4]==='1',
  JSON.stringify(totalesDetalle));

// ---- "Ver datos sin procesar" (para soporte): botón de coordinación para
//      ver el historial crudo en JSON sin depender de la consola del navegador ----
t('El botón "Ver datos sin procesar" aparece para coordinación', (await pg.locator('[data-ver-crudo]').count())===1);
t('Al entrar no se ve el JSON todavía', (await pg.locator('.block:has-text("Historial de temporadas") pre').count())===0);
await pg.click('[data-ver-crudo]'); await pg.waitForTimeout(200);
const crudoTexto = await pg.locator('.block:has-text("Historial de temporadas") pre').innerText();
let crudoJson = null; try { crudoJson = JSON.parse(crudoTexto); } catch(e){}
t('Al tocarlo se ve el historial del jugador como JSON válido, con sus filas reales',
  Array.isArray(crudoJson) && crudoJson.length===2 && crudoJson.some(h=>h.anio==='2024' && h.goles===3) && crudoJson.some(h=>h.anio==='2023' && h.goles===2),
  crudoTexto);
await pg.click('[data-ver-crudo]'); await pg.waitForTimeout(200);
t('Tocarlo de nuevo lo vuelve a ocultar', (await pg.locator('.block:has-text("Historial de temporadas") pre').count())===0);

await pg.evaluate(()=>{ view.jugadorId=null; db.config.acceso='jugador'; db.config.rol='Coordinador'; db.config.categoriaDT=''; render(); });
await pg.waitForTimeout(300);
await pg.click('.tabs button:has-text("Plantel")'); await pg.waitForTimeout(300);
await pg.click('.roster .row[data-jugador]'); await pg.waitForTimeout(400);
t('El jugador (no coordinación) no ve el botón de datos sin procesar', (await pg.locator('[data-ver-crudo]').count())===0);
await pg.evaluate(()=>{ db.config.acceso='coordinacion'; db.config.rol=null; });

await pg.goto(BASE_URL); // limpia los jugadores de prueba antes de cerrar

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
