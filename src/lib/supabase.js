import { createClient } from '@supabase/supabase-js'

// Conexión con Supabase (base de datos y usuarios).
// La URL y la clave "anon" (pública) se leen de variables de entorno de Vite
// (archivo .env.local, que no se sube a git; ver .env.example).
// La clave anon es pública por diseño: lo que protege los datos son las reglas de
// seguridad por fila (RLS) del esquema. NUNCA poner acá la clave "service_role".
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && anonKey)

// Sin configuración la app sigue funcionando como hasta ahora (solo en el navegador)
export const supabase = supabaseConfigurado ? createClient(url, anonKey) : null
