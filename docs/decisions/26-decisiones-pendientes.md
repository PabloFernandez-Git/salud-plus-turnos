# 26. Decisiones pendientes

No quedan decisiones arquitectónicas previas imprescindibles antes de crear el repositorio y comenzar el desarrollo.

Quedan deliberadamente postergadas hasta el momento en que aporten valor:

- proveedor/configuración final de email para recuperación de contraseña;
- implementación concreta de rate limiting;
- incorporación completa de Playwright a CI cuando exista un entorno E2E reproducible;
- incorporación de Sentry u observabilidad adicional si el producto lo necesita;
- estrategia de reset destructivo de DEV, solo si aparece una necesidad real;
- eventual incorporación de Supabase Local.

Estas decisiones deberán abordarse cuando exista contexto suficiente y no deben bloquear el inicio del proyecto.
