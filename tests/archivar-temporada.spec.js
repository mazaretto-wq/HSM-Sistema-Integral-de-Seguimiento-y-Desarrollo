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
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// un jugador fresco + datos fabricados de una temporada vieja (2023), para
// no depender de qué trae la base real y poder afirmar valores exactos
const anioViejo = '2023';
const datos = await pg.evaluate((anio)=>{
  const id = uid();
  const otroId = uid(); // solo para que la sesión "sin él" no quede con asistentes vacío
  db.jugadores.push(
    { id, nombre:'ViejaTemporada', apellido:'Test', categorias:['Juveniles'] },
    { id:otroId, nombre:'Compañero', apellido:'DeEquipo', categorias:['Juveniles'] },
  );

  // 3 partidos del año viejo: 2 jugados, 1 no
  db.partidos.push(
    { id:uid(), jugadorId:id, categoria:'Juveniles', fecha:anio+'-03-05', jugo:true, goles:2, asistencias:1, minutos:70, amarillas:1, rojas:0 },
    { id:uid(), jugadorId:id, categoria:'Juveniles', fecha:anio+'-04-10', jugo:true, goles:1, asistencias:0, minutos:90, amarillas:0, rojas:0 },
    { id:uid(), jugadorId:id, categoria:'Juveniles', fecha:anio+'-05-15', jugo:false, goles:0, asistencias:0, minutos:0, amarillas:0, rojas:0 },
  );

  // 2 tomas de test físico del año viejo (se debería conservar solo la última)
  const tomaVieja1 = { id:uid(), nombre:'Marzo '+anio, fecha:anio+'-03-01' };
  const tomaVieja2 = { id:uid(), nombre:'Noviembre '+anio, fecha:anio+'-11-20' };
  db.tomas.push(tomaVieja1, tomaVieja2);
  db.evaluaciones.push(
    { id:uid(), jugadorId:id, tomaId:tomaVieja1.id, fecha:anio+'-03-01', yoyo:1500 },
    { id:uid(), jugadorId:id, tomaId:tomaVieja2.id, fecha:anio+'-11-20', yoyo:1800 },
  );

  // 4 entrenamientos del año viejo: presente en 3 de 4
  db.sesiones.push(
    { id:uid(), categoria:'Juveniles', fecha:anio+'-03-02', dt:'DT Test', asistentes:[id] },
    { id:uid(), categoria:'Juveniles', fecha:anio+'-03-09', dt:'DT Test', asistentes:[id] },
    { id:uid(), categoria:'Juveniles', fecha:anio+'-03-16', dt:'DT Test', asistentes:[id] },
    { id:uid(), categoria:'Juveniles', fecha:anio+'-03-23', dt:'DT Test', asistentes:[otroId] },
  );

  render();
  return {
    id, anio,
    asistenciaAntes: asistenciaDe(id),
    totalesPartidosAntes: db.partidos.filter(p=>p.jugadorId===id).length,
    totalesTomasAntes: db.tomas.filter(x=>x.id===tomaVieja1.id||x.id===tomaVieja2.id).length,
    tomaVieja2Id: tomaVieja2.id,
  };
}, anioViejo);

t('El jugador fabricado arranca con 3/4 de asistencia en el año viejo (sin otra data)',
  datos.asistenciaAntes && datos.asistenciaAntes.fue===3 && datos.asistenciaAntes.total===4, JSON.stringify(datos.asistenciaAntes));

// "Datos" no tiene botón propio en la barra de coordinación (igual que
// "Cargar"/"Plantel"): se entra fijando view.tab directamente, como ya
// hace la propia app desde otros lugares internos
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);

t('La pantalla de Datos ofrece la temporada vieja para archivar',
  await pg.locator(`#archivar-anio option[value="${anioViejo}"]`).count() === 1);
t('La temporada en curso NO aparece como archivable',
  await pg.locator(`#archivar-anio option[value="${new Date().getFullYear()}"]`).count() === 0);

await pg.selectOption('#archivar-anio', anioViejo);
const [download] = await Promise.all([
  pg.waitForEvent('download'),
  pg.click('#archivarTemporada'),
]);
await pg.waitForTimeout(400);

t('Al archivar se descarga un CSV con el nombre de la temporada', /hsm-temporada-2023\.csv/.test(download.suggestedFilename()));

const despues = await pg.evaluate((d)=>({
  partidosQuedan: db.partidos.filter(p=>p.jugadorId===d.id && p.fecha && p.fecha.startsWith(d.anio)).length,
  sesionesQuedan: db.sesiones.filter(s=>s.fecha && s.fecha.startsWith(d.anio)).length,
  tomasQuedan: db.tomas.filter(x=>x.id===d.tomaVieja2Id).length, // solo debería quedar la última (noviembre)
  evaluacionesTomaUltima: db.evaluaciones.filter(e=>e.tomaId===d.tomaVieja2Id).length,
  historial: (db.jugadores.find(j=>j.id===d.id).historial||[]).find(h=>h.anio===d.anio),
  asistenciaDespues: asistenciaDe(d.id),
}), datos);

t('Se borran los partidos sueltos del año archivado', despues.partidosQuedan===0, JSON.stringify(despues));
t('Se borran los entrenamientos sueltos del año archivado', despues.sesionesQuedan===0);
t('Solo queda la ÚLTIMA toma de test físico de ese año (noviembre)', despues.tomasQuedan===1 && despues.evaluacionesTomaUltima===1);
t('El año archivado queda resumido en el historial del jugador: 2 partidos jugados, 3 goles, 1 asistencia, 160 minutos',
  !!despues.historial && despues.historial.pj===2 && despues.historial.goles===3 && despues.historial.asis===1 && despues.historial.min===160,
  JSON.stringify(despues.historial));
t('El historial también guarda el detalle de entrenamientos (3 de 4) para no perder el % de asistencia',
  !!despues.historial && despues.historial.entrenosFue===3 && despues.historial.entrenosTotal===4, JSON.stringify(despues.historial));
t('La asistencia histórica del jugador sigue siendo 3/4 (75%) después de archivar, pese a borrarse los entrenamientos sueltos',
  despues.asistenciaDespues && despues.asistenciaDespues.fue===3 && despues.asistenciaDespues.total===4 && despues.asistenciaDespues.pct===75,
  JSON.stringify(despues.asistenciaDespues));

// ---- si ya no quedan temporadas viejas, el bloque avisa en vez de mostrar el selector ----
await pg.evaluate(()=>{ db.partidos=[]; db.evaluaciones=[]; db.sesiones=[]; db.tomas=[]; render(); });
await pg.waitForTimeout(300);
t('Sin temporadas viejas, el bloque avisa que no hay nada para archivar',
  (await pg.locator('.block:has-text("Archivar temporada")').innerText()).includes('No hay temporadas viejas'));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
