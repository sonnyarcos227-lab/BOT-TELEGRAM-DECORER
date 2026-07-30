require('dotenv').config();
const { Telegraf } = require('telegraf');
const { parseInventario } = require('./inventoryParser');
const db = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (!BOT_TOKEN) {
  console.error('ERROR: falta BOT_TOKEN en las variables de entorno.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function esAdmin(ctx) {
  const id = String(ctx.chat.id);
  return ADMIN_CHAT_IDS.includes(id);
}

function formatearPrecio(valor) {
  return '$' + Math.round(valor).toLocaleString('es-CO');
}

function formatearProducto(p) {
  const disponible = p.cantidad > 0;
  const estado = disponible ? `✅ Disponible (${p.cantidad} und)` : '❌ Agotado';
  let texto = `*${p.nombre.trim()}*\n💰 ${formatearPrecio(p.precio)}\n${estado}`;
  if (p.categoria) texto += `\n🏷️ ${p.categoria}`;
  if (p.nota) texto += `\n📝 Nota: ${p.nota}`;
  texto += `\nCódigo: ${p.codigo.trim()}`;
  return texto;
}

// ---------- Comandos ----------

bot.start((ctx) => {
  ctx.reply(
    '¡Hola! 👋 Soy el bot de *Decorer* 🛋️\n\n' +
      'Escríbeme el nombre (o parte del nombre) del producto que buscas y te digo el precio y si tenemos disponibilidad.\n\n' +
      'Ejemplos:\n' +
      '• "armario"\n' +
      '• "portatil lenovo"\n' +
      '• "celular motorola"\n\n' +
      '📍 Nos encuentras al lado del Hospital José María Hernández, Av. Colombia, Mocoa.\n' +
      '📞 3223787495',
    { parse_mode: 'Markdown' }
  );
});

bot.help((ctx) => {
  ctx.reply(
    'Solo escribe el nombre de un producto y buscaré coincidencias en el inventario. ' +
      'Ejemplo: "nevera" o "mesa tv".'
  );
});

bot.command('stock', (ctx) => {
  const total = db.contarProductos();
  const ultima = db.getMeta('ultima_actualizacion');
  const fecha = ultima ? new Date(ultima).toLocaleString('es-CO') : 'nunca';
  ctx.reply(`📦 Productos cargados: ${total}\n🕒 Última actualización: ${fecha}`);
});

// ---------- Carga de inventario (solo admin) ----------

bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const esExcel =
    doc.mime_type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    doc.file_name?.toLowerCase().endsWith('.xlsx');

  if (!esExcel) {
    return ctx.reply('Ese archivo no parece ser un .xlsx. Envíame el Excel de inventario de Syscafe.');
  }

  if (!esAdmin(ctx)) {
    return ctx.reply('Solo un administrador autorizado puede actualizar el inventario.');
  }

  try {
    await ctx.reply('📥 Recibido, procesando el inventario...');
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const respuesta = await fetch(fileLink.href);
    const arrayBuffer = await respuesta.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const productos = parseInventario(buffer);

    if (productos.length === 0) {
      return ctx.reply(
        '⚠️ No se encontraron productos en el archivo. Verifica que sea el Excel correcto (hoja INVENTARIO de Syscafe).'
      );
    }

    db.reemplazarInventario(productos);

    await ctx.reply(
      `✅ Inventario actualizado con éxito.\n📦 ${productos.length} productos cargados.`
    );
  } catch (err) {
    console.error('Error procesando inventario:', err);
    await ctx.reply(
      '❌ Hubo un error procesando el archivo:\n' + err.message
    );
  }
});

// ---------- Búsqueda de productos (texto libre) ----------

bot.on('text', (ctx) => {
  const consulta = ctx.message.text.trim();
  if (consulta.startsWith('/')) return; // ya manejado arriba

  if (consulta.length < 2) {
    return ctx.reply('Escribe al menos 2 letras del producto que buscas 🙂');
  }

  const resultados = db.buscarProductos(consulta, 8);

  if (resultados.length === 0) {
    return ctx.reply(
      `No encontré nada con "${consulta}". Intenta con otra palabra o revisa cómo se llama el producto.`
    );
  }

  const mensaje = resultados.map(formatearProducto).join('\n\n———\n\n');
  ctx.reply(mensaje, { parse_mode: 'Markdown' });
});

// ---------- Arranque ----------

bot.launch();
console.log('Bot de Decorer corriendo...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
