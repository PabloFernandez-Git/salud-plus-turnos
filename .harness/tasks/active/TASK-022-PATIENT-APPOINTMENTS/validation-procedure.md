# Procedimiento de verificación PostgreSQL — TASK-022

## Local aislado (ejecutado el 2026-10-22)

1. Iniciar un PostgreSQL Supabase **temporal sin puertos publicados**, con nombre propio de TASK-022 y contraseña sintética. No usar el proyecto linkeado a DEV ni sus credenciales.
2. Cargar las migrations previas en orden de versión sobre una base vacía compatible con Supabase Auth/roles, luego cargar `20261022120000_add_patient_appointment_history.sql` con `ON_ERROR_STOP=1`.
3. Ejecutar `supabase/tests/task-022-patient-appointment-history.sql` con `ON_ERROR_STOP=1`; debe finalizar en `ROLLBACK` y salida sin errores. Confirmar que la base conserva cero fixtures TASK-022.
4. Revisar `EXPLAIN (ANALYZE, BUFFERS)` de `UPCOMING` e `HISTORY` para un paciente con muchas filas y cursores inicial/intermedio. Comparar uso del índice nuevo con el índice previo antes de decidir si retirar el previo en otra migration.
5. Cerrar y eliminar únicamente el contenedor temporal de TASK-022. No tocar servicios del proyecto ni el servidor Next.js de VS Code.

## DEV (requiere autorización específica previa)

1. Usar el procedimiento focal y los comandos exactos de `dev-application-runbook.md`. Preflight de solo lectura; si es idéntico al DEV aprobado y existe autorización específica, aplicar únicamente la migration TASK-022 con registro atómico de su versión.
2. Verificar estructura, owner, firma, `SECURITY DEFINER`, `search_path`, grants `EXECUTE`, RLS/SELECT e inventario antes/después. **No crear fixtures ni ejecutar pruebas funcionales DEV** en esta etapa.
3. En una etapa autorizada posterior, definir alcance de fixtures transaccionales para roles/centros, paginación, estados y DST, con `ROLLBACK` e inventario residual. Regenerar tipos desde DEV e integrar servicio/UI sólo tras sus gates propios.
