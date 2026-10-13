// Envoltorio común de las Edge Functions: CORS, método, JSON, errores y autenticación.
import { crearServicio } from './servicio.ts'
import { ErrorNegocio, type Servicio } from './tipos.ts'

// Sitios desde los que se puede llamar a las funciones. Se puede cambiar con la variable
// ORIGENES_PERMITIDOS (separados por coma) sin tocar el código.
const ORIGENES_POR_DEFECTO = ['https://melquiadesiguini.github.io', 'http://localhost:5183', 'http://localhost:5173']

function origenesPermitidos(): string[] {
  const extra = Deno.env.get('ORIGENES_PERMITIDOS')
  return extra ? extra.split(',').map((o) => o.trim()).filter(Boolean) : ORIGENES_POR_DEFECTO
}

export const sitioUrl = () => Deno.env.get('SITIO_URL') ?? 'https://melquiadesiguini.github.io/ipponia'

function cabeceras(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin') ?? ''
  const base: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  }
  // solo se refleja el origen si está en la lista (nunca "*")
  if (origenesPermitidos().includes(origen)) base['Access-Control-Allow-Origin'] = origen
  return base
}

const responder = (req: Request, status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: cabeceras(req) })

export function servir(accion: (srv: Servicio, cuerpo: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(req) })
    if (req.method !== 'POST') return responder(req, 405, { ok: false, error: 'Método no permitido.' })

    try {
      const cuerpo = await req.json().catch(() => null)
      if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new ErrorNegocio(400, 'Solicitud inválida.')
      const srv = await crearServicio(req)
      const resultado = await accion(srv, cuerpo as Record<string, unknown>)
      return responder(req, 200, { ok: true, ...resultado })
    } catch (error) {
      if (error instanceof ErrorNegocio) return responder(req, error.status, { ok: false, error: error.message })
      // el detalle técnico queda en los logs de Supabase; al usuario no se le muestra
      console.error('Error inesperado:', error)
      return responder(req, 500, { ok: false, error: 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.' })
    }
  }
}
