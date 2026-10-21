# TASK-HARNESS-009 — Ajuste posterior a TASK-009

## Objetivo

Reducir intervenciones humanas y corridas repetidas mediante reglas breves de autonomía, prevalidación local y reutilización de evidencia en el Harness existente.

## Contexto relevante

Retrospectiva de TASK-009 y protocolos `startup.md`, `task-loop.md` y `review.md`. TASK-009 ya corrigió sus launchers y escenarios; no se repiten sus pruebas ni Gate D.

## Criterios de aceptación

- [ ] Los agentes corrigen y verifican fallos dentro del alcance autorizado sin usar al usuario como intermediario de comandos; preservan aprobación humana para operaciones sensibles o fuera de alcance.
- [ ] Antes de una corrida remota, se comprueban localmente los scripts en la versión objetivo de PowerShell y los selectores, hidratación y continuidad de escenarios de navegador que correspondan.
- [ ] Review reutiliza evidencia aprobada mientras código, configuración y entorno relevantes no la invaliden; cada cambio recibe verificación focal y mantiene controles de seguridad y cleanup.
- [ ] `main` local coincide con `origin/main`; `next-env.d.ts` y TASK-010/011/012 permanecen intactos.

## Impactos

- Security: sí — conservar autorización para operaciones sensibles, secretos y cleanup.
- Authorization: no — sin cambios al producto ni a RLS.
- Database: no — sin acceso remoto, migrations ni seeds.
- Documentation: sí — protocolos existentes.
- Testing: sí — selección y momento de verificaciones, sin nuevos gates.

## Riesgos

Una regla demasiado amplia podría saltar validaciones o autorizar operaciones remotas. Limitar reutilización a evidencia trazable y exigir aprobación para acciones sensibles fuera del alcance concedido.

## Fuera de alcance

Funcionalidades, TASK-010/011/012, scripts de TASK-009, Gate D, Supabase DEV/PROD, commits y publicación.
