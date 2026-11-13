const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);
await entrarComoDT(pg, 'Juveniles');

await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);

// ---- el formulario de Partido pide el esquema usado ----
t('El formulario de Partido tiene un selector de Esquema', (await pg.locator('#p-esquema').count())===1);
t('Las opciones de esquema son las mismas 4 formaciones ya usadas en la pizarra/cancha',
  JSON.stringify(await pg.locator('#p-esquema option').allTextContents())===JSON.stringify(['4-3-3','4-4-2','3-5-2','4-3-1-2']));
t('El puesto de cada jugador también se puede cargar (columna Puesto, con su posición principal de default)',
  (await pg.locator('select[data-campo="posicion"]').count())>0);

// ---- cargar 2 partidos con 4-3-3 y uno con 4-4-2 ----
const cargarPartido = async (fecha, esquema)=>{
  await pg.selectOption('#p-esquema', esquema);
  await pg.fill('#p-fecha', fecha);
  const filas = await pg.locator('tr[data-fila]').all();
  for (let i=0;i<3;i++){
    const jid = await filas[i].getAttribute('data-fila');
    await pg.fill(`[data-jug="${jid}"][data-campo="minutos"]`, '90');
  }
  await pg.click('#guardarPartidoPlantel'); await pg.waitForTimeout(400);
  await pg.click('[data-tab="cargar"]'); await pg.waitForTimeout(300);
  await pg.click('[data-go="partido"]'); await pg.waitForTimeout(300);
};
const hoyStr = await pg.evaluate(()=>hoy());
const anio = hoyStr.slice(0,4);
await cargarPartido(`${anio}-03-01`, '4-4-2');
t('El próximo partido de la misma categoría sugiere el último esquema usado (4-4-2), no uno fijo',
  (await pg.locator('#p-esquema').inputValue())==='4-4-2');
await cargarPartido(`${anio}-04-01`, '4-3-3');
await cargarPartido(`${anio}-05-01`, '4-3-3');
await pg.click('[data-back]'); await pg.waitForTimeout(300);

// ---- "Esquema más usado" se ve en Plantel, filtrado por categoría ----
await pg.click('[data-tab="categorias"]'); await pg.waitForTimeout(300);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(400);
t('Aparece el bloque "Esquema más usado" al entrar a una categoría puntual', (await pg.locator('.block-title:has-text("Esquema más usado")').count())===1);
const textoBloque = await pg.locator('.block:has-text("Esquema más usado")').innerText();
t('El esquema más usado (4-3-3, 2 de 3 partidos) aparece primero, con el 67%', /4-3-3[\s\S]*2 PJ[\s\S]*67%/.test(textoBloque), textoBloque);
t('El segundo (4-4-2, 1 de 3) también se ve, con el 33%', /4-4-2[\s\S]*1 PJ[\s\S]*33%/.test(textoBloque), textoBloque);
t('Aclara sobre cuántos partidos y de qué temporada es el conteo', textoBloque.includes(`Sobre 3 partidos de Juveniles en ${anio}`), textoBloque);

// ---- al elegir "Todas" no se muestra (no hay una categoría puntual) ----
await pg.click('.chip[data-cat="Todas"]'); await pg.waitForTimeout(300);
t('En "Todas" no se muestra el bloque (el esquema es por categoría)', (await pg.locator('.block-title:has-text("Esquema más usado")').count())===0);

// ---- se guardó en cada fila de jugador del partido ----
const guardado = await pg.evaluate((anio)=>{
  const filas = db.partidos.filter(p=>p.categoria==='Juveniles' && p.fecha===`${anio}-05-01`);
  return filas.map(f=>f.esquema);
}, anio);
t('El esquema quedó guardado en cada fila de jugador de ese partido', guardado.length>0 && guardado.every(e=>e==='4-3-3'), JSON.stringify(guardado));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
