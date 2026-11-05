const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const path = require('path');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

(async()=>{
const b=await chromium.launch(launchOptions());
const pg=await b.newPage({viewport:{width:420,height:1100}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('dialog',d=>d.accept());
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(2200);

await pg.click('#ac-coord'); await pg.waitForTimeout(300);
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
// la app ya siembra sola la base completa del club al no haber jugadores,
// así que no hace falta pasar por "Datos" (que además ya no tiene solapa visible)

// ================= CATEGORÍAS =================
// --- coordinación: entrar a una categoría navega a Plantel filtrado ---
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
t('Coordinación ve la lista de categorías', (await pg.locator('[data-entrarCat]').count())>0);
await pg.click('[data-entrarCat="Juveniles"]'); await pg.waitForTimeout(300);
t('Entrar a una categoría como coordinación navega a Plantel filtrado',
  (await pg.locator('h2.screen-title').innerText())==='PLANTEL' &&
  (await pg.locator('.chip[aria-pressed="true"]').first().innerText()).toUpperCase()==='JUVENILES');

// --- DT: su categoría marcada, las demás "solo mirar" y de solo lectura ---
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-dt'); await pg.waitForTimeout(300);
await pg.selectOption('#ac-cat','Juveniles');
await pg.fill('#ac-clave','hsm-sin-conexion'); await pg.click('#ac-entrar'); await pg.waitForTimeout(900);
await pg.click('.tabs button:has-text("Categorías")'); await pg.waitForTimeout(300);
const filaPropia = pg.locator('[data-entrarCat="Juveniles"]');
t('El DT ve marcada su propia categoría', (await filaPropia.innerText()).toUpperCase().includes('TU CATEGORÍA'));
const filaAjena = pg.locator('[data-entrarCat="Cadetes"]');
t('Las demás categorías dicen "Solo mirar"', (await filaAjena.innerText()).includes('Solo mirar'));
await filaAjena.click(); await pg.waitForTimeout(300);
t('Entrar a una categoría ajena muestra una vista de solo lectura', (await pg.locator('.screen-note:has-text("Solo podés mirar")').count())===1);
t('No hay ningún botón para cargar/editar en esa vista ajena', (await pg.locator('[data-go],[data-editar],[data-foto-jugador]').count())===0);
t('Las filas de jugadores no son clickeables (sin ficha completa)', (await pg.locator('[data-jugador]').count())===0);
await pg.click('[data-back]'); await pg.waitForTimeout(300);
t('"Volver" regresa a la lista de categorías', (await pg.locator('h2.screen-title').innerText())==='CATEGORÍAS');
await filaPropia.click(); await pg.waitForTimeout(300);
t('Entrar a la propia categoría lleva a Inicio (Plantel), no a la vista de solo lectura',
  (await pg.locator('h2.screen-title').innerText())==='PLANTEL');

// ================= RUTINAS =================
// --- DT: cargar una rutina para su categoría ---
await pg.click('.tabs button:has-text("Rutinas")'); await pg.waitForTimeout(300);
t('DT no ve selector de categoría (va directo a la suya)', (await pg.locator('[data-rutinaCat]').count())===0);
t('Sin rutina todavía: estado vacío', (await pg.locator('.empty:has-text("Todavía no hay una rutina")').count())===1);

const pdfPath = path.join(__dirname, 'assets', 'rutina_test.pdf');
const [fileChooser] = await Promise.all([
  pg.waitForEvent('filechooser'),
  pg.click('[data-cargarRutina]'),
]);
await fileChooser.setFiles(pdfPath);
await pg.waitForTimeout(500);
t('La rutina (PDF) quedó cargada para Juveniles', (await pg.locator('.block-title:has-text("rutina_test.pdf")').count())===1);
t('Aparece el link para ver/descargar el PDF', (await pg.locator('a:has-text("Ver / descargar PDF")').count())===1);
t('El toast avisa que quedó en este dispositivo (sin Storage en este entorno)', (await pg.locator('.toast').innerText()).toLowerCase().includes('este dispositivo'));

const rutinaGuardada = await pg.evaluate(()=> !!db.rutinas['Juveniles'] && !db.rutinas['Juveniles'].url);
t('La rutina NO quedó con una URL en "db" (mismo resguardo que las fotos: no arriesga la sync)', rutinaGuardada);

// --- jugador: ve la rutina de la categoría que elige, no otra ---
await pg.click('#salir'); await pg.waitForTimeout(400);
await pg.click('#ac-jugador'); await pg.waitForTimeout(700);
await pg.click('.tabs button:has-text("Rutinas")'); await pg.waitForTimeout(300);
t('Jugador ve el selector de categorías', (await pg.locator('[data-rutinaCat]').count())>0);
t('Sin elegir categoría todavía, pide elegir una', (await pg.locator('.empty').count())===1);
await pg.click('[data-rutinaCat="Cadetes"]'); await pg.waitForTimeout(300);
t('Cadetes (sin rutina cargada) muestra el estado vacío correcto', (await pg.locator('.empty:has-text("Todavía no hay una rutina")').count())===1);
await pg.click('[data-rutinaCat="Juveniles"]'); await pg.waitForTimeout(300);
t('Juveniles sí muestra la rutina que cargó el DT (no la de otra categoría)', (await pg.locator('.block-title:has-text("rutina_test.pdf")').count())===1);
t('Jugador no tiene botón para cargar/eliminar rutina', (await pg.locator('[data-cargarRutina],[data-eliminarRutina]').count())===0);

t('Sin errores de consola hasta acá', errs.length===0, errs.join(' | '));

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
await b.close();
process.exit(bad.length?1:0);
})();
