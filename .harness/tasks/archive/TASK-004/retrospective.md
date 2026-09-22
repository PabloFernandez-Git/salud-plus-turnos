# Retrospective — TASK-004

## Resultado

TASK-004 dejó implementado y verificado en Supabase DEV el esquema PostgreSQL inicial del MVP. El
review independiente de Database/RLS y Security emitió `PASS`: las once tablas, la integridad
multi-centro, los tipos generados, las exclusion constraints, el default-deny y la limpieza final de
DEV quedaron comprobados. PROD permaneció fuera de alcance.

El cierre conserva exactamente tres migrations aplicadas y sincronizadas con DEV. No existe una
cuarta migration y no se reescribió ninguna migration ya aplicada.

## Qué funcionó

- Las FKs compuestas trasladaron a PostgreSQL invariantes multi-centro que no deben depender de que
  cada caller recuerde validar `center_id`.
- La normalización documental generada por PostgreSQL dejó una única autoridad persistente para
  `Person` y `Professional`, manteniendo el valor original y la deduplicación aprobada.
- `btree_gist` y las exclusion constraints GiST protegieron en la base los solapamientos de
  disponibilidad y turnos, incluidos escritores concurrentes.
- Habilitar RLS en las once tablas sin policies permisivas ni grants para roles API produjo el
  default-deny deliberado de esta etapa, sin anticipar Auth ni autorización funcional.
- La regeneración desde DEV mantuvo `database.types.ts` alineado con nulabilidad, enums, relaciones y
  las once tablas reales.
- La separación entre Implementer y review independiente permitió revisar no sólo el resultado de
  PostgreSQL, sino también la calidad probatoria del runner de concurrencia.

## Fricciones y aprendizajes

### Migrations inmutables

Una migration aplicada no se modifica para corregir el pasado:

```text
migration aplicada
→ defecto descubierto
→ nueva migration correctiva
```

La nullabilidad explícita de `normalized_document` se corrigió con la segunda migration y el
predicado cerrado de estados bloqueantes con la tercera. Las migrations anteriores permanecieron
idénticas a los statements registrados en DEV. Esta disciplina preservó una historia reproducible y
permitió verificarla ordinalmente.

### Predicados explícitos sobre estados

Una regla cerrada no debe expresarse como `status <> valor` si futuros valores del enum podrían
cambiar silenciosamente su alcance. Cuando el conjunto aprobado es cerrado, el predicado debe
enumerar sus miembros. Para turnos, sólo `PENDING`, `CONFIRMED`, `ATTENDED` y `NO_SHOW` bloquean;
`CANCELLED` libera el intervalo y un estado futuro requerirá una decisión y migration explícitas.

### Tests de concurrencia

Un test concurrente no demuestra la carrera mediante sleeps o una ventana temporal. Debe construir
deliberadamente el estado concurrente, observarlo mediante estado real de PostgreSQL y liberar el
flujo sólo después de probarlo. El runner final mantiene A abierta detrás de un gate explícito,
observa B esperando `Lock/transactionid` con `pg_blocking_pids(B) → A`, libera A de forma controlada,
confirma A y exige que B falle con SQLSTATE `23P01`.

### Watchdogs

Los timeouts sólo pueden producir `FAIL` y activar cleanup. Nunca deben liberar gates, confirmar
transactions ni ser la acción que haga avanzar un escenario exitoso. La versión final separa el
polling de observación de la única liberación explícita del gate.

### Herramientas de testing

`pg` se incorporó únicamente como `devDependency` para tooling y tests que necesitan conexiones
PostgreSQL persistentes. Su único uso está en el runner de verificación; no existe un cliente
PostgreSQL directo en `src/`. La decisión arquitectónica continúa siendo Supabase Client como acceso
principal desde la aplicación.

### Review independiente

Los primeros runners podían finalizar con PASS pese a depender de ventanas temporales y conservar
flakiness. El review independiente detectó esas debilidades aunque la protección real de PostgreSQL
ya funcionaba. La evidencia final `10/10 PASS` vale porque la sincronización quedó gobernada por
estado observado, no porque se aumentara un sleep.

## Memoria permanente

- Las decisiones de PostgreSQL documentan el uso intencional de `btree_gist` y exclusion constraints
  para invariantes concurrentes del schema inicial.
- La estrategia de testing documenta que la concurrencia se coordina y observa mediante estado real,
  con watchdogs limitados a fallo y cleanup.
- La decisión de acceso a PostgreSQL aclara que `pg` es una excepción exclusiva de tooling/tests y
  no reemplaza Supabase Client en la aplicación.
- La decisión de autorización conserva la secuencia segura: RLS puede quedar en default-deny antes
  de incorporar policies funcionales junto con Auth.
- `.harness/knowledge/lessons.md` conserva sólo las reglas reutilizables de migrations,
  predicados cerrados y pruebas concurrentes determinísticas; no duplica detalles propios de
  TASK-004.

## Cierre

- Review independiente Database + RLS + Security: PASS.
- Database: PASS.
- RLS/Security: PASS.
- Migrations: PASS — exactamente tres, aplicadas y sincronizadas con DEV.
- Tipos generados: PASS.
- Concurrencia: PASS — `10/10` en el review independiente.
- Limpieza DEV: PASS — sin fixtures persistentes.
- PROD: no utilizado.
- Bloqueos: ninguno.
- Próxima etapa: crear un Task Brief independiente para Auth, usuarios y acceso a centros sobre el
  schema existente; TASK-004 no implementa esa etapa.
- Estado final: CLOSED.
