// Pruebas de la lógica de las Edge Functions con un Servicio simulado en memoria.
//   npm run test:functions        (usa Deno vía npx)
import assert from 'node:assert/strict'
import { crearOrganizacion, crearUsuario, desactivarUsuario, resetearClave } from './acciones.ts'
import { ErrorNegocio, type Organizacion, type Perfil, type Servicio } from './tipos.ts'
import { emailInterno, validarClave, validarSlug, validarUsuario } from './validar.ts'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const HOY = new Date().toISOString().slice(0, 10)
const AYER = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
const MANANA = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

// ---- Mundo simulado ---------------------------------------------------------------------
class Mundo {
  orgs = new Map<string, Organizacion>()
  perfiles = new Map<string, Perfil & { debe_cambiar_clave?: boolean; creado_por?: string }>()
  authEmails = new Map<string, string>() // id -> email
  claves = new Map<string, string>()
  bloqueados = new Set<string>()
  sesionesCerradas: string[] = []
  auditoria: { actor_id: string; accion: string; organizacion_id: string | null; detalle?: Record<string, unknown> }[] = []
  invitaciones: { email: string; redirectTo: string }[] = []
  duenos = new Map<string, string>()
  fallar: Partial<Record<'crearPerfil' | 'registrarDueno', boolean>> = {}
  siguiente = 1000
  permisos = new Map<string, Set<string>>() // usuario -> permisos (de la organización)
  superadmins = new Set<string>()

  nuevoId = () => uuid(this.siguiente++)

  org(id: number, slug: string, extra: Partial<Organizacion> = {}) {
    const o: Organizacion = { id: uuid(id), slug, nombre: slug.toUpperCase(), estado: 'activa', vence_el: null, ...extra }
    this.orgs.set(o.id, o)
    return o
  }
  perfil(id: number, org: Organizacion, extra: Partial<Perfil> = {}, permisos: string[] = []) {
    const p: Perfil = { usuario_id: uuid(id), organizacion_id: org.id, nombre_usuario: `usuario${id}`, es_dueno: false, activo: true, ...extra }
    this.perfiles.set(p.usuario_id, p)
    this.authEmails.set(p.usuario_id, emailInterno(p.nombre_usuario ?? 'dueno', org.slug))
    this.permisos.set(p.usuario_id, new Set(permisos))
    return p
  }
  auditadas = (accion: string) => this.auditoria.filter((a) => a.accion === accion)

  servicio(llamador: string): Servicio {
    const m = this
    return {
      usuarioLlamador: llamador,
      tienePermiso: async (permiso) => m.permisos.get(llamador)?.has(permiso) ?? false,
      esSuperadmin: async () => m.superadmins.has(llamador),
      perfil: async (id) => m.perfiles.get(id) ?? null,
      organizacion: async (id) => m.orgs.get(id) ?? null,
      crearUsuarioAuth: async (email, clave) => {
        if ([...m.authEmails.values()].includes(email)) throw new ErrorNegocio(409, 'Ya existe una cuenta con ese nombre de usuario o email.')
        const id = m.nuevoId()
        m.authEmails.set(id, email)
        m.claves.set(id, clave)
        return id
      },
      invitarUsuarioAuth: async (email, redirectTo) => {
        if ([...m.authEmails.values()].includes(email)) throw new ErrorNegocio(409, 'Ya existe una cuenta con ese email.')
        const id = m.nuevoId()
        m.authEmails.set(id, email)
        m.invitaciones.push({ email, redirectTo })
        return id
      },
      cambiarClaveAuth: async (id, clave) => void m.claves.set(id, clave),
      bloquearAuth: async (id, bloqueado) => void (bloqueado ? m.bloqueados.add(id) : m.bloqueados.delete(id)),
      borrarUsuarioAuth: async (id) => void (m.authEmails.delete(id), m.claves.delete(id)),
      cerrarSesiones: async (id) => void m.sesionesCerradas.push(id),
      crearPerfil: async (d) => {
        if (m.fallar.crearPerfil) throw new Error('falla simulada')
        const dup = [...m.perfiles.values()].some((p) => p.organizacion_id === d.organizacion_id && p.nombre_usuario === d.nombre_usuario)
        if (dup) throw new ErrorNegocio(409, 'Ya existe un usuario con ese nombre en tu organización.')
        m.perfiles.set(d.usuario_id, { usuario_id: d.usuario_id, organizacion_id: d.organizacion_id, nombre_usuario: d.nombre_usuario, es_dueno: false, activo: true, debe_cambiar_clave: d.debe_cambiar_clave, creado_por: d.creado_por })
      },
      actualizarPerfil: async (id, cambios) => void m.perfiles.set(id, { ...m.perfiles.get(id)!, ...cambios }),
      crearOrganizacion: async ({ slug, nombre, vence_el }) => {
        if ([...m.orgs.values()].some((o) => o.slug === slug)) throw new ErrorNegocio(409, 'Ya existe una organización con ese identificador.')
        const id = m.nuevoId()
        m.orgs.set(id, { id, slug, nombre, estado: vence_el ? 'prueba' : 'activa', vence_el })
        return id
      },
      registrarDueno: async (org, usuario) => {
        if (m.fallar.registrarDueno) throw new Error('falla simulada')
        m.duenos.set(org, usuario)
        m.perfiles.set(usuario, { usuario_id: usuario, organizacion_id: org, nombre_usuario: null, es_dueno: true, activo: true })
      },
      borrarOrganizacion: async (id) => void m.orgs.delete(id),
      auditar: async (e) => void m.auditoria.push(e),
      contarAcciones: async (actor, accion) => m.auditoria.filter((a) => a.actor_id === actor && a.accion === accion).length,
    }
  }
}

// Escenario base: dos organizaciones; admin y dueño en cada una; un juez sin permisos
function escenario() {
  const m = new Mundo()
  const A = m.org(1, 'fakko')
  const B = m.org(2, 'otra-fed')
  const admin = m.perfil(10, A, { nombre_usuario: 'admin1' }, ['gestionar_usuarios', 'gestionar_roles'])
  const dueno = m.perfil(11, A, { nombre_usuario: null, es_dueno: true }, ['gestionar_usuarios', 'gestionar_roles'])
  const juez = m.perfil(12, A, { nombre_usuario: 'juez1' }, ['puntuar_kata'])
  const adminB = m.perfil(20, B, { nombre_usuario: 'adminb' }, ['gestionar_usuarios'])
  const juezB = m.perfil(21, B, { nombre_usuario: 'juezb' }, [])
  return { m, A, B, admin, dueno, juez, adminB, juezB }
}

async function rechaza(promesa: Promise<unknown>, status: number, patron?: RegExp) {
  try {
    await promesa
  } catch (e) {
    assert.ok(e instanceof ErrorNegocio, `se esperaba ErrorNegocio y fue: ${e}`)
    assert.equal(e.status, status, `estado esperado ${status}, fue ${e.status} (${e.message})`)
    if (patron) assert.match(e.message, patron)
    return
  }
  assert.fail(`se esperaba un rechazo ${status}, pero la operación se hizo`)
}

// ---- Validaciones -----------------------------------------------------------------------
Deno.test('validar: usuario, clave y slug', () => {
  assert.equal(validarUsuario('  Juez.Uno-2 '), 'juez.uno-2')
  for (const malo of ['ab', 'Juez Uno', 'juez!', 'a'.repeat(31), '', null, 12]) assert.throws(() => validarUsuario(malo), ErrorNegocio)
  assert.equal(validarClave('Contra-2026'), 'Contra-2026')
  for (const mala of ['corta', '12345678', ' conespacios ', 'a'.repeat(73), 'Password', 7]) assert.throws(() => validarClave(mala), ErrorNegocio)
  assert.throws(() => validarClave('juez.uno-2', 'juez.uno-2'), ErrorNegocio, 'igual al usuario')
  assert.equal(validarSlug('Fakko'), 'fakko')
  for (const malo of ['kata', 'ipponia', '-abc', 'ab', 'con espacio', 'a'.repeat(41)]) assert.throws(() => validarSlug(malo), ErrorNegocio)
  assert.equal(emailInterno('Juez1', 'FAKKO'), 'juez1@fakko.ipponia.internal')
})

// ---- crear-usuario ----------------------------------------------------------------------
Deno.test('crearUsuario: un admin crea un usuario en SU organización', async () => {
  const { m, A, admin } = escenario()
  const r = await crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'Kansa.1', clave: 'Inicial-2026', nombre_visible: 'Kansa Uno' })
  const creado = m.perfiles.get(r.usuario.id)!
  assert.equal(creado.organizacion_id, A.id)
  assert.equal(creado.nombre_usuario, 'kansa.1')
  assert.equal(creado.debe_cambiar_clave, true, 'obliga a cambiar la clave inicial')
  assert.equal(m.authEmails.get(r.usuario.id), 'kansa.1@fakko.ipponia.internal', 'email interno sintético')
  assert.equal(m.auditadas('crear_usuario').length, 1)
})

Deno.test('crearUsuario: ignora una organizacion_id enviada en el cuerpo (nunca se confía en el cliente)', async () => {
  const { m, A, B, admin } = escenario()
  const r = await crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'intruso', clave: 'Inicial-2026', organizacion_id: B.id })
  assert.equal(m.perfiles.get(r.usuario.id)!.organizacion_id, A.id)
})

Deno.test('crearUsuario: sin permiso no se crea nada', async () => {
  const { m, juez } = escenario()
  const antes = m.authEmails.size
  await rechaza(crearUsuario(m.servicio(juez.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 403)
  assert.equal(m.authEmails.size, antes)
})

Deno.test('crearUsuario: llamador sin perfil, desactivado o de organización suspendida/vencida', async () => {
  const { m, A, admin } = escenario()
  await rechaza(crearUsuario(m.servicio(uuid(999)), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 403)
  m.perfiles.set(admin.usuario_id, { ...admin, activo: false })
  await rechaza(crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 403)
  m.perfiles.set(admin.usuario_id, { ...admin, activo: true })
  m.orgs.set(A.id, { ...A, estado: 'suspendida' })
  await rechaza(crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 403, /suspendido/)
  m.orgs.set(A.id, { ...A, vence_el: AYER })
  await rechaza(crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 403, /vencido/)
  m.orgs.set(A.id, { ...A, vence_el: MANANA })
  await crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }) // en prueba y vigente: sí
})

Deno.test('crearUsuario: datos inválidos y duplicados', async () => {
  const { m, admin, juezB } = escenario()
  const s = () => m.servicio(admin.usuario_id)
  await rechaza(crearUsuario(s(), { nombre_usuario: 'a', clave: 'Inicial-2026' }), 400)
  await rechaza(crearUsuario(s(), { nombre_usuario: 'bien.1', clave: 'corta' }), 400)
  await rechaza(crearUsuario(s(), { nombre_usuario: 'bien.1', clave: 'bien.1' }), 400)
  await rechaza(crearUsuario(s(), { nombre_usuario: 'juez1', clave: 'Inicial-2026' }), 409) // ya existe en la organización
  // el mismo nombre de usuario SÍ se puede usar en otra organización
  const otra = await crearUsuario(m.servicio(uuid(20)), { nombre_usuario: 'juezb2', clave: 'Inicial-2026' })
  assert.ok(otra.usuario.id)
  assert.ok(juezB)
})

Deno.test('crearUsuario: si falla el perfil se deshace la cuenta (sin cuentas huérfanas)', async () => {
  const { m, admin } = escenario()
  const antes = m.authEmails.size
  m.fallar.crearPerfil = true
  await assert.rejects(crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }))
  assert.equal(m.authEmails.size, antes)
})

Deno.test('crearUsuario: límite de acciones seguidas', async () => {
  const { m, admin } = escenario()
  for (let i = 0; i < 30; i++) m.auditoria.push({ actor_id: admin.usuario_id, accion: 'crear_usuario', organizacion_id: null })
  await rechaza(crearUsuario(m.servicio(admin.usuario_id), { nombre_usuario: 'nuevo1', clave: 'Inicial-2026' }), 429)
})

// ---- resetear-clave ---------------------------------------------------------------------
Deno.test('resetearClave: el admin cambia la clave, obliga a cambiarla y cierra sesiones', async () => {
  const { m, admin, juez } = escenario()
  await resetearClave(m.servicio(admin.usuario_id), { usuario_id: juez.usuario_id, clave: 'Nueva-2026!' })
  assert.equal(m.claves.get(juez.usuario_id), 'Nueva-2026!')
  assert.equal((m.perfiles.get(juez.usuario_id) as { debe_cambiar_clave?: boolean }).debe_cambiar_clave, true)
  assert.deepEqual(m.sesionesCerradas, [juez.usuario_id])
  assert.equal(m.auditadas('resetear_clave').length, 1)
})

Deno.test('resetearClave: no se puede sobre otra organización, ni sobre uno mismo, ni sobre el dueño', async () => {
  const { m, admin, dueno, juezB } = escenario()
  const s = m.servicio(admin.usuario_id)
  await rechaza(resetearClave(s, { usuario_id: juezB.usuario_id, clave: 'Nueva-2026!' }), 404)
  assert.equal(m.claves.has(juezB.usuario_id), false, 'no se tocó la clave de otra organización')
  await rechaza(resetearClave(s, { usuario_id: uuid(555), clave: 'Nueva-2026!' }), 404)
  await rechaza(resetearClave(s, { usuario_id: admin.usuario_id, clave: 'Nueva-2026!' }), 400)
  await rechaza(resetearClave(s, { usuario_id: dueno.usuario_id, clave: 'Nueva-2026!' }), 403)
  assert.equal(m.sesionesCerradas.length, 0)
})

Deno.test('resetearClave: sin permiso, clave débil o id inválido', async () => {
  const { m, admin, juez } = escenario()
  await rechaza(resetearClave(m.servicio(juez.usuario_id), { usuario_id: admin.usuario_id, clave: 'Nueva-2026!' }), 403)
  await rechaza(resetearClave(m.servicio(admin.usuario_id), { usuario_id: juez.usuario_id, clave: '1234' }), 400)
  await rechaza(resetearClave(m.servicio(admin.usuario_id), { usuario_id: 'no-es-uuid', clave: 'Nueva-2026!' }), 400)
})

// ---- desactivar-usuario -----------------------------------------------------------------
Deno.test('desactivarUsuario: desactiva, bloquea el acceso y cierra sesiones; luego reactiva', async () => {
  const { m, admin, juez } = escenario()
  const s = m.servicio(admin.usuario_id)
  await desactivarUsuario(s, { usuario_id: juez.usuario_id, activo: false })
  assert.equal(m.perfiles.get(juez.usuario_id)!.activo, false)
  assert.ok(m.bloqueados.has(juez.usuario_id))
  assert.deepEqual(m.sesionesCerradas, [juez.usuario_id])
  await desactivarUsuario(s, { usuario_id: juez.usuario_id, activo: true })
  assert.equal(m.perfiles.get(juez.usuario_id)!.activo, true)
  assert.ok(!m.bloqueados.has(juez.usuario_id))
  assert.equal(m.sesionesCerradas.length, 1, 'reactivar no cierra sesiones')
})

Deno.test('desactivarUsuario: otra organización, dueño, uno mismo, sin permiso, datos inválidos', async () => {
  const { m, admin, dueno, juez, juezB } = escenario()
  const s = m.servicio(admin.usuario_id)
  await rechaza(desactivarUsuario(s, { usuario_id: juezB.usuario_id, activo: false }), 404)
  assert.equal(m.perfiles.get(juezB.usuario_id)!.activo, true)
  await rechaza(desactivarUsuario(s, { usuario_id: dueno.usuario_id, activo: false }), 403)
  await rechaza(desactivarUsuario(s, { usuario_id: admin.usuario_id, activo: false }), 400)
  await rechaza(desactivarUsuario(m.servicio(juez.usuario_id), { usuario_id: admin.usuario_id, activo: false }), 403)
  await rechaza(desactivarUsuario(s, { usuario_id: juez.usuario_id, activo: 'si' }), 400)
  assert.equal(m.bloqueados.size, 0)
})

// ---- crear-organizacion -----------------------------------------------------------------
const SITIO = 'https://sitio.test/ipponia'
const nueva = { slug: 'Nueva-Fed', nombre: 'Nueva Federación', email_dueno: 'Dueno@Nueva.org' }

Deno.test('crearOrganizacion: solo el superadmin (ni un admin de organización puede)', async () => {
  const { m, admin, dueno } = escenario()
  await rechaza(crearOrganizacion(m.servicio(admin.usuario_id), nueva, SITIO), 403)
  await rechaza(crearOrganizacion(m.servicio(dueno.usuario_id), nueva, SITIO), 403)
  assert.equal([...m.orgs.values()].some((o) => o.slug === 'nueva-fed'), false)
})

Deno.test('crearOrganizacion: con contraseña inicial crea el dueño, que debe cambiarla', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  const r = await crearOrganizacion(m.servicio(uuid(1)), { ...nueva, clave: 'Inicial-2026', vence_el: MANANA }, SITIO)
  assert.equal(r.organizacion.slug, 'nueva-fed')
  assert.equal(r.modo, 'clave_inicial')
  const duenoId = m.duenos.get(r.organizacion.id)!
  assert.equal(m.authEmails.get(duenoId), 'dueno@nueva.org', 'el dueño entra con su email real')
  assert.equal((m.perfiles.get(duenoId) as { debe_cambiar_clave?: boolean }).debe_cambiar_clave, true)
  assert.equal(m.orgs.get(r.organizacion.id)!.estado, 'prueba')
  assert.equal(m.auditadas('crear_organizacion').length, 1)
})

Deno.test('crearOrganizacion: sin contraseña envía invitación por email al sitio correcto', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  const r = await crearOrganizacion(m.servicio(uuid(1)), nueva, SITIO)
  assert.equal(r.modo, 'invitacion')
  assert.deepEqual(m.invitaciones, [{ email: 'dueno@nueva.org', redirectTo: 'https://sitio.test/ipponia/restablecer' }])
})

Deno.test('crearOrganizacion: datos inválidos no crean nada', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  const s = m.servicio(uuid(1))
  const cantidad = m.orgs.size
  await rechaza(crearOrganizacion(s, { ...nueva, slug: 'kata' }, SITIO), 400, /reservado/)
  await rechaza(crearOrganizacion(s, { ...nueva, slug: 'Mal Slug' }, SITIO), 400)
  await rechaza(crearOrganizacion(s, { ...nueva, email_dueno: 'no-es-email' }, SITIO), 400)
  await rechaza(crearOrganizacion(s, { ...nueva, nombre: '   ' }, SITIO), 400)
  await rechaza(crearOrganizacion(s, { ...nueva, clave: 'corta' }, SITIO), 400)
  await rechaza(crearOrganizacion(s, { ...nueva, vence_el: AYER }, SITIO), 400)
  await rechaza(crearOrganizacion(s, { ...nueva, vence_el: '31/12/2026' }, SITIO), 400)
  assert.equal(m.orgs.size, cantidad)
  assert.ok(HOY)
})

Deno.test('crearOrganizacion: identificador repetido', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  await rechaza(crearOrganizacion(m.servicio(uuid(1)), { ...nueva, slug: 'fakko' }, SITIO), 409)
})

Deno.test('crearOrganizacion: si el email del dueño ya existe se deshace la organización', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  m.authEmails.set(uuid(777), 'dueno@nueva.org')
  const cantidad = m.orgs.size
  await rechaza(crearOrganizacion(m.servicio(uuid(1)), { ...nueva, clave: 'Inicial-2026' }, SITIO), 409)
  assert.equal(m.orgs.size, cantidad, 'la organización no queda a medias')
})

Deno.test('crearOrganizacion: si falla registrar al dueño se deshace todo (organización y cuenta)', async () => {
  const { m } = escenario()
  m.superadmins.add(uuid(1))
  const orgs = m.orgs.size
  const cuentas = m.authEmails.size
  m.fallar.registrarDueno = true
  await assert.rejects(crearOrganizacion(m.servicio(uuid(1)), { ...nueva, clave: 'Inicial-2026' }, SITIO))
  assert.equal(m.orgs.size, orgs)
  assert.equal(m.authEmails.size, cuentas)
})
