# TASK-038 — Informe de implementación para review

Estado actual: revisión técnica y visual aprobadas, migración aplicada y validada en DEV, tipos
regenerados; pendiente de Pull Request y merge. Las secciones siguientes conservan los resultados
y límites de cada fase al momento de ejecutarla.

## Ajustes finales de Agenda (2026-11-16)

La página real ya pasaba el rango civil de `agendaRange` a `staff_list_availability_blocks`; la RPC restringe su resultado a bloqueos que intersectan ese rango. También conservaba la autorización por rol y los filtros por profesional y especialidad. El exceso de bloqueos observado provenía de la vista sintética, que pasaba cuatro bloques al componente sin esa consulta. El componente filtraba solo por profesional. Ahora filtra también por intersección con el mismo rango, lo que limita aviso y marcas de las tres vistas aun con props sintéticas. Semana muestra el intervalo lunes-domingo, incluidos cruces de mes y año; Día y Mes conservan sus encabezados.

Verificación de esta fase: 34/34 pruebas focales en cuatro archivos (Agenda componente, interacciones, página y cálculo de rango), TypeScript, ESLint focal, Prettier focal y `git diff --check` PASS. La vista sintética de Día/Semana/Mes a 1440 y 390 px pasó con 1/2/4 bloques visibles, sin solicitudes externas ni errores de página. Capturas en `artifacts/task038-visual/`. No se cambió PostgreSQL, migración, RPC, RLS, permisos, lógica de Disponibilidad ni sus diseños aprobados.

## Refinamiento visual previo a DEV (2026-11-16)

La persona usuaria informó la aprobación técnica `TASK038_APPROVED_FOR_DEV_VALIDATION`. En esta fase se ajustaron solo la presentación de `availability-blocks-section.tsx` y del aviso de bloqueos en `agenda-calendar.tsx`: campos alineados, espacio entre revisión y acciones, cierre superior con icono accesible, fechas como dato principal, motivos legibles, filas sobrias, retiro compacto con CTA destructiva y aviso de Agenda con chips que envuelven en móvil. El guion de vista sintética se amplió a cuatro bloqueos y captura ambos modales y el aviso en Día/Semana/Mes.

Validación de esta fase: 49/49 pruebas focales de Disponibilidad y Agenda, TypeScript, ESLint y Prettier focales de código, `git diff --check`, y vista sintética a 1440 y 390 px, sin solicitudes externas ni errores de página. El guion verifica que ambos modales caben en el viewport y que el aviso no excede el ancho móvil. La grilla semanal de Agenda conserva su desbordamiento horizontal previo a este refinamiento; el aviso se presenta dentro del ancho visible. No se cambiaron lógica de negocio, validación, SQL, RPC, RLS, locks ni migración, ni se aplicó nada en DEV. La vista local aislada es `http://127.0.0.1:31038/` y `http://127.0.0.1:31038/agenda?view=week`.

## Remediación tras CHANGES_REQUESTED (2026-11-16)

- `localhost:3003` escuchaba desde `node_modules/next` de este worktree, rama `codex/task-038-availability-blocks`. El detalle de Disponibilidad llama a `staff_list_availability_blocks`; el índice no llama a esa RPC. La consulta REST de solo lectura a Supabase DEV, con los mismos dos nombres de parámetros que envía la página, devolvió HTTP 404, código `PGRST202`, mensaje exacto: `Could not find the function public.staff_list_availability_blocks(p_center_id, p_professional_center_id) in the schema cache`. La tabla `availability_blocks` también falta (`PGRST205`); la RPC anterior del índice sí existe (responde `42501` al usuario anónimo). La pantalla propaga el error de la RPC nueva al `src/app/error.tsx`, que muestra «No pudimos cargar la página». La migración no aplicada en DEV explica este fallo del detalle; no se cambió el manejo de errores. No se capturó el stack de la sesión de Next original porque su salida no estaba disponible; la misma RPC se comprobó directamente en DEV.
- CANCELLED toma el lock exclusivo de Center antes de leer el ProfessionalCenter del turno, luego el lock compartido de ese ProfessionalCenter y finalmente `FOR UPDATE`. RESCHEDULE y bloqueos toman primero el lock de Center, de modo que la asignación no cambia mientras se adquiere el lock del ProfessionalCenter. Las demás transiciones conservan el lock de Center compartido; se copiaron sus reglas de autorización, CAS y tiempo sin cambios.
- La tabla exige `isfinite(start_date)` y `isfinite(end_date)`. Listado con filtros, vista previa y creación rechazan ambas fechas especiales con `INVALID_AVAILABILITY_BLOCK`.
- `scripts/task038-visual.mjs --serve` publica los componentes reales con datos sintéticos en `http://127.0.0.1:31038/` y `/agenda?view=day|week|month`. Las Actions de la vista están simuladas y no hay solicitudes a Supabase. Capturas de escritorio y móvil en `artifacts/task038-visual/`; el script verificó cero solicitudes externas y cero errores de página. Se comprobó visualmente el modal y Agenda.
- PostgreSQL local: migración completa PASS; `node scripts/task038-local-db.mjs` PASS con fechas especiales en CHECK/RPC, cancelación antes/después de bloqueo, espera de transacciones, conteo obsoleto, permisos de PROFESSIONAL y CAS obsoleto. Los fixtures se limpiaron y la base local se detuvo con `--no-backup`. Docker necesitó liberar memoria: se pausó `3003` y después se restauró; responde HTTP 307 en la raíz.
- Vitest focal 25 archivos / 234 pruebas PASS; TypeScript PASS; ESLint PASS con un warning preexistente; Prettier focal PASS; `git diff --check` PASS.

La revisión independiente debe repetirse. La prueba real de navegador con DEV sigue pendiente de autorización y aplicación de la migración allí, seguida de regeneración y comparación de tipos, E2E autenticado y revisión visual con datos reales. No hubo migraciones remotas, commit, push ni deploy.

## Base y aislamiento

- Worktree: `.worktrees/task-038-availability-blocks`.
- Rama: `codex/task-038-availability-blocks`, desde `origin/main` `08a2125ef2cd01d7a5041cf11a6e21977c853977` tras `git fetch origin`.
- El directorio original conservó sus modificaciones y archivos sin seguimiento. TASK-029, portfolio DEMO, autenticación, Vercel y Cloudflare no se tocaron.
- Solo se aplicó la migración en PostgreSQL local iniciado con `supabase start -x ...`; DEV y PROD no se modificaron.

## Cambios propuestos

- `20261116120000_add_availability_blocks.sql`: tabla por ProfessionalCenter con fechas `date` inclusivas, motivo enumerado por CHECK, `is_active`, exclusión GiST de rangos activos, RLS SELECT para staff del centro o profesional propio, sin DML directo autenticado. RPCs para listado, revisión de cantidad afectada, creación y retiro lógico; grants de ejecución solo a `authenticated`.
- La creación compara bajo lock el conteo revisado por el usuario. Si cambió, rechaza con `STALE_BLOCK_PREVIEW`. Con turnos no cancelados requiere confirmación explícita. Los turnos existentes no se actualizan.
- CREATE/RESCHEDULE toman el advisory lock compartido por ProfessionalCenter después del lock de Center y antes de locks de filas; crear/quitar bloqueo toma el mismo lock exclusivo. `appointment_slot_grid` omite fechas bloqueadas y es usado por búsqueda y validación final de reservas. Se conserva `appointments_no_blocking_overlap`.
- Disponibilidad: sección en el detalle del profesional con listado, vacío, modales de revisión/confirmación/retiro, vínculo a turnos filtrados, feedback y lectura propia para PROFESSIONAL.
- Agenda: lectura autorizada de bloqueos del período, resumen separado de turnos, sombreado contextual Día/Semana e insignia Mes. Filtros de profesional y especialidad se respetan; señalar una fecha bloqueada informa la causa.
- Contratos Zod, servicio y Actions delgadas. `database.types.ts` contiene una proyección local del contrato; la regeneración desde DEV queda pendiente hasta autorizar allí la migración.

## Verificación

- `pnpm bootstrap`: PASS en worktree tras copiar solo `.env.local` ignorado y el `project-ref` local desde el checkout original.
- Migración completa aplicada a la base Supabase **local**, incluyendo todas las migraciones anteriores: PASS.
- `node scripts/task038-local-db.mjs`: PASS. Cubre un día, varios días, fechas inválidas, solapamiento, búsqueda de slots, CREATE y RESCHEDULE rechazados, conservación de turnos, advertencia/conteo, retiro lógico, restauración, ADMIN/RECEPTION/PROFESSIONAL, aislamiento entre centros, fecha civil de `Pacific/Auckland`, y ambas direcciones de la carrera bloqueo/reserva. Fixtures exactos limpiados.
- Vitest focal de Disponibilidad, Turnos y Agenda: 25 archivos, 234/234 pruebas PASS tras el último ajuste.
- TypeScript: PASS. ESLint completo: PASS con 1 warning preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs`.
- Prettier global: FAIL de baseline en 415 archivos preexistentes; Prettier focal de todos los archivos de código modificados: PASS.
- `git diff --check`: PASS.

## Pendiente para DEV

1. Obtener autorización explícita para aplicar la migración incremental en Supabase DEV. Nunca aplicarla automáticamente a PROD.
2. Regenerar `database.types.ts` desde DEV y revisar el diff antes de usar el cliente de la app.
3. Con DEV preparado, probar localhost en escritorio y móvil, incluyendo ADMIN, RECEPTION y PROFESSIONAL, filtros de Agenda, modal y turnos preexistentes; ejecutar E2E con fixtures sintéticos y limpieza exacta.
4. Realizar review independiente de SQL, permisos, concurrencia, UI y diff. No hay commit, push ni deploy.
