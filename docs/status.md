# Estado actual

**Fase:** Bootstrap del proyecto  
**Tarea activa:** TASK-001 — Project Bootstrap  
**Estado:** en progreso

## Completado

- Definición de producto y alcance MVP.
- Reglas principales de negocio.
- Stack y arquitectura general.
- Estrategia de seguridad, RLS, testing y observabilidad inicial.
- Estrategia de migrations, zonas horarias, tooling, naming y seeds.
- Harness v1 diseñado.
- Scaffold inicial del repositorio materializado.
- Documentación consolidada dentro de `docs/`.
- Documentación técnica modularizada en `docs/decisions/` y `docs/stack/` para facilitar el context routing.
- Repositorio público de GitHub creado y remoto confirmado.

## Pendiente para cerrar TASK-001

- Ejecutar el proyecto en Node.js 24.
- Activar pnpm 11.26.0.
- Ejecutar `pnpm install` y versionar el `pnpm-lock.yaml` resultante.
- Ejecutar `pnpm bootstrap`.
- Ejecutar `pnpm format:check`, `pnpm check` y `pnpm build`.
- Corregir cualquier incompatibilidad real detectada por esas verificaciones.
- Review final y archivo de TASK-001.

## Próximo

**TASK-002 — React Big Calendar Spike** con mock data, validando Día, Semana y Mes antes de adoptar definitivamente la librería.

## Decisiones postergadas

- Librería final de agenda: después del spike.
- Email/recovery provider definitivo.
- Rate limiting concreto antes de producción pública.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.
