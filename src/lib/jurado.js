// Datos que se guardan de un resultado de Kata, Kobudo o Destreza (módulos con jurado).
//
// payload (jsonb en la tabla `resultados`), con el tipo de cada dato:
//   competitor      texto    nombre del competidor (o equipo, en Destreza)
//   kata            texto    nombre del kata / kobudo (no existe en Destreza)
//   area            número   número de área, o null si no se puso (la columna `area` de la tabla es texto)
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
// La base además guarda `creado_en` (timestamptz) y `creado_por` (uuid).

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

// Jueces de un resultado ya guardado. Los resultados anteriores a este formato no tienen `jueces`:
// se reconstruyen con `scores` y `judgeNames`.
export function juecesDe(payload) {
  if (Array.isArray(payload?.jueces)) return payload.jueces
  const { scores = {}, judgeNames = {}, judgeSystem } = payload ?? {}
  return Object.keys(scores)
    .filter((id) => numeroONull(scores[id]) !== null)
    .map((id) => {
      const numero = Number(id.replace('judge', ''))
      return {
        numero,
        etiqueta: etiquetaJuez(numero, judgeSystem),
        nombre: String(judgeNames[id] ?? '').trim(),
        puntaje: numeroONull(scores[id]),
        incluido: null,
      }
    })
}
