# TASK-021 — Preparación de cleanup Auth exacto del run fallido

**Cierre posterior (2026-10-22):** la persona usuaria ejecutó una vez el procedimiento y
comunicó `TASK021_FUNCTIONAL_CLEANUP_PASS runId=c8c10bdb-705b-405e-8990-070edcd8bde6
resources=14 residue=0`. La comprobación local posterior encontró el ledger en `cleaned`,
seis `delete_ack`, inventario final 14/14 igual al baseline, evidencia del `23P01`
preservada y `active.lock` ausente. El resto de este documento conserva la preparación
histórica previa al cleanup. El estado actual y el comando reservado para un nuevo `run`
están en [gate-b-rerun-readiness.md](gate-b-rerun-readiness.md); ese `run` aún requiere
autorización nueva y específica.

## Estado y autorización

La persona usuaria comunicó `TASK021_FUNCTIONAL_PREFLIGHT_PASS` y una conciliación read-only
del run `c8c10bdb-705b-405e-8990-070edcd8bde6`: seis `auth.users` propios y cero filas
propias en las otras trece tablas. Este agente no consultó DEV ni ejecutó `cleanup`. La
autorización de `run` está consumida; la autorización nueva y específica de `cleanup` se
registró más abajo y aún no se utilizó.

El ledger local conserva `stage=db_rolled_back`, evidencia `23P01`, seis actores Auth con IDs
y correos, baseline de 14 recursos y ningún inventario final. Su SHA-256 sigue siendo
`1B03FAF23A83D7777012C6A8593C49CCCF92EA2E91F492924B2994C0716A2D29`.
`active.lock` existe y contiene ese runId. Ninguno de esos dos archivos fue modificado por la
preparación.

## Recursos elegibles, exclusivamente en DEV

| Actor | Auth UUID |
| --- | --- |
| adminA | `fb317884-7b96-4050-b363-f05e8af7d73e` |
| receptionA | `b7acd5d6-befc-4d97-b479-81168063a235` |
| professionalA | `86d1a252-a771-4471-bf1e-800d508071f7` |
| professionalA2 | `b2e6b1de-cc45-46f1-bc31-718459ca8336` |
| adminB | `8bc9a90c-44b9-4b8b-8e71-885b582c2e54` |
| unlinked | `74eefdb1-2467-4548-9651-2ade663ddf80` |

El correo exigido para cada actor es exactamente
`task021-c8c10bdb-705b-405e-8990-070edcd8bde6-<actor en minúsculas>@example.test`.
Cada cuenta debe tener `user_metadata.gate=TASK-021` y `user_metadata.runId` exacto. El
borrado se hace por estos seis UUID, nunca por un prefijo de correo.

## Procedimiento preparado

Se reutiliza `scripts/task021-functional-dev/run.ps1 -Mode cleanup` y el ejecutor
`gate.mjs`. Una rama exclusiva de este run impide que el cleanup genérico alcance a borrar
filas SQL. Antes del primer `deleteUser`:

1. `run.ps1` exige project ref DEV exacto, CA aprobada y contraseñas PostgreSQL/Auth Admin
   ocultas. `gate.mjs` comprueba identidad, 25 migrations, catálogo y ambas RPC.
2. El ledger debe conservar el SHA-256 original, versión 1, runId/proyecto exactos,
   `db_rolled_back`, evidencia `23P01`, seis UUID y correos fijados y baseline válido. No
   puede existir intento previo de cleanup ni inventario final. `active.lock` debe existir,
   pertenecer al mismo runId y conservar su `createdAt` original. La comprobación de SHA
   aplica sólo a `cleanup`, de modo que `reconcile` siga disponible tras un fallo parcial.
3. `ownership(...allowPartial:true)` exige cero filas propias en las otras trece tablas. Un
   snapshot `REPEATABLE READ READ ONLY` consulta Auth por UUID, email o `runId` exactos,
   requiere exactamente las seis identidades y compara los 14 inventarios con el baseline al
   descontar sólo esos seis UUID de `auth.users`. Así se detecta drift ajeno antes de escribir.
4. Auth Admin `getUserById` confirma ID, correo, gate y runId para las seis cuentas antes del
   primer borrado.

El ejecutor registra en el ledger cada `auth_cleanup_attempt`, respuesta `delete_ack` o
resultado `uncertain`; llama a Auth Admin `deleteUser(id)` una vez por UUID. Un error detiene
inmediatamente las escrituras y conserva ledger y lock. No hay reintento automático: una
ejecución posterior con stage distinto de `db_rolled_back` se rechaza y requiere conciliación
read-only y autorización nueva.

Después de seis respuestas exitosas, `absent()` comprueba IDs y emails ausentes y las filas
SQL propias ausentes. Un nuevo snapshot exige cero identidades por UUID, email **o runId** y
14 inventarios exactamente iguales al baseline. Un postcheck verifica de nuevo 25 migrations,
catálogo/RPC e inventarios. Sólo entonces guarda `cleanup_verified`, comprueba el lock,
lo libera, guarda `cleaned` y emite `TASK021_FUNCTIONAL_CLEANUP_PASS ... residue=0`.

Auth Admin no ofrece una transacción común para seis eliminaciones. Si falla una llamada, una
verificación final o el proceso entre `cleanup_verified` y `cleaned`, se conserva evidencia y
no se declara PASS. La recuperación requerirá inspeccionar el estado remoto y el ledger antes
de decidir otra acción; no se hará un segundo intento a ciegas.

## Validación y revisión

`LOCAL_RECOVERY_LEDGER_PASS`: runId, stage, seis actores y 14 recursos. Tests focales del
cleanup, inventario y plan: **17/17 PASS**. Cubren éxito completo, UUID/runId/gate/correo o
identidad ajena, SQL inesperado, drift de inventario, metadatos Auth Admin incorrectos, fallo
parcial, residuo final y orden de ledger/lock. ESLint, Prettier, `node --check` y
`git diff --check` PASS. La migration aprobada mantiene SHA-256
`7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`.

Revisión independiente focal: **PASS sin bloqueantes**. Confirmó que la ruta exclusiva no
permite PASS con cuentas faltantes, ajenas, metadatos distintos, filas SQL propias, drift o
fallo parcial; conserva ledger y lock hasta las verificaciones finales. No se accedió a DEV ni
PROD, ni se modificaron RPC, RLS, migrations, UI o datos remotos.

## Autorización específica recibida

La persona usuaria autorizó **una única ejecución** de `cleanup` para este runId y estos seis
UUID, exclusivamente desde su PowerShell con credenciales ocultas. Esta autorización no
incluye otro `run`, migrations, fixtures, escrituras SQL ni PROD. El ejecutor hará un nuevo
preflight y todas las precondiciones antes de la primera eliminación; cualquier discrepancia
detiene la operación. Este agente no ejecutó el comando.

La comprobación local posterior a la autorización confirmó que el ledger sigue en
`db_rolled_back`, con seis actores, 14 recursos y SHA-256 original, y que `active.lock`
conserva runId y `createdAt` originales. Esto no sustituye el preflight remoto del comando.

## Comando autorizado para ejecución única desde PowerShell de la persona usuaria

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode cleanup -ConfirmProjectRef ehllxymqyzrofydrvtzo -RunId c8c10bdb-705b-405e-8990-070edcd8bde6
```

Si el comando se detiene, conservar salida, ledger y lock; no repetir `cleanup` sin
conciliación y autorización nuevas. Un nuevo Gate B `run` sigue prohibido hasta confirmar
`CLEANUP_PASS` y `residue=0`.
