# TASK-004 — Plan

**Estado:** `READY_FOR_REVIEW`

## Estrategia

Separar estrictamente diseño e implementación. El dominio y las decisiones humanas aprobadas ya
fueron convertidos en un contrato relacional cerrado. La etapa posterior deberá materializarlo como
una migration SQL versionada, aplicarla sólo en DEV, probarla, regenerar tipos y pasar reviews
independientes de Database/RLS y Security.

## Etapa 1 — Startup y verificación previa (completada)

1. Leer las instrucciones globales, el Harness, producto, reglas, arquitectura, módulos y decisiones
   técnicas relevantes.
2. Inspeccionar el schema tipado actual y los scripts de Supabase.
3. Confirmar que `main` esté limpia y sincronizada con `origin/main` mediante `git fetch` y comparación
   de commits.
4. Ejecutar `pnpm bootstrap`.
5. Verificar por operaciones de sólo lectura:
   - identidad, región, salud y link de Supabase DEV;
   - que `public` siga sin tablas ni otros objetos del dominio;
   - que el archivo de tipos represente ese schema vacío.
6. Crear `task/004-initial-postgres-schema` desde el commit verificado.

## Etapa 2 — Diseño documental (completada)

1. Definir entidades, relaciones y ownership por centro.
2. Proponer columnas y tipos PostgreSQL sin escribir DDL ejecutable.
3. Diseñar FKs compuestas para impedir relaciones cruzadas entre centros.
4. Proponer unicidad, checks, inactivación y timestamps.
5. Diseñar índices según consultas y constraints previsibles.
6. Separar:
   - integridad estructural de primera migration;
   - RLS dependiente de Auth/memberships;
   - reglas de negocio server-side o de una futura operación transaccional.
7. Evaluar exclusion constraints para turnos y disponibilidad y documentar sus costos.
8. Registrar y someter a aprobación humana todas las ambigüedades materiales.
9. Actualizar `docs/status.md` sin presentar la tarea como implementada o cerrada.

## Gate humano del schema (completado)

El humano confirmó explícitamente:

- estrategia `users` ↔ `auth.users` y borrado de identidades Auth;
- vínculo entre una membership `PROFESSIONAL` y `ProfessionalCenter`;
- formato de nacionalidad y algoritmo exacto de documento normalizado;
- ubicación y unicidad de la matrícula profesional;
- alcance de la exclusión de turnos entre centros;
- estados de turno que bloquean horario;
- uso de `btree_gist` y exclusion constraints;
- reglas de duración habitual;
- unicidad normalizada del nombre de especialidad;
- postergación de cualquier copia/sincronización de email en `public.users` para la futura tarea de
  Auth/gestión de usuarios; el schema inicial no agrega esa columna;
- nivel de enforcement PostgreSQL para identificadores IANA.

Todas las decisiones quedaron materializadas en el contrato de `schema-proposal.md`. No quedan
decisiones humanas abiertas dentro del alcance de TASK-004.

## Etapa 3 — Implementación completada; review pendiente

1. Releer Brief, Plan, propuesta y decisiones humanas aprobadas.
2. Crear una única migration inicial coherente en `supabase/migrations/`.
3. Incluir sólo extensiones, enums, tablas, constraints, índices, triggers técnicos y RLS
   default-deny aprobados.
4. Incorporar tests reproducibles de schema, constraints, concurrencia y aislamiento.
5. Aplicar la migration exclusivamente a Supabase DEV después de revalidar el destino.
6. Regenerar `src/lib/supabase/database.types.ts` mediante el script oficial.
7. Ejecutar bootstrap, checks, tests, format, lint, typecheck y build aplicables.
8. Producir `implementation-report.md` con evidencia sanitizada.
9. Solicitar review independiente de Reviewer/Verifier, Database/RLS y Security.
10. Corregir hallazgos y repetir verificaciones según el Task Loop.
11. No aplicar nada a PROD ni cerrar la tarea sin Review PASS y una etapa de cierre separada.

## Archivos modificables en esta actualización documental

- `.harness/tasks/active/TASK-004/brief.md`
- `.harness/tasks/active/TASK-004/plan.md`
- `.harness/tasks/active/TASK-004/schema-proposal.md`
- `docs/status.md`
- documentación permanente de producto/reglas/módulos que contradiga las decisiones aprobadas.

## Archivos explícitamente prohibidos en la etapa actual

- cualquier archivo bajo `supabase/migrations/`;
- `src/lib/supabase/database.types.ts`;
- seeds, fixtures, código de Auth, RLS ejecutable, módulos de producto o UI.

## Estado de los gates

- `STARTUP_VERIFIED` — completado.
- `SCHEMA_PROPOSED` — completado.
- `SCHEMA_HUMAN_APPROVED` — completado.
- `READY_FOR_IMPLEMENTATION` — completado.
- `READY_FOR_VERIFICATION` — completado.
- `READY_FOR_REVIEW` — **estado actual**.
- `PASS` — no iniciado.
- `CLOSED` — no iniciado.
