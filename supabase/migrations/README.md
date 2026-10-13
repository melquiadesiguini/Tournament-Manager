# Migraciones

Archivos `AAAAMMDDHHMMSS_nombre.sql`, **en orden** y cada uno atómico (si algo falla, no queda nada a medias).
Lo que había antes de esta carpeta está en `../legacy/` (solo como historial, no se vuelve a ejecutar).

## Cómo aplicar una migración
1. Supabase > SQL Editor > New query > pegar el archivo completo > Run.
2. O, con el proyecto vinculado: `npx supabase db push`.

## Cómo probarlas antes (sin tocar Supabase)
```bash
npm run test:db
```
Levanta un PostgreSQL en memoria, carga el esquema anterior con datos de ejemplo, aplica **todas** las
migraciones y comprueba que los datos se migraron, que una organización no ve ni modifica nada de otra
(RLS) y que `tiene_permiso` respeta torneo, área, plan y estado de la organización.
Cada migración nueva debe sumar sus pruebas en `../tests/ejecutar.mjs`.
