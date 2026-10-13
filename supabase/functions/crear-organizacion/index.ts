// POST /functions/v1/crear-organizacion   { slug, nombre, email_dueno, clave?, vence_el? }
// Alta de un cliente. Solo el superadmin de la plataforma.
import { crearOrganizacion } from '../_shared/acciones.ts'
import { servir, sitioUrl } from '../_shared/servir.ts'

Deno.serve(servir((srv, cuerpo) => crearOrganizacion(srv, cuerpo, sitioUrl())))
