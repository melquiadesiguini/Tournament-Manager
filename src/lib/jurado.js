// Datos que se guardan de un resultado de Kata, Kobudo o Destreza (módulos con jurado).
//
// payload que entregan las pantallas (lib/filasResultados.js lo reparte en las columnas de resultados_jurado), con el tipo de cada dato:
//   competitor      texto    nombre del competidor (o equipo, en Destreza)
//   kata            texto    nombre del kata / kobudo (no existe en Destreza)
//   area            número   número de área, o null si no se puso
//   ronda           número   número de ronda, o null si no se puso
//   responsableMesa texto    nombre del responsable de mesa
//   judgeSystem     número   3 o 5 jueces
//   jueces          lista    [{ numero: número, etiqueta: texto, nombre: texto, puntaje: número, incluido: booleano }]
//   scores          objeto   { judge1: número | null, ... } puntajes crudos por posición
//   judgeNames      objeto   { judge1: texto, ... }
//   highest, lowest número   puntaje mayor y menor
//   finalScore      número   puntaje final
//   guardadoEn      texto    fecha y hora exactas del guardado, ISO 8601 con segundos (JSON no tiene tipo fecha)
//   timestamp       texto    lo mismo en formato local (solo para mostrar)
// La base además guarda `creado_en` (timestamptz, hora del servidor) y `creado_por` (uuid).

// Número, o null si está vacío o no es un número (un campo vacío no es 0)
export function numeroONull(valor) {
  if (valor === '' || valor === null || valor === undefined) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

// { judge1: '7.3', judge2: '' } -> { judge1: 7.3, judge2: null }
export const puntajesNumericos = (scores) => Object.fromEntries(Object.entries(scores).map(([id, v]) => [id, numeroONull(v)]))

export const etiquetaJuez = (numero, sistema) => (numero === sistema ? 'Juez Central' : `Juez Nº${numero}`)

// Un renglón por juez que puntuó: quién es, qué nombre escribieron y qué puntaje dio.
//   puntajes: [{ judgeId, judgeNumber, score }]   nombres: { judge1: 'Ana Pérez', ... }
//   incluido(judgeId): true si el puntaje cuenta para el total (false si se descarta)
export function armarJueces({ puntajes, nombres, sistema, incluido }) {
  return puntajes.map((p) => ({
    numero: p.judgeNumber,
    etiqueta: etiquetaJuez(p.judgeNumber, sistema),
    nombre: String(nombres[p.judgeId] ?? '').trim(),
    puntaje: p.score,
    incluido: incluido(p.judgeId),
  }))
}

// Puntaje final de un resultado de jurado, con las mismas reglas que las pantallas de Kata, Kobudo y Destreza:
//   3 jueces: suma de los tres puntajes.
//   5 jueces: se descartan el mayor (si se repite, el primero que se cargó) y el menor (si se repite, el último)
//             y se suman los tres del medio.
// `puntajes`: [{ posicion, puntaje }] en el orden de carga (posición 1 a 4, y 5 = central).
// Devuelve { final, descartados } (posiciones que no cuentan); final es null si falta algún puntaje.
export function calcularPuntaje(puntajes, sistema) {
  const validos = puntajes.map((p) => ({ posicion: p.posicion, puntaje: numeroONull(p.puntaje) }))
  if (validos.length !== sistema || validos.some((p) => p.puntaje === null)) return { final: null, descartados: [] }
  if (sistema === 3) return { final: Number(validos.reduce((s, p) => s + p.puntaje, 0).toFixed(2)), descartados: [] }
  const ordenados = validos.slice().sort((a, b) => b.puntaje - a.puntaje) // el orden es estable: los empates mantienen el de carga
  const descartados = [ordenados[0].posicion, ordenados[ordenados.length - 1].posicion]
  const medio = ordenados.slice(1, -1)
  return { final: Number(medio.reduce((s, p) => s + p.puntaje, 0).toFixed(2)), descartados }
}
