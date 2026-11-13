const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Firebase real está bloqueado en este sandbox, así que acá se simula
   fb.ref.onSnapshot a mano: se llama a fbEscucharCambios() con un "fb"
   de prueba que guarda el callback, y después se lo invoca directamente
   con distintos "snapshots" fabricados, como si Firestore avisara un
   cambio. Así se prueba toda la lógica de decisión sin depender de la
   nube real. */

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

await pg.evaluate(()=>{
  window.__cb = null;
  fb = { ref: { onSnapshot: (cb, errCb) => { window.__cb = cb; } } };
  fbEscucharCambios();
});

// construye el "snapshot" fabricado DENTRO del navegador (no se puede
// mandar una función como argumento de page.evaluate)
const snapArg = (json, {pending=false, exists=true, por='otro@harassantamaria.com'}={}) =>
  ({ jsonTexto: JSON.stringify(json), pending, exists, por });

// ---- el primer snapshot (la carga inicial) se ignora ----
const r1 = await pg.evaluate(async (arg)=>{
  const antes = JSON.stringify(db.jugadores.length);
  const s = { metadata:{hasPendingWrites:arg.pending}, exists:arg.exists, data:()=>({json:arg.jsonTexto, por:arg.por}) };
  window.__cb(s);
  return antes === JSON.stringify(db.jugadores.length);
}, snapArg({ jugadores:[{id:'x',nombre:'Nunca debería aplicarse'}], partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{} }));
t('El primer snapshot (la carga inicial) se ignora', r1);

// ---- un guardado propio todavía sin confirmar (hasPendingWrites) se ignora ----
const r2 = await pg.evaluate((arg)=>{
  const antes = db.jugadores.length;
  const s = { metadata:{hasPendingWrites:arg.pending}, exists:arg.exists, data:()=>({json:arg.jsonTexto, por:arg.por}) };
  window.__cb(s);
  return db.jugadores.length === antes;
}, snapArg({ jugadores:[{id:'y'}], partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{} }, {pending:true}));
t('Un guardado propio sin confirmar todavía (hasPendingWrites) se ignora', r2);

// ---- un guardado confirmado por NOSOTROS MISMOS (mismo mail) se ignora ----
const r3 = await pg.evaluate((arg)=>{
  fbUser = { email: 'yo@harassantamaria.com' };
  const antes = db.jugadores.length;
  const s = { metadata:{hasPendingWrites:arg.pending}, exists:arg.exists, data:()=>({json:arg.jsonTexto, por:arg.por}) };
  window.__cb(s);
  return db.jugadores.length === antes;
}, snapArg({ jugadores:[{id:'z'}], partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{} }, {por:'yo@harassantamaria.com'}));
t('Un guardado confirmado por nosotros mismos se ignora (no se re-aplica)', r3);

// ---- un cambio de OTRO dispositivo, sin estar editando nada, se aplica solo ----
const r4 = await pg.evaluate((arg)=>{
  fbUser = { email: 'yo@harassantamaria.com' };
  view.form = null; view.fichaEditando=false; view.testRegistrando=false; view.draft=null;
  view.pizDraft=null; view.fotoEditor=null; view.editJugador=null; view.rutinaSubiendo=false;
  const s = { metadata:{hasPendingWrites:arg.pending}, exists:arg.exists, data:()=>({json:arg.jsonTexto, por:arg.por}) };
  window.__cb(s);
  return { len: db.jugadores.length, nombre: db.jugadores[0] && db.jugadores[0].nombre };
}, snapArg({ jugadores:[{id:'remoto1', nombre:'Llegó de otro dispositivo'}], partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{acceso:'coordinacion'} }));
t('Si no se está editando nada, un cambio de otro dispositivo se aplica solo', r4.len===1 && r4.nombre==='Llegó de otro dispositivo', JSON.stringify(r4));

const configIntacto = await pg.evaluate(()=> db.config.acceso === 'coordinacion');
t('El "config" (rol/sesión) de este dispositivo no se pisa con el que venga en la nube', configIntacto);

// ---- si hay una edición en curso, el cambio se guarda pendiente (no se aplica) y avisa ----
const r5 = await pg.evaluate((arg)=>{
  view.form = 'nuevoJugador';
  let avisado = null;
  const toastOrig = window.toast;
  window.toast = (m)=>{ avisado = m; };
  const s = { metadata:{hasPendingWrites:arg.pending}, exists:arg.exists, data:()=>({json:arg.jsonTexto, por:arg.por}) };
  window.__cb(s);
  window.toast = toastOrig;
  return { len: db.jugadores.length, avisado };
}, snapArg({ jugadores:[{id:'pendiente', nombre:'No debería verse todavía'}], partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{} }));
t('Con un formulario abierto, el cambio remoto NO se aplica solo (queda pendiente)', r5.len===1);
t('Avisa que hay cambios nuevos cuando llegan mientras se está editando', !!r5.avisado && /cambios/i.test(r5.avisado), String(r5.avisado));

// ---- al dejar de editar (el siguiente render), el cambio pendiente se aplica ----
const r6 = await pg.evaluate(()=>{
  view.form = null;  // "se termina de cargar"
  render();
  return { len: db.jugadores.length, nombre: db.jugadores[0] && db.jugadores[0].nombre };
});
t('Al dejar de editar, el cambio que había quedado pendiente se aplica en el siguiente render', r6.len===1 && r6.nombre==='No debería verse todavía', JSON.stringify(r6));

// ---- la base ahora se sube comprimida (campo "gz" en vez de "json"): el
// listener en vivo tiene que poder descomprimirla también, no solo leer
// el formato viejo. Se simula "pako" (no se puede bajar el real: la red
// a los CDN está bloqueada en este sandbox) con un ida-y-vuelta trivial,
// para probar que el código llama a cargarPako() y usa pako.inflate() ----
await pg.evaluate(()=>{
  window.pako = { inflate: (bytes)=> new TextDecoder().decode(bytes) };
  fbUser = { email: 'yo@harassantamaria.com' };
  view.form = null; view.fichaEditando=false; view.testRegistrando=false; view.draft=null;
  view.pizDraft=null; view.fotoEditor=null; view.editJugador=null; view.rutinaSubiendo=false;
  const jsonTexto = JSON.stringify({ jugadores:[{id:'comprimido', nombre:'Llegó comprimido de otro dispositivo'}],
    partidos:[], evaluaciones:[], tomas:[], sesiones:[], ejercicios:[], pizarra:[], rutinas:{}, config:{acceso:'coordinacion'} });
  const s = { metadata:{hasPendingWrites:false}, exists:true,
    data:()=>({ gz:{ toUint8Array:()=> new TextEncoder().encode(jsonTexto) }, por:'otro@harassantamaria.com' }) };
  window.__cb(s);   // la rama "gz" pasa por un await (cargarPako): no se puede leer el resultado en este mismo evaluate
});
await pg.waitForTimeout(150);
const r7 = await pg.evaluate(()=>({ len: db.jugadores.length, nombre: db.jugadores[0] && db.jugadores[0].nombre }));
t('Un cambio remoto que llega comprimido ("gz") también se descomprime y se aplica', r7.len===1 && r7.nombre==='Llegó comprimido de otro dispositivo', JSON.stringify(r7));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
