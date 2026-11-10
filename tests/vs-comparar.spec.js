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
await pg.reload(); await pg.waitForTimeout(1500);

// ---- jugador (el rol con menos permisos) también tiene que poder usar "Vs" ----
await pg.click('#ac-jugador'); await pg.waitForTimeout(700);
t('"Vs" aparece en la barra también para el rol Jugador', await pg.locator('.tabs button:has-text("Vs")').count()===1);

// datos fabricados: dos jugadores, uno con una temporada vieja (2024) ya
// archivada (solo le queda el resumen en historial, sin partidos sueltos)
const anioViejo = '2024';
const datos = await pg.evaluate((anio)=>{
  const idA = uid(), idB = uid();
  db.jugadores.push(
    { id:idA, nombre:'Goleador', apellido:'Uno', categorias:['Juveniles'], historial:[
      { anio, categoria:'Juveniles', pj:10, goles:8, asis:2, min:850, ta:1, tr:0, entrenosFue:18, entrenosTotal:20 }
    ] },
    { id:idB, nombre:'Asistidor', apellido:'Dos', categorias:['Juveniles'] },
  );
  // Dos, en la temporada actual, con partidos y un test físico cargados
  db.partidos.push(
    { id:uid(), jugadorId:idB, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-03-01', jugo:true, goles:1, asistencias:4, minutos:90, amarillas:0, rojas:0, posicion:'Volante central' },
  );
  const toma = { id:uid(), nombre:'Marzo', fecha:ANIO_ACTUAL+'-03-05' };
  db.tomas.push(toma);
  db.evaluaciones.push({ id:uid(), jugadorId:idB, tomaId:toma.id, fecha:ANIO_ACTUAL+'-03-05', yoyo:1600 });
  render();
  return { idA, idB, anio };
}, anioViejo);

await pg.evaluate(()=>{ view.tab='vs'; render(); }); await pg.waitForTimeout(300);
t('La pantalla de Vs muestra los dos selectores de jugador', await pg.locator('[data-vsjug="a"]').count()===1 && await pg.locator('[data-vsjug="b"]').count()===1);
t('Sin elegir a los dos, pide que se completen ambos', (await pg.locator('#app').innerText()).includes('Elegí los dos jugadores'));

await pg.selectOption('[data-vsjug="a"]', datos.idA);
await pg.selectOption('[data-vsanio="a"]', datos.anio);
await pg.selectOption('[data-vsjug="b"]', datos.idB);
await pg.waitForTimeout(300);

const texto = await pg.locator('#app').innerText();
t('Con los dos elegidos, muestra la comparación (no más el aviso de elegir)', !texto.includes('Elegí los dos jugadores'));
t('Se ven los nombres de los dos jugadores comparados', texto.includes('UNO, Goleador') && texto.includes('DOS, Asistidor'));

const filas = await pg.evaluate(()=>{
  const celdas = [...document.querySelectorAll('.vs-cmp td.etq')].map(td=>td.closest('tr'));
  const porEtq = {};
  celdas.forEach(tr=>{
    const etq = tr.querySelector('td.etq').textContent.trim();
    porEtq[etq] = { a: tr.querySelector('td.a').textContent.trim(), b: tr.querySelector('td.b').textContent.trim() };
  });
  return porEtq;
});
t('Partidos jugados: Goleador (2024, archivado) 10 vs Asistidor (temporada actual) 1', filas['Partidos jugados'].a==='10' && filas['Partidos jugados'].b==='1', JSON.stringify(filas['Partidos jugados']));
t('Goles: 8 vs 1', filas['Goles'].a==='8' && filas['Goles'].b==='1');
t('Goles + Asistencias: 10 (8+2) vs 5 (1+4)', filas['Goles + Asistencias'].a==='10' && filas['Goles + Asistencias'].b==='5', JSON.stringify(filas['Goles + Asistencias']));
t('% de asistencia: 90% (18/20, de la temporada archivada) vs sin datos (sin entrenos cargados este año)',
  filas['% de asistencia'].a==='90%' && filas['% de asistencia'].b==='—', JSON.stringify(filas['% de asistencia']));
t('Test físicos: a Goleador no le quedó toma en 2024 (se archivó la temporada entera sin tomas), a Asistidor sí (yoyo 1.600 este año)',
  !!filas['Yo-Yo IR1 (m)'] && filas['Yo-Yo IR1 (m)'].a==='—' && filas['Yo-Yo IR1 (m)'].b==='1.600', JSON.stringify(filas['Yo-Yo IR1 (m)']));

// ---- cambiar el jugador A actualiza su selector de año (ANIO_ACTUAL primero) y vuelve a comparar ----
await pg.selectOption('[data-vsjug="a"]', datos.idB);
await pg.waitForTimeout(300);
const anioSeleccionadoA = await pg.locator('[data-vsanio="a"]').inputValue();
t('Al cambiar de jugador en A, el año se resetea a la temporada actual', anioSeleccionadoA===String(new Date().getFullYear()));

// ---- clickear el encabezado de un jugador comparado abre su ficha ----
await pg.click('.vs-jug[data-jugador]'); await pg.waitForTimeout(300);
t('Tocar el nombre de un jugador comparado abre su ficha', await pg.locator('.ficha-name').count()>0);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
