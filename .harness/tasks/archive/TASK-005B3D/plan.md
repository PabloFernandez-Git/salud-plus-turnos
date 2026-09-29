# TASK-005B3D — Plan

**Estado:** `COMPLETED / REVIEW PASS — B3D-R1 CLOSED`

1. Revalidar baseline, bootstrap, DEV health, migration sync y contrato real de
   `admin_set_center_membership`.
2. Definir schemas/estados de acción y extender la query tenant para incluir el identificador de la
   asociación actual y opciones elegibles sin falso conflicto consigo misma.
3. Implementar helper server-side y Server Action delgada con reautorización, pertenencia al Center,
   llamada exclusiva a `admin_set_center_membership`, mapeo de errores y revalidación.
4. Reemplazar **Sólo lectura** por el panel **Administrar**, identidad global read-only,
   confirmaciones explícitas y refresh no optimista.
5. Agregar unit/component/integration y E2E B3D con fixtures UUID exactos y cleanup endurecido.
6. Ejecutar B3D focalizados, B3C/B3B/B3A/Auth/provisioning/schema/grants/Auth config/B1/B2 y checks
   estáticos/build/secret guard/diff check según corresponda.
7. Auditar baseline y migration sync finales; actualizar access/status/implementation report.
8. Revisar el diff completo contra `a8f3378c09ee452fcddf6faf5b5591a0ebee7807` y verificar que
   `next-env.d.ts` conserve exclusivamente su cambio preexistente.

No avanzar a otra subfase, no tocar PROD y no hacer commit/push/PR/merge.
