const { chromium } = require('playwright');
const { BASE_URL, launchOptions, entrarComoJugador, entrarComoDT } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* "Nuevos partidos cargados": cuando coordinación o el DT dejan un link
   nuevo en un partido del fixture (solapa "Partidos"), jugadores y DT de
   esa categoría ven un aviso en Inicio hasta que entran a Partidos de esa
   categoría; coordinación no se lo avisa a sí misma. Vive en localStorage
   por dispositivo (hsm:fixtureVisto:<categoria>), no en la nube. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2000);

// ---- coordinación agenda un partido de Juveniles y le carga un link ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.fill('#fx-rival', 'Rival Streaming'); await pg.fill('#fx-fecha', '2026-12-10');
await pg.click('#agregarFixture'); await pg.waitForTimeout(400);
const fx = await pg.evaluate(()=>db.fixture.find(f=>f.rival==='Rival Streaming'));
await pg.click(`[data-cambiarLinkFixture="${fx.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fx.id}`, 'https://youtube.com/live/abc');
await pg.click(`[data-guardarLinkFixture="${fx.id}"]`); await pg.waitForTimeout(400);

await pg.click('.tabs button:has-text("Inicio")'); await pg.waitForTimeout(300);
t('Coordinación NO ve el aviso en su propio Inicio (ella es quien lo carga)',
  (await pg.locator('text=Nuevos partidos cargados').count())===0);

// ---- DT de OTRA categoría (Cadetes): no le importa, no ve nada ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Cadetes');
t('El DT de Cadetes no ve el aviso (el link era de Juveniles)',
  (await pg.locator('text=Nuevos partidos cargados').count())===0);

// ---- DT de Juveniles: SÍ ve el aviso ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
t('El DT de Juveniles ve el aviso "Nuevos partidos cargados" en Inicio',
  (await pg.locator('text=Nuevos partidos cargados').count())===1);
t('El aviso menciona la categoría', (await pg.locator('text=Juveniles').count())>0);

// ---- tocar el aviso lleva a Partidos y lo apaga ----
await pg.click('text=Nuevos partidos cargados'); await pg.waitForTimeout(400);
t('Tocar el aviso navega a la solapa Partidos', (await pg.locator('h2.screen-title').innerText())==='PARTIDOS');
await pg.click('.tabs button:has-text("Inicio")'); await pg.waitForTimeout(300);
t('Después de entrar a Partidos, el aviso ya no aparece', (await pg.locator('text=Nuevos partidos cargados').count())===0);

// ---- persiste entre sesiones del mismo dispositivo (localStorage) ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
t('Sigue sin verse en una sesión nueva del mismo dispositivo (ya quedó marcado como visto)',
  (await pg.locator('text=Nuevos partidos cargados').count())===0);

// ---- un link NUEVO (o cambiado) vuelve a prender el aviso ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Partidos")'); await pg.waitForTimeout(300);
await pg.click('[data-fixtureCat="Juveniles"]'); await pg.waitForTimeout(300);
await pg.click(`[data-cambiarLinkFixture="${fx.id}"]`); await pg.waitForTimeout(300);
await pg.fill(`#fxlink-${fx.id}`, 'https://youtube.com/live/nuevo');
await pg.click(`[data-guardarLinkFixture="${fx.id}"]`); await pg.waitForTimeout(400);
await pg.click('#salir'); await pg.waitForTimeout(400);
await entrarComoDT(pg, 'Juveniles');
t('Un link nuevo (o cambiado) vuelve a mostrar el aviso',
  (await pg.locator('text=Nuevos partidos cargados').count())===1);

// ---- jugador de la misma categoría también lo ve ----
await pg.click('#salir'); await pg.waitForTimeout(400);
const jugJuv = await pg.evaluate(()=>db.jugadores.find(j=>(j.categorias||[]).includes('Juveniles')).id);
await entrarComoJugador(pg, jugJuv);
t('Un jugador de Juveniles también ve el aviso',
  (await pg.locator('text=Nuevos partidos cargados').count())===1);
await pg.click('text=Nuevos partidos cargados'); await pg.waitForTimeout(400);
t('Al jugador también lo lleva a Partidos', (await pg.locator('h2.screen-title').innerText())==='PARTIDOS');

// ---- jugador de OTRA categoría no ve nada ----
await pg.click('#salir'); await pg.waitForTimeout(400);
const jugCadetes = await pg.evaluate(()=>db.jugadores.find(j=>(j.categorias||[]).includes('Cadetes') && !(j.categorias||[]).includes('Juveniles')).id);
await entrarComoJugador(pg, jugCadetes);
t('Un jugador de Cadetes no ve el aviso de un link de Juveniles',
  (await pg.locator('text=Nuevos partidos cargados').count())===0);

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
