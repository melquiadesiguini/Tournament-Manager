import writeExcelFile from 'write-excel-file/browser'
import { juecesDe, numeroONull } from './jurado'

// Datos del historial listos para mostrar y exportar (Excel o CSV).
// Cada resultado ocupa una fila y cada juez una columna fija, así los resultados de 3 y de 5 jueces
// se pueden comparar y filtrar juntos:
//   Juez Nº1 · Juez Nº2 · Juez Nº3 · Juez Nº4 · Juez Central
// Con 3 jueces actúan Nº1, Nº2 y el Central; las columnas Nº3 y Nº4 quedan VACÍAS (null), no en 0,
// porque un 0 sería un puntaje real y arruinaría promedios y totales.

export const NOMBRES_MODULO = { kata: 'Kata', kobudo: 'Kobudo', destreza: 'Destreza', kumite: 'Kumite' }
export const COLUMNAS_JUECES = ['Juez Nº1', 'Juez Nº2', 'Juez Nº3', 'Juez Nº4', 'Juez Central']

// Columna que le toca a un juez: el último del sistema (3.º de 3, o 5.º de 5) es siempre el Central
const columnaDeJuez = (numero, sistema) => (numero === sistema ? COLUMNAS_JUECES.length - 1 : numero - 1)

// [{ nombre, puntaje, incluido } | null] en el orden de COLUMNAS_JUECES
export function juecesPorColumna(payload) {
  const columnas = Array(COLUMNAS_JUECES.length).fill(null)
  const lista = juecesDe(payload)
  const sistema = numeroONull(payload?.judgeSystem) || (lista.some((j) => j.numero > 3) ? 5 : 3)
  for (const j of lista) {
    const i = columnaDeJuez(j.numero, sistema)
    if (i >= 0 && i < columnas.length) columnas[i] = { nombre: j.nombre, puntaje: j.puntaje, incluido: j.incluido }
  }
  return columnas
}

// Fila de un resultado guardado, con todo lo que se muestra o exporta
export function filaDeResultado(r) {
  const p = r.payload || {}
  const esKumite = r.modulo === 'kumite'
  const final = numeroONull(p.finalScore)
  return {
    id: r.id,
    modulo: r.modulo,
    fecha: new Date(p.guardadoEn || r.creado_en),
    moduloTexto: NOMBRES_MODULO[r.modulo] || r.modulo,
    area: numeroONull(r.area),
    ronda: numeroONull(p.ronda),
    competidor: esKumite ? `${p.nombreShiro} vs ${p.nombreAka}` : p.competitor || '',
    detalle: (esKumite ? p.categoria : p.kata) || '',
    sistema: numeroONull(esKumite ? p.sistemaJueces : p.judgeSystem),
    jueces: esKumite ? Array(COLUMNAS_JUECES.length).fill(null) : juecesPorColumna(p),
    responsable: p.responsableMesa || '',
    puntajeFinal: !esKumite ? final : null,
    resultadoKumite: esKumite ? `${p.shiroTotal} - ${p.akaTotal} · Ganador: ${p.ganador}` : '',
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
