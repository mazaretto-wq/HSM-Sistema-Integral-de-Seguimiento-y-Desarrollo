# Pruebas de HSM

Pruebas end-to-end (Playwright) de `index.html`. Viven en esta carpeta aparte
para no mezclarse con el sitio: Vercel sigue desplegando solo `index.html` y
las imágenes de portada, nada de acá.

Cada archivo `*.spec.js` es un script independiente que abre el sitio en un
navegador real, hace clics como lo haría una persona, y al final imprime
cuántas verificaciones pasaron y cuáles no (termina con código de salida 0
si todo pasó, 1 si algo falló). No usan ningún framework de testing — es
JavaScript simple a propósito, para poder leerlos y modificarlos sin tener
que aprender una herramienta nueva.

## Cómo correrlas

```bash
cd tests
npm install              # una sola vez, instala Playwright
npm run install-browser  # una sola vez, instala el Chromium que usa Playwright
npm test                 # corre todas las pruebas, una por una
```

`npm test` levanta su propio servidor local (sirviendo el `index.html` de la
carpeta de arriba) en el puerto 8811, corre cada `*.spec.js` contra ese
servidor, y lo apaga al terminar. No hace falta tener nada corriendo de
antes.

Para correr un solo archivo puntual (más rápido mientras se prueba algo):

```bash
cd tests
python3 -m http.server 8811 &       # en otra terminal, o con & como acá
node roles-y-permisos.spec.js
```

### Variables de entorno (opcionales)

- `HSM_TEST_URL`: URL del sitio a probar, si no es `http://127.0.0.1:8811/index.html`.
- `PW_CHROMIUM_PATH`: ruta a un Chromium ya instalado, para no depender del
  que instala Playwright. Si no existe ese archivo, se usa el de Playwright.

## Qué cubre cada archivo

| Archivo | Qué prueba |
|---|---|
| `roles-y-permisos.spec.js` | Permisos básicos de los 3 roles (coordinación/DT/jugador), edición de ficha, subida de foto con resguardo local, agrupación de ejercicios, herramientas de la pizarra |
| `categorias-y-rutinas.spec.js` | Pantalla de Categorías (entrar a la propia / mirar una ajena) y Rutinas (cargar, ver por categoría, resguardo local); un jugador identificado por DNI cae directo en la rutina de su categoría, sin selector y sin ver las de otras, pero sigue viendo todas las categorías en el resto de la app (Plantel, etc.) |
| `test-fisicos-flujo.spec.js` | Flujo completo de Test Físicos: registrar una toma, que quede en `evaluaciones`/`tomas` (sin duplicar), verlo en la ficha |
| `test-fisicos-toma-detalle.spec.js` | Entrar a una toma puntual de un test físico y ver el resultado de cada jugador |
| `inicio-nav-y-landing.spec.js` | Navegación por rol (qué solapas ve cada uno) y que todos aterricen en Inicio |
| `inicio-destacados.spec.js` | Tira de tarjetas "Destacados" del panel de Inicio |
| `ficha-tablero-general.spec.js` | Tablero de la solapa General de la ficha (estadísticas, historial, gráfico, tests físicos, posición en el plantel, detalle de rendimiento). Para un jugador en más de una categoría, la temporada en curso separa lo de Juveniles (la única data verificada) del resto, que queda sin nombre de categoría en vez de mostrar todas pegadas con " · "; lo mismo para una fila vieja de historial sin categoría, y para cualquier categoría que no sea Juveniles aunque esté etiquetada (nunca se nombra "Cadetes" ni ninguna otra). Las tarjetas se muestran con los mismos cuadraditos de color (`.card-mark`) que el resto de la app, no como texto "3A/1R". Estadísticas generales suma G+A (goles+asistencias) y "Min. por gol"/"Min. por G+A" (minutos ÷ esa cantidad, redondeado; sin goles/G+A todavía muestra "—" en vez de dividir por 0). La tabla de "Historial de temporadas" tiene una fila de totales al pie (PJ, Goles, Asistencias, Tarjetas de todas las temporadas listadas; no suma minutos) |
| `historial-duplicado.spec.js` | Corrección `limpiarHistorialDuplicado` (corre siempre, para cualquier jugador): filas de historial EXACTAMENTE repetidas (mismo año, categoría y todos los números iguales) quedan con una sola copia; no toca filas que no estén repetidas; segura de correr de nuevo |
| `ficha-foto-grande.spec.js` | Que la foto grande de la solapa General siga permitiendo subir/cambiar foto, y que Detalle/Historial conserven el encabezado chico |
| `migracion-categorias.spec.js` | Migración de categorías duplicadas ("Selección Libre" → "Selección") en dispositivos con datos viejos |
| `alarma-tamano-firestore.spec.js` | Aviso cuando la base se acerca al límite de tamaño de Firestore; si `fbEscribir` informa el tamaño real ya comprimido, el aviso se arma sobre ese número, no sobre el JSON sin comprimir (que ahora pesa bastante más que lo que de verdad ocupa en la nube) |
| `sincronizacion-en-vivo.spec.js` | Que un cambio de otro dispositivo se aplique solo cuando no se está editando nada, quede pendiente (con aviso) si se está editando, y nunca pise el rol/sesión de este dispositivo; un cambio que llega comprimido ("gz", el formato nuevo) también se descomprime y se aplica igual que el formato viejo ("json") |
| `informe-juveniles-2026.spec.js` | Corrección puntual `cargarInformeJuvenilesPdf2026` (de una sola vez, misma idea que `corregirHistorialPereyra`): vuelca el informe propio de la temporada 2026 de Juveniles que pasó coordinación (con minutos y asistencias, que la AIF nunca da) en la base de planilla de cada jugador — pero solo la DIFERENCIA frente a lo que ya está cargado partido a partido (algunos ya tienen "amistosos 2026" del seed del club), para no duplicar. De paso suma Juveniles a sus categorías si no la tenía. Segura de correr de nuevo. Usa jugadores reales del seed del club (`SEED_HSM`/`SEED_JUVENILES`), no jugadores de prueba inventados, porque la corrección matchea por nombre exacto contra una lista fija |
| `archivar-temporada.spec.js` | Pantalla de Datos: archivar una temporada vieja descarga el CSV, resume partidos/entrenamientos en el historial del jugador, conserva solo la última toma de test físico del año, y no cambia el % de asistencia histórico |
| `estimar-ahorro-archivar.spec.js` | La pantalla de Datos muestra cuántos KB liberaría archivar la temporada elegida (se recalcula solo al cambiar de temporada en el desplegable), y ese número coincide con lo que de verdad baja el tamaño de la base al archivar |
| `vs-comparar.spec.js` | Solapa Vs (visible para los 3 roles): comparar a dos jugadores en una temporada cada uno, incluida una ya archivada, con los mismos números de partidos, asistencia a entrenos y test físicos que se ven en cada ficha |
| `iconos-contorno.spec.js` | Todos los íconos de la app son de contorno (sin relleno), naranjas sobre fondo claro y blancos adentro del panel oscuro de Inicio; no quedó ningún emoji de texto suelto |
| `pwa.spec.js` | manifest.json y sw.js se sirven bien, las metaetiquetas de instalación están en el `<head>`, el service worker se registra solo, y el banner "Instalar app" se comporta distinto en Android (botón) que en iPhone (aviso de Compartir) |
| `alertas-radar.spec.js` | Bloque "Para repasar" en Inicio (sin evaluarse hace 4+ meses, 3+ amarillas o 1+ roja; visible para los 3 roles; tope de 8 filas con el total real en el título); gráfico de telaraña del perfil técnico-táctico en la ficha, con el valor de cada ítem y sin que se corte ninguna etiqueta; flechas ↑/↓ en la comparación con la toma anterior |
| `cargar-evaluacion.spec.js` | "Cargar datos de un jugador": primero pregunta Test Físico o Habilidades (técnico-táctico + comportamiento juntos); Test Físico a su vez pregunta uno por uno (Cooper, Yo-Yo, Velocidad); la fecha sale con la de hoy por default y cae sola en la toma de ese mes (crea una si hace falta, sin duplicar si ya existe) |
| `ponderacion-tecnica.spec.js` | El promedio técnico-táctico y "lo que más tiene que mejorar" ponderan cada ítem según el puesto del jugador (ej.: el remate no le pesa a un defensor); el valor crudo se sigue viendo igual en Detalle y en la telaraña, sin esconder nada |
| `lesiones.spec.js` | Solapa "Lesiones" de la ficha: coordinación/DT cargan tipo, parte del cuerpo, fecha y tiempo previsto de vuelta; al registrar la vuelta real se compara contra lo previsto (en rojo si se pasó, en verde si volvió antes); el rol Jugador solo mira, sin botones de carga/edición; eliminar un jugador borra también sus lesiones |
| `partido-totales.spec.js` | La tabla de "Cargar partido" tiene una fila de totales al pie (cuántos jugaron, goles, asistencias, amarillas, rojas) que se recalcula al toque con cada tecla, tocando el DOM directo (no `render()`, para no perder el foco del campo que se está escribiendo); "jugaron" cuenta solo a los que tienen minutos cargados, aunque otro sin minutos tenga alguna tarjeta puesta (p.ej. entró y se fue sin sumar, o una amonestación desde el banco); se reinicia en 0 cada vez que se abre el formulario de nuevo |
| `partido-esquema.spec.js` | El formulario de "Partido" pide el esquema usado (además del puesto de cada jugador, que ya existía) y sugiere solo el último usado en esa categoría; en Plantel, al entrar a una categoría puntual, se ve "Esquema más usado" con el ranking y el % de esta temporada (no se muestra en "Todas") |
| `acceso-dni-jugador.spec.js` | "Soy jugador" pide el DNI (sin contraseña) en vez de entrar directo; no deja entrar con un DNI que no está cargado en ningún jugador; coordinación carga el DNI desde la ficha del jugador, y no deja cargar el mismo DNI en dos jugadores distintos; con el DNI correcto entra y queda atado a la categoría de ese jugador |
| `acceso-dni-dt.spec.js` | "Soy DT" pide usuario (DNI) + contraseña (la misma para todos) en vez de elegir la categoría de un desplegable; la categoría la decide el DNI, cargado desde Datos > "DT por categoría"; un DNI no cargado o la contraseña mal no dejan entrar; coordinación puede agregar y eliminar DT desde esa pantalla, y eliminar uno le saca el acceso en el momento |
| `partidos-links.spec.js` | Solapa "Partidos": el primer filtro es la categoría; solo coordinación carga (título + link, que se completa con `https://` si hace falta) o elimina; DT y jugador (identificados) caen directo en la suya, sin selector y sin botón de carga; el más nuevo se ve primero; cada categoría tiene sus propios partidos, sin mezclarse con las demás |
| `fixture.spec.js` | Solapa "Fixture": el primer filtro es la categoría; a diferencia de Partidos, acá coordinación Y el DT pueden agendar (rival, fecha, hora) o eliminar, el jugador solo mira; vista Tabla y Calendario (con navegación de mes) sobre los mismos datos; el partido agendado se ve "Programado" hasta que el DT carga las estadísticas en Cargar > Partido con el campo "Goles del rival" — ahí el Fixture completa el resultado solo, sumando en vivo los goles cargados de cada jugador (los goles propios nunca se guardan en el fixture) y permite corregir el gol del rival después |
| `aif-sincronizar.spec.js` | Botón "Sincronizar con AIF" en Fixture (coordinación y DT, no el jugador): trae de `/api/aif` los partidos oficiales de Haras Santa María en esa categoría, agrega los que falten y actualiza hora/gol del rival de los que ya estaban (sin duplicar al sincronizar dos veces); un partido que la AIF ya dio por jugado pero que todavía no se cargó en la app (sin datos de jugadores) se ve como "? - <gol del rival>", no "Programado"; si la AIF corrige un resultado después, la sincronización lo pisa, sin tocar los datos de los jugadores ya cargados; si `/api/aif` falla, avisa con un toast y no cambia nada. Bloquea el service worker de la página (`serviceWorkers:'block'`) porque si no, intercepta el `fetch()` antes que la ruta simulada de Playwright |
| `aif-historial.spec.js` | Bloque "Importar historial AIF" en Datos (coordinación): trae de `/api/aif-historial` el plantel ACTUAL de Haras Santa María para Promocional, Cadetes, Juveniles, Juveniles B o Selección y, de cada jugador de ese plantel, su historial temporada a temporada (partidos jugados, minutos reales, goles, amarillas, rojas — lo único que la AIF nunca tiene son las asistencias, esas sí quedan en 0); a cada jugador lo cruza solo con el plantel de esa categoría cuando el nombre coincide exacto, y lo deja "sin elegir" cuando no (nunca inventa un cruce dudoso); la próxima vez que se importa, ese mismo jugador se vincula solo por el id de la AIF (sin tener que elegirlo de nuevo) y se marca con ✓; **la temporada en curso nunca se guarda en el historial** (duplicaría con Cargar > Partido + la base de planilla, ver `totalesTemporada` — bug real que se encontró y corrigió en este mismo desarrollo): en cambio, actualiza la base de planilla de esa categoría con el total fresco de la AIF (sin minutos, la base nunca los tuvo). La limpieza de filas viejas con el año en curso puesto a mano corre siempre al cargar la base (no solo "una vez"), incluso otra vez justo después de iniciar sesión — hacía falta porque esa limpieza nunca llegaba a subirse a la nube si corría antes de loguearse, y el login siguiente volvía a bajar la copia vieja y la pisaba; nunca toca una fila legítima tipo "2026 Apertura"; cambiar de categoría a mitad de revisión cancela la revisión; si la AIF no tiene jugadores para esa categoría, o si falla, avisa y no rompe nada. **Jugadores que también juegan Juveniles** (categoría excluida y aprobada a mano): el total de la AIF es por persona, no por categoría, así que antes de guardar se le resta lo que ya está cargado en Juveniles ese mismo año (`datosYaEnJuveniles`/`restarJuveniles`), tanto en el historial de años pasados como en la base de planilla del año en curso; la tabla de revisión muestra la cuenta completa y se recalcula en vivo si cambiás el jugador vinculado. **Filas de historial viejas sin categoría puesta** (de antes de que existiera esa columna) nunca se adivinan ni se les pone "Juveniles" solas: son de ALGUNA categoría, pero no se sabe de cuál, así que quedan como están para siempre (revisión manual, como con Pereyra). En la ficha del jugador, la categoría nunca se nombra salvo que sea Juveniles (es la única data verificada): ni una fila vieja sin categoría ni una ya importada y etiquetada como otra categoría muestran su nombre, para no transmitir más confianza de la que corresponde. Además, de paso **completa la foto de perfil** de los jugadores vinculados que todavía no tienen ninguna cargada (nunca pisa una que ya se subió a mano): la AIF expone la foto de carnet de cada jugador en un endpoint aparte (`jsjugador.php`), se recorta centrada al cuadrado más grande que entra (sin arrastre manual, a diferencia de "Agregar foto") y se sube por el mismo camino que una foto cargada a mano (Storage, o este dispositivo si no hay nube). El rango de años ("Desde"/"Hasta") ahora permite llegar hasta 2002, el límite real de los datos de la AIF, no solo 2014. **Juveniles es una categoría más de la lista, pero en un modo distinto**: como su historial ya está cargado a mano y aprobado, acá <strong>nunca se escribe nada como Juveniles</strong>, ni siquiera cuando un año no tiene nada cargado — siempre se le resta al total de la AIF lo que ya está cargado como Juveniles ese año (`datosYaEnJuveniles`) MÁS lo que haya en filas ambiguas sin categoría de ese mismo año (`datosYaRegistradosAmbiguos`: son de alguna categoría, no se sabe cuál, pero ya están contadas, así que no hay que agregarles otra fila al lado con el mismo total y duplicar el año), y la diferencia SIEMPRE queda como una fila sin nombre de categoría, para revisar a mano; el año en curso nunca se toca con esta herramienta. (Bug real encontrado y corregido en este mismo desarrollo: la primera versión sí escribía "Juveniles" para los años sin nada cargado, lo que inflaba el total oficial de Juveniles para jugadores que en realidad venían de otra categoría esos años.) También bloquea el service worker por el mismo motivo que `aif-sincronizar.spec.js` |

## Si agregás una función nueva a la app

Sumá un archivo `*.spec.js` nuevo (copiá la estructura de cualquiera de los
de arriba) o agregá casos a uno existente si la función está relacionada.
`run-all.js` los detecta solo con que termine en `.spec.js`, no hace falta
registrarlo en ningún lado.

## Qué NO cubren todavía

No hay pruebas de Firebase real (login, sincronización en la nube): el
sandbox donde se escribió esta app bloquea el acceso a Firebase/gstatic, así
que todo se prueba con el modo "sin conexión" (`hsm-sin-conexion`), que usa
los mismos datos pero guardados solo en el dispositivo. Si en algún momento
se prueba desde un entorno con acceso real a internet, valdría la pena sumar
pruebas de ese flujo.

Por la misma razón tampoco se puede probar la carga real de `pako` (la
librería que comprime la base antes de subirla a Firestore): el sandbox
bloquea también los CDN (jsdelivr, cdnjs), no solo Firebase. Lo que sí se
probó acá es la lógica de compresión/descompresión en sí (con un `pako`
fabricado a mano en `sincronizacion-en-vivo.spec.js`) y, aparte de estas
pruebas, el algoritmo de compresión (DEFLATE) contra una muestra de datos
con la forma real de la base, usando el `zlib` de Node: redujo unos
650 KB de JSON a poco más de 20 KB, con una vuelta exacta al original.

Tampoco hay una prueba end-to-end de `api/aif.js` (la función de Vercel que
trae el fixture real de aif.org.ar) contra la AIF de verdad: `run-all.js`
sirve `index.html` con un servidor estático de Python, que no ejecuta
funciones serverless, así que `aif-sincronizar.spec.js` simula la respuesta
de `/api/aif` con `page.route`. La lógica de `api/aif.js` en sí (los
endpoints de la AIF, el mapeo de categoría→torneo/división, el parseo del
JSONP) sí se probó a mano contra el sitio real en el momento de escribirla,
para las 5 categorías. Si la AIF cambia su estructura en el futuro, esta
función podría necesitar ajustes que estas pruebas no van a detectar solas.
