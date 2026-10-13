// Junta cada Edge Function y sus módulos de _shared en UN solo archivo (para pegarlo en el editor
// de funciones del panel de Supabase, que no resuelve imports entre carpetas).
// La fuente de verdad sigue siendo el código modular; esto solo genera copias en `.dist/` (ignorada por Git).
//
//   node supabase/functions/empaquetar.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const compartidos = ['tipos.ts', 'validar.ts', 'acciones.ts', 'servicio.ts', 'servir.ts']
const funciones = ['crear-organizacion', 'crear-usuario', 'resetear-clave', 'desactivar-usuario']

// Quita los imports entre módulos propios (incluidos los de varias líneas) y los "export" de nivel superior
const sinImportsLocales = (texto) => texto.replace(/^import\s[^;]*?from\s+'\.{1,2}\/[^']+'\s*;?\s*\n/gm, '')
const sinExport = (texto) => texto.replace(/^export\s+(?!default)/gm, '')

const modulos = compartidos.map((archivo) => {
  const texto = readFileSync(join(aqui, '_shared', archivo), 'utf8')
  return `// ===== _shared/${archivo} =====\n${sinExport(sinImportsLocales(texto)).trim()}\n`
})

mkdirSync(join(aqui, '.dist'), { recursive: true })
for (const nombre of funciones) {
  const principal = sinImportsLocales(readFileSync(join(aqui, nombre, 'index.ts'), 'utf8')).trim()
  const salida = [
    `// IPPONIA · Edge Function "${nombre}" (archivo único generado por empaquetar.mjs; no editar a mano)`,
    "import { createClient } from 'npm:@supabase/supabase-js@2'",
    '',
    ...modulos,
    `// ===== ${nombre}/index.ts =====`,
    principal,
    '',
  ].join('\n')
  writeFileSync(join(aqui, '.dist', `${nombre}.ts`), salida)
  console.log(`OK ${nombre}: ${salida.length} caracteres`)
}
