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
| `vs-comparar.spec.js` | Solapa Vs (visible para los 3 roles): comparar a dos jugadores en una temporada cada uno, incluida una ya archivada, con los mismos números de partidos, asistencia a entrenos y test físicos que se ven en cada ficha |

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
