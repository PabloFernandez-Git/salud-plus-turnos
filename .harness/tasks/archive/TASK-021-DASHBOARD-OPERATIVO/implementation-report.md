# TASK-021 — Integración Next.js/UI local

**Resultado:** Gates A y B PASS local; Gate C PASS independiente tras corregir dos P2. No se aplicó la migration en DEV/PROD ni se conectó a entornos remotos. No hubo commit, push, PR ni merge.

## Arquitectura y alcance

- `src/modules/dashboard/api/daily-dashboard-rpc.ts`: adaptador focal de los nombres/argumentos SQL aprobados. Valida una sola fila, claves exactas por rol, enteros seguros, fecha civil/zona, proyección de próximos, orden y cardinalidad. Deriva `toAttend` y `activeTotal` de conteos completos.
- `src/modules/dashboard/server/daily-dashboard.ts`: consulta server-only con cliente de sesión, membresía activa y `requireProfessionalContext` para PROFESSIONAL. ADMIN/RECEPTION llaman a `staff_get_daily_dashboard`; PROFESSIONAL a `professional_get_own_daily_dashboard`. SQLSTATE `42501` se convierte en denegación; errores internos se propagan.
- `src/modules/dashboard/actions/daily-dashboard-actions.ts`: Server Action de relectura. Distingue `success`, `denied` y `error`, sin entregar detalles internos al navegador.
- `src/modules/dashboard/components/daily-dashboard-panel.tsx`: Actividad de hoy, Próximos turnos de hoy, carga, dos vacíos, error y reintento. `CenterDashboard` mantiene debajo las tarjetas y permisos existentes. El encabezado y layout compartidos siguen intactos.

## Actualización y tiempo

`as_of`, `local_date` y `timezone` llegan de PostgreSQL. El navegador sólo dispara una nueva lectura al pulsar Actualizar/Reintentar, recuperar visibilidad o cruzar medianoche del centro. Si una respuesta cruza medianoche entre solicitud y recepción, se descarta y se relee. Una respuesta tardía de otro centro/rol/membresía no reemplaza el estado actual. Una consulta fallida retira las cifras previas. Las horas de turnos muestran desplazamiento UTC para distinguir la repetición por DST. No hay polling continuo.

## Verificación

- `pnpm bootstrap`: Node y pnpm OK; se detuvo por ausencia deliberada de `.env.local`.
- Vitest focal: 6 archivos, 26 pruebas PASS. Incluye contrato, autorización, roles, fórmulas, vacíos, reintento, denegación, cambio de centro, respuesta tardía, visibilidad y días DST de 23/25 horas.
- `pnpm exec tsc --noEmit --incremental false`, ESLint focal y Prettier focal: PASS.
- Chromium local con datos sintéticos y Vite aislado (`node scripts/task021-dashboard-visual.mjs`): 1440 px y 390 px PASS; sin desbordamiento horizontal, navegación disponible tras error y foco visible. Capturas en `artifacts/task021-dashboard-ui/` para actividad, error y vacío en ambas anchuras. No son evidencia de DEV ni de E2E autenticado.
- Review independiente: dos P2 corregidos (denegación distinguible de consulta fallida; respuesta previa a medianoche descartada). Re-review estático PASS, sin hallazgos materiales. El reviewer no pudo correr Vitest por EPERM en su acceso de sólo lectura; el gate de pruebas se ejecutó desde el implementador.

## Límite antes de DEV

La RPC aún no está aplicada en DEV, por lo que no se ejecutó un E2E autenticado contra ella. Para el gate posterior se requiere autorización separada para aplicar la migration en Supabase DEV y validar con sesión real, roles y datos controlados. PROD permanece fuera de alcance.
