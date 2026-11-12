const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador } = require('./helpers');
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

const jugId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Con', apellido:'Lesiones', categorias:['Juveniles'] });
  render();
  return id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='lesiones'; render(); }, jugId);
await pg.waitForTimeout(300);

// ---- la solapa existe y arranca vacía ----
t('"Lesiones" aparece como solapa de la ficha', (await pg.locator('.chip[data-ficha="lesiones"]').count())===1);
t('Arranca sin lesiones cargadas', (await pg.locator('.empty:has-text("Sin lesiones")').count())===1);

// ---- cargar una lesión (coordinación) ----
await pg.click('[data-lesionForm]'); await pg.waitForTimeout(300);
t('El formulario pide fecha, tipo, parte del cuerpo y días previstos de vuelta',
  (await pg.locator('#l-fecha').count())===1 && (await pg.locator('#l-tipo').count())===1
  && (await pg.locator('#l-parte').count())===1 && (await pg.locator('#l-dias').count())===1);

await pg.fill('#l-fecha', '2026-10-01');
await pg.selectOption('#l-tipo', 'Muscular');
await pg.selectOption('#l-parte', 'Isquiotibiales');
await pg.fill('#l-dias', '15');
await pg.click('[data-guardar="lesion"]'); await pg.waitForTimeout(400);

const guardada = await pg.evaluate((id)=>db.lesiones.find(l=>l.jugadorId===id), jugId);
t('La lesión quedó guardada con todos los campos cargados', guardada
  && guardada.fecha==='2026-10-01' && guardada.tipo==='Muscular' && guardada.parte==='Isquiotibiales'
  && guardada.diasPrevistos===15 && guardada.fechaVuelta===null, JSON.stringify(guardada));
t('Vuelve sola a la lista (no se queda en el formulario)', (await pg.locator('#l-fecha').count())===0);
t('La fila muestra la vuelta prevista calculada (15 días después)', /16\/10\/2026/.test(await pg.locator('.scroll-x table').innerText()));
t('Mientras no se registra la vuelta, figura "En curso"', /EN CURSO/.test(await pg.locator('.scroll-x table').innerText()));

// ---- registrar la vuelta REAL, más tarde de lo previsto ----
const inputVuelta = `#v-vuelta-${guardada.id}`;
await pg.fill(inputVuelta, '2026-10-21');
await pg.click(`[data-registrarVuelta="${guardada.id}"]`); await pg.waitForTimeout(400);

const conVuelta = await pg.evaluate((id)=>db.lesiones.find(l=>l.id===id), guardada.id);
t('La fecha de vuelta real quedó guardada', conVuelta.fechaVuelta==='2026-10-21', JSON.stringify(conVuelta));
const textoTrasVuelta = await pg.locator('.scroll-x table').innerText();
t('Se ve la diferencia contra lo previsto: volvió 5 días más tarde (20 reales vs 15 previstos)',
  /\(20 d\)/.test(textoTrasVuelta) && /\+5 d/.test(textoTrasVuelta), textoTrasVuelta);
t('Ya no pide la fecha de vuelta (esa lesión ya está cerrada)', (await pg.locator(inputVuelta).count())===0);

// ---- una segunda lesión que vuelve ANTES de lo previsto ----
const segundaId = await pg.evaluate((id)=>{
  const lid = uid();
  db.lesiones.push({ id:lid, jugadorId:id, fecha:'2026-01-01', tipo:'Contusión', parte:'Tobillo', diasPrevistos:20, fechaVuelta:'2026-01-15' });
  render();
  return lid;
}, jugId);
await pg.waitForTimeout(200);
const textoAdelantado = await pg.locator('.scroll-x table').innerText();
t('Si vuelve antes de lo previsto, la diferencia se ve en verde y en negativo (no "+")',
  /-6 d/.test(textoAdelantado) && !new RegExp('\\+6 d').test(textoAdelantado), textoAdelantado);

// ---- eliminar un registro de lesión ----
await pg.click(`[data-borrarLesion="${segundaId}"]`); await pg.waitForTimeout(300);
t('"Eliminar" saca ese registro puntual de lesión', (await pg.evaluate((id)=>db.lesiones.some(l=>l.id===id), segundaId))===false);
t('No tocó la otra lesión del mismo jugador', (await pg.evaluate((id)=>db.lesiones.some(l=>l.id===id), guardada.id))===true);

// ---- rol jugador: solo lectura, sin botones de carga/edición ----
await pg.evaluate(()=>{ db.config.acceso=null; });
await pg.reload(); await pg.waitForTimeout(1200);
await entrarComoJugador(pg, jugId);
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='lesiones'; render(); }, jugId);
await pg.waitForTimeout(300);
t('El rol Jugador NO ve "Cargar lesión"', (await pg.locator('[data-lesionForm]').count())===0);
t('El rol Jugador NO puede registrar una vuelta ni eliminar', (await pg.locator('[data-registrarVuelta], [data-borrarLesion]').count())===0);
t('El rol Jugador sí ve el historial de lesiones (de solo lectura)', /Muscular/.test(await pg.locator('.scroll-x table').innerText()));

// ---- al eliminar un jugador, se borran también sus lesiones ----
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1200);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
const otroId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Para', apellido:'Borrar', categorias:['Juveniles'] });
  db.lesiones.push({ id:uid(), jugadorId:id, fecha:'2026-01-01', tipo:'Muscular', parte:'Gemelo / pantorrilla', diasPrevistos:10, fechaVuelta:null });
  render();
  return id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, otroId);
await pg.waitForTimeout(300);
await pg.click(`[data-borrar="${otroId}"]`); await pg.waitForTimeout(400);
t('Eliminar un jugador también elimina sus registros de lesión',
  (await pg.evaluate((id)=>db.lesiones.some(l=>l.jugadorId===id), otroId))===false);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
