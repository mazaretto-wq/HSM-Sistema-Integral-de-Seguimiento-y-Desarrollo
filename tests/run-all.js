#!/usr/bin/env node
/* Corre todos los *.spec.js de esta carpeta contra una copia local del
   sitio (levanta un servidor estático propio) y da un resumen al final.
   Uso: node run-all.js   (o "npm test" desde esta carpeta) */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = process.env.HSM_TEST_PORT || 8811;
const ROOT = path.join(__dirname, '..');

function esperarServidor(url, intentos = 30){
  return new Promise((resolve, reject) => {
    const intentar = (n) => {
      http.get(url, res => { res.resume(); resolve(); })
        .on('error', () => {
          if (n <= 0) return reject(new Error('el servidor no respondió a tiempo'));
          setTimeout(() => intentar(n - 1), 300);
        });
    };
    intentar(intentos);
  });
}

(async () => {
  const specs = fs.readdirSync(__dirname).filter(f => f.endsWith('.spec.js')).sort();
  if (!specs.length){ console.log('No hay pruebas (*.spec.js) para correr.'); process.exit(0); }

  console.log(`Sirviendo ${ROOT} en http://127.0.0.1:${PORT} ...`);
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });

  try {
    await esperarServidor(`http://127.0.0.1:${PORT}/index.html`);
  } catch (e) {
    server.kill();
    console.error('No se pudo levantar el servidor de pruebas:', e.message);
    process.exit(1);
  }

  const env = { ...process.env, HSM_TEST_URL: `http://127.0.0.1:${PORT}/index.html` };
  let fallaron = 0;
  for (const spec of specs) {
    console.log(`\n────── ${spec} ──────`);
    const r = spawnSync('node', [path.join(__dirname, spec)], { stdio: 'inherit', env });
    if (r.status !== 0) fallaron++;
  }

  server.kill();
  console.log('\n========================================');
  console.log(fallaron
    ? `${fallaron} de ${specs.length} archivos de prueba tuvieron fallas.`
    : `Los ${specs.length} archivos de prueba pasaron.`);
  process.exit(fallaron ? 1 : 0);
})();
