const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* El PDF que pasó coordinación (informe propio de la temporada 2026 de
   Juveniles, con minutos Y asistencias, que la AIF nunca da) se volcó como
   una corrección puntual (cargarInformeJuvenilesPdf2026 en index.html), con
   los nombres reales tal cual el PDF. Esos mismos nombres (Awada Felipe,
   Besze Santiago, Bibbo Mateo, etc.) ya vienen en la base real del club
   (SEED_HSM) y algunos ya tienen amistosos 2026 cargados de antes
   (SEED_JUVENILES): no se puede asumir que "no tienen nada cargado", hay
   que medir lo que el seed ya les puso antes de calcular cuánto falta. */
const PDF = {
  AWADA_Felipe:    {pj:8,  min:422,  goles:4,  asis:2, ta:4,  tr:2},
  BESZE_Santiago:  {pj:9,  min:720,  goles:0,  asis:0, ta:2,  tr:1},
  BIBBO_Mateo:     {pj:20, min:1495, goles:4,  asis:2, ta:8,  tr:0},
  SANES_Felipe:    {pj:20, min:1425, goles:10, asis:5, ta:5,  tr:0},
};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2500); // siembra la base real del club (y sus amistosos 2026 ya cargados)

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// lo que el seed YA tenía cargado para cada uno (partidos sueltos MÁS
// cualquier temporada parcial ya cerrada tipo "2026 Apertura"), antes de
// tocar nada
const yaCargado = await pg.evaluate(()=>{
  const suma = (id) => {
    const j = db.jugadores.find(x=>x.id===id);
    const p = totales(id,'Juveniles'), h = historialAnio(j, ANIO_ACTUAL, 'Juveniles');
    return { pj:p.pj+h.pj, minutos:p.minutos+h.minutos, goles:p.goles+h.goles,
      asistencias:p.asistencias+h.asistencias, amarillas:p.amarillas+h.amarillas, rojas:p.rojas+h.rojas };
  };
  const porNombre = (ap,no) => db.jugadores.find(j=>j.apellido===ap && j.nombre===no);
  return {
    AWADA_Felipe:   suma(porNombre('AWADA','Felipe').id),
    BESZE_Santiago: suma(porNombre('BESZE','Santiago').id),
    BIBBO_Mateo:    suma(porNombre('BIBBO','Mateo').id),
    SANES_Felipe:   suma(porNombre('SANES','Felipe').id),
  };
});

/* Sanes Felipe: le agrego una temporada parcial ya cerrada (tipo "2026
   Apertura") en el historial, tagueada Juveniles. Es la MISMA plata que
   un bug real dejó sin restar: contaba los partidos cargados uno por uno
   pero no estos años parciales, así que a Retamar (en producción) le
   terminó sumando de más. */
const idSanes = await pg.evaluate(()=>{
  const j = db.jugadores.find(x=>x.apellido==='SANES' && x.nombre==='Felipe');
  j.historial = j.historial || [];
  j.historial.push({ anio:`${ANIO_ACTUAL} Apertura`, categoria:'Juveniles', pj:6, min:420, goles:3, asis:1, ta:1, tr:0 });
  return j.id;
});
const parcialSanes = { pj:6, minutos:420, goles:3, asistencias:1, amarillas:1, rojas:0 };

// a Bibbo le agrego 2 partidos más encima de lo que ya tenía el seed, para probar que la resta es sobre el total real
const idBibbo = await pg.evaluate(()=>{
  const j = db.jugadores.find(x=>x.apellido==='BIBBO' && x.nombre==='Mateo');
  db.partidos.push(
    { id:uid(), jugadorId:j.id, categoria:'Juveniles', fecha:`${ANIO_ACTUAL}-03-01`, jugo:true, goles:1, asistencias:1, minutos:60, amarillas:1, rojas:0 },
    { id:uid(), jugadorId:j.id, categoria:'Juveniles', fecha:`${ANIO_ACTUAL}-03-08`, jugo:true, goles:0, asistencias:0, minutos:50, amarillas:0, rojas:0 },
  );
  return j.id;
});
const extraBibbo = { pj:2, minutos:110, goles:1, asistencias:1, amarillas:1, rojas:0 };
await pg.evaluate(async ()=>{ await Store.save(db); });

await pg.reload(); await pg.waitForTimeout(2500); // ahora corre la corrección puntual con todo ya sembrado

const resta = (pdf, cargado) => ({
  pj:    Math.max(0, pdf.pj    - cargado.pj),
  min:   Math.max(0, pdf.min   - cargado.minutos),
  goles: Math.max(0, pdf.goles - cargado.goles),
  asis:  Math.max(0, pdf.asis  - cargado.asistencias),
  ta:    Math.max(0, pdf.ta    - cargado.amarillas),
  tr:    Math.max(0, pdf.tr    - cargado.rojas),
});

const awada = await pg.evaluate(()=>db.jugadores.find(j=>j.apellido==='AWADA' && j.nombre==='Felipe'));
const faltaAwada = resta(PDF.AWADA_Felipe, yaCargado.AWADA_Felipe);
t('A Awada Felipe la base de Juveniles le completa justo lo que falta frente al informe (descontando lo que el seed ya le había cargado)',
  JSON.stringify(awada.base.find(x=>x.categoria==='Juveniles'))===JSON.stringify({categoria:'Juveniles', ...faltaAwada}),
  JSON.stringify(awada.base)+' vs esperado '+JSON.stringify(faltaAwada));
t('De paso, queda agregado a la categoría Juveniles si no la tenía (en el seed ya la tenía, junto con Cadetes)',
  (awada.categorias||[]).includes('Juveniles') && (awada.categorias||[]).includes('Cadetes'), JSON.stringify(awada.categorias));

const besze = await pg.evaluate(()=>db.jugadores.find(j=>j.apellido==='BESZE' && j.nombre==='Santiago'));
const faltaBesze = resta(PDF.BESZE_Santiago, yaCargado.BESZE_Santiago);
t('A Besze Santiago la base de Juveniles también le completa justo la diferencia frente al informe',
  JSON.stringify(besze.base.find(x=>x.categoria==='Juveniles'))===JSON.stringify({categoria:'Juveniles', ...faltaBesze}),
  JSON.stringify(besze.base)+' vs esperado '+JSON.stringify(faltaBesze));

const bibbo = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idBibbo);
const cargadoBibboTotal = {
  pj: yaCargado.BIBBO_Mateo.pj+extraBibbo.pj, minutos: yaCargado.BIBBO_Mateo.minutos+extraBibbo.minutos,
  goles: yaCargado.BIBBO_Mateo.goles+extraBibbo.goles, asistencias: yaCargado.BIBBO_Mateo.asistencias+extraBibbo.asistencias,
  amarillas: yaCargado.BIBBO_Mateo.amarillas+extraBibbo.amarillas, rojas: yaCargado.BIBBO_Mateo.rojas+extraBibbo.rojas,
};
const faltaBibbo = resta(PDF.BIBBO_Mateo, cargadoBibboTotal);
t('A Bibbo Mateo (con partidos del seed MÁS los 2 que le agregué) la base le completa solo lo que sigue faltando',
  JSON.stringify(bibbo.base.find(x=>x.categoria==='Juveniles'))===JSON.stringify({categoria:'Juveniles', ...faltaBibbo}),
  JSON.stringify(bibbo.base)+' vs esperado '+JSON.stringify(faltaBibbo));
const sanes = await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id), idSanes);
const cargadoSanesTotal = {
  pj: yaCargado.SANES_Felipe.pj+parcialSanes.pj, minutos: yaCargado.SANES_Felipe.minutos+parcialSanes.minutos,
  goles: yaCargado.SANES_Felipe.goles+parcialSanes.goles, asistencias: yaCargado.SANES_Felipe.asistencias+parcialSanes.asistencias,
  amarillas: yaCargado.SANES_Felipe.amarillas+parcialSanes.amarillas, rojas: yaCargado.SANES_Felipe.rojas+parcialSanes.rojas,
};
const faltaSanes = resta(PDF.SANES_Felipe, cargadoSanesTotal);
t('A Sanes Felipe (con una temporada parcial ya cerrada tipo "2026 Apertura") la base también descuenta ESO, no solo los partidos sueltos',
  JSON.stringify(sanes.base.find(x=>x.categoria==='Juveniles'))===JSON.stringify({categoria:'Juveniles', ...faltaSanes}),
  JSON.stringify(sanes.base)+' vs esperado '+JSON.stringify(faltaSanes));
const anioActual = await pg.evaluate(()=>ANIO_ACTUAL);
t('Esa temporada parcial de Sanes sigue intacta (no se tocó)',
  sanes.historial.some(h=>h.anio===`${anioActual} Apertura` && h.categoria==='Juveniles' && h.pj===6 && h.min===420),
  JSON.stringify(sanes.historial));

await pg.reload(); await pg.waitForTimeout(2500);
const awada2 = await pg.evaluate(()=>db.jugadores.find(j=>j.apellido==='AWADA' && j.nombre==='Felipe'));
t('Correr esta corrección de nuevo no cambia nada más (es segura de repetir)',
  JSON.stringify(awada2.base)===JSON.stringify(awada.base));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
