/* Opciones compartidas por todas las pruebas: de dónde sacar la página y
   qué Chromium usar. Con las variables de entorno sin definir, usa lo
   mismo que ya funciona en el sandbox de Claude; en cualquier otra
   máquina alcanza con exportar HSM_TEST_URL y/o PW_CHROMIUM_PATH, o con
   dejar que Playwright use su propio Chromium (ver README). */
const fs = require('fs');

const BASE_URL = process.env.HSM_TEST_URL || 'http://127.0.0.1:8811/index.html';
const CLAVE = 'hsm-sin-conexion';

function launchOptions(){
  const opts = {};
  const candidato = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  try { fs.accessSync(candidato); opts.executablePath = candidato; } catch(e){ /* usa el Chromium propio de Playwright */ }
  return opts;
}

/* "Soy jugador" ahora pide un DNI que tenga cargado algún jugador (ver
   entrarConDni en index.html). Para los tests que solo necesitan entrar
   como jugador sin que importe cuál, esto le pone un DNI de prueba al
   primero que tenga categoría (o al que se le pase por jugadorId, si el
   test ya armó un jugador puntual) y hace el login completo. Devuelve
   {id, categoria} del jugador usado. */
async function entrarComoJugador(pg, jugadorId){
  const dni = '00000111';
  const datos = await pg.evaluate(({jugadorId, dni})=>{
    const j = jugadorId ? db.jugadores.find(x=>x.id===jugadorId)
                         : (db.jugadores.find(x=>(x.categorias||[]).length) || db.jugadores[0]);
    j.dni = dni;
    return { id:j.id, categoria:(j.categorias||[])[0]||'' };
  }, {jugadorId, dni});
  await pg.click('#ac-jugador'); await pg.waitForTimeout(300);
  await pg.fill('#ac-dni', dni);
  await pg.click('#ac-dni-entrar'); await pg.waitForTimeout(600);
  return datos;
}

/* "Soy DT" ahora pide usuario (DNI) + contraseña, y la categoría la decide
   el DNI (ver entrar() en index.html: categoriaDelDtPorDni, db.dts), ya no
   un desplegable. La contraseña es única para todos los DT. Si esa
   categoría todavía no tiene un DT cargado en db.dts, este helper le crea
   uno de prueba; si ya tiene (por ejemplo el que se siembra solo la
   primera vez, en Juveniles), reusa ese mismo DNI. Devuelve el DNI usado. */
const CLAVE_DT = 'B@sehsm';
async function entrarComoDT(pg, categoria){
  const dni = await pg.evaluate((categoria)=>{
    let d = db.dts.find(x=>x.categoria===categoria);
    if (!d){ d = { id:uid(), dni:String(10000000+Math.floor(Math.random()*89999999)), categoria }; db.dts.push(d); }
    return d.dni;
  }, categoria);
  await pg.click('#ac-dt'); await pg.waitForTimeout(300);
  await pg.fill('#ac-dt-dni', dni);
  await pg.fill('#ac-clave', CLAVE_DT);
  await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
  return dni;
}

module.exports = { BASE_URL, CLAVE, CLAVE_DT, launchOptions, entrarComoJugador, entrarComoDT };
