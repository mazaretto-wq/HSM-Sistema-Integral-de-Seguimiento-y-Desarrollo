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

// tres jugadores, mismos valores técnico-tácticos salvo donde se indica,
// para aislar el efecto del puesto en el promedio ponderado
const datos = await pg.evaluate(()=>{
  const defensor = uid(), mediocampista = uid(), delantero = uid();
  db.jugadores.push(
    { id:defensor, nombre:'Zaguero', apellido:'Test', categorias:['Juveniles'], posiciones:['Central Derecho'] },
    { id:mediocampista, nombre:'Diez', apellido:'Test', categorias:['Juveniles'], posiciones:['Enganche'] },
    { id:delantero, nombre:'Nueve', apellido:'Test', categorias:['Juveniles'], posiciones:['Delantero Centro'] },
  );
  const toma = { id:uid(), nombre:'Marzo', fecha:ANIO_ACTUAL+'-03-05' };
  db.tomas.push(toma);
  db.evaluaciones.push(
    { id:uid(), jugadorId:defensor, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:2, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:mediocampista, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:2, unoOf:4, unoDef:8, decision:8, ubicacion:8 },
    { id:uid(), jugadorId:delantero, tomaId:toma.id, fecha:toma.fecha,
      control:8, remate:8, unoOf:8, unoDef:5, decision:8, ubicacion:8 },
  );
  render();
  return { defensor, mediocampista, delantero };
});

const promedios = await pg.evaluate((d)=>({
  defensor: promedioTecnico(d.defensor),
  mediocampista: promedioTecnico(d.mediocampista),
  delantero: promedioTecnico(d.delantero),
}), datos);
t('Con los mismos valores crudos, el defensor y el mediocampista NO dan el mismo promedio (el remate no le pesa igual al defensor)',
  Math.abs(promedios.defensor - promedios.mediocampista) > 0.5, JSON.stringify(promedios));
t('El promedio del defensor (7.56) excluye el remate (peso 0) del cálculo', Math.abs(promedios.defensor - 34/4.5) < 0.01, JSON.stringify(promedios));
t('El promedio del mediocampista (6.33) es el simple, sin ponderar (todo pesa 1 en ese puesto)', Math.abs(promedios.mediocampista - 38/6) < 0.01, JSON.stringify(promedios));
t('El promedio del delantero (7.73) pondera el 1v1 defensivo a mitad de peso', Math.abs(promedios.delantero - 42.5/5.5) < 0.01, JSON.stringify(promedios));

const mejorar = await pg.evaluate((d)=>({
  defensor: aMejorar(db.jugadores.find(j=>j.id===d.defensor)).map(x=>x.nombre),
  mediocampista: aMejorar(db.jugadores.find(j=>j.id===d.mediocampista)).map(x=>x.nombre),
  delantero: aMejorar(db.jugadores.find(j=>j.id===d.delantero)).map(x=>x.nombre),
}), datos);
t('Al defensor, "Remate" (flojo, 2) NO le aparece como "a mejorar": no pesa nada en su puesto',
  !mejorar.defensor.includes('Remate'), JSON.stringify(mejorar));
t('Al defensor sí le aparece "1v1 ofensivo" (flojo, 4): pesa la mitad, pero sigue contando como a mejorar',
  mejorar.defensor.includes('1v1 ofensivo'), JSON.stringify(mejorar));
t('Al mediocampista (todo pesa igual) SÍ le aparece "Remate" como a mejorar, con el mismo valor flojo',
  mejorar.mediocampista.includes('Remate'), JSON.stringify(mejorar));
t('Al delantero le aparece "1v1 defensivo" (flojo, 5) aunque pese la mitad: 0.5 sigue siendo relevante',
  mejorar.delantero.includes('1v1 defensivo'), JSON.stringify(mejorar));

// el valor crudo se sigue viendo igual en Detalle/telaraña, sin esconder nada
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='detalle'; render(); }, datos.defensor);
await pg.waitForTimeout(300);
const filaRemateDetalle = await pg.locator('tr:has-text("Remate")').first().innerText();
t('En la solapa Detalle, el remate del defensor se sigue mostrando tal cual se cargó (no se esconde por pesar 0)',
  /\b2\b/.test(filaRemateDetalle), filaRemateDetalle);

await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, datos.defensor);
await pg.waitForTimeout(300);
const textoRadar = await pg.locator('.block:has-text("Perfil técnico-táctico")').innerText();
t('La telaraña también muestra el remate del defensor tal cual (2), sin ocultar el eje de peso 0',
  /Remate[\s\S]{0,6}2\b/.test(textoRadar), textoRadar);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
