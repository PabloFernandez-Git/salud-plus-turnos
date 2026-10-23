# TASK-021 — Dashboard operativo (definición funcional aprobada; sin implementar)

## Objetivo

Ampliar el inicio del Center para presentar actividad diaria y próximos turnos según el rol,
conservando la navegación existente. ADMIN y RECEPTION consultan el Center activo; PROFESSIONAL
consulta exclusivamente su propia actividad. El alcance responde a `docs/product.md` §13,
`docs/mvp.md` §11 y criterio 14, y `docs/modules/dashboard.md`.

## Contratos reutilizables observados

- `src/app/centers/[centerId]/page.tsx` valida UUID y llama `requireCenterMembership`; el layout
  repite el guard. PR #17 conserva errores internos de consulta como errores, sin convertirlos
  en 404. El Dashboard actual (`src/modules/access/components/center-dashboard.tsx`) sólo muestra
  navegación.
- `centerLocalDate(context.center.timezone)` da el día civil del Center.
- `listAppointments()` en `src/modules/appointments/server/appointments.ts` reautoriza el Center
  y devuelve proyecciones distintas: staff por `staff_list_appointments`, PROFESSIONAL por
  `professional_list_own_appointments` tras `requireProfessionalContext`. Acepta rango local de
  hasta 31 días, status opcional y páginas de máximo 50 con cursor. El RPC profesional omite
  nota administrativa y datos de contacto/documento.
- `listAgendaAppointments()` demuestra paginación completa de un período, pero oculta CANCELLED
  si no hay filtro de estado. Para contadores de todos los estados no se debe reutilizar ese
  resultado sin adaptar la lógica. No existe en el contrato actual una RPC agregada de métricas.

## Decisiones funcionales aprobadas (2026-10-22)

- `hoy` es la fecha civil del Center activo en `centers.timezone`, derivada de una referencia
  temporal única de PostgreSQL. El día incluye todos los instantes cuya fecha local sea esa,
  incluso jornadas de 23 o 25 horas por DST.
- `turnos del día = PENDING + CONFIRMED + ATTENDED + NO_SHOW`. `CANCELLED` se cuenta y muestra
  aparte como turnos cancelados **con horario actual en la fecha de hoy**. Cada turno contribuye
  a un solo estado según su estado y horario actuales. No se miden cambios ocurridos hoy.
- `por atender = PENDING + CONFIRMED`, con desglose visible de ambos estados. `ATTENDED` y
  `NO_SHOW` tienen conteos separados.
- `próximos turnos de hoy`: `PENDING` o `CONFIRMED`, `starts_at >= as_of`, fecha local de hoy,
  máximo cinco, orden estable por `(starts_at, id)` ascendente. No se extiende a otros días.
- `profesionales con turnos hoy`: cantidad de `ProfessionalCenter` distintos con al menos un
  turno no cancelado cuya fecha local sea hoy. Sólo ADMIN/RECEPTION. El rótulo no infiere
  presencia real ni se basa en Availability configurada.
- ADMIN/RECEPTION reciben sólo datos del Center activo. PROFESSIONAL recibe únicamente sus
  turnos mediante su `professional_center_id` activo y la proyección mínima ya autorizada;
  ningún resultado del Center completo se filtra sólo en frontend.
- El orden visual aprobado es: **Actividad de hoy y fecha del Center** → **Próximos turnos de
  hoy** → **¿Qué querés hacer hoy?** y tarjetas de navegación existentes. Sin gráficos,
  tendencias, analítica histórica ni accesos rápidos duplicados.
- Dos vacíos operativos distintos: ningún turno vigente hoy; turnos vigentes hoy, pero ningún
  próximo turno restante. Error de lectura tiene estado propio y nunca se convierte en cero.

## Criterios de aceptación

1. Una sola lectura autorizada devuelve conteos completos y próximos turnos coherentes con
   el mismo `as_of` y la misma fotografía de datos; no deriva totales de páginas parciales.
2. En cada rol, `total = pending + confirmed + attended + no_show` y
   `por atender = pending + confirmed`; cancelados quedan fuera del total.
3. Los próximos son como máximo cinco, del día civil del Center, con estados abiertos, desde
   `as_of` inclusive y orden `(starts_at, id)`; las horas repetidas por DST son distinguibles.
4. ADMIN/RECEPTION ven únicamente el Center activo; PROFESSIONAL no recibe datos de otros
   turnos, profesionales, pacientes administrativos ni totales del Center.
5. La carga, los dos vacíos, el error y la actualización tienen estados visuales distintos;
   el error conserva la navegación y no muestra cifras falsas.
6. Encabezado compartido, identidad/rol, logout y tarjetas por rol conservan diseño, rutas,
   semántica, teclado y comportamiento responsive aprobados.
7. Cambio de Center, rol, estado, horario o fecha civil no mezcla resultados previos con el
   nuevo contexto. Denegaciones se distinguen de fallos internos de lectura.

El contrato y los escenarios verificables están en [`contract.md`](contract.md). La revisión
independiente focal se registra en [`review.md`](review.md).

## Evoluciones postergadas

- Alertas operativas sin regla comprobada, disponibilidad de profesionales como indicador,
  horizonte de próximos días, gráficos e informes históricos.
- Checklist de onboarding para distinguir ausencia comprobada de pacientes o profesionales
  activos. No inferirla de cero turnos; cualquier consulta adicional deberá ser autorizada
  y estrictamente limitada al rol staff.
- `docs/product.md` §13 menciona alertas y accesos rápidos; las tarjetas de navegación
  existentes satisfacen el acceso a módulos, mientras que las alertas quedan fuera de este corte.

## Riesgos e impacto

Riesgo principal: filtrar tarde en React, contar una página parcial o reutilizar la proyección
staff para PROFESSIONAL expondría datos ajenos. Una lectura paginada también puede mezclar
fotografías bajo mutaciones concurrentes. Se aprueba el **enfoque** de dos RPC agregadas,
read-only y separadas por alcance, no su creación ni la aplicación de una migration.

El Dashboard permanece en `src/app/` como composición delgada; lecturas y cálculo del resumen
viven en el módulo correspondiente. La futura implementación deberá validar autorización en
servidor y PostgreSQL, preservar RLS/aislamiento y no usar service role. No cambiar Auth,
RLS, permisos, RPC, reglas de turnos ni datos durante esta etapa documental. No conectar a
DEV/PROD ni interferir con el servidor Next.js. La implementación, verification y review
posteriores son una etapa distinta.
## Preparación de gates Supabase DEV (2026-10-22)

El objetivo, criterios de aceptación, impacto, riesgos, procedimientos y autorizaciones separadas
del Gate A estructural y Gate B funcional están en [dev-gates-preparation.md](dev-gates-preparation.md).
Ambos procedimientos quedaron preparados y revisados sólo localmente. La migration, Auth, RLS y UI
aprobadas no se modificaron; no hubo conexión, migration ni fixtures remotos. TASK-021 sigue activa
hasta ejecutar y verificar los gates con autorización específica.
