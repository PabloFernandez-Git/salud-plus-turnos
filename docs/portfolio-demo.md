# Publicación de la demo de portfolio

Esta guía usa el proyecto Supabase DEMO independiente `oygrwetmxsqgcizopezq`. Nunca usar el proyecto DEV ni PROD. La rama `codex/task-029-main-integration` y sus seis migraciones quedan fuera. Las 28 migraciones, la cuenta Auth, el seed y el inventario ficticio ya están confirmados.

## Contrato de la demo

- Un solo centro y una sola cuenta Auth (`demo@salud-plus.example`) con membership ADMIN para aprovechar las pantallas de lectura actuales. En este proyecto, `authenticated` carece de DML y sólo conserva las RPC de lectura indicadas por la migración DEMO. La función de las credenciales es visitar la demo, no administrar el centro.
- Signup público desactivado; datos exclusivamente ficticios del archivo `supabase/demo/seed.sql`.
- `PORTFOLIO_DEMO_MODE=true` bloquea las Server Actions de escritura y la resolución exacta de identidades. PostgreSQL bloquea las mismas operaciones aun al llamar PostgREST directamente.
- En modo DEMO, las pantallas muestran el aviso de solo lectura y conservan visibles, pero deshabilitados, los controles de creación, edición, activación y desactivación. Los listados, filtros, navegación, disponibilidad y detalles siguen disponibles. Para enseñar el flujo CRUD completo, usar capturas o una grabación en el portfolio.

## Estado de Supabase DEMO

- Confirmado por el operador: 28 migraciones aplicadas, registro público desactivado, usuario `demo@salud-plus.example` creado, seed satisfactorio e inventario de datos ficticios PASS.
- Confirmado por el operador: las seis RPC sensibles de pacientes tienen `EXECUTE=false` para `anon` y `authenticated`.
- No repetir migraciones ni seed para publicar. Revisar las fechas de los turnos si la publicación se demora.
- Cuando se conozca el dominio definitivo, en Supabase DEMO → Authentication → URL Configuration, configurar `Site URL` con `https://DOMINIO` y añadir exactamente `https://DOMINIO/auth/callback` a Redirect URLs. Evitar wildcards de previews.

Ver [acceso invitado preparado](portfolio-guest-access.md) para la activación posterior y la limpieza.

## Vercel

Variables mínimas de este despliegue:

| Variable                               | Valor                                                  |
| -------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://oygrwetmxsqgcizopezq.supabase.co`             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key del proyecto DEMO                      |
| `APP_ORIGIN`                           | Origen HTTPS exacto de Vercel, sin barra final ni ruta |
| `PORTFOLIO_DEMO_MODE`                  | `true`                                                 |

No configurar `SUPABASE_SECRET_KEY`: la demo no provisiona usuarios desde la web. La publishable key es pública; la protección está en RLS y grants. No copiar `.env.local` de DEV. En Vercel, configurar estas cuatro variables para el entorno que servirá la rama demo; `APP_ORIGIN` debe coincidir con el dominio canónico y `PORTFOLIO_DEMO_MODE` debe ser `true`. Publicar `codex/portfolio-mvp` en GitHub sólo cuando se autorice; importar el repositorio en Vercel y seleccionar esta rama como Production Branch antes de anunciar la demo. La importación puede iniciar un despliegue de la rama predeterminada; verificar la rama y el SHA del despliegue final. Tras publicar, añadir la URL de demo al README y compartir la contraseña por un canal separado.

**Límite de la cuenta compartida:** la acción web de cambio de contraseña está bloqueada en modo DEMO, pero una sesión puede llamar directamente a Supabase Auth `updateUser` para modificar sus propias credenciales. Esto no concede escrituras sobre tablas `public` ni EXECUTE sobre RPCs revocadas. Antes de divulgar credenciales de forma abierta, decidir cómo se entregarán y cómo se restaurará la cuenta si alguien cambia su contraseña. La recuperación de contraseña desde la web queda deshabilitada en modo DEMO.

## Smoke test antes de anunciar la URL

Usar la cuenta demo y verificar:

1. Login y redirección al único centro; logout.
2. Dashboard del centro con contadores y turnos ficticios.
3. Agenda en día, semana y mes; sólo turnos del centro DEMO.
4. Profesionales, especialidades y disponibilidad ficticios.
5. Pacientes ficticios y sus turnos; no aparecen datos de DEV.
6. Listado y detalle de turnos; intento de crear/editar/cambiar estado rechazado.
7. Con JWT demo, POST/PATCH/DELETE directo a tablas `public` rechazado; llamadas directas a `staff_create_appointment`, `staff_resolve_patient_identity` y `admin_resolve_professional_by_document` rechazadas con falta de permiso. Los botones deshabilitados no sustituyen esta prueba de permisos.
8. Consulta con un `center_id` aleatorio devuelve cero filas o acceso denegado; ningún resultado de RPC o respuesta de red incluye identidad global ajena al centro.

Comprobación SQL de grants en DEMO (como operador, sin exponer tokens):

```sql
select
  has_table_privilege('authenticated', 'public.patient_centers', 'SELECT') as can_read_patients,
  has_table_privilege('authenticated', 'public.patient_centers', 'INSERT') as can_insert_patients,
  has_function_privilege('authenticated', 'public.staff_resolve_patient_identity(uuid,text,text,date)', 'EXECUTE') as can_resolve_global_identity;
```

Esperado: `true, false, false`. Repetir el chequeo de escrituras con un JWT real para acreditar los controles de aplicación y PostgreSQL. Si alguno falla, no publicar.
