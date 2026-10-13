// POST /functions/v1/desactivar-usuario   { usuario_id, activo }
// Desactiva (activo=false) o reactiva (activo=true) un usuario de la organización de quien llama.
import { desactivarUsuario } from '../_shared/acciones.ts'
import { servir } from '../_shared/servir.ts'

Deno.serve(servir((srv, cuerpo) => desactivarUsuario(srv, cuerpo)))
