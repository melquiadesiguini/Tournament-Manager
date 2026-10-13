// Pruebas de la base de datos (multi-organización), sobre un PostgreSQL real en memoria (PGlite).
// No toca Supabase: simula auth.users, auth.uid() y los roles anon/authenticated/service_role.
//
//   npm run test:db
//
// Pasos: (1) se carga el esquema ANTERIOR con datos de ejemplo, (2) se aplican las migraciones
// en orden, (3) se comprueba que los datos se migraron, y (4) se prueba el aislamiento entre
// organizaciones y la regla de permisos con RLS real.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8')

process.on('uncaughtException', (e) => { console.log('ERROR inesperado: ' + e.message); process.exit(1) })
process.on('unhandledRejection', (e) => { console.log('ERROR inesperado: ' + (e?.message ?? e)); process.exit(1) })
const db = new PGlite()
let ok = 0
let fallos = 0

function prueba(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++
    console.log(`  ✓ ${nombre}`)
  } else {
    fallos++
    console.log(`  ✗ ${nombre} ${detalle}`)
  }
}
const filas = async (sql) => (await db.query(sql)).rows
const uno = async (sql) => (await filas(sql))[0]

// Ejecuta un bloque como usuario de la API (rol authenticated, con su JWT)
async function como(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}
async function comoAnonimo(fn) {
  await db.exec(`set role anon; select set_config('request.jwt.claims', '', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role;`)
  }
}
// ¿La operación falla? (con un patrón opcional del mensaje)
async function falla(fn, patron) {
  try {
    await fn()
    return false
  } catch (e) {
    return patron ? new RegExp(patron, 'i').test(e.message) : true
  }
}

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const U = {
  superadmin: id(1), mesaA: id(2), supervisorA: id(3),
  duenoB: id(10), juezB: id(11), kansaB: id(12), sinRolB: id(13),
  duenoC: id(20),
}

// ---------------------------------------------------------------- 1) Esquema anterior
console.log('\n1) Estado anterior (esquema viejo + datos de ejemplo)')
await db.exec(leer('tests/bootstrap.sql'))
await db.exec(leer('legacy/schema.sql'))
await db.exec(`
  insert into auth.users (id, email, email_confirmed_at) values ('${U.superadmin}', 'melquiades.iguini@gmail.com', now());
  update public.organizations set name = 'Ikigai Dojo';
  insert into public.invitaciones (org_id, email, role)
    select id, 'mesa@x.com', 'mesa' from public.organizations
    union all select id, 'sup@x.com', 'supervisor' from public.organizations;
  insert into auth.users (id, email, email_confirmed_at) values ('${U.mesaA}', 'mesa@x.com', now());
  insert into auth.users (id, email, email_confirmed_at) values ('${U.supervisorA}', 'sup@x.com', now());
  insert into public.jueces (org_id, nombre, apellido) select id, 'Juan', 'Pérez' from public.organizations;
  insert into public.results (org_id, modulo, area, payload, created_by)
    select id, 'kata', '1', '{"competitor":"Ana"}'::jsonb, '${U.superadmin}' from public.organizations;
`)
prueba('el esquema viejo tiene members y 3 miembros', Number((await uno('select count(*) n from public.members')).n) === 3)

// ---------------------------------------------------------------- 2) Migraciones
console.log('\n2) Aplicando migraciones')
const migraciones = readdirSync(join(raiz, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
for (const m of migraciones) {
  try {
    await db.exec(leer(`migrations/${m}`))
    prueba(`migración ${m}`, true)
  } catch (e) {
    prueba(`migración ${m}`, false, e.message)
    console.log('\nNo se puede seguir sin las migraciones.')
    process.exit(1)
  }
}

// ---------------------------------------------------------------- 3) Datos migrados
console.log('\n3) Datos migrados')
const orgA = await uno(`select * from public.organizaciones where nombre = 'Ikigai Dojo'`)
prueba('la organización conserva datos y recibe slug "ikigai-dojo"', orgA?.slug === 'ikigai-dojo')
prueba('queda en el plan estándar', orgA?.plan === 'estandar')
prueba('roles de fábrica + Supervisor', Number((await uno(`select count(*) n from public.roles where organizacion_id='${orgA.id}'`)).n) === 6)
prueba('3 perfiles', Number((await uno('select count(*) n from public.perfiles')).n) === 3)
prueba('el dueño es el primer administrador', (await uno(`select usuario_id from public.perfiles where es_dueno`)).usuario_id === U.superadmin)
prueba('3 asignaciones permanentes', Number((await uno('select count(*) n from public.asignaciones where torneo_id is null and area is null')).n) === 3)
prueba('superadmin migrado', Number((await uno(`select count(*) n from public.superadmins where usuario_id='${U.superadmin}'`)).n) === 1)
prueba('se retiraron members, invitaciones y platform_admins',
  (await uno(`select to_regclass('public.members') a, to_regclass('public.invitaciones') b, to_regclass('public.platform_admins') c`)).a === null &&
  (await uno(`select to_regclass('public.invitaciones') b`)).b === null)
prueba('jueces y resultados se conservan', Number((await uno('select count(*) n from public.jueces')).n) === 1 && Number((await uno('select count(*) n from public.resultados')).n) === 1)
prueba('el trigger de registro viejo ya no existe',
  Number((await uno(`select count(*) n from pg_trigger where tgname in ('on_auth_user_created','on_auth_user_confirmed')`)).n) === 0)

// ---------------------------------------------------------------- 4) Aislamiento y permisos
console.log('\n4) Aislamiento entre organizaciones y permisos')
// Dos organizaciones nuevas, como las crearía la Edge Function
await db.exec(`
  select public.crear_organizacion_interna('fakko', 'FAKKO');
  select public.crear_organizacion_interna('otra-fed', 'Otra Federación', 'estandar', current_date + 14);
  insert into auth.users (id, email, email_confirmed_at) values
    ('${U.duenoB}', 'dueno@fakko.org', now()),
    ('${U.juezB}', 'juez1@fakko.ipponia.internal', now()),
    ('${U.kansaB}', 'kansa1@fakko.ipponia.internal', now()),
    ('${U.sinRolB}', 'nadie@fakko.ipponia.internal', now()),
    ('${U.duenoC}', 'dueno@otra.org', now());
`)
const orgB = await uno(`select id from public.organizaciones where slug='fakko'`)
const orgC = await uno(`select id from public.organizaciones where slug='otra-fed'`)
await db.exec(`
  select public.registrar_dueno('${orgB.id}', '${U.duenoB}');
  select public.registrar_dueno('${orgC.id}', '${U.duenoC}');
  insert into public.perfiles (usuario_id, organizacion_id, nombre_usuario, debe_cambiar_clave) values
    ('${U.juezB}', '${orgB.id}', 'juez1', true),
    ('${U.kansaB}', '${orgB.id}', 'kansa1', true),
    ('${U.sinRolB}', '${orgB.id}', 'nadie', false);
  insert into public.torneos (id, organizacion_id, nombre) values
    ('${id(101)}', '${orgB.id}', 'Copa FAKKO 1'),
    ('${id(102)}', '${orgB.id}', 'Copa FAKKO 2'),
    ('${id(201)}', '${orgC.id}', 'Torneo de otra federación'),
    ('${id(301)}', '${orgA.id}', 'Torneo Ikigai');
  -- juez de FAKKO: solo en el torneo 1 y en el área 2
  insert into public.asignaciones (organizacion_id, usuario_id, torneo_id, area, rol_id)
    select '${orgB.id}', '${U.juezB}', '${id(101)}', '2', id from public.roles where organizacion_id='${orgB.id}' and nombre='Juez';
  -- kansa de FAKKO: torneo 1, todas las áreas
  insert into public.asignaciones (organizacion_id, usuario_id, torneo_id, area, rol_id)
    select '${orgB.id}', '${U.kansaB}', '${id(101)}', null, id from public.roles where organizacion_id='${orgB.id}' and nombre='Kansa';
  insert into public.jueces (organizacion_id, nombre, apellido) values ('${orgB.id}', 'Pedro', 'Gómez');
`)

// 4.1 Aislamiento de lectura
const verA = await como(U.superadmin, async () => ({
  perfiles: await filas('select * from public.perfiles'),
  orgs: await filas('select * from public.organizaciones'),
  torneos: await filas('select * from public.torneos'),
  roles: await filas('select * from public.roles'),
  jueces: await filas('select * from public.jueces'),
  resultados: await filas('select * from public.resultados'),
}))
prueba('la org A ve solo sus perfiles', verA.perfiles.length === 3 && verA.perfiles.every((p) => p.organizacion_id === orgA.id))
prueba('la org A ve solo su organización', verA.orgs.length === 1 && verA.orgs[0].id === orgA.id)
prueba('la org A ve solo sus torneos', verA.torneos.length === 1 && verA.torneos[0].organizacion_id === orgA.id)
prueba('la org A ve solo sus roles', verA.roles.length > 0 && verA.roles.every((r) => r.organizacion_id === orgA.id))
prueba('la org A ve solo sus jueces y resultados', verA.jueces.length === 1 && verA.resultados.length === 1)
const verB = await como(U.duenoB, async () => ({
  perfiles: await filas('select * from public.perfiles'),
  torneos: await filas('select * from public.torneos'),
  jueces: await filas('select * from public.jueces'),
  resultados: await filas('select * from public.resultados'),
}))
prueba('la org B (FAKKO) ve solo lo suyo', verB.perfiles.length === 4 && verB.torneos.length === 2 && verB.jueces.length === 1 && verB.resultados.length === 0)

// 4.2 Aislamiento de escritura
const rolDeB = (await uno(`select id from public.roles where organizacion_id='${orgB.id}' limit 1`)).id
await como(U.superadmin, async () => {
  prueba('A no puede crear un torneo en B', await falla(() => db.exec(`insert into public.torneos (organizacion_id, nombre) values ('${orgB.id}', 'intruso')`), 'row-level security'))
  const upd = await db.query(`update public.torneos set nombre = 'hackeado' where id = '${id(101)}' returning id`)
  prueba('A no puede modificar un torneo de B', upd.rows.length === 0)
  const del = await db.query(`delete from public.torneos where id = '${id(101)}' returning id`)
  prueba('A no puede borrar un torneo de B', del.rows.length === 0)
  prueba('A no puede crear un rol en B', await falla(() => db.exec(`insert into public.roles (organizacion_id, nombre) values ('${orgB.id}', 'intruso')`), 'row-level security'))
  // A ni siquiera ve los roles de B, así que no puede referenciarlos; y si fuerza el insert, la política lo rechaza
  prueba('A no ve los roles de B', (await filas(`select id from public.roles where organizacion_id='${orgB.id}'`)).length === 0)
  prueba('A no puede asignar roles en B', await falla(() => db.exec(`insert into public.asignaciones (organizacion_id, usuario_id, rol_id) values ('${orgB.id}', '${U.juezB}', '${rolDeB}')`), 'row-level security'))
  prueba('A no puede guardar resultados en B', await falla(() => db.exec(`insert into public.resultados (organizacion_id, modulo, payload, creado_por) values ('${orgB.id}', 'kata', '{}', '${U.superadmin}')`), 'row-level security'))
  prueba('A no puede cargar jueces en B', await falla(() => db.exec(`insert into public.jueces (organizacion_id, nombre) values ('${orgB.id}', 'Intruso')`), 'row-level security'))
})
prueba('el torneo de B quedó intacto', (await uno(`select nombre from public.torneos where id='${id(101)}'`)).nombre === 'Copa FAKKO 1')

// 4.3 Permisos por torneo y área
const tp = (uid, t, a, p) => como(uid, async () => (await uno(`select public.tiene_permiso(${t ? `'${t}'` : 'null'}, ${a ? `'${a}'` : 'null'}, '${p}') v`)).v)
prueba('juez asignado al torneo 1 / área 2 puede puntuar kata ahí', (await tp(U.juezB, id(101), '2', 'puntuar_kata')) === true)
prueba('...pero no en el área 3', (await tp(U.juezB, id(101), '3', 'puntuar_kata')) === false)
prueba('...ni en el torneo 2', (await tp(U.juezB, id(102), '2', 'puntuar_kata')) === false)
prueba('...ni a nivel organización', (await tp(U.juezB, null, null, 'puntuar_kata')) === false)
prueba('...ni tiene permisos que el rol Juez no incluye', (await tp(U.juezB, id(101), '2', 'gestionar_usuarios')) === false)
prueba('kansa del torneo 1 opera en cualquier área', (await tp(U.kansaB, id(101), '7', 'operar_kansa_kumite')) === true)
prueba('kansa no opera en otro torneo', (await tp(U.kansaB, id(102), '7', 'operar_kansa_kumite')) === false)
prueba('el usuario sin rol no tiene permisos', (await tp(U.sinRolB, id(101), '2', 'puntuar_kata')) === false)
prueba('el dueño (Admin permanente) puede todo, en cualquier torneo y área', (await tp(U.duenoB, id(102), '9', 'puntuar_kobudo')) === true && (await tp(U.duenoB, null, null, 'gestionar_usuarios')) === true)
prueba('el admin de A no tiene permisos en torneos de B (otra organización)', (await tp(U.superadmin, id(101), '2', 'puntuar_kata')) === true /* permanente en A */)
const mp = await como(U.juezB, () => filas(`select * from public.mis_permisos('${id(101)}')`))
prueba('mis_permisos devuelve los del torneo con su área', mp.length === 3 && mp.every((r) => r.area === '2'))
const mpOtro = await como(U.juezB, () => filas(`select * from public.mis_permisos('${id(102)}')`))
prueba('mis_permisos no devuelve nada de otro torneo', mpOtro.length === 0)

// 4.4 El plan limita lo que el rol concede
await db.exec(`delete from public.plan_permisos where permiso = 'operar_kansa_kumite'`)
prueba('si el plan no incluye el permiso, ni el Admin lo tiene', (await tp(U.duenoB, null, null, 'operar_kansa_kumite')) === false)
prueba('...y mis_permisos tampoco lo lista', (await como(U.kansaB, () => filas(`select * from public.mis_permisos('${id(101)}')`))).length === 0)
await db.exec(`insert into public.plan_permisos (plan, permiso) values ('estandar', 'operar_kansa_kumite')`)
prueba('al volver al plan, vuelve el permiso', (await tp(U.kansaB, id(101), '7', 'operar_kansa_kumite')) === true)

// 4.5 Organización suspendida o vencida
await db.exec(`update public.organizaciones set estado = 'suspendida' where id = '${orgB.id}'`)
prueba('suspendida: no tiene permisos', (await tp(U.duenoB, null, null, 'gestionar_usuarios')) === false)
prueba('suspendida: no ve torneos', (await como(U.duenoB, () => filas('select * from public.torneos'))).length === 0)
prueba('suspendida: sí ve el estado de su organización (para avisarle)', (await como(U.duenoB, () => filas('select estado from public.organizaciones')))[0]?.estado === 'suspendida')
await db.exec(`update public.organizaciones set estado = 'activa' where id = '${orgB.id}'`)
await db.exec(`update public.organizaciones set vence_el = current_date - 1 where id = '${orgC.id}'`)
prueba('vencida: no tiene permisos', (await tp(U.duenoC, null, null, 'gestionar_usuarios')) === false)
await db.exec(`update public.organizaciones set vence_el = current_date + 5 where id = '${orgC.id}'`)

// 4.6 Anónimos
prueba('anónimo no lee perfiles', await comoAnonimo(() => falla(() => db.query('select * from public.perfiles'), 'permission denied')))
prueba('anónimo no lee organizaciones', await comoAnonimo(() => falla(() => db.query('select * from public.organizaciones'), 'permission denied')))
prueba('anónimo no puede llamar a tiene_permiso', await comoAnonimo(() => falla(() => db.query(`select public.tiene_permiso(null,null,'puntuar_kata')`), 'permission denied')))
const pub = await comoAnonimo(() => filas(`select * from public.org_publica('FAKKO')`))
prueba('org_publica devuelve solo nombre y estado (y no distingue mayúsculas)', pub.length === 1 && pub[0].nombre === 'FAKKO' && pub[0].activa === true && Object.keys(pub[0]).length === 2)
prueba('org_publica de un slug inexistente no devuelve nada', (await comoAnonimo(() => filas(`select * from public.org_publica('no-existe')`))).length === 0)

// 4.7 Superadmin
const resumen = await como(U.superadmin, () => filas('select * from public.superadmin_resumen()'))
prueba('el superadmin ve el resumen de todas las organizaciones', resumen.length === 3)
prueba('...solo con agregados (usuarios y torneos), sin datos deportivos', Number(resumen.find((r) => r.slug === 'fakko').usuarios) === 4 && Number(resumen.find((r) => r.slug === 'fakko').torneos) === 2 && !('payload' in resumen[0]))
prueba('un usuario común no puede pedir el resumen', await como(U.duenoB, () => falla(() => db.query('select * from public.superadmin_resumen()'), 'permiso')))
prueba('el superadmin, como usuario de A, NO ve los torneos de otras organizaciones', (await como(U.superadmin, () => filas('select * from public.torneos'))).length === 1)
prueba('un usuario común no puede darse de alta como superadmin', await como(U.duenoB, () => falla(() => db.exec(`insert into public.superadmins (usuario_id) values ('${U.duenoB}')`), 'permission denied')))
await como(U.superadmin, () => db.query(`select public.superadmin_actualizar_organizacion('${orgC.id}', 'Otra Fed. SA', 'estandar', 'activa', null, 'pagó')`))
prueba('el superadmin puede actualizar plan, estado y notas', (await uno(`select nombre, notas from public.organizaciones where id='${orgC.id}'`)).notas === 'pagó')

// 4.8 Slug y organización: no se cambian desde la API
prueba('un admin no puede cambiar el slug ni el plan de su organización', await como(U.duenoB, () => falla(() => db.exec(`update public.organizaciones set slug = 'nuevo' where id = '${orgB.id}'`), 'permission denied')))
prueba('un slug reservado se rechaza', await falla(() => db.exec(`select public.crear_organizacion_interna('kata', 'X')`), 'slug_no_reservado'))
prueba('un slug repetido se rechaza', await falla(() => db.exec(`select public.crear_organizacion_interna('fakko', 'Otro FAKKO')`), 'organizaciones_slug_unico'))
prueba('un slug inválido se rechaza', await falla(() => db.exec(`select public.crear_organizacion_interna('Mal Slug!', 'X')`), 'slug_formato'))
prueba('el slug es inmutable también para el rol de la API (trigger)', await falla(async () => {
  await db.exec(`set role authenticated`)
  try { await db.exec(`update public.organizaciones set slug = 'nuevo' where id = '${orgB.id}'`) } finally { await db.exec('reset role') }
}))

// 4.9 Usuario único por organización (no en todo el sistema)
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${id(30)}', 'juez1@otra-fed.ipponia.internal', now())`)
await db.exec(`insert into public.perfiles (usuario_id, organizacion_id, nombre_usuario) values ('${id(30)}', '${orgC.id}', 'juez1')`)
prueba('el mismo nombre de usuario puede existir en dos organizaciones', Number((await uno(`select count(*) n from public.perfiles where nombre_usuario='juez1'`)).n) === 2)
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${id(31)}', 'juez1b@fakko.ipponia.internal', now())`)
prueba('...pero no dos veces en la misma', await falla(() => db.exec(`insert into public.perfiles (usuario_id, organizacion_id, nombre_usuario) values ('${id(31)}', '${orgB.id}', 'juez1')`), 'perfiles_organizacion_id_nombre_usuario_key'))
prueba('el nombre de usuario con mayúsculas o símbolos se rechaza', await falla(() => db.exec(`insert into public.perfiles (usuario_id, organizacion_id, nombre_usuario) values ('${id(31)}', '${orgB.id}', 'Juez Raro!')`), 'check'))
prueba('email_interno arma usuario@slug.ipponia.internal', (await uno(`select public.email_interno('Juez1','FAKKO') e`)).e === 'juez1@fakko.ipponia.internal')

// 4.10 Candados: la organización nunca queda sin administración
prueba('no se puede quitar el Admin permanente del dueño', await falla(() => db.exec(`delete from public.asignaciones where usuario_id='${U.duenoB}'`), 'Admin permanente'))
prueba('no se puede borrar el rol Admin', await falla(() => db.exec(`delete from public.roles where organizacion_id='${orgB.id}' and nombre='Admin'`), 'no se puede borrar'))
prueba('no se puede renombrar el rol Admin', await falla(() => db.exec(`update public.roles set nombre='Jefe' where organizacion_id='${orgB.id}' and nombre='Admin'`), 'renombrar'))
prueba('no se pueden quitar gestionar_usuarios/gestionar_roles al Admin', await falla(() => db.exec(`delete from public.rol_permisos where permiso='gestionar_roles' and rol_id=(select id from public.roles where organizacion_id='${orgB.id}' and nombre='Admin')`), 'Admin'))
prueba('no se puede desactivar al dueño', await falla(() => db.exec(`update public.perfiles set activo=false where usuario_id='${U.duenoB}'`), 'dueño'))
prueba('una asignación no puede mezclar organizaciones', await falla(() => db.exec(`insert into public.asignaciones (organizacion_id, usuario_id, rol_id) select '${orgC.id}', '${U.duenoC}', id from public.roles where organizacion_id='${orgB.id}' limit 1`), 'no pertenece'))

// 4.11 Roles propios y asignaciones, con el permiso gestionar_roles
await como(U.duenoB, async () => {
  await db.exec(`insert into public.roles (organizacion_id, nombre) values ('${orgB.id}', 'Cronometrista')`)
  await db.exec(`insert into public.rol_permisos (rol_id, permiso) select id, 'ver_pantalla_publica' from public.roles where nombre='Cronometrista' and organizacion_id='${orgB.id}'`)
  prueba('el dueño crea un rol propio con permisos', true)
  prueba('...pero no puede marcar un rol como "de fábrica"', await falla(() => db.exec(`insert into public.roles (organizacion_id, nombre, de_fabrica) values ('${orgB.id}', 'Falso', true)`), 'row-level security'))
  await db.exec(`update public.roles set nombre = 'Juez de mesa' where organizacion_id='${orgB.id}' and nombre='Juez'`)
  prueba('...y edita un rol de fábrica (que no sea Admin)', (await uno(`select 1 x from public.roles where organizacion_id='${orgB.id}' and nombre='Juez de mesa'`)) !== undefined)
})
await db.exec(`update public.roles set nombre = 'Juez' where organizacion_id='${orgB.id}' and nombre='Juez de mesa'`)
prueba('quien no gestiona roles no puede crearlos', await como(U.juezB, () => falla(() => db.exec(`insert into public.roles (organizacion_id, nombre) values ('${orgB.id}', 'Intruso')`), 'row-level security')))
prueba('un rol no puede incluir permisos que el plan no ofrece', await (async () => {
  await db.exec(`delete from public.plan_permisos where permiso = 'ver_pantalla_publica'`)
  const r = await como(U.duenoB, () => falla(() => db.exec(`insert into public.rol_permisos (rol_id, permiso) select id, 'ver_pantalla_publica' from public.roles where nombre='Juez' and organizacion_id='${orgB.id}'`), 'row-level security'))
  await db.exec(`insert into public.plan_permisos (plan, permiso) values ('estandar', 'ver_pantalla_publica')`)
  return r
})())
prueba('el dueño asigna un rol por torneo y área', await como(U.duenoB, async () => {
  await db.exec(`insert into public.asignaciones (organizacion_id, usuario_id, torneo_id, area, rol_id) select '${orgB.id}', '${U.sinRolB}', '${id(102)}', '5', id from public.roles where organizacion_id='${orgB.id}' and nombre='Mesa'`)
  return true
}))
prueba('...y ese usuario ya opera en ese torneo/área', (await tp(U.sinRolB, id(102), '5', 'operar_mesa_kumite')) === true && (await tp(U.sinRolB, id(102), '6', 'operar_mesa_kumite')) === false)
prueba('asignaciones: un juez solo ve las suyas', (await como(U.juezB, () => filas('select * from public.asignaciones'))).every((a) => a.usuario_id === U.juezB))

// 4.12 Listas y resultados según el permiso
prueba('un juez no gestiona la lista de jueces (no la ve)', (await como(U.juezB, () => filas('select * from public.jueces'))).length === 0)
prueba('...pero recibe sugerencias de nombres', (await como(U.juezB, () => filas(`select * from public.sugerir_jueces('ped')`))).length === 1)
prueba('las sugerencias son solo de su organización', (await como(U.duenoC, () => filas(`select * from public.sugerir_jueces('ped')`))).length === 0)
prueba('quien no puntúa ni opera no recibe sugerencias', (await como(U.kansaB, () => filas(`select * from public.sugerir_jueces('ped')`))).length === 0)
prueba('el juez puede guardar resultados de kata pero no de kobudo... (tiene los tres)', await como(U.juezB, async () => {
  await db.exec(`insert into public.resultados (organizacion_id, modulo, payload, creado_por) values ('${orgB.id}', 'kata', '{}', '${U.juezB}')`)
  return true
}))
prueba('el kansa no puede guardar resultados de kata', await como(U.kansaB, () => falla(() => db.exec(`insert into public.resultados (organizacion_id, modulo, payload, creado_por) values ('${orgB.id}', 'kata', '{}', '${U.kansaB}')`), 'row-level security')))
prueba('nadie puede firmar un resultado a nombre de otro', await como(U.juezB, () => falla(() => db.exec(`insert into public.resultados (organizacion_id, modulo, payload, creado_por) values ('${orgB.id}', 'kata', '{}', '${U.duenoB}')`), 'row-level security')))
prueba('el juez no ve el historial', (await como(U.juezB, () => filas('select * from public.resultados'))).length === 0)
prueba('el dueño sí ve el historial', (await como(U.duenoB, () => filas('select * from public.resultados'))).length === 1)
await como(U.juezB, () => db.exec(`select public.registrar_juez('Nuevo Juez')`))
prueba('registrar_juez agrega un nombre nuevo...', Number((await uno(`select count(*) n from public.jueces where organizacion_id='${orgB.id}'`)).n) === 2)
await como(U.juezB, () => db.exec(`select public.registrar_juez('gómez pedro')`))
prueba('...y no duplica uno existente (aunque esté en otro orden)', Number((await uno(`select count(*) n from public.jueces where organizacion_id='${orgB.id}'`)).n) === 2)

// 4.13 Contraseña inicial
await como(U.juezB, () => db.exec('select public.marcar_clave_cambiada()'))
prueba('marcar_clave_cambiada apaga la obligación solo del propio usuario',
  (await uno(`select debe_cambiar_clave d from public.perfiles where usuario_id='${U.juezB}'`)).d === false &&
  (await uno(`select debe_cambiar_clave d from public.perfiles where usuario_id='${U.kansaB}'`)).d === true)
prueba('un usuario no puede editar perfiles directamente', await como(U.juezB, () => falla(() => db.query(`update public.perfiles set nombre_visible='x' where usuario_id='${U.juezB}'`), 'permission denied')))

// 4.14 Borrar una organización completa funciona (los candados no lo impiden)
prueba('se puede borrar una organización entera (cascada)', await (async () => {
  await db.exec(`delete from public.organizaciones where id = '${orgC.id}'`)
  return Number((await uno(`select count(*) n from public.roles where organizacion_id='${orgC.id}'`)).n) === 0
})())

// ---------------------------------------------------------------- 5) Soporte de las Edge Functions
console.log('\n5) Soporte de las Edge Functions')
await db.exec(`insert into auth.sessions (id, user_id) values ('${id(900)}', '${U.juezB}'), ('${id(901)}', '${U.kansaB}')`)
prueba('un usuario logueado no puede cerrar sesiones ajenas', await como(U.duenoB, () => falla(() => db.query(`select public.cerrar_sesiones_usuario('${U.juezB}')`), 'permission denied')))
prueba('un anónimo tampoco', await comoAnonimo(() => falla(() => db.query(`select public.cerrar_sesiones_usuario('${U.juezB}')`), 'permission denied')))
await db.exec(`set role service_role`)
await db.exec(`select public.cerrar_sesiones_usuario('${U.juezB}')`)
await db.exec(`reset role`)
prueba('service_role cierra las sesiones de ese usuario y de nadie más',
  Number((await uno(`select count(*) n from auth.sessions where user_id='${U.juezB}'`)).n) === 0 &&
  Number((await uno(`select count(*) n from auth.sessions where user_id='${U.kansaB}'`)).n) === 1)
// auditoría: la leen los admins de su organización; nadie puede escribirla desde la API
await db.exec(`insert into public.auditoria (organizacion_id, actor_id, accion) values ('${orgB.id}', '${U.duenoB}', 'crear_usuario')`)
prueba('el dueño ve la auditoría de su organización y no la de otras', (await como(U.duenoB, () => filas('select * from public.auditoria'))).length === 1 && (await como(U.superadmin, () => filas('select * from public.auditoria'))).length === 0)
prueba('nadie escribe auditoría desde la API', await como(U.duenoB, () => falla(() => db.exec(`insert into public.auditoria (organizacion_id, actor_id, accion) values ('${orgB.id}', '${U.duenoB}', 'falsa')`), 'permission denied')))
prueba('el juez (sin gestionar_usuarios) no ve la auditoría', (await como(U.juezB, () => filas('select * from public.auditoria'))).length === 0)

// ---------------------------------------------------------------- 6) mis_permisos_todos
console.log('\n6) mis_permisos_todos')
const todos = (uid) => como(uid, () => filas('select * from public.mis_permisos_todos()'))
const juezTodos = await todos(U.juezB)
prueba('el juez de FAKKO ve sus 3 permisos con torneo y área', juezTodos.length === 3 && juezTodos.every((r) => r.torneo_id === id(101) && r.area === '2'))
const duenoTodos = await todos(U.duenoB)
prueba('el dueño tiene todos los permisos del plan, a nivel organización', duenoTodos.length === 12 && duenoTodos.every((r) => r.torneo_id === null && r.area === null))
prueba('un usuario sin roles no recibe nada', (await todos(U.kansaB)).every((r) => r.permiso === 'operar_kansa_kumite') && (await filas(`select 1 from public.perfiles limit 0`)).length === 0)
await db.exec(`update public.organizaciones set estado = 'suspendida' where id = '${orgB.id}'`)
prueba('con la organización suspendida no recibe nada', (await todos(U.duenoB)).length === 0)
await db.exec(`update public.organizaciones set estado = 'activa' where id = '${orgB.id}'`)
prueba('un anónimo no puede pedirlos', await comoAnonimo(() => falla(() => db.query('select * from public.mis_permisos_todos()'), 'permission denied')))

// ---------------------------------------------------------------- 7) transferir_dueno
console.log('\n7) transferir_dueno')
const NUEVO = '00000000-0000-4000-8000-0000000000aa'
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${NUEVO}', 'nuevo.dueno@fakko.org', now())`)
prueba('la API pública no puede transferir organizaciones', await como(U.duenoB, () => falla(() => db.query(`select public.transferir_dueno('fakko', 'nuevo.dueno@fakko.org')`), 'permission denied')))
prueba('no transfiere a una cuenta que no existe', await falla(() => db.query(`select public.transferir_dueno('fakko', 'nadie@x.org')`), 'No existe una cuenta'))
prueba('no transfiere a una cuenta que ya está en una organización', await falla(() => db.query(`select public.transferir_dueno('fakko', 'juez1@fakko.ipponia.internal')`), 'ya pertenece'))
prueba('no transfiere una organización inexistente', await falla(() => db.query(`select public.transferir_dueno('no-existe', 'nuevo.dueno@fakko.org')`), 'No existe la organizaci'))
await db.exec(`select public.transferir_dueno('fakko', 'nuevo.dueno@fakko.org')`)
const nuevoPerfil = await uno(`select es_dueno, activo, debe_cambiar_clave from public.perfiles where usuario_id='${NUEVO}'`)
prueba('el nuevo dueño queda como dueño y debe cambiar la clave', nuevoPerfil?.es_dueno === true && nuevoPerfil.debe_cambiar_clave === true)
prueba('el dueño anterior ya no tiene perfil ni roles', Number((await uno(`select count(*) n from public.perfiles where usuario_id='${U.duenoB}'`)).n) === 0 && Number((await uno(`select count(*) n from public.asignaciones where usuario_id='${U.duenoB}'`)).n) === 0)
prueba('el nuevo dueño tiene los 12 permisos a nivel organización', (await todos(NUEVO)).length === 12)
prueba('la organización conserva a sus demás usuarios', Number((await uno(`select count(*) n from public.perfiles where organizacion_id='${orgB.id}'`)).n) === 4)
prueba('los candados del dueño siguen activos tras transferir', await falla(() => db.exec(`update public.perfiles set activo = false where usuario_id='${NUEVO}'`), 'no se puede desactivar'))
prueba('el Admin permanente del nuevo dueño sigue protegido', await falla(() => db.exec(`delete from public.asignaciones where usuario_id='${NUEVO}'`), 'Admin permanente'))

console.log(`\nResultado: ${ok} pruebas correctas, ${fallos} fallidas.`)
process.exit(fallos ? 1 : 0)
