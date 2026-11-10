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
| `categorias-y-rutinas.spec.js` | Pantalla de Categorías (entrar a la propia / mirar una ajena) y Rutinas (cargar, ver por categoría, resguardo local) |
| `test-fisicos-flujo.spec.js` | Flujo completo de Test Físicos: registrar una toma, que quede en `evaluaciones`/`tomas` (sin duplicar), verlo en la ficha |
| `test-fisicos-toma-detalle.spec.js` | Entrar a una toma puntual de un test físico y ver el resultado de cada jugador |
| `inicio-nav-y-landing.spec.js` | Navegación por rol (qué solapas ve cada uno) y que todos aterricen en Inicio |
| `inicio-destacados.spec.js` | Tira de tarjetas "Destacados" del panel de Inicio |
| `ficha-tablero-general.spec.js` | Tablero de la solapa General de la ficha (estadísticas, historial, gráfico, tests físicos, posición en el plantel, detalle de rendimiento) |
| `ficha-foto-grande.spec.js` | Que la foto grande de la solapa General siga permitiendo subir/cambiar foto, y que Detalle/Historial conserven el encabezado chico |
| `migracion-categorias.spec.js` | Migración de categorías duplicadas ("Selección Libre" → "Selección") en dispositivos con datos viejos |
| `alarma-tamano-firestore.spec.js` | Aviso cuando la base se acerca al límite de tamaño de Firestore |
| `sincronizacion-en-vivo.spec.js` | Que un cambio de otro dispositivo se aplique solo cuando no se está editando nada, quede pendiente (con aviso) si se está editando, y nunca pise el rol/sesión de este dispositivo |
| `archivar-temporada.spec.js` | Pantalla de Datos: archivar una temporada vieja descarga el CSV, resume partidos/entrenamientos en el historial del jugador, conserva solo la última toma de test físico del año, y no cambia el % de asistencia histórico |
| `estimar-ahorro-archivar.spec.js` | La pantalla de Datos muestra cuántos KB liberaría archivar la temporada elegida (se recalcula solo al cambiar de temporada en el desplegable), y ese número coincide con lo que de verdad baja el tamaño de la base al archivar |
| `vs-comparar.spec.js` | Solapa Vs (visible para los 3 roles): comparar a dos jugadores en una temporada cada uno, incluida una ya archivada, con los mismos números de partidos, asistencia a entrenos y test físicos que se ven en cada ficha |
| `pwa.spec.js` | manifest.json y sw.js se sirven bien, las metaetiquetas de instalación están en el `<head>`, el service worker se registra solo, y el banner "Instalar app" se comporta distinto en Android (botón) que en iPhone (aviso de Compartir) |
| `alertas-radar.spec.js` | Bloque "Para repasar" en Inicio (sin evaluarse hace 4+ meses, 3+ amarillas o 1+ roja; visible para los 3 roles; tope de 8 filas con el total real en el título); gráfico de telaraña del perfil técnico-táctico en la ficha, con el valor de cada ítem y sin que se corte ninguna etiqueta; flechas ↑/↓ en la comparación con la toma anterior |
| `cargar-evaluacion.spec.js` | "Cargar datos de un jugador": primero pregunta Test Físico o Habilidades (técnico-táctico + comportamiento juntos); Test Físico a su vez pregunta uno por uno (Cooper, Yo-Yo, Velocidad); la fecha sale con la de hoy por default y cae sola en la toma de ese mes (crea una si hace falta, sin duplicar si ya existe) |
| `ponderacion-tecnica.spec.js` | El promedio técnico-táctico y "lo que más tiene que mejorar" ponderan cada ítem según el puesto del jugador (ej.: el remate no le pesa a un defensor); el valor crudo se sigue viendo igual en Detalle y en la telaraña, sin esconder nada |

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
