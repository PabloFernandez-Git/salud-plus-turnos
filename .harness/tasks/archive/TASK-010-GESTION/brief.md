# TASK-010 — Gestión de usuarios

## Objetivo

Consolidar la gestión de usuarios del centro sobre los flujos existentes y presentar el módulo como «Gestión de usuarios», con textos breves y coherentes con la identidad visual vigente.

## Criterios de aceptación

- `main` sincronizada con `origin/main` incluyendo PR #15, sin alterar `next-env.d.ts` ni los expedientes locales TASK-010/011/012.
- El Dashboard, título y breadcrumb muestran «Gestión de usuarios»; la ruta `/users`, el icono y los contratos internos no cambian.
- Encabezado: «Administrá los usuarios, roles y accesos del centro.»; sección Agregar usuario: «Ingresá un email para agregar un usuario a este centro.»; ambas se presentan en una línea cuando el ancho lo permite y se adaptan a mobile.
- El listado, alta por email, administración de rol/estado/vínculo profesional y controles de acceso cumplen las reglas aprobadas de `docs/modules/access.md` y `docs/business-rules.md`; corregir sólo faltantes comprobados.
- Pruebas focalizadas y revisión del diff; capturas Chromium a 1440 y 390 px del Dashboard y pantalla de usuarios, incluido formulario abierto.
- Sin escrituras sensibles en Supabase DEV, acceso PROD, migraciones, commit, push o merge.

## Riesgos e impacto

- Las modificaciones visuales afectan sólo al módulo de acceso y su navegación en Dashboard. La lógica funcional existente es sensible a identidad global, aislamiento por centro, último ADMIN y reintentos Auth/DB; se reutiliza y verifica sin reescribirla.
- El `brief.md` local anterior de TASK-010 corresponde a un ajuste puntual de espaciado y se conserva intacto. Este expediente separado evita sobrescribirlo.
