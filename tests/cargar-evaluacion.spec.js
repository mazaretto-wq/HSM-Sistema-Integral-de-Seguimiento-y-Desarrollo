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

// ---- entrando desde la ficha de un jugador ("Cargar datos de X") ----
const jugId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Probando', apellido:'DesdeFicha', categorias:['Juveniles'] });
  render();
  return id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, jugId);
await pg.waitForTimeout(300);
await pg.click('[data-go="cargarPara"]'); await pg.waitForTimeout(300);

t('Primero pregunta qué vas a cargar (Test Físico / Habilidades), no un formulario gigante',
  (await pg.locator('.row:has-text("Test Físico")').count())===1 && (await pg.locator('.row:has-text("Habilidades")').count())===1);
t('Todavía no hay ningún campo de carga (ni físico ni técnico) en esta pantalla',
  (await pg.locator('#f-fecha').count())===0);

await pg.click('.row:has-text("Test Físico")'); await pg.waitForTimeout(300);
const hoyStr = await pg.evaluate(()=>hoy());
t('La fecha sale con el día de hoy por default', await pg.inputValue('#f-fecha') === hoyStr, await pg.inputValue('#f-fecha'));
t('El jugador desde el que entré ya viene elegido', await pg.locator('#f-jugador').inputValue() === jugId);
t('Al elegir "Test Físico" se ven los campos de Cooper/Yo-Yo/Velocidad', (await pg.locator('label:has-text("Cooper")').count())===1);
t('Al elegir "Test Físico" NO se ven los de Técnico-táctico/Comportamiento', (await pg.locator('.scale').count())===0);

// ---- volver lleva al paso anterior (elegir qué cargar), no al menú de Cargar ----
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('"Volver" desde el formulario cae en la elección de qué cargar (no en el menú de Cargar)',
  (await pg.locator('.row:has-text("Test Físico")').count())===1);

// ---- Habilidades: técnico-táctico + comportamiento juntos, sin lo físico ----
await pg.click('.row:has-text("Habilidades")'); await pg.waitForTimeout(300);
t('Al elegir "Habilidades" se ven las escalas de técnico-táctico y comportamiento', (await pg.locator('.scale').count())>0);
t('Al elegir "Habilidades" NO se ven los campos de test físico', (await pg.locator('label:has-text("Cooper")').count())===0);

// cargo un par de valores técnico-tácticos y guardo
await pg.click('[data-scale="control"] [data-v="8"]');
await pg.click('[data-scale="puntualidad"] [data-v="9"]');
await pg.click('[data-guardar="evaluacion"]'); await pg.waitForTimeout(400);

const guardado = await pg.evaluate((id)=>{
  const reg = db.evaluaciones.find(e=>e.jugadorId===id && typeof e.control==='number');
  const toma = reg ? db.tomas.find(t=>t.id===reg.tomaId) : null;
  return reg ? { control:reg.control, puntualidad:reg.puntualidad, fecha:reg.fecha, tomaFecha: toma&&toma.fecha, tomaNombre: toma&&toma.nombre } : null;
}, jugId);
t('Se guardó con los valores elegidos (control:8, puntualidad:9)', guardado && guardado.control===8 && guardado.puntualidad===9, JSON.stringify(guardado));
t('La evaluación quedó fechada hoy, en una toma del mes de hoy', guardado && guardado.fecha===hoyStr && guardado.tomaFecha===hoyStr.slice(0,7)+'-01', JSON.stringify(guardado));

// ---- cargar el test físico de ESE MISMO mes cae en la MISMA toma (no duplica) ----
const totalTomasAntes = await pg.evaluate(()=>db.tomas.length);
await pg.click('[data-back]'); await pg.waitForTimeout(200); // vuelve a elegir qué cargar
await pg.click('.row:has-text("Test Físico")'); await pg.waitForTimeout(300);
t('Al volver a entrar, la fecha sigue siendo la de hoy (no quedó pegada una vieja)', await pg.inputValue('#f-fecha') === hoyStr);
await pg.fill('[id="f-yoyo"]', '1700');
await pg.click('[data-guardar="evaluacion"]'); await pg.waitForTimeout(400);
const despues = await pg.evaluate((id)=>{
  const reg = db.evaluaciones.find(e=>e.jugadorId===id && typeof e.yoyo==='number');
  return { totalTomas: db.tomas.length, mismoReg: reg && typeof reg.control==='number' };
}, jugId);
t('No se creó una toma nueva: se sumó el test físico a la misma toma de hoy', despues.totalTomas===totalTomasAntes, JSON.stringify(despues));
t('El yoyo quedó en el MISMO registro que ya tenía control/puntualidad (una sola fila por jugador y toma)', despues.mismoReg===true);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
