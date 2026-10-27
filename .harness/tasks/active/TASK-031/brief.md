# TASK-031 — Restricciones temporales y confirmaciones de estado

## Objetivo

Agregar límites temporales exactos a Confirmar, Marcar atendido y Marcar ausente, con PostgreSQL como autoridad, y reemplazar las confirmaciones nativas de las acciones de estado por diálogos accesibles del estilo existente. Conservar Cancelar, Reprogramar, la matriz de roles/estados, CAS y el aislamiento por centro.

## Criterios de aceptación

- Confirmar PENDING sólo cuando `clock_timestamp() < starts_at`.
- Marcar ATTENDED desde PENDING/CONFIRMED cuando `clock_timestamp() >= starts_at`, sin límite máximo.
- Marcar NO_SHOW desde PENDING/CONFIRMED cuando `clock_timestamp() >= ends_at`, sin límite máximo.
- La RPC evalúa el tiempo una vez tras `FOR UPDATE`; conserva firma, autorización, grants, `SECURITY DEFINER`, `search_path` y CAS. Error temporal estable y tipado.
- La UI mantiene visibles pero deshabilitadas las acciones temporalmente prematuras, con explicación. Actualiza su presentación al cruzar límites y al volver la pestaña. El servidor revalida al confirmar.
- Confirmar, Atendido, Ausente y Cancelar abren diálogos con paciente, fecha y horario; abrir/volver/cerrar no mutan. Cancelar tiene estilo destructivo. Foco, Escape, pending, error y resultado incierto quedan cubiertos.
- Pruebas locales focales de RPC, Action, UI, límites, roles, concurrencia y responsive a 390/1440; revisión independiente.

## Impacto y riesgos

- Nueva migración incremental sobre `public.staff_transition_appointment_status`; errores y presentación en `src/modules/appointments/`.
- Los relojes cliente pueden diferir; la presentación no autoriza. La RPC decide con tiempo PostgreSQL después del bloqueo.
- Cancelar y Reprogramar pueden seguir ejecutándose en turnos iniciados/finalizados: decisión funcional diferida.
- Los resultados inciertos requieren reconciliación antes de reintentar.

## Restricciones

Base `origin/main` en `d313db616b1e3a2b913e527bcde54333498ac2f9`. Sin worktree, commit, push, PR, merge, despliegue, acceso a Supabase DEV/PROD ni reinicio de Next.js. Preservar archivos locales, `next-env.d.ts`, `.env.local` y TASK-029. Mantener TASK-031 ACTIVE hasta integración formal.

## Pulido visual final autorizado

- Centrar horizontalmente el footer de los cuatro diálogos de estado, con Volver antes de la confirmación, separación uniforme, CTA destructivo intacto y sin overflow a 390 px.
- Separar los mensajes temporales del grupo de acciones aproximadamente 16–20 px, espaciar mensajes entre sí y mantener `aria-describedby` sólo para botones temporalmente deshabilitados. Usar texto secundario y evitar contenedores o iconos nuevos si no hay uno reutilizable.
- Cambiar sólo presentación y textos de ayuda temporal. No tocar lógica, migraciones, Actions, permisos, Cancelar/Reprogramar, TASK-029 ni archivos locales ajenos. Verificar 390/1440, foco/teclado/pending y obtener review independiente focal antes de la validación visual humana.

## Icono de reloj en mensajes temporales

La persona usuaria aprobó separación y redacción. Agregar sólo un icono decorativo tipo Clock3, de 16–18 px, `currentColor` y `aria-hidden`, a los mensajes de Atendido y Ausente. Mantener 8 px entre icono y texto, alineación en varias líneas, márgenes aprobados y ausencia de overflow a 390 px. Reutilizar un icono existente si lo hay; de lo contrario SVG local sin dependencia. No tocar diálogos, lógica ni archivos ajenos. Captura final de Acciones, pruebas focales y review proporcional antes de aprobación visual humana.

## Gate final autorizado — 2026-10-27

La persona usuaria aprobó visualmente TASK-031, incluidos diálogos e iconos, y autorizó expresamente el gate técnico final, commit, push de esta rama y Pull Request hacia `main`. Esta autorización actualiza sólo la prohibición anterior de commit/push/PR. TASK-031 sigue ACTIVE hasta integración y cierre formal. No autoriza merge, despliegue ni migraciones en DEV/PROD. Preservar `next-env.d.ts`, `.env.local`, archivos ajenos, servidor Next.js y TASK-029.
