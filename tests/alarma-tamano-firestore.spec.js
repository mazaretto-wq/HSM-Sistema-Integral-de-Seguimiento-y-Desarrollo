const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1200}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);
await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);

// ---- tamanoBytesDb calcula bien bytes (no caracteres) con acentos/emoji ----
const bytes = await pg.evaluate(()=> tamanoBytesDb({x:'ñoño 🙂'}));
t('tamanoBytesDb cuenta bytes UTF-8, no caracteres JS', bytes > 'ñoño 🙂'.length, String(bytes));

// ---- simulamos: logueado a Firebase, escritura "exitosa", base grande -> debe avisar ----
const resultado1 = await pg.evaluate(async ()=>{
  const relleno = 'x'.repeat(900000); // > 80% de 1MiB una vez serializado
  fbEscribir = async () => ({ok:true});
  fbUser = { email:'coord@test.com' };
  avisoTamanoDado = false;
  let avisado = null;
  const toastOrig = window.toast;
  window.toast = (m)=>{ avisado = m; };
  programarSubida({ relleno });
  await new Promise(r=>setTimeout(r, 1500));
  window.toast = toastOrig;
  return avisado;
});
t('Avisa cuando la base supera el 80% del límite', !!resultado1 && resultado1.includes('KB'), String(resultado1));
t('El aviso menciona la nube/sincronización', !!resultado1 && /nube|sincroniz/i.test(resultado1));

// ---- no debe repetirse en el siguiente guardado de la misma sesión ----
const resultado2 = await pg.evaluate(async ()=>{
  let avisado = null;
  const toastOrig = window.toast;
  window.toast = (m)=>{ avisado = m; };
  programarSubida({ relleno: 'x'.repeat(900000) });
  await new Promise(r=>setTimeout(r, 1500));
  window.toast = toastOrig;
  return avisado;
});
t('No repite el aviso en el siguiente guardado (una vez por sesión)', resultado2===null, String(resultado2));

// ---- una base chica no dispara el aviso ----
const resultado3 = await pg.evaluate(async ()=>{
  avisoTamanoDado = false;
  let avisado = null;
  const toastOrig = window.toast;
  window.toast = (m)=>{ avisado = m; };
  programarSubida({ chico:'poco contenido' });
  await new Promise(r=>setTimeout(r, 1500));
  window.toast = toastOrig;
  return avisado;
});
t('Una base chica no dispara ningún aviso', resultado3===null, String(resultado3));

// ---- la base ahora se sube comprimida: si fbEscribir informa los bytes
// REALES ya comprimidos, el aviso se arma sobre esos, no sobre el JSON
// crudo (que ahora pesa bastante más que lo que de verdad ocupa en
// Firestore) ----
const resultado4 = await pg.evaluate(async ()=>{
  const relleno = 'x'.repeat(900000);   // crudo > 80% del límite
  fbEscribir = async () => ({ok:true, bytes: 500});  // comprimido, bien chico
  fbUser = { email:'coord@test.com' };
  avisoTamanoDado = false;
  let avisado = null;
  const toastOrig = window.toast;
  window.toast = (m)=>{ avisado = m; };
  programarSubida({ relleno });
  await new Promise(r=>setTimeout(r, 1500));
  window.toast = toastOrig;
  return avisado;
});
t('Con el tamaño comprimido disponible, NO avisa aunque el JSON crudo sea grande (los bytes reales son chicos)', resultado4===null, String(resultado4));

t('Sin errores de JS', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
