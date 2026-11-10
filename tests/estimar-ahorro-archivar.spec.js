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

// una temporada vieja con bastante detalle (40 partidos), para que la
// estimación de ahorro sea un número claramente positivo y medible
const datos = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Viejo', apellido:'ConHistoria', categorias:['Juveniles'] });
  for (let i=0;i<40;i++){
    db.partidos.push({ id:uid(), jugadorId:id, categoria:'Juveniles', fecha:`2023-0${i%9+1}-01`, jugo:true, goles:1, asistencias:0, minutos:90, amarillas:0, rojas:0 });
  }
  render();
  const antes = tamanoBytesDb(db);
  const estimado = estimarAhorroArchivar('2023');
  return { id, antes, estimado };
});
t('La estimación de ahorro para 2023 es un número positivo, con 40 partidos cargados', datos.estimado > 0, String(datos.estimado));

// ---- se ve en la pantalla de Datos, para la temporada elegida ----
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
const textoBloque = await pg.locator('.block:has-text("Archivar temporada")').innerText();
t('La pantalla de Datos muestra la estimación en KB para la temporada seleccionada',
  new RegExp(`Archivar 2023 liberaría aproximadamente ${Math.round(datos.estimado/1024)} KB`).test(textoBloque), textoBloque);

// ---- se actualiza sola si se cambia de temporada (otra con datos, sin archivar) ----
const idOtro = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Otro', apellido:'Viejo2022', categorias:['Juveniles'] });
  for (let i=0;i<40;i++){
    db.partidos.push({ id:uid(), jugadorId:id, categoria:'Juveniles', fecha:`2022-0${i%9+1}-01`, jugo:true, goles:1, asistencias:0, minutos:90, amarillas:0, rojas:0 });
  }
  render();
  return id;
});
await pg.selectOption('#archivar-anio', '2022');
await pg.waitForTimeout(300);
const textoOtraTemporada = await pg.locator('.block:has-text("Archivar temporada")').innerText();
t('Al cambiar de temporada en el desplegable, la estimación se recalcula sola (ahora habla de 2022, no de 2023)',
  textoOtraTemporada.includes('Archivar 2022') && !textoOtraTemporada.includes('Archivar 2023'), textoOtraTemporada);

// ---- de verdad baja el tamaño real de la base al archivar ----
const tamanoAntesDeArchivar = await pg.evaluate(()=>tamanoBytesDb(db));
await pg.selectOption('#archivar-anio', '2023');
await pg.waitForTimeout(200);
await pg.click('#archivarTemporada'); await pg.waitForTimeout(400);
const tamanoDespues = await pg.evaluate(()=>tamanoBytesDb(db));
t('Después de archivar, el tamaño real de la base bajó (no fue solo una promesa)', tamanoDespues < tamanoAntesDeArchivar,
  `antes=${tamanoAntesDeArchivar} después=${tamanoDespues}`);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
