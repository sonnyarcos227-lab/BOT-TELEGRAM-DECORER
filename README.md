# Bot de Telegram — Decorer 🛋️

Bot que responde a clientes con el precio y disponibilidad de productos,
leyendo el inventario que tú subes como archivo Excel (formato exportado
desde Syscafe, hoja "INVENTARIO").

## ¿Cómo funciona?

1. Tú (como administrador) le envías el archivo `.xlsx` al bot por Telegram,
   directamente en el chat privado con el bot.
2. El bot lo procesa y reemplaza el inventario guardado.
3. Cualquier cliente que le escriba al bot un nombre de producto (ej. "armario",
   "portátil lenovo", "celular motorola") recibe el precio, si hay stock, la
   categoría y el código.

No necesitas tocar el código para actualizar precios: solo reenvías el Excel
nuevo cuando cambie.

---

## Paso 1 — Crear el bot en Telegram

1. Abre Telegram y busca **@BotFather**.
2. Envíale `/newbot`.
3. Ponle un nombre (ej. `Decorer Tienda`) y un usuario que termine en `bot`
   (ej. `decorer_tienda_bot`).
4. BotFather te dará un **token** parecido a:
   `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   Guárdalo, es tu `BOT_TOKEN`.

## Paso 2 — Obtener tu chat_id (para ser el admin autorizado)

1. Busca en Telegram al bot **@userinfobot** y dale `/start`.
2. Te devuelve tu `Id` (un número). Ese es tu `ADMIN_CHAT_IDS`.
   (Si quieres que otra persona también pueda subir el inventario, agrega su
   id separado por coma: `111111111,222222222`)

## Paso 3 — Desplegar en Railway

1. Crea una cuenta en [railway.app](https://railway.app) si no tienes.
2. Sube este proyecto a un repositorio de GitHub (o usa "Deploy from local
   directory" con el CLI de Railway).
3. En Railway: **New Project → Deploy from GitHub repo** y selecciona el repo.
4. Railway detecta automáticamente que es un proyecto Node.js y usa
   `npm install` + `npm start`.
5. Ve a la pestaña **Variables** del servicio y agrega:
   - `BOT_TOKEN` → el token de BotFather
   - `ADMIN_CHAT_IDS` → tu chat_id
   - `DATA_DIR` → `/data`
6. Ve a la pestaña **Volumes** (o "Storage") y crea un volumen montado en
   `/data`. **Esto es importante**: sin esto, cada vez que Railway reinicie el
   bot se perdería el inventario cargado y tendrías que volver a subir el Excel.
7. Railway hará el deploy automáticamente. Revisa los **Logs**: deberías ver
   `Bot de Decorer corriendo...`.

## Paso 4 — Cargar el inventario

1. Abre tu bot en Telegram (el usuario que creaste, ej. `@decorer_tienda_bot`).
2. Dale `/start`.
3. Adjunta y envía el archivo `.xlsx` que descargas de Syscafe (el mismo
   formato de "SALDOS DE INVENTARIO").
4. El bot responderá confirmando cuántos productos cargó.
5. ¡Listo! Ahora cualquier cliente puede escribirle al bot para preguntar por
   productos.

Cada vez que tu inventario cambie, repite el paso 4 con el Excel actualizado.

---

## Comandos disponibles

- `/start` — mensaje de bienvenida
- `/help` — ayuda rápida
- `/stock` — cuántos productos hay cargados y cuándo fue la última actualización

## Probarlo en tu computador (opcional, antes de subir a Railway)

```bash
npm install
cp .env.example .env
# edita .env y pon tu BOT_TOKEN y ADMIN_CHAT_IDS
npm start
```

## Notas técnicas

- La base de datos es SQLite, usando el módulo nativo `node:sqlite` de
  Node.js (no requiere compilar nada, por eso el despliegue es más simple).
  Requiere Node **22.5 o superior** (ya especificado en `package.json`).
- El parser (`src/inventoryParser.js`) está hecho específicamente para el
  formato de exportación de Syscafe que compartiste: fila de encabezado
  "REFERENCIA | DETALLE | CANTIDAD | VR/UNIT | VR/TOTAL", con filas de
  categoría intercaladas (solo texto en la primera columna) y una columna
  opcional de notas (garantía, daños, etc.).
- Si Syscafe llegara a cambiar el formato del Excel, lo primero a revisar es
  ese archivo.
