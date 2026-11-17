# TASK-039 — Fase D: validación Supabase DEV

**Resultado:** PASS — ready for merge. Fecha: 2026-11-17. Fase C: revisión técnica independiente APPROVED, según autorización de esta fase. Worktree existente, sin commit, push, merge ni deploy.

## Destino y migrations

- Proyecto confirmado por referencia vinculada, configuración local y API de Supabase: `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), `ACTIVE_HEALTHY`. La otra instancia listada corresponde a DEMO y no se utilizó.
- Antes de aplicar: 28 migrations remotas, 29 locales; única pendiente `20261117124426_protect_unverified_patient_identity.sql`, sin versiones inesperadas. `supabase migration list --project-ref` confirmó la misma diferencia.
- Se ejecutó `supabase migration up --linked --project-ref ehllxymqyzrofydrvtzo` desde este worktree. El CLI informó únicamente la migration aprobada como aplicada.
- Después: historial remoto de 29 entradas, última `20261117124426_protect_unverified_patient_identity`; `migration list` confirmó `remote=29 pending=0`.

## Validación funcional

`scripts/task039-dev-validation.mjs` creó cuatro usuarios Auth ficticios con sesiones reales, dos centros ficticios y cuatro identidades sintéticas. La prueba llamó la Data API con sesiones ADMIN y RECEPTION, además de accesos denegados.

| Comprobación                                                                                  | Resultado                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nacimiento discordante sin vínculo, vínculo ACTIVE, vínculo INACTIVE y vínculo en otro centro | `UNVERIFIED`, `birth_date_matches=false`; `first_name`, `last_name`, `relationship_state`, `person_id`, `patient_center_id` y `patient_center_updated_at` todos `NULL` en las cuatro respuestas.                        |
| Identidad inexistente                                                                         | `NOT_FOUND`, fecha y seis campos protegidos en `NULL`.                                                                                                                                                                  |
| Identidad verificada                                                                          | `FOUND` con `NOT_LINKED`, `ACTIVE` o `INACTIVE` según el vínculo local; la identidad vinculada sólo en el otro centro resultó `NOT_LINKED` para el centro A.                                                            |
| Permisos y aislamiento                                                                        | EXECUTE para `authenticated`, sin EXECUTE para `anon`; rechazo `42501` para ADMIN de otro centro, membership inactiva y cliente anónimo. Firma, `SECURITY DEFINER` y `search_path` comprobados en el catálogo efectivo. |
| Flujos legítimos                                                                              | Create, rechazo de duplicado global, link y reactivate pasaron; un único `Person` y un único vínculo para el alta comprobada.                                                                                           |

La prueba focal del navegador (`tests/e2e/task-039-dev.spec.mjs`) pasó `1/1` en Chromium contra `localhost:3000` con el código de este worktree y la configuración DEV. Registro mostró la advertencia neutral y ningún nombre en el diálogo para `UNVERIFIED`, sin acciones de alta/vínculo/reactivación. Con la fecha correcta mostró `FOUND` y permitió abrir Administración. Un alta ficticia desde Registro mostró confirmación en el listado; Administración abrió esa ficha y guardó un cambio administrativo. Los dos ajustes iniciales del spec corrigieron expectativas históricas del formato de fecha y del comportamiento de cierre de Registro; no revelaron una falla de producto.

## Limpieza

El runner borró exclusivamente IDs del manifiesto de TASK-039 tras verificar que no hubiese vínculos desconocidos ni turnos en los centros ficticios. Se limpiaron y auditaron cuatro usuarios Auth, dos centros, seis `Person` y seis `PatientCenter` (incluidos create, link y alta UI). El recuento posterior fue cero para todos los IDs de DB y Auth. El manifiesto temporal con la contraseña ficticia se eliminó. `.env.local` copiada temporalmente al worktree se eliminó tras finalizar localhost. DEMO, PROD y portfolio no fueron tocados.

## Riesgos residuales y compatibilidad

- `UNVERIFIED` frente a `NOT_FOUND` y el error de identidad existente de `create` siguen permitiendo inferir existencia. Es un bloqueo PRE-PROD independiente, no resuelto por TASK-039.
- Sólo DEV tiene aplicada esta migration. DEMO y PROD conservan el contrato anterior hasta una autorización y despliegue separados.
- App anterior + migration nueva: la validación Zod anterior no admite `UNVERIFIED`; el resultado discordante falla de forma cerrada, con degradación de UX. App nueva + DB anterior: la Action rechaza el payload legacy, pero la RPC directa todavía expone datos. El despliegue de código y DB en cada entorno debe coordinarse.
- No se repitieron los gates locales de Fase B aprobados en Fase C. La validación de esta fase fue focal en DEV y localhost.
