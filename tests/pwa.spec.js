const { chromium } = require('playwright');
const { BASE_URL, launchOptions } = require('./helpers');
const ok=[],bad=[];
const t=(n,c,d='')=>{(c?ok:bad).push(n);console.log((c?'PASS  ':'FAIL  ')+n+(d?' → '+d:''));};

/* la app sirve estos archivos desde la raíz del sitio, no desde /index.html */
const RAIZ = BASE_URL.replace(/\/index\.html$/, '/');

(async()=>{
const b=await chromium.launch(launchOptions());

// ---- manifest.json, sw.js y los íconos se sirven bien ----
const ctxChequeo = await b.newContext();
const pgChequeo = await ctxChequeo.newPage();
const manifestResp = await pgChequeo.goto(RAIZ+'manifest.json');
const manifest = await manifestResp.json();
t('manifest.json se sirve con 200', manifestResp.status()===200);
t('manifest.json tiene el nombre y short_name pedidos',
  manifest.name==='Base de datos Haras Santa María' && manifest.short_name==='HSM', JSON.stringify(manifest.name)+' / '+JSON.stringify(manifest.short_name));
t('manifest.json: start_url "/", display standalone, orientation portrait',
  manifest.start_url==='/' && manifest.display==='standalone' && manifest.orientation==='portrait');
t('manifest.json: colores pedidos', manifest.background_color==='#111111' && manifest.theme_color==='#F26A1B');
t('manifest.json: los 2 íconos, ambos "any maskable"', manifest.icons.length===2
  && manifest.icons.every(i=>i.purpose==='any maskable')
  && manifest.icons.some(i=>i.sizes==='192x192') && manifest.icons.some(i=>i.sizes==='512x512'));

const swResp = await pgChequeo.goto(RAIZ+'sw.js');
t('sw.js se sirve con 200', swResp.status()===200);
const icon192 = await pgChequeo.goto(RAIZ+'icons/icon-192.png');
const icon512 = await pgChequeo.goto(RAIZ+'icons/icon-512.png');
const iconApple = await pgChequeo.goto(RAIZ+'icons/apple-touch-icon.png');
t('Los 3 íconos (192, 512, apple-touch) están publicados', icon192.status()===200 && icon512.status()===200 && iconApple.status()===200);
await ctxChequeo.close();

// ---- head: metaetiquetas de PWA ----
const pg = await b.newPage({viewport:{width:390,height:844}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(BASE_URL);
await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pg.reload(); await pg.waitForTimeout(1500);

t('<link rel="manifest"> apunta a /manifest.json', await pg.locator('link[rel="manifest"][href="/manifest.json"]').count()===1);
t('<meta name="theme-color"> con el naranja pedido', await pg.locator('meta[name="theme-color"][content="#F26A1B"]').count()===1);
t('<link rel="apple-touch-icon">', await pg.locator('link[rel="apple-touch-icon"][href="/icons/apple-touch-icon.png"]').count()===1);
t('<meta name="apple-mobile-web-app-capable" content="yes">', await pg.locator('meta[name="apple-mobile-web-app-capable"][content="yes"]').count()===1);
t('<meta name="apple-mobile-web-app-title" content="HSM">', await pg.locator('meta[name="apple-mobile-web-app-title"][content="HSM"]').count()===1);
const viewport = await pg.locator('meta[name="viewport"]').getAttribute('content');
t('El viewport sigue siendo una <meta> real con viewport-fit=cover', /width=device-width/.test(viewport) && /viewport-fit=cover/.test(viewport), viewport);

// ---- el service worker se registra solo ----
await pg.waitForTimeout(800);
const swRegistrado = await pg.evaluate(async ()=>{
  if (!('serviceWorker' in navigator)) return 'sin-soporte';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.active?.scriptURL || 'registrado-sin-activar-aun' : 'no-registrado';
});
t('El service worker queda registrado solo, sin tocar nada manualmente', /sw\.js$/.test(swRegistrado) || swRegistrado==='registrado-sin-activar-aun', swRegistrado);

// ---- Firestore: fbInit() pide la persistencia offline (acá Firebase real
// está bloqueado, así que se chequea en el código fuente de la función,
// no en tiempo de ejecución) ----
const pideP = await pg.evaluate(()=> typeof fbInit==='function' && fbInit.toString().includes('enablePersistence'));
t('fbInit() pide la persistencia offline de Firestore al conectar', pideP);

// ---- banner "instalar app": en iPhone, aviso de Compartir ----
t('Sin ser iPhone y sin que el navegador ofrezca instalar, el banner no se muestra solo', !(await pg.locator('#pwaBanner.show').count()));
await b.close();

const bIOS = await chromium.launch(launchOptions());
const pgIOS = await bIOS.newPage({viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
await pgIOS.goto(BASE_URL);
await pgIOS.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pgIOS.reload(); await pgIOS.waitForTimeout(1200);
t('En iPhone, el banner avisa "Compartir → Agregar a inicio"', (await pgIOS.locator('#pwaBannerTexto').innerText()).includes('Compartir'));
t('En iPhone NO aparece el botón "Instalar app" (no hay beforeinstallprompt)', await pgIOS.locator('#pwaBannerBtn:visible').count()===0);
const overflowIOS = await pgIOS.evaluate(()=>({body:document.body.scrollWidth, win:window.innerWidth}));
t('El banner no provoca scroll horizontal en el celular', overflowIOS.body===overflowIOS.win, JSON.stringify(overflowIOS));

await pgIOS.click('#pwaBannerCerrar'); await pgIOS.waitForTimeout(200);
t('Cerrar el banner lo oculta', !(await pgIOS.locator('#pwaBanner.show').count()));
await pgIOS.reload(); await pgIOS.waitForTimeout(1200);
t('Una vez cerrado, no vuelve a aparecer solo (se recuerda en localStorage)', !(await pgIOS.locator('#pwaBanner.show').count()));
await bIOS.close();

// ---- Android/Chrome: simulamos el evento beforeinstallprompt del navegador ----
const bAnd = await chromium.launch(launchOptions());
const pgAnd = await bAnd.newPage({viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
const errsAnd=[]; pgAnd.on('pageerror',e=>errsAnd.push(String(e)));
await pgAnd.goto(BASE_URL);
await pgAnd.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await pgAnd.reload(); await pgAnd.waitForTimeout(1200);
t('Antes de que el navegador ofrezca instalar, no hay botón visible', await pgAnd.locator('#pwaBannerBtn:visible').count()===0);

const resultado = await pgAnd.evaluate(()=>{
  return new Promise(resolve=>{
    let prompted = false;
    const evento = new Event('beforeinstallprompt', {cancelable:true});
    evento.prompt = () => { prompted = true; return Promise.resolve(); };
    evento.userChoice = Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(evento);
    setTimeout(()=>resolve({
      textoBanner: document.getElementById('pwaBannerTexto').textContent,
      botonVisible: document.getElementById('pwaBannerBtn').style.display !== 'none',
    }), 200);
  });
});
t('Al ofrecer el navegador instalarla, aparece el botón "Instalar app"', resultado.botonVisible, JSON.stringify(resultado));
t('El texto del banner en ese caso invita a instalar (no el de iPhone)', /instal/i.test(resultado.textoBanner) && !resultado.textoBanner.includes('Compartir'), resultado.textoBanner);

await pgAnd.click('#pwaBannerBtn'); await pgAnd.waitForTimeout(300);
t('Tocar "Instalar app" dispara el prompt del navegador y cierra el banner', !(await pgAnd.locator('#pwaBanner.show').count()));

t('Sin errores de JS en toda la corrida (Android)', errsAnd.length===0, errsAnd.join(' | '));
await bAnd.close();

console.log(`\n== ${ok.length} PASS / ${bad.length} FAIL ==`);
process.exit(bad.length?1:0);
})();
