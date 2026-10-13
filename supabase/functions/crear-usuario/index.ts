// POST /functions/v1/crear-usuario   { nombre_usuario, clave, nombre_visible? }
// Crea un usuario interno de la organización de quien llama (requiere gestionar_usuarios).
import { crearUsuario } from '../_shared/acciones.ts'
import { servir } from '../_shared/servir.ts'

Deno.serve(servir((srv, cuerpo) => crearUsuario(srv, cuerpo)))
