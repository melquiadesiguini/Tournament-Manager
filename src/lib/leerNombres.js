import { readSheet } from 'read-excel-file/browser'

const MAX_FILAS = 2000
const MAX_LARGO = 120
const AFIRMATIVO = /^(s[ií]|x|true|verdadero|yes|y|1)$/i

const limpiar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO)

function aBooleano(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  return AFIRMATIVO.test(limpiar(v))
}

// Ubica la columna de cada campo por el encabezado de la primera fila. Si el archivo no
// tiene encabezados reconocibles, se toman las columnas en el orden de los campos.
function ubicarColumnas(filas, campos) {
  const encabezados = filas[0].map((c) => (typeof c === 'string' ? c : ''))
  const usadas = new Set()
  const indices = campos.map((campo) => {
    const i = encabezados.findIndex((h, n) => !usadas.has(n) && h && campo.encabezado.test(h))
    if (i >= 0) usadas.add(i)
    return i
  })
  if (indices.some((i) => i >= 0)) {
    if (indices[campos.findIndex((c) => c.requerido)] < 0) {
      throw new Error('No se encontró la columna «Nombre» en la primera fila del archivo.')
    }
    return { indices, datos: filas.slice(1) }
  }
  return { indices: campos.map((_, n) => n), datos: filas }
}

// Lee un archivo .xlsx o .csv/.txt y devuelve las filas como objetos { clave: valor }
// según los campos indicados (ver camposPersonas.js). Descarta filas sin los datos requeridos
// y repetidas (misma clave única, sin distinguir mayúsculas).
export async function leerPersonasDeArchivo(archivo, config) {
  const nombre = archivo.name.toLowerCase()
  let filas
  if (nombre.endsWith('.xlsx')) {
    filas = await readSheet(archivo)
  } else if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    let texto = await archivo.text()
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1) // marca BOM de Excel
    filas = texto
      .split(/\r?\n/)
      .map((linea) => linea.split(/[;\t]/).map((c) => c.replace(/^"|"$/g, '')))
  } else {
    throw new Error('Formato no admitido. Usá un archivo .xlsx o .csv.')
  }
  if (filas.length === 0) return []

  const { campos, claveUnica } = config
  const { indices, datos } = ubicarColumnas(filas, campos)
  const vistos = new Set()
  const personas = []
  for (const fila of datos) {
    const obj = {}
    campos.forEach((campo, n) => {
      const bruto = indices[n] >= 0 ? fila[indices[n]] : null
      obj[campo.clave] = campo.tipo === 'booleano' ? aBooleano(bruto) : limpiar(bruto)
    })
    if (campos.some((c) => c.requerido && !obj[c.clave])) continue
    const clave = claveUnica.map((k) => obj[k].toLowerCase()).join('|')
    if (vistos.has(clave)) continue
    vistos.add(clave)
    personas.push(obj)
    if (personas.length >= MAX_FILAS) break
  }
  return personas
}
