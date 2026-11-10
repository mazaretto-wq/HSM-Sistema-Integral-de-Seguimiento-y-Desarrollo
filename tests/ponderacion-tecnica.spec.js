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

// ---- nivel de grupo: defensor / mediocampista / delantero, con puestos
// que NO tienen excepción puntual (lateral, volante interior, extremo) ----
const grupo = await pg.evaluate(()=>{
  const lateral = uid(), volante = uid(), extremo = uid();
  db.jugadores.push(
    { id:lateral, nombre:'Lateral', apellido:'Test', categorias:['Juveniles'], posiciones:['Lateral Derecho'] },
    { id:volante, nombre:'Volante', apellido:'Test', categorias:['Juveniles'], posiciones:['Mediocampista Interior'] },
    { id:extremo, nombre:'Extremo', apellido:'Test', categorias:['Juveniles'], posiciones:['Extremo Derecho'] },
  );
  const toma = { id:uid(), nombre:'Marzo', fecha:ANIO_ACTUAL+'-03-05' };
  db.tomas.push(toma);
  db.evaluaciones.push(
    { id:uid(), jugadorId:lateral, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:2, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:volante, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:2, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:extremo, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:8, unoOf:8, unoDef:5, decision:8, ubicacion:8 },
  );
  render();
  return { lateral, volante, extremo };
});
const pesosGrupo = await pg.evaluate((d)=>({
  lateral: { remate:pesoTecnico(db.jugadores.find(j=>j.id===d.lateral),'remate'), unoOf:pesoTecnico(db.jugadores.find(j=>j.id===d.lateral),'unoOf') },
  volante: { unoOf:pesoTecnico(db.jugadores.find(j=>j.id===d.volante),'unoOf') },
  extremo: { unoDef:pesoTecnico(db.jugadores.find(j=>j.id===d.extremo),'unoDef') },
}), grupo);
t('Lateral (defensor): el remate pesa 0 y el 1v1 ofensivo pesa 0.5 (el peso del grupo, sin excepción)',
  pesosGrupo.lateral.remate===0 && pesosGrupo.lateral.unoOf===0.5, JSON.stringify(pesosGrupo.lateral));
t('Volante interior (mediocampista): el 1v1 ofensivo pesa 1 (sin excepción, es mediocampista "normal")',
  pesosGrupo.volante.unoOf===1, JSON.stringify(pesosGrupo.volante));
t('Extremo (delantero): el 1v1 defensivo pesa 0.5 (el peso del grupo)',
  pesosGrupo.extremo.unoDef===0.5, JSON.stringify(pesosGrupo.extremo));

const mejorarGrupo = await pg.evaluate((d)=>({
  lateral: aMejorar(db.jugadores.find(j=>j.id===d.lateral)).map(x=>x.nombre),
  volante: aMejorar(db.jugadores.find(j=>j.id===d.volante)).map(x=>x.nombre),
}), grupo);
t('Al lateral, "Remate" (flojo) no le aparece como a mejorar: no pesa nada en su puesto',
  !mejorarGrupo.lateral.includes('Remate'), JSON.stringify(mejorarGrupo));
t('Al volante (mismo valor flojo de remate, pero sí pesa en su puesto) sí le aparece "Remate" a mejorar',
  mejorarGrupo.volante.includes('Remate'), JSON.stringify(mejorarGrupo));

// ---- subdivisión puntual: central/delantero centro/enganche pesan el
// 1v1 ofensivo todavía menos que el resto de su grupo (0.25) ----
const sub = await pg.evaluate(()=>{
  const central = uid(), enganche = uid(), nueve = uid();
  db.jugadores.push(
    { id:central, nombre:'Central', apellido:'Test', categorias:['Juveniles'], posiciones:['Central Derecho'] },
    { id:enganche, nombre:'Enganche', apellido:'Test', categorias:['Juveniles'], posiciones:['Enganche'] },
    { id:nueve, nombre:'NueveCentral', apellido:'Test', categorias:['Juveniles'], posiciones:['Delantero Centro'] },
  );
  const toma = { id:uid(), nombre:'Abril', fecha:ANIO_ACTUAL+'-04-05' };
  db.tomas.push(toma);
  db.evaluaciones.push(
    { id:uid(), jugadorId:central, tomaId:toma.id, fecha:toma.fecha, control:8, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:enganche, tomaId:toma.id, fecha:toma.fecha, control:8, remate:8, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:nueve, tomaId:toma.id, fecha:toma.fecha, control:8, remate:8, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
  );
  render();
  return { central, enganche, nueve };
});
const pesosSub = await pg.evaluate((d)=>({
  central: pesoTecnico(db.jugadores.find(j=>j.id===d.central), 'unoOf'),
  enganche: pesoTecnico(db.jugadores.find(j=>j.id===d.enganche), 'unoOf'),
  nueve: pesoTecnico(db.jugadores.find(j=>j.id===d.nueve), 'unoOf'),
}), sub);
t('Central: el 1v1 ofensivo pesa 0.25 (menos que el 0.5 del lateral)', pesosSub.central===0.25, JSON.stringify(pesosSub));
t('Enganche: el 1v1 ofensivo también pesa 0.25 (menos que el 1 del resto de mediocampo)', pesosSub.enganche===0.25, JSON.stringify(pesosSub));
t('Delantero centro: el 1v1 ofensivo también pesa 0.25 (menos que el 1 del extremo)', pesosSub.nueve===0.25, JSON.stringify(pesosSub));

// con el mismo 1v1 ofensivo flojo (4) y el resto en 8, el central promedia
// más alto que un lateral (34/4.5=7.56): al pesar menos ese ítem flojo,
// tira menos del promedio para abajo
const promedioCentral = await pg.evaluate((d)=>promedioTecnico(d.central), sub);
t('Al central le pesa tan poco el 1v1 ofensivo que su promedio da más alto que el del lateral con los mismos valores',
  promedioCentral > 34/4.5, `central=${promedioCentral} vs lateral=${34/4.5}`);

// el valor crudo se sigue viendo igual en Detalle/telaraña pese al
// peso bajísimo (0.25): no se esconde ni se recalcula nada cargado
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, sub.central);
await pg.waitForTimeout(300);
const filaUnoOfDetalle = await pg.locator('tr:has-text("1v1 ofensivo")').first().innerText();
t('En Detalle, el central sigue viendo su 1v1 ofensivo tal cual se cargó (4), aunque pese 0.25',
  /\b4\b/.test(filaUnoOfDetalle), filaUnoOfDetalle);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
