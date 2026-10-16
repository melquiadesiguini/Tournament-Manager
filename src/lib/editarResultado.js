import { calcularPuntaje, numeroONull } from './jurado.js'

// Corregir un resultado del historial: de la fila guardada a los valores del formulario, validación y
// los cambios que se mandan a la base. Código puro (sin red ni navegador): lo prueba `npm run test:db`.

const PREFIJOS_JUECES = ['juez1', 'juez2', 'juez3', 'juez4', 'juez_central']
const ETIQUETAS_JUECES = ['Juez Nº1', 'Juez Nº2', 'Juez Nº3', 'Juez Nº4', 'Juez Central']

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

// Valores iniciales del formulario a partir de la fila de resultados_jurado o resultados_kumite (`tabla` dice cuál)
export function valoresIniciales(r) {
  if (r.tabla === 'kumite') {
    return {
      tabla: 'kumite',
      torneoId: r.torneo_id ?? '',
      nombreShiro: r.nombre_shiro ?? '',
      nombreAka: r.nombre_aka ?? '',
      categoria: r.categoria ?? '',
      area: r.area === null ? '' : String(r.area),
      responsable: r.responsable_mesa ?? '',
      puntajeShiro: String(r.puntaje_shiro),
      puntajeAka: String(r.puntaje_aka),
      lado: r.lado_ganador ?? 'empate',
    }
  }
  return {
    tabla: 'jurado',
    torneoId: r.torneo_id ?? '',
    modulo: r.modulo,
    sistema: r.sistema_jueces,
    competidor: r.competidor ?? '',
    kata: r.kata ?? '',
    area: r.area === null ? '' : String(r.area),
    ronda: r.ronda === null ? '' : String(r.ronda),
    responsable: r.responsable_mesa ?? '',
    // solo los jueces que actuaron (con 3 jueces, el 3 y el 4 no existen)
    jueces: PREFIJOS_JUECES.map((prefijo, i) => ({
      posicion: i + 1,
      etiqueta: ETIQUETAS_JUECES[i],
      prefijo,
      nombre: r[`${prefijo}_nombre`] ?? '',
      puntaje: r[`${prefijo}_puntaje`] === null ? null : String(r[`${prefijo}_puntaje`]),
    })).filter((j) => j.puntaje !== null),
  }
}

// Puntaje final y jueces descartados según lo que hay en el formulario (solo jurado)
export const calcularDeValores = (v) =>
  calcularPuntaje(v.jueces.map((j) => ({ posicion: j.posicion, puntaje: j.puntaje })), v.sistema)

// ¿El texto está vacío o es un entero entre min y max?
const enteroOVacio = (texto, min, max) => {
  if (texto === '') return true
  const n = numeroONull(texto)
  return Number.isInteger(n) && n >= min && n <= max
}

// Mensaje de lo que está mal, o '' si se puede guardar
export function validar(v) {
  if (!enteroOVacio(v.area, 0, 999)) return 'El área tiene que ser un número entero de 0 a 999.'
  if (v.tabla === 'kumite') {
    for (const p of [v.puntajeShiro, v.puntajeAka]) {
      if (!Number.isInteger(numeroONull(p))) return 'Los puntajes de Shiro y Aka tienen que ser números enteros.'
    }
    return ''
  }
  if (!texto(v.competidor)) return v.modulo === 'destreza' ? 'El nombre del equipo es obligatorio.' : 'El nombre del competidor es obligatorio.'
  if (!enteroOVacio(v.ronda, 1, 999)) return 'La ronda tiene que ser un número entero de 1 a 999.'
  for (const j of v.jueces) {
    const n = numeroONull(j.puntaje)
    if (n === null || n < 0 || n > 10) return `El puntaje de ${j.etiqueta} tiene que estar entre 0 y 10.`
  }
  return ''
}

// Cambios para actualizar la fila. Nunca incluye lo que la base no deja cambiar (organización, módulo, sistema, quién y cuándo).
export function cambiosDesdeValores(v) {
  const base = { torneo_id: texto(v.torneoId), area: numeroONull(v.area), responsable_mesa: texto(v.responsable) }
  if (v.tabla === 'kumite') {
    const nombreShiro = v.nombreShiro.trim()
    const nombreAka = v.nombreAka.trim()
    const ganador = v.lado === 'shiro' ? nombreShiro || 'SHIRO (BLANCO)' : v.lado === 'aka' ? nombreAka || 'AKA (ROJO)' : 'EMPATE'
    return {
      ...base,
      categoria: texto(v.categoria),
      nombre_shiro: nombreShiro,
      nombre_aka: nombreAka,
      puntaje_shiro: numeroONull(v.puntajeShiro),
      puntaje_aka: numeroONull(v.puntajeAka),
      lado_ganador: v.lado,
      ganador,
    }
  }
  const { final, descartados } = calcularDeValores(v)
  const cambios = {
    ...base,
    competidor: v.competidor.trim(),
    kata: v.modulo === 'destreza' ? null : texto(v.kata),
    ronda: numeroONull(v.ronda),
    puntaje_final: final,
    jueces_descartados: descartados,
  }
  for (const j of v.jueces) {
    cambios[`${j.prefijo}_nombre`] = texto(j.nombre)
    cambios[`${j.prefijo}_puntaje`] = numeroONull(j.puntaje)
  }
  return cambios
}
