# TASK-021 — Gate SQL del Dashboard

## Alcance

Implementar exclusivamente dos RPC de lectura en una migration nueva, pruebas SQL transaccionales y procedimiento local de EXPLAIN/concurrencia. No aplicar SQL ni conectar a bases en esta etapa.

## Contraste con esquema

- `appointments` conserva `center_id`, `professional_center_id`, `patient_center_id`, `specialty_id`, `starts_at`, `ends_at` y los cinco estados aprobados.
- `center_memberships` tiene un vínculo profesional nullable, restringido por rol y FK compuesta al mismo centro. `private.active_professional_center_id` ya exige membership, centro y vínculo activos.
- `private.has_active_center_role` exige membership y centro activos. `PLATFORM_ADMIN` no concede acceso tenant.
- Los índices de `appointments` por `(center_id, starts_at)`, `(professional_center_id, starts_at)` y `(center_id, status, starts_at)` existen. RLS no concede SELECT directo al cliente.
- No hay incompatibilidad material del contrato con el esquema versionado en `origin/main`.

## Implementación

1. Dos funciones `STABLE SECURITY DEFINER`, `search_path = ''`, autorización interna y `42501` en denegación. PostgreSQL usa la fotografía de la sentencia llamadora para todas las consultas internas de una función `STABLE`.
2. Capturar `statement_timestamp()` una vez y derivar fecha del centro. Filtrar por intervalo UTC conservador y fecha local exacta; agregar el conjunto completo antes de limitar los cinco próximos.
3. Construir proyecciones JSON distintas en PostgreSQL. Revocar EXECUTE a PUBLIC, anon y service_role; conceder sólo a authenticated.
4. Preparar pruebas de contratos, autorización, conteos, bordes temporales, privacidad y fórmulas DST. Preparar protocolo de concurrencia y EXPLAIN para gate local posterior.

## Riesgos y verificación

- Sin ejecutar migration ni pruebas SQL, no se puede afirmar compatibilidad ejecutada, plan real ni PASS PostgreSQL.
- El día local de la llamada no puede fijarse por parámetro sin debilitar el contrato; pruebas de DST usan geometría SQL determinista y el gate local deberá inspeccionar el comportamiento RPC en un día de transición o una base aislada con reloj controlado.
- Review independiente focal de SQL y cobertura, seguido de verificaciones estáticas.
