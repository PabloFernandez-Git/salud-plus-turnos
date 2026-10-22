# TASK-022 — Validación funcional DEV preparada (sin ejecución remota)

## Estado y alcance

**PREPARED / REMOTE FUNCTIONAL BLOCKED por autorización.** El usuario informó `LOCAL PASS`, `PREFLIGHT PASS` y `APPLICATION_AND_STRUCTURAL_POSTCHECK PASS` para la migration `20261022120000_add_patient_appointment_history.sql` en `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), con 24 migrations. Esa evidencia es estructural; no demuestra todavía la UI ni la RPC con fixtures reales DEV. Durante esta preparación no se conectó a DEV, no se escribieron datos remotos y no se inició Next.

La migration aprobada conserva SHA-256 `A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`. El ejecutor usa `scripts/task022-dev/gate.mjs` sólo para verificar el contrato local y el catálogo ya aplicado. No ejecuta su modo `apply`, `supabase db push` ni ningún DDL.

## Scripts y comandos previstos

Desde la raíz del repo, en una terminal propia de PowerShell:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode local
.\scripts\task022-functional-dev\run.ps1 -Mode preflight
```

`local` no abre red. `preflight` pide la contraseña PostgreSQL mediante entrada oculta; confirma rama, proyecto linkeado y URL DEV exacta, pooler `sa-east-1`, base/rol `postgres`, PostgreSQL 17.6, hash SQL, las 24 versiones exactas, firma/owner/ACL/índice de la RPC y el estado de SELECT/RLS. Todas las consultas PostgreSQL de preflight corren en transacción `REPEATABLE READ READ ONLY` con timeout. Una llamada anónima a la RPC debe devolver `42501`; así se comprueba el endpoint y la clave pública sin leer datos del paciente. Captura un inventario de cantidad y digest de IDs de 14 recursos, sin exportar filas preexistentes. Cualquier discrepancia impide crear el ledger y los fixtures.

**Sólo después de autorización expresa para escribir en DEV:**

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

El wrapper pide la contraseña PostgreSQL y, si no está en el entorno del proceso, la secret key DEV para Auth Admin, ambas con entrada oculta. Ninguna se escribe en archivos, reportes o argumentos CLI. La clave administrativa sólo crea y elimina identidades sintéticas; las pruebas de acceso usan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y JWT de cada actor. Chromium y el Next aislado se lanzan con un entorno de variables permitido; no heredan la clave administrativa ni la contraseña PostgreSQL. Playwright no guarda trazas, screenshots ni video. El servidor aislado usa puerto 31009 y un directorio temporal; `reuseExistingServer: false` impide reutilizar o controlar el servidor Next de VS Code.

## Fixture y ledger

Cada ejecución genera un `runId` UUID único y un ledger local ignorado por Git en `.task022-functional-dev/ledger.json`. El ledger reserva UUIDs y correos `task022-{runId}-...@example.test` antes de cada escritura. Máximo exacto: **5 Auth, 2 centros, 3 pacientes, 30 turnos**. No usa pacientes, cuentas ni turnos existentes.

- Centro A: `America/New_York`, ADMIN, RECEPTION, PROFESSIONAL y un usuario sin membresía; paciente poblado y paciente vacío.
- Centro B: `America/Argentina/Buenos_Aires`, ADMIN y un paciente propio.
- 21 cancelados históricos con el mismo `starts_at` cruzan el límite de 20 de la UI. Otros 3 turnos pasados ejercitan ATTENDED, NO_SHOW y PENDING vencido.
- 2 cancelados futuros se ubican en las dos ocurrencias de 01:30 durante el cambio DST de Nueva York; 1 ATTENDED futuro va a historial. 2 activos futuros van a Próximos. 1 activo pertenece sólo al centro B.
- 2 profesionales, 2 especialidades y 2 asignaciones verifican nombres; todos los IDs de citas se preplanifican. La inserción de tablas de dominio y turnos se hace en una única transacción PostgreSQL. Si el COMMIT queda incierto, no se reintenta: sólo se permite reconciliación de lectura.

El ledger conserva baseline, catálogo previo, IDs, emails, etapa, evidencia y resultado. No conserva contraseña sintética, contraseña PostgreSQL, JWT ni secret key. El reporte sólo registra fase y código de error; nunca texto crudo potencialmente sensible.

## Gates funcionales

`checks.mjs` inicia sesión con cada Auth sintético mediante clave pública y comprueba la RPC real: ADMIN/RECEPTION, 8 columnas exactas, nombres profesional/especialidad, UPCOMING/HISTORY disjuntos, estados y corte fijo, cursores ASC/DESC con límite 2 y sin duplicados/omisiones en 27 filas históricas, paciente vacío/ajeno/inexistente, acceso propio centro B, denegaciones PROFESSIONAL/sin membresía/otro centro/anon, SELECT directo revocado y detalle autorizado con denegación de otro centro.

Playwright usa la app real aislada: ADMIN ve 2 próximos y 20+7 históricos con «Cargar más», ambos offsets DST, profesional/especialidad, detalle autorizado y vacíos; RECEPTION ve el panel; PROFESSIONAL, ADMIN B y usuario sin membresía reciben denegación en Pacientes A. Una prueba induce error de Server Action y verifica alerta y reintento. La navegación a otro paciente comprueba que no queda información anterior. La carrera exacta de respuesta tardía dentro del mismo componente y cambio de Center está cubierta por las pruebas locales de `patient-appointments.test.tsx`; la navegación E2E no sustituye esa aserción de componente. Antes de declarar PASS integral, debe constar la ejecución de esos tests locales focales junto al gate DEV o reconfirmar su PASS vigente.

## Cleanup, conciliación y resultados

Tras pruebas con estado de fixtures conocido, el runner audita ownership exacto y ausencia de filas ajenas ligadas a los centros/usuarios fixture. Borra sólo UUIDs del ledger en orden inverso: turnos → PatientCenters → Persons → memberships → asignaciones → especialidades → ProfessionalCenters → profesionales → centros → usuarios públicos; después verifica metadata `gate=TASK-022` y `runId` antes de borrar cada Auth por ID. El postflight exige cero IDs/correos fixture, cero referencias por `user_id` en `auth.identities`, `auth.sessions` y `auth.refresh_tokens`, inventario de 14 recursos idéntico al baseline y catálogo previo intacto. No borra logs operativos administrados por Supabase; estos pueden retener eventos de Auth y no se cuentan como filas fixture.

Si una creación o COMMIT es incierto, el runner detiene escrituras y conserva el ledger. El operador ejecuta **sólo lectura**:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode reconcile
```

La salida indica los Auth marcados por `runId` y las cantidades por UUID reservado. Sólo con estado exacto conciliado y autorización vigente de cleanup se permite el comando explícito:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode cleanup -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

`cleanup` vuelve a ejecutar preflight, revisa el catálogo, hace otra conciliación de sólo lectura, acepta sólo un conjunto de filas completo o ausente, audita ownership si está completo, borra IDs exactos y verifica inventario. Estado parcial o referencias ajenas bloquean el borrado. Nunca hace retry automático de una escritura incierta. Si no logra limpiar, conserva el ledger y comunica recursos restantes; no se permite iniciar otro run con ledger existente.

Estados: `PASS` sólo si autorización, RPC, UI, pruebas locales focales y cleanup/postflight pasan; `FAIL` si alguna prueba falla y cleanup se confirma; `BLOCKED` si preflight/autorización/escenario requerido impide continuar; `CLEANUP_PENDING` si quedan fixtures o el resultado de borrado es incierto. Un `PASS` estructural DEV anterior no equivale a este `PASS` funcional.

## Detenciones

Detener antes de escribir si cambia ref/nombre/endpoint/rol/base, hash SQL, secuencia de 24 migrations, firma/grants/RLS, inventario esperado o clave pública/Admin. Detener durante ejecución si un resultado de escritura es ambiguo, el ledger falla, aparece una fila ajena ligada a los centros fixture o una prueba de aislamiento falla. No aplicar migrations, no escribir en PROD, no usar `service_role` para pruebas de acceso, no modificar Auth/RLS/RPC ni usuarios existentes.

## Revisión independiente

**PASS estático focal, sin bloqueantes materiales.** Se revisaron alcance de escrituras, identidad/preflight, roles/JWT, ownership exacto, estados ambiguos, cleanup, aislamiento de secretos y cobertura RPC/UI. La carrera de respuesta tardía dentro de la misma instancia y el cambio de Center se atribuyen a las pruebas locales previas, no a una falsa prueba remota. El dictamen no es PASS de ejecución funcional DEV.

## Autorización que falta

> Autorizo una ejecución funcional controlada de TASK-022 únicamente en `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), con hasta 5 usuarios Auth, 2 centros, 3 pacientes y 30 turnos sintéticos identificados por un `runId`. Autorizo su creación, las pruebas de RPC/UI descritas y el cleanup exacto de esos fixtures, incluida la conciliación de solo lectura y, si es necesario, un comando de cleanup separado tras revisar el ledger. Si el preflight o la pertenencia de los fixtures no pasa, detener sin escribir. No autorizo migrations, cambios a datos preexistentes ni acceso a PROD.

No ejecutar `run` ni `cleanup` hasta recibir esta autorización expresa.

## Resultado posterior

La autorización se otorgó y el primer run ejecutó los checks RPC y tres
escenarios Chromium aprobados, pero su cuarto escenario quedó bloqueado por
una aserción HTTP. Tras tres revalidaciones focales con cleanup acreditado,
el run `9b581bb1-e2be-44e4-b33d-77efbc594982` cerró el escenario pendiente:
cuatro actores PASS, cleanup `residue=0` e inventarios de 14 recursos
idénticos. El dictamen final y la proveniencia de cada evidencia están en
`focused-dev-revalidation.md`. Los comandos históricos de este runbook no
deben reutilizarse para TASK-022.
