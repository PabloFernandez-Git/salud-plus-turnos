# TASK-008 — Review independiente de brief y plan

## Resultado

**TASK-008 PLAN REVIEW PASS — READY FOR IMPLEMENTATION AUTHORIZATION**

Review de planning únicamente. No autoriza implementar en esta conversación. No se ejecutaron migraciones, tests, conexión a DEV ni cambios funcionales.

## Base y alcance comprobados

- Rama: `task/008-availability`. `HEAD`, `main` y `origin/main`: `6e5e4f46fe7871966557ee1822ac08e2575ac22b`.
- Se revisaron `brief.md`, `plan.md`, producto, reglas de negocio, módulos Availability/Professionals/Appointments, arquitectura, convenciones y protocolo de review; schema y migraciones de auth/RLS, Professionals y CAS; helpers de autorización, queries/ruta actuales de Professionals, navegación y verificadores de catálogo afectados.
- `pnpm bootstrap` consta como PASS en el brief y plan de esta fase. No se volvió a ejecutar en este review, que sólo admite cambios en este archivo.

## Evaluación del contrato

### DB, RLS y autorización

- **DB blocker confirmado.** `public.availabilities` existe con RLS habilitada y sin grant/policy de lectura ni superficie de mutación para `authenticated`. La solución SELECT bajo una policy tenant para filas activas + RPCs estrechas respeta la arquitectura. No se propone service role en la app, DML genérico, bypass de RLS ni una RPC de actualización arbitraria.
- La policy planeada exige `is_active` y un helper con `ProfessionalCenter` activo del mismo `center_id`. Para ADMIN/RECEPTION exige membership activa en Center activo; para PROFESSIONAL compara el ID exacto con `private.active_professional_center_id(center_id)`, cuyo SQL exige rol, membership, Center y vínculo activos. Manipular URL, filtros, `center_id` o `professional_center_id` no debe ampliar el resultado. PLATFORM_ADMIN sin membership tenant no tiene acceso implícito. La matriz DB propuesta verifica estos casos, incluidos cross-center e inactivos.
- Los `SECURITY DEFINER` propuestos son acotados: `search_path=''`, referencias calificadas, `auth.uid()`, revocación de PUBLIC/anon, grants EXECUTE por firma y revalidación tenant en cada RPC. El helper de appointments queda privado y sin EXECUTE para el cliente. El review del SQL concreto en Gate A debe comprobar esos invariantes antes de DEV.

### Mutaciones, duración y concurrencia

- Create fuerza `is_active=true`; update sólo cambia horas de una fila activa; deactivate sólo fija `is_active=false`. Las RPCs verifican el par `ProfessionalCenter`/Center contra la DB y no confían en los IDs del request para determinar pertenencia. `p_center_id` es redundante pero se revalida y se usa para autorización y lock; no permite combinaciones arbitrarias. Sólo ADMIN/RECEPTION mutan; PROFESSIONAL, vínculo inactivo y Center/membership inactivos se rechazan. No hay mutación de appointments.
- La RPC de duración específica es preferible a ampliar `admin_update_professional_center`, que hoy es ADMIN-only y también acepta matrícula. El contrato nuevo cambia exclusivamente `usual_appointment_duration_minutes`, conserva el campo fuente, valida 5–480 y múltiplo de 5, exige contexto activo y aplica CAS sobre el token monotónico existente de ProfessionalCenter.
- Hay riesgo real de lost update si dos ediciones de la misma franja usan el mismo snapshot. El trigger actual de Availability usa `now()`, que no garantiza un token estrictamente creciente dentro de una transacción. Reutilizar `private.set_task006_cas_updated_at()` para updates efectivos, sin reescribir timestamps existentes, es un cambio proporcionado dentro de TASK-008. `FOR UPDATE` + `expected_updated_at` por fila basta; no hace falta copiar el CAS más complejo de Patients. La misma clave advisory de Center existe en las RPCs de Center, membership y ProfessionalCenter. Gate A debe verificar que el nuevo lock compartido use esa clave exacta y se adquiera antes de leer el estado sensible.
- La exclusión GiST `availabilities_no_active_overlap` ya es la autoridad final: mismo ProfessionalCenter + weekday + solapamiento activo falla; intervalos `[inicio, fin)` contiguos, otros días, otros ProfessionalCenter/Centers y filas inactivas no se bloquean mutuamente. La traducción de `23P01` exige el nombre exacto de constraint y mensaje estable, sin SQL crudo. Quitar preserva la fila histórica; una nueva franja inserta otra fila. El crecimiento de inactivas no representa un bloqueo material para el MVP.

### Turnos futuros, tiempo y UI

- La advertencia booleana tras guardar es viable en esta tarea como consulta `EXISTS` privada, de sólo lectura y sobre el mismo ProfessionalCenter. No necesita slot generator, devuelve cero IDs/datos personales y mantiene appointments intactos. Su alcance debe mantenerse tal como está: no crear lógica de Agenda ni resolver turnos fuera de horario. La comprobación del SQL y las pruebas deben exigir los bordes `[inicio, fin)`, fecha local y estado CANCELLED; el mensaje es informativo, no una garantía de disponibilidad para reservar. Existe un índice `(professional_center_id, starts_at)` para acotar la búsqueda, pero Gate A debe revisar el plan de consulta y su costo con datos representativos.
- La subruta de detalle y el índice de entrada satisfacen el acceso de ADMIN, RECEPTION y PROFESSIONAL propio sin reescribir permisos de Professionals. La RPC de contexto devuelve sólo nombre, ID, duración y token; evita ampliar SELECT sobre columnas personales de Professionals para RECEPTION. La ruta ajena/inactiva y la plataforma sin membership fallan cerradas. `CenterNavigation` hoy oculta todo a PROFESSIONAL, por lo que el cambio de navegación previsto es necesario.
- La UX contempla siete días verticales, varias franjas, alta, edición inline, cancelación, confirmación para quitar, estados vacíos, duración y timezone. Usa el `AppLoader` existente y `PageReveal`, y exige semántica móvil sin scroll horizontal, teclado y foco.
- `start_time`/`end_time` son horas locales recurrentes del Center. No corresponde convertirlas a `timestamptz` ni generar slots en TASK-008. La tabla `centers` sólo exige timezone no vacío, pero la RPC vigente de creación de centros ya comprueba `pg_timezone_names`; el preflight del plan también valida valores existentes. El riesgo de datos cargados por vías privilegiadas sigue documentado y no requiere migration ajena en esta tarea.

### Acciones, verificación y scope

- Las Server Actions planeadas validan con Zod, reautorizan mediante `requireRole`, llaman servicios/RPC y revalidan rutas. La lectura de PROFESSIONAL corresponde a Server Component/query bajo RLS; no necesita Action de lectura. El mapping de errores usa pares código/token o constraint conocidos y no expone texto SQL.
- La matriz de pruebas cubre roles y denegaciones, aislamiento, centros/memberships/vínculos inactivos, franjas múltiples/adyacentes, GiST concurrente, stale update/deactivate, duración, deactivación, UX y accesibilidad. La prueba concurrente con barrera observable es apropiada; un sleep no demostraría la carrera.
- El gate DEV es proporcional: identidad/preflight, paridad y dry-run, lint DB, catálogo y pruebas DB focalizadas, suite local, navegador focalizado y cleanup por IDs exactos con auditoría. No requiere repetir el finalizador completo de TASK-007. Los tests históricos `auth-access-foundation.sql` y `task-006b-foundation.sql` enumeran policies/grants exactos; el plan propone ajustar sólo sus expectativas legítimas. Los baselines archivados de TASK-007 no deben reescribirse ni usarse para ocultar drift.
- Fuera de TASK-008 permanecen creación/reprogramación/cancelación de turnos, slots, Agenda, feriados, excepciones, licencias, vacaciones, bloqueos extraordinarios y resolución automática de turnos fuera de horario.

## Hallazgos

Ninguno BLOCKER, HIGH ni MEDIUM. No se identificó ajuste obligatorio del brief o plan antes de solicitar autorización de implementación.

## Riesgos residuales y gate siguiente

- Gate A debe revisar el SQL real de policy, `SECURITY DEFINER`, grants, orden de locks, constraint mapping y consulta booleana antes de aplicar la migration a DEV. Este review evalúa el contrato del plan, no código aún inexistente.
- La advertencia no sustituye la validación de appointments/slots de TASK-009 y puede requerir tratamiento explícito de cambios DST en esa fase.
- El preflight vivo de DEV sigue pendiente de la futura implementación; no se afirma paridad ni ausencia de drift hoy.

## Estado Git al cerrar el review

- Se conserva `M docs/status.md` y `M next-env.d.ts` preexistentes y `.harness/tasks/active/` no trackeado. Este review sólo agregó `TASK-008/review.md`; no hubo stage, commit, push ni PR.
- `next-env.d.ts` quedó sin tocar; SHA-256: `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
