# Guía: activar el acceso seguro

Esta guía acompaña el cambio de seguridad de la app. Hay que hacerla **una sola vez**, en este orden. Lleva unos 20 minutos.

## Qué cambió

| Antes | Ahora |
|---|---|
| Cualquiera en internet podía bajar la base completa del club | Solo coordinación y los DT habilitados pueden leerla |
| Todos los DT compartían una contraseña, y estaba escrita en el código | Cada DT tiene **su propia contraseña**, que creás vos desde la app |
| El jugador bajaba los datos de todos, con los DNI | El jugador entra con su DNI y baja una **copia sin datos sensibles** (sin DNI, fecha de nacimiento, carnet, ni test o lesiones de otros) más sus propios datos |
| El "DT de una categoría" era un filtro de pantalla | La categoría de cada DT la guarda Firebase, no el celular |

## Paso 1 · Publicar la versión nueva

Se aprueba el cambio en GitHub y Vercel lo publica solo.

## Paso 2 · Pegar las reglas de seguridad en Firebase (antes que nada)

Este paso cierra la puerta, y además **tiene que ir antes** que los siguientes: con las reglas viejas, Firebase no deja guardar los accesos de DT ni las llaves de los jugadores (aparece "Firebase no dejó guardar el acceso").

1. Entrá a <https://console.firebase.google.com> y abrí el proyecto **hsm-base-de-datos**.
2. Menú de la izquierda: **Firestore Database → pestaña Reglas**.
3. Borrá todo lo que hay y pegá el contenido del archivo `firestore.rules` de este repositorio.
4. Tocá **Publicar**.
5. Menú de la izquierda: **Storage → pestaña Reglas**.
6. Borrá todo y pegá el contenido de `storage.rules`. Tocá **Publicar**.
7. Si Firebase pregunta si Storage puede consultar Firestore, aceptá.

## Paso 3 · Entrar una vez como coordinación

1. Abrí la app y entrá como **Coordinación** (si ya estabas adentro, tocá "salir" y volvé a entrar).
2. Esperá unos 10 segundos. La app arma sola las llaves de acceso de cada jugador que tenga DNI cargado.

## Paso 4 · Crear la contraseña de cada DT

1. En la app, andá a **Datos → DT por categoría**.
2. Para cada DT: escribí su DNI, elegí su categoría y una contraseña (mínimo 6 caracteres) y tocá **Agregar DT**.
3. Si el DT ya estaba en la lista, tocá **Crear acceso** al lado de su DNI.
4. Pasale la contraseña **en persona**, no por un grupo de WhatsApp.

Si un DT se olvida la contraseña, tocá **Nueva contraseña**. **Eliminar** le corta el acceso al instante.

> Si aparece "Falta habilitar Correo/contraseña", en Firebase andá a **Authentication → Sign-in method** y activá **Correo electrónico/contraseña**.

## Paso 5 · Comprobar que funciona

- Entrá como jugador con un DNI cargado: tiene que entrar.
- Entrá como un DT con su contraseña nueva: tiene que caer en su categoría.

## Paso 6 · Limpieza recomendada

- En Firebase, **Authentication → Users**: borrá las cuentas viejas compartidas `dt@harassantamaria.com` y `jugadores@harassantamaria.com`. Ya no tienen acceso a nada, pero conviene que no existan.
- El DNI 41781139 estaba escrito en el código, que es público, así que **ya no sirve como llave de jugador**. Si lo usabas para probar, cargale otro DNI al jugador "Zzz (acceso de prueba)" o borralo.
- Pasá el repositorio de GitHub a **privado**: Settings → Danger zone → Change visibility. La app sigue funcionando igual.

## Lo que todavía queda pendiente

- **Un DT puede editar otras categorías si sabe de programación.** La app no lo deja, pero Firebase todavía no lo frena, porque la base es un solo archivo. Resolverlo requiere dividir la base por categoría (próxima etapa). Igual, ahora cada cambio queda registrado con la cuenta de quién lo hizo.
- **Alguien que conozca el DNI de un jugador puede entrar como él.** Ve lo mismo que ese jugador, nunca datos de los demás. Si hace falta más, se puede sumar un PIN de 4 números.
