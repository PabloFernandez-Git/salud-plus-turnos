# TASK-017 — Confirmación antes de cerrar sesión en Dashboard

## Objetivo

Solicitar confirmación en el Dashboard antes de invocar el `logoutAction` existente, con un diálogo compacto consistente con Salud Plus.

## Criterios de aceptación

- Botón del Dashboard abre un diálogo centrado con título, descripción y Cancelar/Cerrar sesión centrados como grupo.
- Cancelar, Escape y clic en fondo cierran sin llamar a logout y restauran foco al botón original.
- Sólo confirmar invoca `logoutAction`; durante pending se bloquea duplicación/cierre; error se muestra en el diálogo sin fingir éxito. Redirección y limpieza se conservan.
- Otros usos de `LogoutButton` mantienen su comportamiento existente.
- Chromium local 1440/390 px: semántica, foco, teclado, responsive, ausencia de overflow y flujo simulado. Pruebas locales focales PASS.

## Riesgos e impacto

- `LogoutButton` es compartido por Dashboard, selección de centro, plataforma y no-access: la confirmación debe activarse explícitamente sólo en `CenterHeader` del Dashboard.
- El `logoutAction` redirige desde servidor; no se modifica ni se agrega acceso Supabase.
- No se cambian Auth, reglas, permisos, otros módulos, diseño del Dashboard o Harness; sin Supabase DEV/PROD, commit ni push.
