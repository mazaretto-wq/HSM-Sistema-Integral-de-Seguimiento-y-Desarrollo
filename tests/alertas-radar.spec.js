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

// datos fabricados y a mano para probar con certeza: uno sin evaluarse
// nunca, uno con 3 amarillas, uno con 1 roja, uno sin ningún motivo
const datos = await pg.evaluate(()=>{
  const sano = uid(), conAmarillas = uid(), conRoja = uid(), evaluadoHaceNada = uid();
  db.jugadores.push(
    { id:sano, nombre:'Sano', apellido:'SinAlertas', categorias:['Juveniles'] },
    { id:conAmarillas, nombre:'Tarjetero', apellido:'TresAmarillas', categorias:['Juveniles'] },
    { id:conRoja, nombre:'Expulsado', apellido:'UnaRoja', categorias:['Juveniles'] },
    { id:evaluadoHaceNada, nombre:'Reciente', apellido:'EvaluadoAyer', categorias:['Juveniles'] },
  );
  db.partidos.push(
    { id:uid(), jugadorId:conAmarillas, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:3, rojas:0 },
    { id:uid(), jugadorId:conRoja, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:0, rojas:1 },
  );
  const tomaReciente = { id:uid(), nombre:'Hoy', fecha:hoy() };
  db.tomas.push(tomaReciente);
  [sano, conAmarillas, conRoja, evaluadoHaceNada].forEach(id=>{
    db.evaluaciones.push({ id:uid(), jugadorId:id, tomaId:tomaReciente.id, fecha:hoy(), control:7 });
  });
  render();
  return { sano, conAmarillas, conRoja, evaluadoHaceNada };
});

const motivos = await pg.evaluate((d)=>({
  sano: alertasDe(db.jugadores.find(j=>j.id===d.sano)),
  conAmarillas: alertasDe(db.jugadores.find(j=>j.id===d.conAmarillas)),
  conRoja: alertasDe(db.jugadores.find(j=>j.id===d.conRoja)),
}), datos);
t('Evaluado hoy y sin tarjetas: sin motivos de alerta', motivos.sano.length===0, JSON.stringify(motivos.sano));
t('3 amarillas en la temporada: alerta por tarjetas', motivos.conAmarillas.some(m=>/3 amarillas/.test(m)), JSON.stringify(motivos.conAmarillas));
t('1 roja en la temporada: alerta por tarjetas (alcanza con una)', motivos.conRoja.some(m=>/1 roja/.test(m)), JSON.stringify(motivos.conRoja));

// ---- la alerta por tarjetas aparece en Inicio y es clickeable ----
// (la base ya trae ~100 jugadores de ejemplo con sus propias alertas; para
// probar esto con certeza se aísla la base a solo los 2 que importan acá)
const jugadoresCompletos = await pg.evaluate((d)=>{
  const todos = db.jugadores;
  db.jugadores = todos.filter(j=>j.id===d.conRoja || j.id===d.sano);
  render();
  return todos;
}, datos);
await pg.waitForTimeout(300);
const textoAlertas = await pg.locator('.block:has-text("Para repasar")').innerText();
t('El bloque "Para repasar" aparece en Inicio para coordinación', /para repasar/i.test(textoAlertas));
t('Muestra al jugador con la roja fabricada, con el motivo (y no al que no tiene alertas)',
  /UNAROJA, Expulsado/.test(textoAlertas) && /1 roja/.test(textoAlertas) && !/Sano/.test(textoAlertas), textoAlertas);

await pg.click('.row:has-text("Expulsado")'); await pg.waitForTimeout(300);
t('Tocar una fila de alerta abre la ficha de ese jugador', (await pg.locator('.ficha-name').innerText()).includes('EXPULSADO'));
await pg.evaluate(()=>{ view.jugadorId=null; render(); }); await pg.waitForTimeout(300);

// ---- el bloque nunca lista más de 8 filas, aunque haya muchísimas alertas ----
await pg.evaluate(()=>{
  db.jugadores = Array.from({length:15}, (_,i)=>({ id:uid(), nombre:'Masivo'+i, apellido:'Prueba', categorias:['Juveniles'] }));
  db.partidos = db.jugadores.map(j=>({ id:uid(), jugadorId:j.id, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:3, rojas:0 }));
  render();
});
await pg.waitForTimeout(300);
const filasAlertas = await pg.locator('.block:has-text("Para repasar") .row').count();
const tituloConTotal = await pg.locator('.block:has-text("Para repasar") .block-title').innerText();
t('El bloque de alertas nunca muestra más de 8 filas, aunque haya 15 con motivo', filasAlertas===8, String(filasAlertas));
t('El título avisa el total real cuando hay más de las que se muestran', tituloConTotal.includes('15 en total'), tituloConTotal);

await pg.evaluate((orig)=>{ db.jugadores = orig; render(); }, jugadoresCompletos);
await pg.waitForTimeout(300);

// ---- jugador (rol de solo lectura) no ve el bloque de alertas ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-jugador'); await pg.waitForTimeout(700);
t('El jugador NO ve el bloque de alertas (es para coordinación/DT)', await pg.locator('.block:has-text("Para repasar")').count()===0);

// ---- radar técnico-táctico: visible en General, y con un valor bien a la
// vista no se corta ningún texto (ancho/alto del chart == lo que entra) ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, datos.sano);
await pg.waitForTimeout(300);
t('El jugador evaluado sí tiene el bloque "Perfil técnico-táctico"', await pg.locator('.block:has-text("Perfil técnico-táctico")').count()===1);
// ninguna etiqueta del gráfico se corta contra el borde del SVG (el bug
// real que hubo: "Toma de decisión" perdía la "T" por quedarse afuera)
const etiquetasOK = await pg.evaluate(()=>{
  const svg = [...document.querySelectorAll('svg')].find(s => s.closest('.block').textContent.includes('Perfil técnico-táctico'));
  if (!svg) return null;
  const vb = svg.viewBox.baseVal;
  return [...svg.querySelectorAll('text')].every(txt => {
    const b = txt.getBBox();
    return b.x >= vb.x - 0.5 && (b.x+b.width) <= vb.x+vb.width + 0.5;
  });
});
t('Ninguna etiqueta del radar se corta contra el borde del gráfico', etiquetasOK===true, String(etiquetasOK));

// un jugador SIN ninguna evaluación técnico-táctica no muestra el bloque
const sinNada = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Vacio', apellido:'SinEvaluar', categorias:['Juveniles'] });
  render();
  return id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, sinNada);
await pg.waitForTimeout(300);
t('Sin ninguna evaluación técnico-táctica, no se muestra el bloque del radar', await pg.locator('.block:has-text("Perfil técnico-táctico")').count()===0);

// ---- flechas en la comparación de evaluaciones (Detalle) ----
const jFlechas = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Flechas', apellido:'Comparacion', categorias:['Juveniles'] });
  const t1={id:uid(),nombre:'Vieja',fecha:'2025-01-10'}, t2={id:uid(),nombre:'Nueva',fecha:'2025-06-10'};
  db.tomas.push(t1,t2);
  db.evaluaciones.push(
    { id:uid(), jugadorId:id, tomaId:t1.id, fecha:t1.fecha, control:4 },
    { id:uid(), jugadorId:id, tomaId:t2.id, fecha:t2.fecha, control:7 },
  );
  render();
  return id;
});
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, jFlechas);
await pg.waitForTimeout(300);
const filaControl = await pg.locator('tr:has-text("Control y pase")').first().innerText();
t('La mejora de "Control y pase" (4→7) se marca con flecha ↑ hacia arriba', filaControl.includes('↑'), filaControl);
t('El número de la diferencia sigue mostrándose junto a la flecha', /\+3/.test(filaControl), filaControl);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
