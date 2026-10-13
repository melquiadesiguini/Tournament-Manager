# Plan: IPPONIA multi-organización (Etapa 1: organizaciones, usuarios, roles y permisos)

Estado: **APROBADO (decisiones del punto 10). En ejecución: Etapa 0.**
Alcance: solo la base. Puntuación y pantalla pública siguen igual (localStorage + evento `storage`).

---

## 0. Punto de partida (lo que ya hay en el repo)

| Tema | Hoy | Con este plan |
|---|---|---|
| Organizaciones | `organizations` (plan libre en texto, estado, vencimiento) | `organizaciones` con `slug` y plan en tabla `planes` (hoy uno solo) |
| Usuarios | `auth.users` con email real + `members.role` (4 roles fijos) | `perfiles` con `nombre_usuario` (email sintético interno); dueño con email real |
| Roles | 4 fijos en texto (administrador, supervisor, mesa, juez) | `roles` + `rol_permisos` editables por organización |
| Torneos | no existen | `torneos` + `asignaciones` (rol por torneo y área) |
| Superadmin | `platform_admins` + RPC | `superadmins` (misma idea, tabla separada y más restringida) |
| Alta de usuarios | invitación por email (`invitaciones`) | Edge Function que crea la cuenta con usuario y contraseña |
| Login | `/cuenta` con email | `/:slugOrg/ingresar` (usuario+clave) y `/ingresar` (dueño y superadmin, con email) |
| Datos | `jueces`, `competidores`, `results` por `org_id` | igual, pero con RLS por permiso |

Lo que se **descarta** (se reemplaza, no se parchea): `members`, `invitaciones`, `listar_equipo`, `crear_organizacion` actual, las páginas `ConfigUsuarios` y `ConfigOrganizaciones`. Son pocas líneas y hoy hay una sola organización real, así que es el momento más barato para cambiar el modelo.

---

## 1. Decisiones de diseño (y por qué)

1. **Un usuario interno pertenece a una sola organización.** Si una persona trabaja en dos organizaciones, tiene dos cuentas (dos filas en `auth.users`, dos emails sintéticos distintos). *Por qué:* es lo que pediste y simplifica todo: `perfiles.organizacion_id` es único por usuario y las políticas RLS no necesitan elegir "organización activa".
2. **Email sintético `usuario@slug.ipponia.internal`.** Supabase Auth exige email; el usuario nunca lo ve. Se arma en el frontend (login) y en la Edge Function (alta). *Por qué `.internal`:* es un TLD reservado para uso privado, no puede recibir mail real. **Se verifica con una prueba corta antes de seguir** (ver Etapa 0), porque Supabase podría rechazar el dominio.
3. **El `slug` es inmutable.** Está dentro del email sintético; cambiarlo rompería todos los logins de esa organización. Un trigger impide modificarlo. Si algún día hace falta, se hace con un script que reescriba los emails.
4. **Los permisos se evalúan en SQL con `tiene_permiso(torneo, area, permiso)`** (`security definer`, lee `auth.uid()`). *Por qué:* una sola función usada por todas las políticas RLS y por el frontend (vía RPC `mis_permisos`) evita que la regla viva en dos lugares con comportamientos distintos.
5. **El plan limita, el rol concede.** Un permiso está activo solo si lo tiene el rol **y** el plan de la organización lo incluye. *Por qué:* si una organización baja de plan, pierde las funciones al instante sin tener que tocar sus roles.
6. **Catálogo de permisos en dos lugares sincronizados:** constante en el código (`src/lib/permisos.js`, para textos y pantallas) y tabla `permisos` en la base (para claves foráneas y para que RLS no dependa del frontend). Una migración los sincroniza; un chequeo en el build avisa si se desfasan.
7. **Asignaciones, no roles pegados al usuario.** `asignaciones(usuario, torneo nullable, area nullable, rol)`. `torneo = null` significa "toda la organización" (el Admin permanente); `area = null` significa "todas las áreas".
8. **Rutas sin colisión:** el slug no puede ser una palabra reservada (`kata`, `kumite`, `cuenta`, `ingresar`, `configuracion`, `api`…). Se valida con un `check` en la base y en el formulario de alta.
9. **Service role solo en Edge Functions.** Se inyecta automáticamente como variable de entorno del servidor de Supabase; nunca pasa por el frontend ni por el repo.
10. **Seguridad por defecto:** todas las tablas con RLS activada y sin permisos para `anon`; los accesos públicos mínimos (mostrar el nombre de una organización en su pantalla de ingreso) van por una función `org_publica(slug)` que devuelve solo nombre y estado.

---

## 2. Esquema (migraciones versionadas)

Archivos en `supabase/migrations/AAAAMMDDHHMM_nombre.sql`, aplicables en orden. Los SQL actuales (`roles.sql`, `configuracion.sql`…) se mueven a `supabase/legacy/` como historial.

```text
planes(clave pk: hoy 'estandar', nombre)
permisos(clave pk, descripcion)                          -- catálogo fijo
plan_permisos(plan, permiso)                             -- qué incluye cada plan

organizaciones(id, slug unique/immutable, nombre, plan -> planes (hoy solo 'estandar'),
               estado: prueba|activa|suspendida, vence_el, creada_en)
perfiles(usuario_id pk -> auth.users, organizacion_id, nombre_usuario,
         nombre_visible, es_dueno, activo, debe_cambiar_clave,
         unique(organizacion_id, nombre_usuario))        -- username en minúsculas
torneos(id, organizacion_id, nombre, fecha, estado)
roles(id, organizacion_id, nombre, de_fabrica, unique(organizacion_id, nombre))
rol_permisos(rol_id, permiso)
asignaciones(id, organizacion_id, usuario_id, torneo_id null, area null, rol_id)
superadmins(usuario_id pk -> auth.users)
auditoria(id, cuando, organizacion_id, actor_id, accion, detalle jsonb)
```

Datos existentes: `jueces`, `competidores`, `results` se mantienen (ya tienen `org_id`); se renombra a `organizacion_id` y se les cambia la política.

**Catálogo inicial de permisos** (ajustado a las pantallas reales):

| Permiso | Pantalla / acción |
|---|---|
| `ver_pantalla_publica` | `/pantalla` (hoy abierta; pasa a requerir sesión de la organización) |
| `operar_mesa_kumite` | `/kumite/mesa` |
| `operar_kansa_kumite` | `/kumite/kansa` |
| `puntuar_kata`, `puntuar_kobudo`, `puntuar_destreza` | módulos |
| `cargar_competidores` | lista y Excel de competidores |
| `gestionar_jueces` | lista y Excel de jueces (hoy existe aparte) |
| `ver_historial` | historial de resultados |
| `crear_torneos` | torneos |
| `gestionar_usuarios` | crear, desactivar, resetear clave |
| `gestionar_roles` | roles y asignaciones |

**Planes:** por ahora hay **un solo plan** (clave `estandar`) que incluye todos los permisos. La estructura (`planes`, `plan_permisos`) queda lista para sumar planes más adelante sin cambiar el código: alcanza con insertar filas.

**Roles de fábrica** (se crean con la organización, editables): Admin (todos los del plan), Juez (`puntuar_*`), Kansa (`operar_kansa_kumite`), Fukushin (`puntuar_*` + `ver_pantalla_publica`), Mesa (`operar_mesa_kumite`, `puntuar_*`, `ver_pantalla_publica`, `cargar_competidores`).

---

## 3. RLS y `tiene_permiso`

```text
tiene_permiso(p_torneo uuid, p_area text, p_permiso text) -> boolean
  1. perfil = perfiles donde usuario_id = auth.uid() y activo
  2. la organización está activa (estado + vencimiento)
  3. el permiso está en el plan de la organización (plan_permisos)
  4. existe una asignación del usuario donde:
       (torneo_id is null  OR torneo_id = p_torneo)
       AND (area is null   OR area = p_area)
     cuyo rol incluye p_permiso
  p_torneo null = consulta "a nivel organización": solo cuentan asignaciones con torneo_id null.
```

Políticas (todas filtran además por `organizacion_id = mi_organizacion()`):

- `perfiles`: ver los de mi organización; modificar solo con `gestionar_usuarios` (y los altas/bajas por Edge Function).
- `roles`, `rol_permisos`, `asignaciones`: ver los de mi organización; modificar con `gestionar_roles`. **Candado:** no se puede quitar `gestionar_usuarios`/`gestionar_roles` al último Admin (trigger), para que nadie deje a la organización sin administración.
- `torneos`: ver los de mi organización; crear/editar con `crear_torneos`.
- `jueces`, `competidores`: por `gestionar_jueces` / `cargar_competidores`.
- `organizaciones`: cada miembro ve solo la suya; plan/estado/vencimiento solo el superadmin (por columna, como hoy).
- Superadmin: tabla propia; **no** tiene acceso general a datos de organizaciones (ver 4).

**Prueba de aislamiento:** un script SQL (`supabase/tests/aislamiento.sql`) crea dos organizaciones y usuarios, simula sus JWT con `set local role authenticated` y comprueba que A no lee ni escribe nada de B, y que el permiso por torneo/área funciona. Se corre antes de dar por buena cada migración.

---

## 4. Superadmin

- Tabla `superadmins` (hoy `platform_admins`). Solo se agrega desde el SQL Editor, nunca desde la app.
- **Menor privilegio:** el superadmin **no** lee los datos deportivos de los clientes. Ve un panel con: lista de organizaciones, plan, estado, vencimiento, cantidad de usuarios y torneos (funciones `security definer` que devuelven solo esos agregados). *Por qué:* limita el daño si esa cuenta se compromete y es más defendible ante un cliente.
- Alta de cliente = Edge Function `crear-organizacion` (solo superadmin): crea la organización con `slug`, plan y vencimiento, genera los roles de fábrica y envía la invitación por email al dueño (`inviteUserByEmail`), que elige su contraseña y queda como Admin permanente.

---

## 5. Edge Functions (Deno, en `supabase/functions/`)

Todas: verifican el JWT del llamador, validan la entrada, derivan la organización **del perfil del llamador** (nunca de un parámetro), responden con CORS limitado al dominio del sitio y registran en `auditoria`.

| Función | Quién | Qué hace |
|---|---|---|
| `crear-usuario` | permiso `gestionar_usuarios` | valida `nombre_usuario` (minúsculas, `a-z0-9._-`, 3–30), arma el email sintético, `auth.admin.createUser({ email_confirm: true, password })`, inserta `perfiles`; si falla el insert, borra el usuario de Auth (rollback) |
| `resetear-clave` | `gestionar_usuarios` | solo sobre usuarios de **su** organización; `auth.admin.updateUserById`, cierra sesiones, marca `debe_cambiar_clave` |
| `desactivar-usuario` | `gestionar_usuarios` | `activo=false` + ban en Auth; no se borra (se conserva el historial) |
| `crear-organizacion` | superadmin | ver punto 4 |

El llamador se autoriza llamando a `tiene_permiso` con **su propio JWT**; recién después se usa el cliente con service role para la operación privilegiada. Así la regla de permisos sigue viviendo en un solo lugar (SQL).

Requisito práctico: publicar funciones necesita la CLI de Supabase (`supabase functions deploy`) o pegarlas desde el panel. Lo dejo en la Etapa 0.

---

## 6. Routing en GitHub Pages: ¿es compatible `/:slugOrg/ingresar`?

**Sí.** Hoy el sitio ya usa `BrowserRouter` con `basename=/ipponia/` y el truco `404.html` (spa-github-pages) con `pathSegmentsToKeep = 1`: cualquier ruta que no exista como archivo (`/ipponia/fakko/ingresar`) devuelve el 404.html, que la reescribe como `/ipponia/?/fakko/ingresar` y `index.html` la restaura. Ya funciona hoy con `/ipponia/kata`.

Observaciones:
- El navegador recibe un 404 HTTP antes del redireccionamiento (no afecta a una app privada, pero hay un parpadeo corto en el primer ingreso directo).
- **Colisión de nombres:** `/:slugOrg` choca con rutas fijas. Solución: rutas fijas primero en el router y lista de slugs reservados (punto 1.8).
- Con **dominio propio** (`ipponia.com`) cambia solo `base: '/'` y `pathSegmentsToKeep = 0`. Los subdominios por organización (`fakko.ipponia.com`) **no** son posibles en GitHub Pages (no admite comodines); si alguna vez se quieren, hay que pasar a Cloudflare Pages o Netlify. Por ahora, rutas con slug.

---

## 7. Cambios en React

```text
src/
  lib/permisos.js            catálogo (clave, etiqueta, pantalla) + utilidades
  lib/api/                   llamadas a RPC y Edge Functions (usuarios, roles, torneos)
  context/AuthProvider       + perfil (organización, usuario, es_dueño, superadmin)
  context/PermisosProvider   carga mis_permisos(torneo) al entrar a un torneo
  hooks/usePermiso.js        const puede = usePermiso('puntuar_kata', { area })
  components/Requiere.jsx    <Requiere permiso="puntuar_kata"> ... </Requiere>
  pages/IngresarOrg.jsx      /:slugOrg/ingresar  (usuario + clave)
  pages/Ingresar.jsx         /ingresar (dueño y superadmin, con email) + "olvidé mi clave"
  pages/RestablecerClave.jsx /restablecer
  pages/org/                 Torneos, Usuarios, Roles, Asignaciones
  pages/superadmin/          Organizaciones (alta y estado)
```

Rutas: `/ingresar`, `/restablecer`, `/:slugOrg/ingresar`, `/:slugOrg/torneos`, `/:slugOrg/torneos/:torneoId/*` (módulos), `/superadmin/*`. Mientras dura la etapa, **las rutas actuales (`/kata`, `/kumite/mesa`…) siguen funcionando con localStorage**; solo se les agrega el filtro por permisos a nivel organización. La navegación muestra solo lo permitido (UX); la seguridad real es RLS.

---

## 8. Etapas

**Etapa 0 – Preparación (corta, sin riesgo)**
- Prueba (spike): crear por la API un usuario con email `@x.ipponia.internal` ya confirmado y loguearse. Si Supabase lo rechaza, se cambia el dominio sintético.
- Instalar la CLI de Supabase y vincular el proyecto (o definir el flujo por el panel). Crear `supabase/migrations/` y mover el SQL actual a `legacy/`.

**Etapa 1 – Base de datos** (migraciones + prueba de aislamiento)
- Catálogo, planes, organizaciones, perfiles, roles, asignaciones, torneos, superadmins, auditoría.
- `tiene_permiso`, `mis_permisos`, `org_publica`, políticas RLS y triggers (slug inmutable, candado del último Admin, roles de fábrica).
- Migración de los datos actuales (tu organización y tu usuario) al modelo nuevo.

**Etapa 2 – Edge Functions**: `crear-organizacion`, `crear-usuario`, `resetear-clave`, `desactivar-usuario` + pruebas.

**Etapa 3 – Frontend**: login por organización, contexto de permisos, paneles (usuarios, roles, asignaciones, torneos), panel de superadmin, filtro de menús.

**Etapa 4 – Cierre y convivencia**: retirar `members`, invitaciones y páginas viejas; revisar que localStorage siga igual; documentación.

*Después (fuera de esta etapa):* mover el estado de Kata/Kumite a la base y tiempo real (incluye la función de jueces conectados que quedó guardada aparte).

---

## 9. Riesgos y cuidados

- **Bloqueo por error de permisos:** candado del último Admin + cuenta superadmin que siempre puede restablecer.
- **Fuerza bruta de contraseñas:** límites de Supabase Auth por IP; se suma contador de intentos fallidos por cuenta en una etapa posterior si hace falta.
- **Enumeración de usuarios:** el login responde siempre "usuario o contraseña incorrectos".
- **Contraseñas:** mínimo 8 en usuarios internos; el admin entrega la inicial y se obliga a cambiarla en el primer ingreso (`debe_cambiar_clave`).
- **Deriva del catálogo** código/base: chequeo en el build.
- **Costo de Supabase:** el plan gratuito alcanza para esta etapa; el tiempo real (etapa posterior) es lo que más consume.

---

## 10. Decisiones confirmadas

1. **Alta de organizaciones solo por el superadmin.** Sin autoregistro. (Se mantiene "Solicitar acceso" por WhatsApp.)
2. **Un solo plan** por ahora (`estandar`, con todos los permisos). Se diseña para poder agregar más.
3. **Tablas en español** (`organizaciones`, `perfiles`, `roles`…). Se renombra ahora.
4. **El superadmin ve solo agregados** de las organizaciones (nombre, plan, estado, vencimiento, cantidad de usuarios y torneos), no sus datos deportivos.
5. **Contraseña inicial con cambio obligatorio** en el primer ingreso de usuarios internos.
6. **Sin límites por plan** por ahora (cantidad de usuarios o torneos); se analiza más adelante.
7. **Dominio sintético `ipponia.internal`** (a validar en la Etapa 0).

---

## 11. Etapa 0: seguimiento

- [x] CLI de Supabase disponible vía `npx supabase` (v2.120). No hace falta instalarlo.
- [x] `supabase/migrations/` y `supabase/tests/` creadas; SQL anterior movido a `supabase/legacy/` (solo historial).
- [x] `supabase init` (genera `supabase/config.toml`).
- [x] **Prueba del email sintético**: Supabase acepta `usuario@x.ipponia.internal` y permite iniciar sesión.
- [ ] `npx supabase login` (lo hacés vos una vez; abre el navegador) para poder publicar Edge Functions.

## 12. Etapa 1: seguimiento

- [x] Migración escrita: `supabase/migrations/20261013120000_multiorganizacion.sql` (catálogo, tablas en español, `tiene_permiso`, RLS, candados, migración de datos, retiro del modelo viejo).
- [x] Pruebas locales (`npm run test:db`): **94 correctas** (migración de datos, aislamiento entre organizaciones, permisos por torneo/área, plan, organización suspendida/vencida, superadmin, candados).
- [x] **Aplicada en Supabase** (13/10/2026). Verificada: organización `ikigai-dojo` (plan estandar), 1 perfil dueño, 5 roles, 1 asignación, 1 superadmin, 12 permisos, jueces y resultados conservados, todas las tablas con RLS, sin triggers viejos. La nube del frontend viejo queda inactiva hasta la Etapa 3.
- [x] "Allow new users to sign up" desactivado en Authentication (verificado tras recargar).

## 13. Etapa 2: seguimiento (Edge Functions)

- [x] Código en `supabase/functions/`: `crear-organizacion`, `crear-usuario`, `resetear-clave`, `desactivar-usuario` (+ `_shared/`).
- [x] La lógica está separada de Supabase (`acciones.ts`) y probada con un servicio simulado: **20 pruebas** (`npm run test:functions`).
- [x] Tipos revisados con `deno check` (incluida la conexión real a supabase-js).
- [x] Migración `20261013130000_soporte_edge_functions.sql` (cerrar sesiones de un usuario) aplicada en Supabase. Pruebas de base de datos: **101 correctas**.
- [x] Las 4 funciones publicadas desde el editor del panel de Supabase (no hizo falta el login del CLI) y con "Verify JWT with legacy secret" apagado: las sesiones usan claves nuevas (ES256) y cada función verifica la sesión por su cuenta.
- [x] Prueba real con la sesión del dueño (13/10/2026): `crear-usuario` pasa perfil, organización vigente y permiso; `crear-organizacion` reconoce al superadmin; `resetear-clave` y `desactivar-usuario` consultan con la clave de servicio. Las cuatro rechazaron los datos inválidos antes de crear nada.
- [ ] Pendiente menor: `desactivar-usuario` y `crear-organizacion` siguen en la primera versión (claves heredadas SUPABASE_ANON_KEY/SERVICE_ROLE_KEY, marcadas DEPRECATED). Funcionan; actualizarlas a SUPABASE_PUBLISHABLE_KEYS/SECRET_KEYS (ya hecho en `crear-usuario` y `resetear-clave`).
- [ ] Configurar SMTP propio antes de usar invitaciones por email con clientes reales.
