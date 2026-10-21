# Implementación y verificación

## Sincronización

- `main` avanzó por fast-forward a `b066db2` = `origin/main`, con PR #12–#15 integrados.
- Se preservó `next-env.d.ts` (SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`), los expedientes locales TASK-010/011/012 y los artefactos preexistentes.

## Auditoría funcional

- El listado ADMIN de memberships activas e inactivas muestra nombre, email, rol, estado, profesional asociado y acción Administrar.
- Agregar usuario resuelve email exacto en servidor: reutiliza una identidad existente sin editarla o crea una identidad nueva con nombre, apellido y contraseña inicial. Una membership existente es terminal en el alta.
- La administración separada permite rol predefinido, estado y vínculo ProfessionalCenter elegible. Las Actions reautorizan ADMIN; queries se acotan por centro y la RPC valida pertenencia, estado stale, último ADMIN y exclusividad del vínculo profesional.
- Estas funciones estaban implementadas y probadas en TASK-005 B3B/B3C/B3D. No se identificó faltante funcional que justificara alterar esos contratos.

## Cambio realizado

- El Dashboard, título y breadcrumb presentan «Gestión de usuarios» sobre la ruta `/users`, conservando el icono y la tarjeta.
- El encabezado dice «Administrá los usuarios, roles y accesos del centro.»
- Agregar usuario dice «Ingresá un email para agregar un usuario a este centro.» y dejó de limitar innecesariamente el ancho de esa descripción.
- Se actualizaron tests de presentación. `docs/modules/access.md` refleja el nombre visible.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal del módulo: 7 archivos, 62 tests PASS.
- `pnpm typecheck`: PASS.
- ESLint focal de archivos modificados y script visual: PASS.
- Prettier focal con CRLF para archivos existentes y formato del script nuevo: PASS.
- Chromium local con componentes reales y datos/acciones sintéticos: desktop 1440 y mobile 390 PASS; Dashboard, pantalla, formulario abierto, etapa tras Continuar, panel Administrar, navegación y ausencia de desbordamiento horizontal. Capturas y `results.json` en `artifacts/task010-gestion-usuarios/`.
- `pnpm lint` global: un error en `test-results/dashboard-preview.mjs` local preexistente fuera del alcance y un warning histórico en `scripts/task009-gate-d/preflight-dev-readonly.mjs`. El lint focal de este cambio pasó.
- La revisión visual sintética no es una nueva prueba de integración Auth/RLS/RPC; se conserva la evidencia E2E previa de TASK-005 sin repetir escrituras DEV.

Sin acceso PROD, escrituras DEV, migrations, cambios RLS/roles, commit, push ni merge.
