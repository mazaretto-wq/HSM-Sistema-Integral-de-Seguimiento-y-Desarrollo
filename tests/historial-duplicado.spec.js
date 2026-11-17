const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Varios jugadores (reportado con Pedro Moncalvo) quedaron con filas de
   historial EXACTAMENTE repetidas (mismo año, categoría y todos los
   números iguales) de corridas viejas de "Importar historial AIF". La
   limpieza (limpiarHistorialDuplicado en index.html) saca las copias de
   más, para cualquier jugador, corriendo siempre al abrir la app. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

const idDup = await pg.evaluate(async ()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTHISTDUP', nombre:'Repetido', categorias:['Cadetes','Juveniles'],
    historial: [
      { anio:'2024', categoria:'Juveniles', pj:10, min:600, goles:3, asis:1, ta:1, tr:0 },
      { anio:'2023', categoria:'otra', pj:16, min:1233, goles:8, asis:0, ta:1, tr:0 },
      { anio:'2023', categoria:'otra', pj:16, min:1233, goles:8, asis:0, ta:1, tr:0 }, // repetida tal cual
      { anio:'2022', categoria:'otra', pj:19, min:1330, goles:3, asis:0, ta:0, tr:0 },
      { anio:'2022', categoria:'otra', pj:19, min:1330, goles:3, asis:0, ta:0, tr:0 }, // repetida tal cual
      { anio:'2022', categoria:'otra', pj:19, min:1330, goles:3, asis:0, ta:0, tr:0 }, // y una tercera vez
    ],
  });
  await Store.save(db);
  return id;
});
await pg.reload(); await pg.waitForTimeout(2000);
const dup = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idDup);
t('2023 quedó con una sola fila (no dos, aunque estaban repetidas tal cual)',
  dup.historial.filter(h=>h.anio==='2023').length===1, JSON.stringify(dup.historial));
t('2022 quedó con una sola fila (estaba repetida tres veces)',
  dup.historial.filter(h=>h.anio==='2022').length===1, JSON.stringify(dup.historial));
t('2024 (que nunca estuvo repetida) sigue como estaba, con sus valores intactos',
  dup.historial.filter(h=>h.anio==='2024').length===1 &&
  dup.historial.some(h=>h.anio==='2024' && h.categoria==='Juveniles' && h.pj===10 && h.min===600 && h.goles===3 && h.asis===1 && h.ta===1),
  JSON.stringify(dup.historial));
t('En total quedan 3 filas (una por año), no las 6 originales', dup.historial.length===3, JSON.stringify(dup.historial));

// ---- el mismo dato repetido, pero una copia con los números como texto
//      en vez de número (quedó así de un camino de carga distinto): tiene
//      que reconocerla igual, no solo cuando son el mismo tipo exacto ----
const idDupTexto = await pg.evaluate(async ()=>{
  const id = uid();
  db.jugadores.push({
    id, apellido:'ZZZTESTHISTDUPTXT', nombre:'Texto', categorias:['Juveniles'],
    historial: [
      { anio:'2025', categoria:'otra', pj:18, min:1500, goles:36, asis:0, ta:3, tr:0 },
      { anio:'2025', categoria:'otra', pj:'18', min:'1500', goles:'36', asis:'0', ta:'3', tr:'0' }, // mismo dato, como texto
    ],
  });
  await Store.save(db);
  return id;
});
await pg.reload(); await pg.waitForTimeout(2000);
const dupTexto = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idDupTexto);
t('La reconoce igual aunque una copia tenga los números como texto: queda una sola fila',
  dupTexto.historial.length===1 && dupTexto.historial[0].pj==18 && dupTexto.historial[0].min==1500 && dupTexto.historial[0].goles==36,
  JSON.stringify(dupTexto.historial));

await pg.reload(); await pg.waitForTimeout(2000);
const dup2 = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idDup);
t('Correr la limpieza de nuevo no cambia nada más (es segura de repetir)',
  JSON.stringify(dup2.historial)===JSON.stringify(dup.historial));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
