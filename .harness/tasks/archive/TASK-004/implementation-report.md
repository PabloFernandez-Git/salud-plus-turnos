# TASK-004 — Implementation Report

**Estado:** `READY_FOR_REVIEW`
**Rol:** Implementer

## Resultado

- El esquema PostgreSQL inicial aprobado quedó implementado y aplicado exclusivamente en Supabase
  DEV `ehllxymqyzrofydrvtzo` (`salud-plus-turnos-dev`, `sa-east-1`).
- No se ejecutaron migrations, seeds, resets ni otras operaciones contra PROD.
- No se crearon usuarios reales, datos demo persistentes, Auth funcional, policies permisivas,
  helpers `SECURITY DEFINER`, UI ni clientes privilegiados.
- Los datos usados por la suite principal se ejecutaron dentro de una transacción revertida. La
  prueba concurrente creó fixtures artificiales identificables y los eliminó en un bloque `finally`.
- Los ciclos posteriores al review resolvieron exclusivamente los hallazgos `MEDIA`. Este último
  ciclo reemplazó el gate temporal que mantenía abierta a A por un latch controlado explícitamente.
  No modificó schema, migrations, enums ni constraints.

## Migrations aplicadas

| Migration | Resultado |
| --- | --- |
| `20260921150000_initial_domain_schema.sql` | PASS — migration inicial aplicada en DEV. |
| `20260921170000_enforce_normalized_document_not_null.sql` | PASS — corrección mínima e inmutable de nullabilidad aplicada en DEV. |
| `20260921210000_use_explicit_appointment_blocking_statuses.sql` | PASS — exclusion constraint recreada con la lista cerrada de estados bloqueantes. |

La primera generación de tipos reveló que `normalized_document`, aunque no podía producir `NULL` por
su expresión y columnas fuente, no tenía `NOT NULL` declarado en catálogo. Como la migration inicial
ya estaba aplicada, no se reescribió: se agregó la segunda migration y se repitieron todas las
verificaciones. El comportamiento aprobado no cambió.

Las dos migrations previamente aplicadas permanecieron inmutables. La tercera elimina
`appointments_no_blocking_overlap` y la recrea sin modificar columnas, operadores, rango, nombre ni
ninguna otra regla del schema.

## Correcciones del review `CHANGES_REQUESTED`

### Predicado parcial cerrado

Definición anterior:

```sql
where (status <> 'CANCELLED')
```

Definición final equivalente en catálogo:

```sql
where (
  status = any (
    array[
      'PENDING'::appointment_status,
      'CONFIRMED'::appointment_status,
      'ATTENDED'::appointment_status,
      'NO_SHOW'::appointment_status
    ]
  )
)
```

La migration se escribió con `status IN (...)`; PostgreSQL la representa como el `ANY (ARRAY[...])`
anterior. Un futuro valor del enum queda fuera del índice hasta que una migration decida
explícitamente si bloquea. El test de catálogo compara el predicado completo y cerrado, sin modificar
artificialmente el enum productivo.

### Barrera de concurrencia determinística

`pg_sleep(240)` seguía siendo una lease temporal: aunque era más amplia que el polling anterior,
podía finalizar y liberar el gate antes de que la latencia acumulada de CLI/API permitiera observar a
B. El tercer review reprodujo exactamente ese caso en una de diez corridas. A partir de esta
corrección no existe ningún `pg_sleep` ni duración que permita continuar a A.

El runner incorporó `pg` como dependencia de desarrollo y abre cuatro conexiones PostgreSQL
persistentes usando el login temporal oficial de Supabase CLI, validado contra el host directo o el
pooler del mismo project ref DEV:

1. `controller` adquiere un advisory lock de sesión con una clave aleatoria de 64 bits exclusiva de
   la ejecución y lo conserva después de que su consulta termina;
2. A ejecuta `BEGIN`, obtiene su PID, completa el primer `INSERT`, adquiere un marker transaccional
   también único y luego llama `pg_advisory_xact_lock(gateKey)`;
3. como `controller` todavía posee exactamente ese lock, A queda detenida antes del `COMMIT`, con
   `xact_start` activo, `wait_event_type = 'Lock'` y `wait_event = 'advisory'`;
4. el observador compara la identidad completa del lock concedido a `controller` con el lock no
   concedido de A y exige que `pg_blocking_pids(A)` contenga el PID del controller;
5. B ejecuta `BEGIN`, obtiene su PID y marker único e inicia el `INSERT` incompatible, conservando su
   Promise sin esperarla;
6. el observador sólo acepta la barrera completa si A y B siguen pendientes, A continúa detrás del
   mismo gate, B tiene un lock `transactionid` no concedido, B informa
   `wait_event_type = 'Lock'`/`wait_event = 'transactionid'` y `pg_blocking_pids(B)` contiene el PID
   exacto de A;
7. únicamente esa condición provoca `releaseGate()`, implementado como
   `controller -> pg_advisory_unlock(gateKey)`; A continúa y Node ejecuta su `COMMIT`;
8. el `INSERT` de B debe rechazarse con el código nativo del driver exactamente igual a `23P01`. El
   nombre de `appointments_no_blocking_overlap`, si está disponible, continúa siendo evidencia
   secundaria y nunca sustituye al SQLSTATE;
9. se comprueba exactamente una fila antes del cleanup.

Los markers de A y B usan claves distintas y nadie compite por ellos. El advisory gate sólo demuestra
que A no puede confirmar; la evidencia de la exclusion constraint continúa siendo exclusivamente B
esperando `Lock/transactionid` con A dentro de `pg_blocking_pids(B)`.

El polling usa intervalos de 150 ms y un watchdog de 180 s. La conexión tiene un watchdog de apertura
de 20 s y cada paso de cleanup uno de 30 s. Alcanzar cualquiera de esos límites provoca `FAIL` y entra
al `finally`; ningún timer ejecuta `releaseGate()`, `COMMIT` ni permite continuar el escenario.

El `finally` libera el advisory lock del controller si sigue tomado, espera que A salga del gate,
hace `ROLLBACK` de A y B si siguen abiertas, cierra controller/A/B/observer, elimina fixtures y audita
la ausencia de sesiones y advisory locks. Cada paso se aísla para que un fallo no omita los
siguientes, y el error original del escenario nunca queda oculto.

## Objetos PostgreSQL creados

- Extensión `btree_gist` en `extensions`.
- Enums públicos `membership_role` y `appointment_status` con los valores aprobados.
- Schema no expuesto `private`, sin `USAGE` para `PUBLIC`.
- `private.normalize_document(text)`: `IMMUTABLE`, `STRICT`, `SECURITY INVOKER`, `search_path` fijo y
  sin `EXECUTE` para `PUBLIC`, `anon` ni `authenticated`.
- `private.set_updated_at()`: trigger function `SECURITY INVOKER`, `search_path` fijo y privilegios
  mínimos.
- Tablas: `centers`, `users`, `center_memberships`, `professionals`, `professional_centers`,
  `specialties`, `professional_center_specialties`, `persons`, `patient_centers`, `availabilities` y
  `appointments`.
- PK, FKs restrictivas, FKs compuestas multi-centro, UNIQUE, CHECK, índices funcionales/parciales/de
  consulta, dos exclusion constraints GiST y once triggers de `updated_at`.
- RLS habilitada en las once tablas; cero policies en TASK-004; privilegios de tabla revocados a
  `anon` y `authenticated`.

## Normalización documental

`private.normalize_document` aplica `btrim`, `upper`, elimina whitespace reconocido por la clase
POSIX `[[:space:]]`, el punto ASCII `U+002E` y únicamente estos guiones/separadores equivalentes:

```text
U+002D HYPHEN-MINUS
U+2010 HYPHEN
U+2011 NON-BREAKING HYPHEN
U+2012 FIGURE DASH
U+2013 EN DASH
U+2014 EM DASH
U+2015 HORIZONTAL BAR
U+2212 MINUS SIGN
U+FE58 SMALL EM DASH
U+FE63 SMALL HYPHEN-MINUS
U+FF0D FULLWIDTH HYPHEN-MINUS
```

No elimina todos los caracteres no alfanuméricos, no translitera, no convierte a número y conserva
ceros iniciales. `persons.normalized_document` y `professionals.normalized_document` son generated
stored y `NOT NULL`.

## Verificación de integridad

`pnpm db:test:schema:dev` ejecuta `supabase/tests/initial-domain-schema.sql` con `BEGIN`/`ROLLBACK` y
luego una prueba concurrente real con dos procesos de Supabase CLI.

| Grupo | Resultado |
| --- | --- |
| Catálogo, tablas, enums, constraints, índices y triggers | PASS. |
| Normalización exacta, caracteres preservados, no transliteración y ceros iniciales | PASS. |
| Unicidad y documento vacío de `Person` y `Professional` | PASS. |
| Nacionalidad minúscula, longitud inválida y carácter no ASCII | PASS — rechazadas. |
| Duración habitual 5/30/480, 0/481/no múltiplo de 5 | PASS. |
| Matrícula nula y duplicada | PASS — permitidas. |
| Membership: rol/vínculo, único User-Center, enum y mismo centro | PASS. |
| Especialidades case/trim, acento, nombre inactivo reservado y otro centro | PASS. |
| FKs cross-center de paciente, profesional, especialidad y asignación | PASS — rechazadas. |
| Disponibilidad: weekday, orden, contiguidad, solapamiento, inactiva y otro ProfessionalCenter | PASS. |
| Turnos: estados bloqueantes, `[)`, parcial/total/contenido y contiguidad | PASS. |
| Predicado GiST cerrado a `PENDING`, `CONFIRMED`, `ATTENDED`, `NO_SHOW` | PASS — catálogo exacto. |
| `CANCELLED` libera intervalo y conserva historia | PASS. |
| Simultaneidad entre ProfessionalCenter distintos del mismo Professional | PASS. |
| Reprogramación hacia un intervalo ocupado | PASS — rechazada. |
| `updated_at` ignora el valor enviado por cliente | PASS. |
| Inactivación de asignación con turno histórico | PASS. |

## Concurrencia

- Evidencia previa al commit: cada corrida imprimió los PID independientes de controller, A y B. A
  estaba detenida detrás del lock de controller y B estaba pendiente en `Lock/transactionid`,
  bloqueada por ese PID exacto de A.
- En ese punto A había completado su `INSERT`, conservaba su marker, seguía con transaction abierta y
  no podía llegar al `COMMIT`; B conservaba su marker y ambas Promises continuaban pendientes.
- Después del `pg_advisory_unlock` explícito: A confirmó; B fue rechazada por
  `appointments_no_blocking_overlap` con SQLSTATE nativo exactamente `23P01`.
- Una consulta posterior confirmó exactamente una fila antes de la limpieza.
- Se ejecutó un lote automático que abortaba ante el primer exit code no cero: las diez ejecuciones
  consecutivas finales completaron la secuencia y dieron `10/10 PASS`.
- Resultado final por corrida:
  `Initial schema verification passed, including real concurrent transactions.`

## Seguridad, RLS y privilegios

| Verificación | Resultado |
| --- | --- |
| RLS habilitada en las once tablas | PASS. |
| Policies públicas creadas por TASK-004 | PASS — cero. |
| Privilegios de tablas para `anon`/`authenticated` | PASS — ninguno. |
| Prueba real `SET LOCAL ROLE anon` | PASS — `permission denied for table centers`. |
| Prueba real `SET LOCAL ROLE authenticated` | PASS — `permission denied for table centers`. |
| Funciones propias `SECURITY DEFINER` | PASS — ninguna. |
| Funciones privadas con `search_path` fijo y sin `EXECUTE` de roles API | PASS. |
| `supabase db lint --linked --schema public --fail-on error` | PASS — sin errores. |
| `supabase db advisors --linked --type security --fail-on error` | PASS — sin issues. |
| Cliente `service_role` o secreto nuevo | PASS — ninguno. |

## Tipos generados

- `pnpm db:types`: PASS después de las tres migrations.
- `src/lib/supabase/database.types.ts` fue regenerado desde DEV; no se editó manualmente.
- Contiene las once tablas, ambos enums, relaciones y `normalized_document: string` no nullable en
  `Person` y `Professional`.
- SHA-256 antes/después: `2166323A6001988B0EF4BB4C768B5D779EFD5D71B3A6B5E1D127FF7056D1E263`;
  la corrección del índice no cambió el contrato TypeScript.

## Checks finales

| Comando | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0, config y link DEV coherentes. |
| `pnpm supabase:check:dev` | PASS — health check read-only. |
| `pnpm db:test:schema:dev` | PASS — suite SQL completa y runner concurrente `10/10 PASS` consecutivos. |
| `pnpm db:types` | PASS. |
| `supabase migration list --linked` | PASS — tres migrations sincronizadas local/remoto. |
| `supabase db lint/advisors --linked` | PASS — cero errores/issues de seguridad. |
| `pnpm format:check` | PASS — el formateador oficial normalizó finales de línea antes del check. |
| `pnpm check` | PASS — ESLint, TypeScript y 17 tests en 5 archivos. |
| `pnpm build` | PASS — build productivo de Next.js. |
| `pnpm security:check:client-bundle` | PASS — fuentes y artefactos cliente sin secretos. |
| `git diff --check` | PASS. |

La auditoría remota final confirmó las tres migrations sincronizadas local/remoto, once tablas con
RLS, cero policies, cero filas persistentes en las tablas del dominio, cero usuarios Auth temporales,
cero advisory locks del runner y cero sesiones residuales del test concurrente. `database.types.ts`
conservó antes y después el SHA-256
`2166323A6001988B0EF4BB4C768B5D779EFD5D71B3A6B5E1D127FF7056D1E263`.

## Desviaciones, riesgos y límites

- Desviaciones funcionales respecto de `schema-proposal.md`: ninguna.
- Desviación de historia: se requirió una migration correctiva para expresar `NOT NULL` en catálogo;
  la migration inicial aplicada se mantuvo inmutable.
- La tercera migration expresa de forma cerrada la semántica ya aprobada; no cambia el comportamiento
  de ninguno de los cinco estados actuales ni rediseña el schema.
- Las policies funcionales de Auth/memberships siguen fuera de alcance; mientras tanto el schema es
  deliberadamente inaccesible para `anon` y `authenticated`.
- Actividad de filas, disponibilidad efectiva, pasado, timezone IANA, transición de estados y rol se
  validarán en una operación server-side/transaccional futura, tal como define el diseño aprobado.
- Los tests remotos requieren login de Supabase CLI, link DEV válido y conectividad.

No se modificó `review.md`; TASK-004 no se cerró ni archivó.
