import writeExcelFile from 'write-excel-file/browser'
import { numeroONull } from './jurado'

// Datos del historial listos para mostrar y exportar (Excel o CSV).
// Cada resultado ocupa una fila y cada juez una columna fija, así los resultados de 3 y de 5 jueces
// se pueden comparar y filtrar juntos:
//   Juez Nº1 · Juez Nº2 · Juez Nº3 · Juez Nº4 · Juez Central
// Con 3 jueces actúan Nº1, Nº2 y el Central; las columnas Nº3 y Nº4 quedan VACÍAS (null), no en 0,
// porque un 0 sería un puntaje real y arruinaría promedios y totales.

export const NOMBRES_MODULO = { kata: 'Kata', kobudo: 'Kobudo', destreza: 'Destreza', kumite: 'Kumite' }
export const COLUMNAS_JUECES = ['Juez Nº1', 'Juez Nº2', 'Juez Nº3', 'Juez Nº4', 'Juez Central']

// Prefijo de las columnas de cada juez en la tabla, en el orden de COLUMNAS_JUECES
const PREFIJOS_JUECES = ['juez1', 'juez2', 'juez3', 'juez4', 'juez_central']

// Fila del historial a partir de una fila de resultados_jurado o resultados_kumite (`tabla` dice cuál)
export function filaDeResultado(r) {
  const esKumite = r.tabla === 'kumite'
  const base = {
    id: r.id,
    fecha: new Date(r.creado_en),
    area: r.area ?? null,
    responsable: r.responsable_mesa ?? '',
    sistema: r.sistema_jueces ?? null,
  }

  if (esKumite) {
    return {
      ...base,
      modulo: 'kumite',
      moduloTexto: NOMBRES_MODULO.kumite,
      ronda: null,
      competidor: `${r.nombre_shiro} vs ${r.nombre_aka}`,
      detalle: r.categoria ?? '',
      jueces: Array(COLUMNAS_JUECES.length).fill(null),
      puntajeFinal: null,
      resultadoKumite: `${r.puntaje_shiro} - ${r.puntaje_aka} · Ganador: ${r.ganador}`,
    }
  }

  const descartados = r.jueces_descartados ?? []
  return {
    ...base,
    modulo: r.modulo,
    moduloTexto: NOMBRES_MODULO[r.modulo] || r.modulo,
    ronda: r.ronda ?? null,
    competidor: r.competidor ?? '',
    detalle: r.kata ?? '',
    // un juez que no actuó (con 3 jueces, el 3 y el 4) queda en null
    jueces: PREFIJOS_JUECES.map((prefijo, i) => {
      const puntaje = numeroONull(r[`${prefijo}_puntaje`])
      return puntaje === null ? null : { nombre: r[`${prefijo}_nombre`] ?? '', puntaje, incluido: !descartados.includes(i + 1) }
    }),
    puntajeFinal: numeroONull(r.puntaje_final),
    resultadoKumite: '',
  }
}

// ---------------------------------------------------------------- exportación

const ENCABEZADOS = [
  'Fecha y hora', 'Módulo', 'Área', 'Ronda', 'Competidor', 'Kata / categoría', 'Sistema de jueces',
  ...COLUMNAS_JUECES.flatMap((c) => [`${c} - nombre`, `${c} - puntaje`]),
  'Responsable de mesa', 'Puntaje final / resultado',
]

const vacioANull = (v) => (v === '' || v === undefined ? null : v)

// Valores de una fila en el orden de ENCABEZADOS (vacío = null)
function valoresDeFila(f) {
  return [
    f.fecha,
    f.moduloTexto,
    f.area,
    f.ronda,
    vacioANull(f.competidor),
    vacioANull(f.detalle),
    f.sistema,
    ...f.jueces.flatMap((j) => (j ? [vacioANull(j.nombre), j.puntaje] : [null, null])),
    vacioANull(f.responsable),
    f.puntajeFinal ?? vacioANull(f.resultadoKumite),
  ]
}

const nombreArchivo = (extension) => `ipponia-historial-${new Date().toLocaleDateString('en-CA')}.${extension}`

// Excel: números como números (se pueden sumar y promediar) y la fecha como fecha real
export async function exportarXlsx(filas) {
  const datos = [
    ENCABEZADOS.map((value) => ({ value, fontWeight: 'bold' })),
    ...filas.map((f) =>
      valoresDeFila(f).map((v) => {
        if (v instanceof Date) return { value: v, format: 'dd/mm/yyyy hh:mm:ss' }
        return v
      })
    ),
  ]
  await writeExcelFile(datos, { columns: ENCABEZADOS.map((_, i) => ({ width: i === 0 ? 20 : i === 4 || i === 5 ? 24 : 16 })) }).toFile(
    nombreArchivo('xlsx')
  )
}

const fechaTexto = (d) => d.toLocaleString('es-AR', { hour12: false }).replace(',', '')

// CSV pensado para Excel en español: separador «;», decimales con coma y UTF-8 con BOM (para las tildes)
function celdaCsv(v) {
  if (v === null || v === undefined) return ''
  let texto
  if (v instanceof Date) texto = fechaTexto(v)
  else if (typeof v === 'number') texto = String(v).replace('.', ',')
  else texto = String(v)
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function exportarCsv(filas) {
  const lineas = [ENCABEZADOS, ...filas.map(valoresDeFila)].map((fila) => fila.map(celdaCsv).join(';'))
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo('csv')
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export { ENCABEZADOS, valoresDeFila }
