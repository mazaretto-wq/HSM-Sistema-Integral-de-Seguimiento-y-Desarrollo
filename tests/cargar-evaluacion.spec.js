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

// ---- "Test Físico" pregunta uno por uno, no los 3 juntos ----
await pg.click('.row:has-text("Test Físico")'); await pg.waitForTimeout(300);
const hoyStr = await pg.evaluate(()=>hoy());
t('Al elegir "Test Físico" primero pregunta qué test completar (no el formulario todavía)',
  (await pg.locator('.row:has-text("Cooper")').count())===1
  && (await pg.locator('.row:has-text("Yo-Yo")').count())===1
  && (await pg.locator('.row:has-text("Velocidad")').count())===1
  && (await pg.locator('#f-fecha').count())===0);

await pg.click('.row:has-text("Cooper")'); await pg.waitForTimeout(300);
t('Recién ahí aparece el formulario, con la fecha de hoy por default', await pg.inputValue('#f-fecha') === hoyStr, await pg.inputValue('#f-fecha'));
t('El jugador desde el que entré ya viene elegido', await pg.locator('#f-jugador').inputValue() === jugId);
t('Solo se ve el campo de Cooper, no Yo-Yo ni Velocidad', (await pg.locator('input[id^="f-"][id$="cooper"], label:has-text("Cooper")').count())>0
  && (await pg.locator('label:has-text("Yo-Yo"), label:has-text("Velocidad")').count())===0);
t('Tampoco se ven las escalas de Habilidades', (await pg.locator('.scale').count())===0);

// ---- volver desde el formulario cae en "qué test", no en "qué cargar" ----
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('"Volver" desde el campo de Cooper cae en la elección de qué test (no en Test Físico/Habilidades)',
  (await pg.locator('.row:has-text("Cooper")').count())===1 && (await pg.locator('.row:has-text("Habilidades")').count())===0);
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('Un "Volver" más cae recién en la elección de Test Físico / Habilidades',
  (await pg.locator('.row:has-text("Test Físico")').count())===1);

// ---- cargo Cooper, guardo, y me vuelve a preguntar qué test (para seguir con Yo-Yo) ----
await pg.click('.row:has-text("Test Físico")'); await pg.waitForTimeout(300);
await pg.click('.row:has-text("Cooper")'); await pg.waitForTimeout(300);
await pg.fill('#f-cooper', '2400');
await pg.click('[data-guardar="evaluacion"]'); await pg.waitForTimeout(400);
t('Al guardar Cooper, vuelve sola a preguntar qué test (no al menú de Cargar ni al de arriba)',
  (await pg.locator('.row:has-text("Cooper")').count())===1 && (await pg.locator('.row:has-text("Habilidades")').count())===0);
t('Esa fila de Cooper ahora avisa que ya está cargado', (await pg.locator('.row:has-text("Cooper")').innerText()).includes('ya cargado'));

await pg.click('.row:has-text("Yo-Yo")'); await pg.waitForTimeout(300);
t('Al pasar a Yo-Yo, la fecha y el jugador siguen siendo los mismos (misma carga)',
  await pg.inputValue('#f-fecha') === hoyStr && await pg.locator('#f-jugador').inputValue() === jugId);
await pg.fill('#f-yoyo', '1700');
await pg.click('[data-guardar="evaluacion"]'); await pg.waitForTimeout(400);

const guardado = await pg.evaluate((id)=>{
  const regs = db.evaluaciones.filter(e=>e.jugadorId===id && (typeof e.cooper==='number' || typeof e.yoyo==='number'));
  const toma = regs[0] ? db.tomas.find(t=>t.id===regs[0].tomaId) : null;
  return { cantidadRegistros: regs.length, cooper: regs[0]&&regs[0].cooper, yoyo: regs[0]&&regs[0].yoyo,
    fecha: regs[0]&&regs[0].fecha, tomaFecha: toma&&toma.fecha };
}, jugId);
t('Cooper y Yo-Yo quedaron en el MISMO registro (una sola fila por jugador y toma, no uno por test)',
  guardado.cantidadRegistros===1 && guardado.cooper===2400 && guardado.yoyo===1700, JSON.stringify(guardado));
t('Esa fila quedó fechada hoy, en una toma del mes de hoy', guardado.fecha===hoyStr && guardado.tomaFecha===hoyStr.slice(0,7)+'-01', JSON.stringify(guardado));

// ---- Velocidad (el tercero) ya viene marcado como pendiente, Cooper y Yo-Yo como hechos ----
const textoLista = await pg.locator('.roster').innerText();
t('La lista de qué test completar marca Cooper y Yo-Yo como ya cargados, y Velocidad sin marcar',
  (textoLista.match(/ya cargado/g)||[]).length===2 && !/Velocidad[\s\S]*ya cargado/.test(textoLista), textoLista);

// ---- Habilidades: técnico-táctico + comportamiento juntos, sin tocar lo físico ----
// (un solo "Volver" alcanza: del picker de test cae directo al de Test Físico/Habilidades)
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('Ese "Volver" cae en la elección de Test Físico / Habilidades (no en el menú de Cargar)',
  (await pg.locator('.row:has-text("Habilidades")').count())===1);
await pg.click('.row:has-text("Habilidades")'); await pg.waitForTimeout(300);
t('"Habilidades" sigue mostrando técnico-táctico y comportamiento juntos (no uno por uno)', (await pg.locator('.scale').count())>=9);
t('"Habilidades" no muestra los campos de test físico', (await pg.locator('label:has-text("Cooper")').count())===0);

await pg.click('[data-scale="control"] [data-v="8"]');
await pg.click('[data-scale="puntualidad"] [data-v="9"]');
await pg.click('[data-guardar="evaluacion"]'); await pg.waitForTimeout(400);
const conHabilidades = await pg.evaluate((id)=>{
  const reg = db.evaluaciones.find(e=>e.jugadorId===id && typeof e.control==='number');
  return reg ? { control:reg.control, puntualidad:reg.puntualidad, mismoRegQueFisico: typeof reg.cooper==='number' } : null;
}, jugId);
t('Las habilidades quedaron guardadas en el mismo registro que el test físico de hoy (misma toma)',
  conHabilidades && conHabilidades.control===8 && conHabilidades.puntualidad===9 && conHabilidades.mismoRegQueFisico===true,
  JSON.stringify(conHabilidades));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
