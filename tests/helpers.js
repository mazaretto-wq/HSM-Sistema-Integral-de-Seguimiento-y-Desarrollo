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

module.exports = { BASE_URL, CLAVE, launchOptions };
