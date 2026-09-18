# Instrucciones para agentes

Este repositorio utiliza el Agent Harness definido en `.harness/README.md`.

## Antes de implementar

1. Ejecutar `pnpm bootstrap` cuando el entorno esté instalado.
2. Leer `docs/product.md`.
3. Leer `docs/status.md`.
4. Leer únicamente los módulos/documentos relevantes para la tarea.
5. Inspeccionar el código y tests existentes afectados.
6. Trabajar desde un Task Brief en `.harness/tasks/active/<TASK-ID>/brief.md`.
7. No implementar antes de que objetivo, criterios de aceptación, riesgos e impacto estén claros.

## Reglas operativas

- El repositorio es la memoria persistente; no depender del historial de chat.
- Mantener `src/app/` delgado: routing, layouts, páginas y composición.
- La lógica del producto vive en `src/modules/`.
- Lecturas internas: queries del módulo.
- Mutaciones desde la web: Server Actions delgadas.
- APIs/webhooks/clientes externos: Route Handlers.
- La lógica importante no debe quedar atrapada en Actions o Route Handlers.
- Validar inputs externos en servidor con Zod.
- Aplicar autorización en servidor y RLS para aislamiento por centro.
- Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` al navegador.
- Nunca aplicar migrations, seeds o resets destructivos automáticamente a PROD.
- No cambiar Node, pnpm o tooling principal como efecto secundario de otra tarea.
- Respetar `docs/coding-conventions.md`.
- No crear capas o carpetas vacías por anticipado.
- Los tests unitarios/componentes viven cerca del código; E2E en `tests/e2e/`.

## Cierre

Una tarea solo se considera terminada después de verificación + review.

Al cerrar, evaluar si corresponde actualizar:

- `docs/modules/...`
- `docs/architecture.md`
- `docs/technical-decisions.md`
- `docs/status.md`
- retrospectiva / lecciones del harness
