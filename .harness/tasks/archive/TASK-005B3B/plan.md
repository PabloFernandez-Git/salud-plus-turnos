# TASK-005B3B — Plan

1. Confirmar bootstrap, baseline Git/DEV, 13 migrations y contrato de RLS/grants.
2. Implementar una query server-only read-only que reautorice ADMIN y componga memberships,
   perfiles y asociaciones profesionales exclusivamente del Center solicitado.
3. Crear tabla presentacional testeable y ruta protegida con loading/error/empty state.
4. Agregar navegación condicional desde el home del Center y regreso claro desde Usuarios.
5. Cubrir en unit/component tests autorización, aislamiento, datos, Professional y navegación.
6. Agregar E2E DEV read-only con fixtures temporales y cleanup exacto por IDs, preservando el
   hardening B3A-F1 y el baseline real.
7. Ejecutar regresiones completas, build/secret guard en copia aislada y comprobar diff contra
   `f1682f97228763bbb9f35f22c1529fac197729fa`.
8. Actualizar sólo documentación de implementación/status y dejar B3B lista para review, sin
   iniciar B3C.
