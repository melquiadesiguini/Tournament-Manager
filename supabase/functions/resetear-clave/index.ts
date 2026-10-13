// POST /functions/v1/resetear-clave   { usuario_id, clave }
// Un admin (gestionar_usuarios) pone una contraseña nueva a un usuario interno de su organización.
import { resetearClave } from '../_shared/acciones.ts'
import { servir } from '../_shared/servir.ts'

Deno.serve(servir((srv, cuerpo) => resetearClave(srv, cuerpo)))
