import { numeroONull } from './jurado.js'

// Reparte el resultado que entregan las pantallas (un "payload") en las columnas de las tablas
// resultados_jurado y resultados_kumite (migración 20261015120000). Es código puro (sin red ni navegador),
// así las pruebas de la base de datos lo ejecutan contra el esquema real: npm run test:db.

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

// Prefijo de las columnas de un juez: el último juez del sistema (3.º de 3 o 5.º de 5) es el central
const prefijoJuez = (numero, sistema) => (numero === sistema ? 'juez_central' : `juez${numero}`)

// Kata, Kobudo y Destreza. `areaPorDefecto`: el área del puesto, si el resultado no la trae.
export function filaJurado(modulo, p, areaPorDefecto = null) {
  const fila = {
    modulo,
    area: numeroONull(p.area) ?? areaPorDefecto,
    ronda: numeroONull(p.ronda),
    competidor: p.competitor,
    kata: texto(p.kata),
    sistema_jueces: p.judgeSystem,
    responsable_mesa: texto(p.responsableMesa),
    puntaje_final: numeroONull(p.finalScore),
    jueces_descartados: [],
  }
  for (const j of p.jueces ?? []) {
    const prefijo = prefijoJuez(j.numero, p.judgeSystem)
    fila[`${prefijo}_nombre`] = texto(j.nombre)
    fila[`${prefijo}_puntaje`] = numeroONull(j.puntaje)
    // posición descartada: 1 a 4, y 5 para el central
    if (j.incluido === false) fila.jueces_descartados.push(j.numero === p.judgeSystem ? 5 : j.numero)
  }
  return fila
}

export function filaKumite(p, areaPorDefecto = null) {
  const duracion = numeroONull(p.duracionRestanteMs)
  return {
    area: numeroONull(p.area) ?? areaPorDefecto,
    sistema_jueces: numeroONull(p.sistemaJueces),
    responsable_mesa: texto(p.responsableMesa),
    categoria: texto(p.categoria),
    nombre_shiro: p.nombreShiro ?? '',
    nombre_aka: p.nombreAka ?? '',
    puntaje_shiro: p.shiroTotal,
    puntaje_aka: p.akaTotal,
    ganador: p.ganador ?? '',
    lado_ganador: p.ladoGanador ?? null,
    faltas: p.faltas ?? {},
    salida: p.salida ?? null,
    encho_sen: Boolean(p.enchoSen),
    duracion_restante_ms: duracion === null ? null : Math.round(duracion),
  }
}
