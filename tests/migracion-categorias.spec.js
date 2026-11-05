const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);

// ---- 1) fresco: el seed embebido ya no debería traer "Selección Libre" ni "Primera" ----
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
const fresco = await pg.evaluate(()=>({
  categorias: CATEGORIAS,
  conLibre: db.jugadores.filter(j=>(j.categorias||[]).includes('Selección Libre')).length,
  conPrimera: db.jugadores.filter(j=>(j.categorias||[]).includes('Primera')).length,
  totalJugadores: db.jugadores.length,
}));
t('CATEGORIAS ya no incluye "Selección Libre" ni "Primera"', !fresco.categorias.includes('Selección Libre') && !fresco.categorias.includes('Primera'), JSON.stringify(fresco.categorias));
t('El seed embebido no trae jugadores en "Selección Libre"', fresco.conLibre===0, String(fresco.conLibre));
t('El seed embebido no trae jugadores en "Primera"', fresco.conPrimera===0, String(fresco.conPrimera));

await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
const filasCat = await pg.locator('[data-entrarCat]').allInnerTexts();
t('La pantalla de Categorías ya no lista "Selección Libre" ni "Primera"',
  !filasCat.some(x=>x.includes('Selección Libre')) && !filasCat.some(x=>/\bPrimera\b/.test(x)), filasCat.join(' | '));
t('"Selección" sigue en la lista', filasCat.some(x=>x.includes('Selección')));

// ---- 2) simular un dispositivo con datos VIEJOS (antes de este cambio) y confirmar que la migración los corrige ----
await pg.evaluate(()=>{
  const a=uid(), bb=uid(), c=uid();
  const dbVieja = {
    jugadores:[
      { id:a, nombre:'Vieja', apellido:'UnoLibre', categorias:['Selección Libre'] },
      { id:bb, nombre:'Vieja', apellido:'DosAmbas', categorias:['Selección','Selección Libre'] },
      { id:c, nombre:'Vieja', apellido:'TresPrimera', categorias:['Juveniles','Primera'] },
    ],
    tomas:[], evaluaciones:[],
    partidos:[{ id:uid(), jugadorId:a, categoria:'Selección Libre', fecha:'2026-01-01', jugo:true, goles:1 }],
    ejercicios:[], sesiones:[{ id:uid(), fecha:'2026-01-01', categoria:'Selección Libre', dt:'' }],
    pizarra:[], rutinas:{ 'Selección Libre': { id:uid(), categoria:'Selección Libre', titulo:'rutina-vieja.pdf' } },
    config:{ rol:'Coordinador', categoriaDT:'', acceso:null }
  };
  localStorage.setItem('hsm:v2', JSON.stringify(dbVieja));
});
await pg.reload(); await pg.waitForTimeout(2200);

const migrado = await pg.evaluate(()=>({
  jugadores: db.jugadores.map(j=>({nombre:j.apellido, categorias:j.categorias})),
  partidoCat: db.partidos[0] && db.partidos[0].categoria,
  sesionCat: db.sesiones[0] && db.sesiones[0].categoria,
  rutinasKeys: Object.keys(db.rutinas||{}),
}));
console.log('migrado:', JSON.stringify(migrado, null, 2));

const uno = migrado.jugadores.find(j=>j.nombre==='UnoLibre');
const dos = migrado.jugadores.find(j=>j.nombre==='DosAmbas');
const tres = migrado.jugadores.find(j=>j.nombre==='TresPrimera');
t('Jugador con solo "Selección Libre" queda con "Selección"', JSON.stringify(uno.categorias)==='["Selección"]', JSON.stringify(uno));
t('Jugador con AMBAS categorías queda sin duplicar (solo "Selección")', JSON.stringify(dos.categorias)==='["Selección"]', JSON.stringify(dos));
t('Jugador con "Primera" la pierde y conserva el resto', JSON.stringify(tres.categorias)==='["Juveniles"]', JSON.stringify(tres));
t('El partido con categoria "Selección Libre" pasa a "Selección"', migrado.partidoCat==='Selección');
t('La sesión con categoria "Selección Libre" pasa a "Selección"', migrado.sesionCat==='Selección');
t('La rutina de "Selección Libre" se migra a la key "Selección"', migrado.rutinasKeys.includes('Selección') && !migrado.rutinasKeys.includes('Selección Libre'), migrado.rutinasKeys.join(','));

t('Sin errores de consola en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
