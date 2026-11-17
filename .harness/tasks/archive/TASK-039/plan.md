# TASK-039 — Plan de implementación (Fase B)

**Aprobación:** Fase A aprobada por la persona usuaria. Alcance fijado: corregir exposición directa en PostgreSQL y aplicación; la inferencia de existencia mediante `resolve`/`create` permanece fuera de TASK-039 y como bloqueo PRE-PROD.

1. Crear una migration incremental desde el worktree existente. Reemplazar sólo `public.staff_resolve_patient_identity` con la misma firma, ocho columnas, `SECURITY DEFINER`, `search_path`, autorización y grants. Tras encontrar `Person`, devolver `UNVERIFIED`, `false` y seis campos `NULL` antes de consultar `patient_centers` cuando la fecha no coincide.
2. Cambiar el contrato Zod a tres variantes: `NOT_FOUND`, `UNVERIFIED` y `FOUND` verificado con sus tres estados de vínculo. Rechazar campos de identidad/vínculo no nulos en `UNVERIFIED`. Ajustar tipos derivados y consumidores de Registro y Administración sin alterar los flujos verificados.
3. Actualizar las pruebas focales de contrato, componentes y SQL. En PostgreSQL local aislado, probar RPC directa con identidad sin vínculo, vínculo ACTIVE e INACTIVE, tanto para nacimiento discordante como correcto; comprobar permisos, multi-centro y deduplicación. Los tests de UI no sustituyen la prueba SQL.
4. Ejecutar tests focales, `typecheck`, `lint` y `build`; inspeccionar la compatibilidad entre migration nueva y app anterior. Registrar implementación, resultados y riesgos en el Harness y actualizar sólo la documentación pertinente. Revisar diff y mantener el worktree sin commit, push, merge ni deploy.

**Límites:** sin Supabase remoto, DEV, DEMO, PROD ni portfolio. No editar migrations históricas ni rediseñar el oráculo de existencia. Si PostgreSQL local no está disponible, registrar el gate DB como no verificado en lugar de atribuirle PASS.
