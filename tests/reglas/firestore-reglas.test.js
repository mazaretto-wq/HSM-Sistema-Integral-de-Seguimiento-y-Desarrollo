/* Prueba de las reglas REALES de ../../firestore.rules contra el emulador
   oficial de Firestore (no forma parte de "npm test": necesita Java y
   firebase-tools). Cómo correrla, desde una carpeta con
   firebase-tools, @firebase/rules-unit-testing y firebase instalados:
     npx firebase emulators:exec --only firestore --project demo-hsm \
       "node /ruta/a/tests/reglas/firestore-reglas.test.js"            */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');

const ok=[],bad=[];
const t=async (n, p)=>{ try{ await p; ok.push(n); console.log('PASS  '+n); }catch(e){ bad.push(n); console.log('FAIL  '+n+' → '+(e&&e.message)); } };

(async()=>{
  const env = await initializeTestEnvironment({
    projectId: 'demo-hsm',
    firestore: { rules: fs.readFileSync(path.join(__dirname,'..','..','firestore.rules'),'utf8') }
  });
  await env.withSecurityRulesDisabled(async c=>{
    const d = c.firestore();
    await setDoc(doc(d,'hsm/base'), { gz:'x' });
    await setDoc(doc(d,'hsm_staff/u-dt'), { categoria:'Cadetes', dni:'27555666' });
    await setDoc(doc(d,'hsm_dtlogin/27555666'), { email:'dt27555666.abc@harassantamaria.com' });
    await setDoc(doc(d,'hsm_acceso/30111222'), { vista:'llaveV', ficha:'llaveF', jugadorId:'j1' });
    await setDoc(doc(d,'hsm_vista/llaveV'), { gz:'v' });
    await setDoc(doc(d,'hsm_ficha/llaveF'), { gz:'f' });
  });
  const anon  = env.unauthenticatedContext().firestore();
  const coord = env.authenticatedContext('u-coord', { email:'coordinacion@harassantamaria.com' }).firestore();
  const dt    = env.authenticatedContext('u-dt', { email:'dt27555666.abc@harassantamaria.com' }).firestore();
  const viejo = env.authenticatedContext('u-viejo', { email:'dt@harassantamaria.com' }).firestore();
  const intruso = env.authenticatedContext('u-x', { email:'cualquiera@gmail.com' }).firestore();

  // base completa
  await t('Sin sesión NO se puede leer la base del club', assertFails(getDoc(doc(anon,'hsm/base'))));
  await t('Sin sesión NO se puede escribir la base', assertFails(setDoc(doc(anon,'hsm/base'),{gz:'y'})));
  await t('Coordinación lee la base', assertSucceeds(getDoc(doc(coord,'hsm/base'))));
  await t('Coordinación escribe la base', assertSucceeds(setDoc(doc(coord,'hsm/base'),{gz:'y'})));
  await t('Un DT habilitado lee la base', assertSucceeds(getDoc(doc(dt,'hsm/base'))));
  await t('Un DT habilitado escribe la base', assertSucceeds(setDoc(doc(dt,'hsm/base'),{gz:'z'})));
  await t('La cuenta compartida vieja de DT ya NO lee la base', assertFails(getDoc(doc(viejo,'hsm/base'))));
  await t('Alguien que se crea una cuenta cualquiera NO lee la base', assertFails(getDoc(doc(intruso,'hsm/base'))));

  // staff
  await t('Un DT NO puede habilitarse a otro (ni a sí mismo) como DT', assertFails(setDoc(doc(dt,'hsm_staff/u-x'),{categoria:'Selección'})));
  await t('Un DT NO puede cambiarse la categoría', assertFails(setDoc(doc(dt,'hsm_staff/u-dt'),{categoria:'Selección'})));
  await t('Una cuenta cualquiera NO puede habilitarse como DT', assertFails(setDoc(doc(intruso,'hsm_staff/u-x'),{categoria:'Selección'})));
  await t('Coordinación habilita DT', assertSucceeds(setDoc(doc(coord,'hsm_staff/u-nuevo'),{categoria:'Selección'})));
  await t('El DT lee su propio registro', assertSucceeds(getDoc(doc(dt,'hsm_staff/u-dt'))));
  await t('El DT NO lee el registro de otro', assertFails(getDoc(doc(dt,'hsm_staff/u-nuevo'))));
  await t('Nadie puede listar los DT sin ser coordinación', assertFails(getDocs(collection(dt,'hsm_staff'))));

  // login de DT
  await t('Sabiendo el DNI, se abre con qué correo entra el DT', assertSucceeds(getDoc(doc(anon,'hsm_dtlogin/27555666'))));
  await t('NO se puede listar los DNI de los DT', assertFails(getDocs(collection(anon,'hsm_dtlogin'))));
  await t('Un DT NO puede cambiar el correo de login', assertFails(setDoc(doc(dt,'hsm_dtlogin/27555666'),{email:'otro'})));

  // jugadores
  await t('Sabiendo el DNI, el jugador abre su llave', assertSucceeds(getDoc(doc(anon,'hsm_acceso/30111222'))));
  await t('NO se puede listar las llaves (los DNI) de los jugadores', assertFails(getDocs(collection(anon,'hsm_acceso'))));
  await t('Con la llave, abre la copia recortada', assertSucceeds(getDoc(doc(anon,'hsm_vista/llaveV'))));
  await t('NO se pueden listar las copias', assertFails(getDocs(collection(anon,'hsm_vista'))));
  await t('Con la llave, abre su fichita', assertSucceeds(getDoc(doc(anon,'hsm_ficha/llaveF'))));
  await t('NO se pueden listar las fichitas', assertFails(getDocs(collection(anon,'hsm_ficha'))));
  await t('Sin sesión NO se puede crear una llave', assertFails(setDoc(doc(anon,'hsm_acceso/1'),{vista:'a'})));
  await t('Sin sesión NO se puede modificar la copia', assertFails(setDoc(doc(anon,'hsm_vista/llaveV'),{gz:'malo'})));
  await t('Sin sesión NO se puede borrar una fichita', assertFails(deleteDoc(doc(anon,'hsm_ficha/llaveF'))));
  await t('El staff publica la copia', assertSucceeds(setDoc(doc(dt,'hsm_vista/llaveV'),{gz:'nuevo'})));

  // resto
  await t('Cualquier otra colección está cerrada', assertFails(getDoc(doc(coord,'otra/cosa'))));

  await env.cleanup();
  console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
  process.exit(bad.length?1:0);
})();
