import writeExcelFile from 'write-excel-file/browser'

// Descarga un Excel de ejemplo con las columnas que acepta la importación
export async function descargarEjemplo(config) {
  const { archivo, encabezados, filas } = config.ejemplo
  const datos = [
    encabezados.map((value) => ({ value, fontWeight: 'bold' })),
    ...filas.map((fila) => fila.map((value) => ({ value, type: String }))),
  ]
  await writeExcelFile(datos, { columns: encabezados.map(() => ({ width: 24 })) }).toFile(archivo)
}
