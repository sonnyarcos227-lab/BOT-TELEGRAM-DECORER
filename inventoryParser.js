const XLSX = require('xlsx');

/**
 * Parsea el buffer de un archivo .xlsx exportado desde Syscafe
 * (hoja "INVENTARIO") y devuelve una lista de productos.
 *
 * Formato real observado:
 *  - Varias filas de encabezado (nombre empresa, NIT, título, bodega...)
 *  - Una fila con literalmente: REFERENCIA | DETALLE | CANTIDAD | VR/UNIT | VR/TOTAL
 *  - Filas de "categoría": solo tienen texto en la primera columna
 *    (ej: "CELULARES", "MOTOROLA", "PRODUCTOS GRAVADOS AL 19%")
 *  - Filas de producto: REFERENCIA, DETALLE, CANTIDAD, VR/UNIT, VR/TOTAL, [NOTA opcional]
 *  - Filas vacías de relleno al final
 */
function parseInventario(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Preferimos una hoja llamada exactamente "INVENTARIO" (case-insensitive).
  // Si no existe, usamos la primera hoja del archivo.
  const nombreHoja =
    workbook.SheetNames.find((n) => n.trim().toUpperCase() === 'INVENTARIO') ||
    workbook.SheetNames[0];

  const hoja = workbook.Sheets[nombreHoja];
  const filas = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  // Buscar la fila de encabezado real (contiene "REFERENCIA" en la 1a columna)
  let indiceEncabezado = filas.findIndex(
    (fila) =>
      fila[0] &&
      fila[0].toString().trim().toUpperCase().startsWith('REFERENCIA')
  );

  if (indiceEncabezado === -1) {
    throw new Error(
      `No se encontró la fila de encabezado "REFERENCIA" en la hoja "${nombreHoja}". Verifica que el archivo tenga el formato esperado de Syscafe.`
    );
  }

  const productos = [];
  let categoriaActual = null;

  for (let i = indiceEncabezado + 1; i < filas.length; i++) {
    const fila = filas[i];
    const [refRaw, detalleRaw, cantidadRaw, precioRaw, , notaRaw] = fila;

    const ref = limpiar(refRaw);
    const detalle = limpiar(detalleRaw);
    const cantidad = numeroONull(cantidadRaw);
    const precio = numeroONull(precioRaw);
    const nota = limpiar(notaRaw);

    // Fila totalmente vacía -> saltar
    if (!ref && !detalle) continue;

    // Fila de categoría: hay texto en ref pero no hay detalle/cantidad/precio
    if (ref && !detalle && cantidad === null && precio === null) {
      categoriaActual = ref;
      continue;
    }

    // Fila de producto válida: necesita referencia, detalle, cantidad y precio
    if (ref && detalle && cantidad !== null && precio !== null) {
      productos.push({
        codigo: ref,
        nombre: detalle,
        categoria: categoriaActual,
        cantidad,
        precio,
        nota: nota || null,
      });
    }
    // Cualquier otra fila rara (parcial) se ignora silenciosamente
  }

  return productos;
}

function limpiar(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = valor.toString().trim();
  return texto.length > 0 ? texto : null;
}

function numeroONull(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

module.exports = { parseInventario };
