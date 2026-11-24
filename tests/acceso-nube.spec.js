const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* Acceso con nube, de punta a punta, contra un Firebase SIMULADO dentro
   del navegador (el real no se puede usar desde las pruebas). El simulado
   imita lo que hacen las reglas de firestore.rules en lo que importa acá:
   sin sesión no se puede leer ni escribir la base (hsm/...), ni hsm_staff;
   las llaves, la copia recortada y las fichitas se abren por nombre.
   Prueba:
   - coordinación entra y publica la copia para jugadores
   - un jugador entra SOLO con su DNI, sin bajar la base completa
   - la copia que baja no trae DNI, fecha de nacimiento ni test/lesiones
     de otros; sí trae los suyos
   - coordinación crea la cuenta propia de un DT; el DT entra con SU
     contraseña y la categoría la decide la nube
   - un DT dado de baja ya no entra
   - si a un jugador se le saca el DNI, se cambia la llave común */

const FAKE = () => {
  const fs = window.__fs = {};
  const usuarios = window.__usuarios = {
    'coordinacion@harassantamaria.com': { pass:'clave-coord', uid:'u-coord' }
  };
  window.__lecturasBase = 0;
  const copiar = v => {
    if (v && typeof v==='object' && v.__blob) return v;
    if (Array.isArray(v)) return v.map(copiar);
    if (v && typeof v==='object'){ const o={}; for (const k in v) o[k]=copiar(v[k]); return o; }
    return v;
  };
  const negado = () => { const e = new Error('permission-denied'); e.code='permission-denied'; return e; };
  const apps = [];
  function crearApp(nombre){
    const auth = {
      currentUser: null, _subs: [],
      onAuthStateChanged(cb){ setTimeout(()=>cb(this.currentUser), 0); return ()=>{}; },
      async signInWithEmailAndPassword(email, pass){
        const u = usuarios[email];
        if (!u || u.pass!==pass){ const e=new Error('x'); e.code='auth/wrong-password'; throw e; }
        this.currentUser = { uid:u.uid, email }; return { user:this.currentUser };
      },
      async createUserWithEmailAndPassword(email, pass){
        if (pass.length<6){ const e=new Error('x'); e.code='auth/weak-password'; throw e; }
        if (usuarios[email]){ const e=new Error('x'); e.code='auth/email-already-in-use'; throw e; }
        const uid = 'u-'+Math.random().toString(36).slice(2);
        usuarios[email] = { pass, uid };
        this.currentUser = { uid, email }; return { user:this.currentUser };
      },
      async signOut(){ this.currentUser = null; },
      async setPersistence(){}
    };
    const app = { name:nombre, auth: ()=>auth };
    apps.push(app);
    return app;
  }
  const principal = crearApp('[DEFAULT]');
  const sesion = () => principal.auth().currentUser;
  const esStaff = () => { const u = sesion(); return !!u && (u.email==='coordinacion@harassantamaria.com' || !!fs['hsm_staff/'+u.uid]); };
  const puede = (col, accion) => {
    if (col==='hsm') return esStaff();
    if (col==='hsm_staff') return accion==='get' ? !!sesion() : (sesion()||{}).email==='coordinacion@harassantamaria.com';
    if (col==='hsm_dtlogin') return accion==='get' ? true : (sesion()||{}).email==='coordinacion@harassantamaria.com';
    if (['hsm_acceso','hsm_vista','hsm_ficha'].includes(col)) return accion==='get' ? true : esStaff();
    return false;
  };
  const ref = (col, id) => {
    const path = col+'/'+id;
    return {
      path,
      async get(){
        if (!puede(col,'get')) throw negado();
        if (path==='hsm/base') window.__lecturasBase++;
        const d = fs[path]; return { exists: d!==undefined, data: ()=>copiar(d) };
      },
      async set(data){ if (!puede(col,'write')) throw negado(); fs[path] = copiar(data); },
      async delete(){ if (!puede(col,'write')) throw negado(); delete fs[path]; },
      onSnapshot(){ return ()=>{}; }
    };
  };
  const firestoreObj = {
    collection: col => ({ doc: id => ref(col, id) }),
    batch(){
      const ops = [];
      return { set:(r,d)=>ops.push(()=>r.set(d)), delete:r=>ops.push(()=>r.delete()),
               async commit(){ for (const o of ops) await o(); } };
    },
    enablePersistence: () => Promise.resolve()
  };
  window.firebase = {
    apps,
    initializeApp: (cfg, nombre) => nombre ? crearApp(nombre) : principal,
    firestore: Object.assign(() => firestoreObj, {
      Blob: { fromUint8Array: u8 => ({ __blob:true, u8, toUint8Array(){ return this.u8; } }) }
    }),
    auth: Object.assign(() => principal.auth(), { Auth: { Persistence: { NONE:'none' } } }),
    storage: () => ({})
  };
  /* pako simulado: no se puede bajar de la CDN en el sandbox */
  window.pako = {
    deflate: s => new TextEncoder().encode(s),
    inflate: (u8, o) => new TextDecoder().decode(u8)
  };
};

(async()=>{
const b=await chromium.launch(launchOptions());
const ctx=await b.newContext({viewport:{width:420,height:1200}});
/* que el SDK real nunca pise al simulado */
await ctx.route(/gstatic\.com|jsdelivr|cloudflare/, r=>r.abort());
await ctx.addInitScript(FAKE);
const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
const dialogos=[]; pg.on('dialog',d=>{ dialogos.push(d.message()); d.accept(window_prompt_valor); });
let window_prompt_valor = '';
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);

t('La app reconoce el Firebase (simulado)', await pg.evaluate(()=>!!fb));
t('Al abrir, sin sesión, no intenta leer la base del club', (await pg.evaluate(()=>window.__lecturasBase))===0);

// ---- coordinación entra, le pone DNI a dos jugadores, lesión y test a uno ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','clave-coord'); await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
t('Coordinación entra con la cuenta de la nube', (await pg.evaluate(()=>db.config.acceso))==='coordinacion');
const ids = await pg.evaluate(async ()=>{
  const juv = db.jugadores.filter(j=>(j.categorias||[]).includes('Juveniles'));
  const a = juv[0], c = juv[1];
  a.dni = '30111222'; a.fechaNac = '2009-05-04'; a.carnet = 'C-99';
  c.dni = '30333444'; c.fechaNac = '2009-07-07';
  const toma = { id:uid(), nombre:'Prueba', fecha:'2026-03-01' }; db.tomas.push(toma);
  db.evaluaciones.push({ id:uid(), jugadorId:a.id, tomaId:toma.id, fecha:'2026-03-01', cooper:2800 });
  db.evaluaciones.push({ id:uid(), jugadorId:c.id, tomaId:toma.id, fecha:'2026-03-01', cooper:2500 });
  db.lesiones.push({ id:uid(), jugadorId:c.id, fecha:'2026-03-02', tipo:'Esguince', parte:'Tobillo' });
  await Store.save(db);
  return { a:a.id, c:c.id };
});
await pg.waitForTimeout(1600);                    // subida a la nube
const pub = await pg.evaluate(()=>publicarParaJugadores());
t('Publicar la copia para jugadores funciona', pub && pub.ok, JSON.stringify(pub));
const nube = await pg.evaluate(()=>({
  acceso: Object.keys(__fs).filter(k=>k.startsWith('hsm_acceso/')).sort(),
  vistas: Object.keys(__fs).filter(k=>k.startsWith('hsm_vista/')).length,
  fichas: Object.keys(__fs).filter(k=>k.startsWith('hsm_ficha/')).length
}));
t('Hay una llave por cada DNI cargado', JSON.stringify(nube.acceso)===JSON.stringify(['hsm_acceso/30111222','hsm_acceso/30333444']), JSON.stringify(nube.acceso));
t('Hay una sola copia común y una fichita por jugador con DNI', nube.vistas===1 && nube.fichas===2, JSON.stringify(nube));
const otraVez = await pg.evaluate(()=>publicarParaJugadores());
t('Publicar de nuevo sin cambios casi no escribe nada (solo el registro)', otraVez.ok && otraVez.escrituras===1, JSON.stringify(otraVez));

// ---- jugador entra con su DNI ----
await pg.click('#salir'); await pg.waitForTimeout(400);
const lecturasAntes = await pg.evaluate(()=>window.__lecturasBase);
await pg.click('#ac-jugador'); await pg.waitForTimeout(300);
await pg.fill('#ac-dni', '30.111.222');           // con puntos también anda
await pg.click('#ac-dni-entrar'); await pg.waitForTimeout(800);
t('El jugador entra solo con el DNI', (await pg.evaluate(()=>db.config.acceso))==='jugador');
t('Queda identificado como ESE jugador', (await pg.evaluate(()=>db.config.jugadorId))===ids.a);
t('Su rol interno es "Jugador"', (await pg.evaluate(()=>db.config.rol))==='Jugador');
t('No leyó la base completa del club', (await pg.evaluate(()=>window.__lecturasBase))===lecturasAntes);
const vista = await pg.evaluate((ids)=>{
  const yo = db.jugadores.find(j=>j.id===ids.a), otro = db.jugadores.find(j=>j.id===ids.c);
  return {
    esVista: !!db._vista,
    dnis: db.jugadores.filter(j=>j.dni).length,
    otroNac: otro.fechaNac, yoNac: yo.fechaNac, yoCarnet: yo.carnet,
    evals: db.evaluaciones.map(e=>e.jugadorId), lesiones: db.lesiones.length,
    jugadores: db.jugadores.length
  };
}, ids);
t('Lo que bajó es la copia recortada', vista.esVista);
t('No trae el DNI de nadie (ni el propio)', vista.dnis===0, String(vista.dnis));
t('No trae la fecha de nacimiento de otro jugador', vista.otroNac===undefined, String(vista.otroNac));
t('Sí trae sus propios datos (fecha de nacimiento, carnet)', vista.yoNac==='2009-05-04' && vista.yoCarnet==='C-99');
t('De los test físicos, trae solo los suyos', vista.evals.length>0 && vista.evals.every(x=>x===ids.a), JSON.stringify(vista.evals));
t('No trae lesiones de otros', vista.lesiones===0);
t('Sigue viendo el plantel del club', vista.jugadores>2);

// ---- un jugador no puede guardar nada en la nube ----
const escrituraJugador = await pg.evaluate(async ()=>(await fbEscribir(db)).ok);
t('Desde la sesión de jugador no se puede pisar la base', escrituraJugador===false);

// ---- DNI inexistente ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-jugador'); await pg.waitForTimeout(300);
await pg.fill('#ac-dni', '99999999'); await pg.click('#ac-dni-entrar'); await pg.waitForTimeout(500);
t('Un DNI sin cargar no entra', (await pg.evaluate(()=>db.config.acceso))===null
  && (await pg.locator('.screen-note:has-text("No encontramos ese DNI")').count())===1);
await pg.click('#ac-volver'); await pg.waitForTimeout(300);

// ---- coordinación crea la cuenta propia de un DT ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','clave-coord'); await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
t('Al volver a entrar, coordinación vuelve a tener la base completa', await pg.evaluate(()=>!db._vista && db.jugadores.some(j=>j.dni==='30111222')));
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
const textoDatos = await pg.locator('.block:has-text("DT por categoría")').innerText();
t('Datos ya no muestra ninguna contraseña compartida', !textoDatos.includes('B@sehsm') && textoDatos.toLowerCase().includes('propia contraseña'));
await pg.fill('#dt-dni', '27555666');
await pg.selectOption('#dt-cat', 'Cadetes');
await pg.fill('#dt-clave', '123');
await pg.click('#agregarDT'); await pg.waitForTimeout(400);
t('No deja crear un DT con contraseña corta', !(await pg.evaluate(()=>db.dts.some(d=>d.dni==='27555666'))));
await pg.fill('#dt-clave', 'cadetes2026');
await pg.click('#agregarDT'); await pg.waitForTimeout(600);
const dt = await pg.evaluate(()=>db.dts.find(d=>d.dni==='27555666'));
t('El DT queda creado con usuario propio', !!dt && !!dt.uid && /^dt27555666\./.test(dt.email||''), JSON.stringify(dt));
t('Crear el DT no cerró la sesión de coordinación', (await pg.evaluate(()=>fb.auth.currentUser && fb.auth.currentUser.email))==='coordinacion@harassantamaria.com');
t('La nube registra su categoría', (await pg.evaluate((uid)=>(__fs['hsm_staff/'+uid]||{}).categoria, dt.uid))==='Cadetes');

// ---- el DT entra con su DNI y su contraseña; la categoría la da la nube ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ db.dts.forEach(d=>d.categoria='Promocional'); });  // aunque el dispositivo diga otra cosa
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.fill('#ac-dt-dni', '27555666'); await pg.fill('#ac-clave', 'otra-cosa');
await pg.click('#ac-entrar'); await pg.waitForTimeout(500);
t('Con otra contraseña, el DT no entra', (await pg.evaluate(()=>db.config.acceso))===null);
await pg.fill('#ac-clave', 'cadetes2026');
await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
t('Con su contraseña, el DT entra', (await pg.evaluate(()=>db.config.acceso))==='dt');
t('Su categoría es la que dice la nube (Cadetes)', (await pg.evaluate(()=>db.config.categoriaDT))==='Cadetes');
t('El DT baja la base completa (la necesita para trabajar)', await pg.evaluate(()=>!db._vista));

// ---- "Nueva contraseña" ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','clave-coord'); await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
const dtId = await pg.evaluate(()=>db.dts.find(d=>d.dni==='27555666').id);
window_prompt_valor = 'nueva-clave-1';
await pg.click(`[data-claveDT="${dtId}"]`); await pg.waitForTimeout(800);
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.fill('#ac-dt-dni', '27555666'); await pg.fill('#ac-clave', 'cadetes2026');
await pg.click('#ac-entrar'); await pg.waitForTimeout(600);
t('Después de "Nueva contraseña", la vieja ya no sirve', (await pg.evaluate(()=>db.config.acceso))===null);
await pg.fill('#ac-clave', 'nueva-clave-1');
await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
t('Y la nueva sí', (await pg.evaluate(()=>db.config.acceso))==='dt');

// ---- baja del DT ----
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','clave-coord'); await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ view.tab='datos'; render(); }); await pg.waitForTimeout(300);
await pg.click(`[data-borrarDT="${dtId}"]`); await pg.waitForTimeout(600);
const usuarioViejo = await pg.evaluate(()=>Object.keys(__usuarios).find(e=>e.startsWith('dt27555666.') && __usuarios[e].pass==='nueva-clave-1'));
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.fill('#ac-dt-dni', '27555666'); await pg.fill('#ac-clave', 'nueva-clave-1');
await pg.click('#ac-entrar'); await pg.waitForTimeout(600);
t('Un DT dado de baja ya no entra', (await pg.evaluate(()=>db.config.acceso))===null);
const conCuentaVieja = await pg.evaluate(async (email)=>{
  try{ await fb.auth.signInWithEmailAndPassword(email, 'nueva-clave-1'); await fbDoc('hsm','base').get(); return 'leyó'; }
  catch(e){ return e.code; } finally { await fb.auth.signOut(); }
}, usuarioViejo);
t('Aunque use la cuenta vieja directamente, ya no puede leer la base', conCuentaVieja==='permission-denied', conCuentaVieja);
await pg.click('#ac-volver'); await pg.waitForTimeout(300);

// ---- sacarle el DNI a un jugador cambia la llave común ----
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','clave-coord'); await pg.click('#ac-entrar'); await pg.waitForTimeout(800);
const llaveAntes = await pg.evaluate(()=>__fs['hsm_acceso/30111222'].vista);
await pg.evaluate(async (id)=>{ db.jugadores.find(j=>j.id===id).dni=''; await Store.save(db); }, ids.c);
await pg.waitForTimeout(1600);
await pg.evaluate(()=>publicarParaJugadores());
const despues = await pg.evaluate((llaveAntes)=>({
  sinLlave: !__fs['hsm_acceso/30333444'],
  nueva: __fs['hsm_acceso/30111222'].vista,
  viejaBorrada: !__fs['hsm_vista/'+llaveAntes],
  fichas: Object.keys(__fs).filter(k=>k.startsWith('hsm_ficha/')).length
}), llaveAntes);
t('El jugador sin DNI pierde su llave', despues.sinLlave);
t('La copia común cambia de llave y la vieja se borra', despues.nueva!==llaveAntes && despues.viejaBorrada, JSON.stringify(despues));
t('Su fichita también se borra', despues.fichas===1, String(despues.fichas));

// ---- el DNI que estaba escrito en el archivo nunca se publica ----
await pg.evaluate(async (id)=>{ db.jugadores.find(j=>j.id===id).dni='41781139'; await Store.save(db); }, ids.c);
await pg.waitForTimeout(1600);
await pg.evaluate(()=>publicarParaJugadores());
t('El DNI 41781139 (público en versiones viejas) no se publica como llave', await pg.evaluate(()=>!__fs['hsm_acceso/41781139']));

t('Sin errores de JS en toda la corrida', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
