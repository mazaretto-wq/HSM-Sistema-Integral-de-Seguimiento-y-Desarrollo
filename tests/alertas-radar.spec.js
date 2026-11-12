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

// datos fabricados y a mano para probar con certeza: sano (sin motivos),
// uno con tarjeta nada más, uno sin evaluarse nunca (nada más), y uno con
// los dos motivos juntos (sin evaluarse Y con roja)
const datos = await pg.evaluate(()=>{
  const sano = uid(), soloTarjeta = uid(), soloSinEvaluar = uid(), ambosMotivos = uid();
  db.jugadores.push(
    { id:sano, nombre:'Sano', apellido:'SinAlertas', categorias:['Juveniles'] },
    { id:soloTarjeta, nombre:'Tarjetero', apellido:'TresAmarillas', categorias:['Juveniles'] },
    { id:soloSinEvaluar, nombre:'Atrasado', apellido:'SinEvaluar', categorias:['Juveniles'] },
    { id:ambosMotivos, nombre:'Expulsado', apellido:'UnaRoja', categorias:['Juveniles'] },
  );
  db.partidos.push(
    { id:uid(), jugadorId:soloTarjeta, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:3, rojas:0 },
    { id:uid(), jugadorId:ambosMotivos, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:0, rojas:1 },
  );
  // "sano" y "soloTarjeta" están evaluados hoy; "soloSinEvaluar" y
  // "ambosMotivos" nunca se evaluaron (a propósito, para probar el motivo)
  const tomaReciente = { id:uid(), nombre:'Hoy', fecha:hoy() };
  db.tomas.push(tomaReciente);
  [sano, soloTarjeta].forEach(id=>{
    db.evaluaciones.push({ id:uid(), jugadorId:id, tomaId:tomaReciente.id, fecha:hoy(), control:7, remate:5 });
  });
  render();
  return { sano, soloTarjeta, soloSinEvaluar, ambosMotivos };
});

const motivos = await pg.evaluate((d)=>({
  sano: alertasDe(db.jugadores.find(j=>j.id===d.sano)),
  soloTarjeta: alertasDe(db.jugadores.find(j=>j.id===d.soloTarjeta)),
  soloSinEvaluar: alertasDe(db.jugadores.find(j=>j.id===d.soloSinEvaluar)),
  ambosMotivos: alertasDe(db.jugadores.find(j=>j.id===d.ambosMotivos)),
}), datos);
t('Evaluado hoy y sin tarjetas: sin motivos de alerta', motivos.sano.length===0, JSON.stringify(motivos.sano));
t('3 amarillas en la temporada: alerta por tarjetas', motivos.soloTarjeta.some(m=>/3 amarillas/.test(m)), JSON.stringify(motivos.soloTarjeta));
t('Nunca evaluado: alerta de evaluación', motivos.soloSinEvaluar.some(m=>/Nunca se evaluó/.test(m)), JSON.stringify(motivos.soloSinEvaluar));
t('Con roja y sin evaluarse: alertasDe() trae los dos motivos juntos',
  motivos.ambosMotivos.some(m=>/1 roja/.test(m)) && motivos.ambosMotivos.some(m=>/Nunca se evaluó/.test(m)), JSON.stringify(motivos.ambosMotivos));

// ---- coordinación ve los dos tipos de alerta juntos ----
// (la base ya trae ~100 jugadores de ejemplo con sus propias alertas; para
// probar esto con certeza se aísla la base a solo los que importan acá)
const jugadoresCompletos = await pg.evaluate((d)=>{
  const todos = db.jugadores;
  db.jugadores = todos.filter(j=>[d.ambosMotivos,d.soloSinEvaluar,d.sano].includes(j.id));
  render();
  return todos;
}, datos);
await pg.waitForTimeout(300);
const textoAlertasCoord = await pg.locator('.block:has-text("Para repasar")').innerText();
t('El bloque "Para repasar" aparece en Inicio para coordinación', /para repasar/i.test(textoAlertasCoord));
t('Coordinación ve ambos motivos del jugador con roja + sin evaluar (y no al que no tiene alertas)',
  /UNAROJA, Expulsado/.test(textoAlertasCoord) && /1 roja/.test(textoAlertasCoord) && /Nunca se evaluó/.test(textoAlertasCoord) && !/Sano/.test(textoAlertasCoord), textoAlertasCoord);
t('Coordinación también ve al que solo tiene "sin evaluarse" (sin ninguna tarjeta)',
  /SINEVALUAR, Atrasado/.test(textoAlertasCoord), textoAlertasCoord);

await pg.click('.row:has-text("Expulsado")'); await pg.waitForTimeout(300);
t('Tocar una fila de alerta abre la ficha de ese jugador', (await pg.locator('.ficha-name').innerText()).includes('EXPULSADO'));
await pg.evaluate(()=>{ view.jugadorId=null; render(); }); await pg.waitForTimeout(300);

// ---- el bloque nunca lista más de 8 filas, aunque haya muchísimas alertas ----
// (jugadores y partidos se cambian temporalmente nada más que para esta
// prueba puntual: se restauran los dos enseguida, para no arrastrar este
// reemplazo a las pruebas de más abajo)
const partidosCompletos = await pg.evaluate(()=>{
  const previos = db.partidos;
  db.jugadores = Array.from({length:15}, (_,i)=>({ id:uid(), nombre:'Masivo'+i, apellido:'Prueba', categorias:['Juveniles'] }));
  db.partidos = db.jugadores.map(j=>({ id:uid(), jugadorId:j.id, categoria:'Juveniles', fecha:ANIO_ACTUAL+'-02-01', jugo:true, minutos:90, amarillas:3, rojas:0 }));
  render();
  return previos;
});
await pg.waitForTimeout(300);
const filasAlertas = await pg.locator('.block:has-text("Para repasar") .row').count();
const tituloConTotal = await pg.locator('.block:has-text("Para repasar") .block-title').innerText();
t('El bloque de alertas nunca muestra más de 8 filas, aunque haya 15 con motivo', filasAlertas===8, String(filasAlertas));
t('El título avisa el total real cuando hay más de las que se muestran', tituloConTotal.includes('15 en total'), tituloConTotal);

await pg.evaluate((args)=>{ db.jugadores = args.jugadores; db.partidos = args.partidos; render(); },
  { jugadores: jugadoresCompletos, partidos: partidosCompletos });
await pg.waitForTimeout(300);

// ---- jugador (rol de solo lectura): ve las tarjetas, NO "sin evaluarse" ----
await pg.evaluate((d)=>{
  db.jugadores = db.jugadores.filter(j=>[d.ambosMotivos,d.soloSinEvaluar,d.soloTarjeta,d.sano].includes(j.id));
  render();
}, datos);
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
const textoAlertasJugador = await pg.locator('.block:has-text("Para repasar")').count()
  ? await pg.locator('.block:has-text("Para repasar")').innerText() : '';
t('El jugador ve el bloque de alertas cuando hay alguna tarjeta para mostrar', textoAlertasJugador!=='');
t('Al jugador le aparece el que tiene roja (motivo de tarjeta)', /UNAROJA, Expulsado/.test(textoAlertasJugador) && /1 roja/.test(textoAlertasJugador), textoAlertasJugador);
t('Al jugador le aparece el que solo tiene amarillas', /TRESAMARILLAS, Tarjetero/.test(textoAlertasJugador), textoAlertasJugador);
t('Al jugador NO le aparece "Nunca se evaluó", ni para el de roja ni para nadie más (eso es solo de coordinación/DT)',
  !/[Ee]valu/.test(textoAlertasJugador), textoAlertasJugador);
t('Al jugador NO le aparece el jugador que solo tiene "sin evaluarse" y ninguna tarjeta (no tiene nada que mostrarle)',
  !/SINEVALUAR, Atrasado/.test(textoAlertasJugador), textoAlertasJugador);

await pg.evaluate((orig)=>{ db.jugadores = orig; render(); }, jugadoresCompletos);

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
  // el bloque también tiene un ícono <svg> chiquito en el título (además
  // del gráfico de verdad): nos quedamos con el que tiene <text>, que es
  // el radar, no el ícono
  const svg = [...document.querySelectorAll('svg')].find(s => s.querySelector('text') && s.closest('.block')?.textContent.includes('Perfil técnico-táctico'));
  if (!svg) return null;
  const vb = svg.viewBox.baseVal;
  return [...svg.querySelectorAll('text')].every(txt => {
    const b = txt.getBBox();
    return b.x >= vb.x - 0.5 && (b.x+b.width) <= vb.x+vb.width + 0.5;
  });
});
t('Ninguna etiqueta del radar se corta contra el borde del gráfico', etiquetasOK===true, String(etiquetasOK));

// cada eje del radar muestra el valor, no solo el nombre
const textoRadar = await pg.locator('.block:has-text("Perfil técnico-táctico")').innerText();
t('El radar muestra el valor de cada ítem junto a su nombre (no solo la forma)',
  /Control y pase[\s\S]{0,6}7/.test(textoRadar), textoRadar);

// "lo que hay que mejorar" (izquierda) · radar (centro) · puntuación
// (derecha) van en una sola fila en pantallas anchas, para no obligar a
// bajar y bajar en vez de leer todo de un vistazo
const ordenPerfil3col = await pg.evaluate(()=>{
  const cont = document.querySelector('.perfil-3col');
  if (!cont) return null;
  return [...cont.children].map(b => b.querySelector('.block-title')?.textContent.trim());
});
t('"Lo que más tiene que mejorar", el radar y "Puntuación" van en una sola fila, en ese orden',
  !!ordenPerfil3col && /mejorar/i.test(ordenPerfil3col[0]) && /técnico-táctico/i.test(ordenPerfil3col[1]) && /puntuación/i.test(ordenPerfil3col[2]),
  JSON.stringify(ordenPerfil3col));

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

// la flecha también se ve para el rol jugador (solo lectura): nunca tuvo
// ninguna restricción de rol, a diferencia de lo que sí pasaba con Alertas
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoJugador(pg);
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, jFlechas);
await pg.waitForTimeout(300);
const filaControlJugador = await pg.locator('tr:has-text("Control y pase")').first().innerText();
t('El jugador (rol de solo lectura) también ve la flecha de la comparación', filaControlJugador.includes('↑'), filaControlJugador);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
