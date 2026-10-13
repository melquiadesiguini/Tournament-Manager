import { supabase } from './supabase'
import { llamarFuncion } from './funciones'
import { mensajeDe } from './errores'

export const ESTADOS_ORGANIZACION = { prueba: 'En prueba', activa: 'Activa', suspendida: 'Suspendida' }

// Panel del superadmin. Solo datos agregados de cada cliente (cantidad de usuarios y torneos):
// la base no le muestra resultados, jueces ni competidores de las organizaciones.
export async function listarOrganizaciones() {
  const { data, error } = await supabase.rpc('superadmin_resumen')
  return error ? { ok: false, filas: [] } : { ok: true, filas: data }
}

// Alta de un cliente (Edge Function): organización + roles de fábrica + dueño
export const crearOrganizacion = ({ slug, nombre, email_dueno, clave, vence_el }) =>
  llamarFuncion('crear-organizacion', {
    slug: slug.trim().toLowerCase(),
    nombre: nombre.trim(),
    email_dueno: email_dueno.trim(),
    clave: clave || undefined,
    vence_el: vence_el || undefined,
  })

export async function actualizarOrganizacion(id, { nombre, plan, estado, vence_el, notas }) {
  const { error } = await supabase.rpc('superadmin_actualizar_organizacion', {
    p_organizacion: id,
    p_nombre: nombre,
    p_plan: plan,
    p_estado: estado,
    p_vence_el: vence_el || null,
    p_notas: notas || null,
  })
  return error ? { ok: false, mensaje: mensajeDe(error) } : { ok: true }
}

// Dirección donde entran los usuarios de una organización
export const urlIngreso = (slug) => `${window.location.origin}${import.meta.env.BASE_URL}${slug}/ingresar`
