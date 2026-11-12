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

// ---- coordinación le carga el DNI a un jugador de Juveniles ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
const jid = await pg.evaluate(()=>db.jugadores.find(j=>(j.categorias||[]).includes('Juveniles')).id);
await pg.evaluate((id)=>{ view.jugadorId=id; view.fichaTab='general'; render(); }, jid);
await pg.waitForTimeout(300);
await pg.click(`[data-editar="${jid}"]`); await pg.waitForTimeout(300);
t('La ficha de edición tiene un campo DNI', (await pg.locator('#j-dni').count())===1);
await pg.fill('#j-dni', '30123456');
await pg.click('#guardarJugador'); await pg.waitForTimeout(400);
t('El DNI quedó guardado en el jugador', (await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id).dni, jid))==='30123456');

// ---- no deja cargar el mismo DNI en otro jugador ----
const otroId = await pg.evaluate(()=>{
  const id = uid();
  db.jugadores.push({ id, nombre:'Otro', apellido:'ConMismoDni', categorias:['Cadetes'] });
  render();
  return id;
});
await pg.evaluate((id)=>{ view.editJugador=id; view.jugadorId=null; view.tab='cargar'; view.form='nuevoJugador'; render(); }, otroId);
await pg.waitForTimeout(300);
await pg.fill('#j-dni', '30123456');
await pg.click('#guardarJugador'); await pg.waitForTimeout(300);
t('No deja guardar un DNI que ya tiene cargado otro jugador', (await pg.locator('.toast').innerText()).includes('ya está cargado'));
t('Ese jugador nuevo se quedó sin DNI (no se guardó el duplicado)', (await pg.evaluate((id)=>db.jugadores.find(j=>j.id===id).dni, otroId))===undefined);

// ---- "Soy jugador" ahora pide DNI, no entra directo ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-jugador'); await pg.waitForTimeout(300);
t('Al tocar "Soy jugador" pide el DNI en vez de entrar directo', (await pg.locator('#ac-dni').count())===1);
t('Todavía no hay acceso concedido', (await pg.evaluate(()=>db.config.acceso))===null);

// ---- DNI que no existe: no lo deja entrar ----
await pg.fill('#ac-dni', '99999999');
await pg.click('#ac-dni-entrar'); await pg.waitForTimeout(400);
t('Con un DNI no encontrado, avisa y no deja entrar', (await pg.locator('.screen-note:has-text("No encontramos ese DNI")').count())===1
  && (await pg.evaluate(()=>db.config.acceso))===null);

// ---- "Volver" desde la pantalla de DNI vuelve a la portada ----
await pg.click('#ac-volver'); await pg.waitForTimeout(300);
t('"Volver" lleva de nuevo a elegir el rol', (await pg.locator('#ac-jugador').count())===1);

// ---- DNI correcto: entra y queda atado a la categoría del jugador ----
await pg.click('#ac-jugador'); await pg.waitForTimeout(300);
await pg.fill('#ac-dni', '30123456');
await pg.click('#ac-dni-entrar'); await pg.waitForTimeout(500);
t('Con el DNI correcto, entra como jugador', (await pg.evaluate(()=>db.config.acceso))==='jugador');
t('Queda guardada la categoría de ESE jugador (Juveniles)', (await pg.evaluate(()=>db.config.categoriaJugador))==='Juveniles');
t('El cartel de arriba muestra la categoría del jugador identificado', (await pg.locator('#rolebox').innerText()).includes('Juveniles'));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
