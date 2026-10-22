# TASK-022 — Aplicación controlada en Supabase DEV (preparada, no ejecutada)

## Identidad y archivo aprobado

- Proyecto: **salud-plus-turnos-dev**; ref **`ehllxymqyzrofydrvtzo`**; región **`sa-east-1`**.
- Conexión PostgreSQL acreditada existente: `aws-0-sa-east-1.pooler.supabase.com:5432`, base `postgres`, usuario `postgres.ehllxymqyzrofydrvtzo`, TLS con la CA DEV ya validada. El preflight confirma que `current_database()` y `current_user` son `postgres` y que PostgreSQL es 17.6. El nombre visible del proyecto se coteja además con el Dashboard antes de autorizar; PostgreSQL no expone ese nombre.
- Único archivo aplicable: `supabase/migrations/20261022120000_add_patient_appointment_history.sql`; SHA-256 **`A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`**. Se recalculó en esta preparación y coincide con el SQL aprobado y ejecutado localmente. El archivo no se modificó.

## Comandos exactos (PowerShell, raíz del repositorio)

Comprobación local, sin red ni credencial:

```powershell
git branch --show-current
Get-FileHash -Algorithm SHA256 -LiteralPath .\supabase\migrations\20261022120000_add_patient_appointment_history.sql
node .\scripts\task022-dev\gate.mjs local
```

La rama debe ser `codex/task-022-patient-history`; el hash debe coincidir exactamente con el anterior. `local` exige que `.env.local`, el link, el metadata del proyecto, el endpoint del pooler y la lista local de **23 migrations previas + TASK-022** correspondan al DEV aprobado. Imprime sólo datos no secretos.

**Preflight DEV de solo lectura**, únicamente tras autorización expresa de conexión:

```powershell
.\scripts\task022-dev\run.ps1 -Mode preflight
```

El launcher pide una sola vez, con entrada oculta, la contraseña PostgreSQL DEV **preexistente**. La pasa sólo al proceso hijo y limpia la variable de entorno al terminar; exige la CA local previamente validada por SHA-256. No invoca flujos CLI sin contraseña que puedan crear o renovar roles. El script abre una transacción `REPEATABLE READ READ ONLY`, comprueba `transaction_read_only=on`, timeout de 10 s, y termina con `ROLLBACK`.

**Aplicación única condicional**, sólo tras autorización específica de escritura y si se acepta que el mismo proceso ejecute un preflight fresco antes de aplicar:

```powershell
.\scripts\task022-dev\run.ps1 -Mode apply
```

Este comando solicita la credencial una sola vez. Primero ejecuta el mismo preflight de solo lectura. Después relee y verifica el SHA-256, bloquea el ledger de migrations, reconfirma las 23 versiones y el catálogo, y ejecuta **sólo las cuatro sentencias de efecto** del archivo aprobado (CREATE INDEX, CREATE FUNCTION, REVOKE, GRANT) dentro de una transacción propia. Registra `20261022120000`, nombre y las seis sentencias originales del archivo en `supabase_migrations.schema_migrations` dentro de la misma transacción; el `BEGIN`/`COMMIT` originales se reemplazan por los límites de esta transacción para que SQL y registro sean atómicos. Verifica firma, ACL, índice, catálogo anterior e inventario antes de `COMMIT`; después realiza un postflight `READ ONLY`. No ejecuta `db push`, `migration up`, otras migrations, seeds, roles ni Vault.

## Condiciones de aceptación y detención

Se detiene **antes de escribir** si no coinciden nombre/ref locales, URL/ref del entorno, link, host/puerto/base/usuario, CA, rama o SHA-256; si falta o falla la credencial existente; si el servidor no es PostgreSQL 17.6, base/rol `postgres`; si las migrations remotas no son exactamente las primeras **23** versiones locales ordenadas; si TASK-022 ya figura en el ledger; si aparece cualquier otra migration local pendiente; o si el esquema relacionado difiere.

La comprobación focal de compatibilidad exige tablas y columnas de Appointments/Patients/Auth necesarias, enum de estados, FK compuestas de appointments, `auth.uid()` y `private.has_active_center_role`, índice anterior, RPCs existentes autorizadas, RLS de appointments activado, cero policies y SELECT directo revocado a `anon`/`authenticated`. La RPC y el índice nuevos deben estar ausentes. Compara además definiciones/ACL de funciones, ACL/RLS de relaciones, policies, índices, privilegios predeterminados, roles y membresías antes/después; cualquier cambio no previsto detiene el proceso. Es una comprobación de compatibilidad de TASK-022, no una auditoría global de todos los esquemas.

El inventario de 14 tablas `auth`/`private`/`public` guarda **sólo conteo y digest de identificadores**, sin mostrar datos personales, y se compara antes/después. Si hay actividad concurrente que lo cambia, el proceso se detiene; después de `COMMIT` no reintenta ni revierte automáticamente. Un error antes de enviar `COMMIT` hace `ROLLBACK`. Si se pierde la respuesta de `COMMIT`, el ejecutor abre una conexión nueva e inspecciona el estado aplicado y el estado pendiente mediante transacciones de solo lectura; informa PASS sólo si el postflight estructural completo confirma la aplicación. Nunca repite `apply` automáticamente.

## Postflight estructural y límite

Se exige ledger con **24** versiones exactas, fila TASK-022 con nombre y sentencias del archivo; una sola firma `staff_list_patient_appointments(uuid,uuid,text,timestamptz,timestamptz,uuid,integer)` con retorno de ocho columnas; owner `postgres`, `STABLE SECURITY DEFINER`, `search_path=""`, EXECUTE efectivo para `authenticated` y denegado a `anon`, `service_role` y PUBLIC; índice nuevo válido `(patient_center_id, starts_at, id)`, índice anterior conservado; RLS/SELECT directo intactos. Catálogo y privilegios preexistentes e inventario de IDs deben coincidir con el preflight.

Esto acredita estructura, permisos y ausencia de DML en el archivo aplicado; el digest de IDs no prueba igualdad de todos los valores de fila ante actividad externa. **No se crean fixtures** en esta etapa. Pruebas funcionales DEV de roles/centros/paginación/DST y cualquier regeneración de tipos o integración UI tienen alcance y autorización posteriores.

## Evidencia de preparación (sin DEV)

- `node scripts/task022-dev/gate.mjs local`: PASS de identidad local, 23 + 1 archivos, SHA-256 y parser de cuatro sentencias de efecto.
- Un shadow PostgreSQL Supabase 17.6 desechable con las 23 migrations previas ejecutó el nuevo runner: `TASK022_SHADOW_RUNNER_PASS prior=23 applied=1 postcheck=PASS`. Se detectó y corrigió en el runner una conversión `"char"` del snapshot de policies; no cambió la migration aprobada ni la evidencia SQL anterior. El contenedor shadow se detuvo y `--rm` lo eliminó.
- No hubo conexión, lectura ni escritura DEV/PROD durante esta preparación. No se inició ni modificó el servidor Next.js.
