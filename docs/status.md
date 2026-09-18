# Estado actual

**Fase:** Bootstrap del proyecto completado
**Tarea activa:** ninguna
**Última tarea completada:** TASK-001 — Project Bootstrap
**Estado:** cerrada con Review PASS

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
- Node.js 24 y pnpm 11.26.0 validados en runtime.
- Dependencias instaladas y lockfile congelado verificado.
- Bootstrap, formato, lint, tipos, tests y build verificados.
- TASK-001 aceptada con Review PASS y archivada.

## Próximo

**TASK-002 — React Big Calendar Spike**, pendiente de inicio, con mock data y validación de las vistas Día, Semana y Mes antes de adoptar definitivamente la librería.

## Decisiones postergadas

- Librería final de agenda: después del spike.
- Email/recovery provider definitivo.
- Rate limiting concreto antes de producción pública.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.
