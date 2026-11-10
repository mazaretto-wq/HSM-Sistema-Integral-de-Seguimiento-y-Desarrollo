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

// ---- ningún emoji con relleno de color se coló en ninguna pantalla:
// solo íconos de contorno (<svg class="icon">), nada de 😀⚽🏆 sueltos
// como caracteres de texto ----
const sinEmojis = texto => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}]/u.test(texto);

t('En Inicio (fondo oscuro) no queda ningún emoji de texto, solo íconos de contorno',
  sinEmojis(await pg.locator('#app').innerText()), await pg.locator('#app').innerText());

const titulosConIcono = await pg.evaluate(()=>
  [...document.querySelectorAll('.block-title')].map(b => ({
    texto: b.textContent.trim(),
    tieneIcono: !!b.querySelector('svg.icon'),
  })).filter(x => x.texto)
);
t('Todos los títulos de bloque en Inicio tienen un ícono de contorno (ninguno quedó sin reemplazar)',
  titulosConIcono.length>0 && titulosConIcono.every(x=>x.tieneIcono), JSON.stringify(titulosConIcono));

// el ícono dentro del panel oscuro de Inicio es blanco (mismo criterio
// que ya usa el texto ahí), no naranja
const colorEnOscuro = await pg.evaluate(()=>{
  const svg = document.querySelector('.inicio-dash .block-title svg.icon');
  return svg ? getComputedStyle(svg).stroke : null;
});
t('Sobre el fondo oscuro de Inicio, el ícono es blanco', colorEnOscuro === 'rgb(255, 255, 255)', colorEnOscuro);

// ---- los íconos de las tarjetas "Destacados" también son de contorno ----
t('Las tarjetas de Destacados tienen ícono de contorno (no el emoji de antes)',
  await pg.locator('.dash-card-icon svg.icon').count() >= 3);

// ---- sobre fondo claro (la ficha), el ícono es naranja, sin relleno ----
const jid = await pg.evaluate(()=>db.jugadores[0].id);
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, jid);
await pg.waitForTimeout(300);
const svgClaro = await pg.evaluate(()=>{
  const svg = document.querySelector('.block-title svg.icon');
  if (!svg) return null;
  const cs = getComputedStyle(svg);
  return { stroke: cs.stroke, fill: cs.fill };
});
t('En la ficha (fondo claro), el ícono es naranja', svgClaro && svgClaro.stroke === 'rgb(234, 91, 12)', JSON.stringify(svgClaro));
t('El ícono no tiene relleno de color (fill: none)', svgClaro && svgClaro.fill === 'none', JSON.stringify(svgClaro));
t('No quedó ningún emoji de texto en toda la solapa General de la ficha',
  sinEmojis(await pg.locator('#app').innerText()));

await pg.evaluate(()=>{ view.fichaTab='detalle'; render(); }); await pg.waitForTimeout(300);
t('Tampoco quedó ningún emoji en la solapa Detalle', sinEmojis(await pg.locator('#app').innerText()));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
