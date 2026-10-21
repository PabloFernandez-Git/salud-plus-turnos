# Startup Protocol

Antes de implementar:

1. Leer `AGENTS.md`.
2. Ejecutar `pnpm bootstrap` si el entorno está listo.
3. Leer `docs/product.md` y `docs/status.md`.
4. Leer solo documentación de módulos relevante.
5. Inspeccionar implementación y tests existentes.
6. Revisar estado Git/diff antes de tocar archivos.
7. Definir objetivo y criterios de aceptación.
8. Clasificar impactos: Security, Authorization, Database, Documentation, Testing.
9. Identificar riesgos y archivos/módulos afectados.
10. Crear o confirmar Task Brief y Plan.
11. Recién entonces implementar.

Antes de consumir una corrida remota de un runner nuevo o modificado, usar las comprobaciones locales existentes: en Windows, probar el script con la versión objetivo de PowerShell (incluida 5.1 cuando aplique) y simular el recorrido completo de éxito, fallo y cleanup; para E2E, comprobar hidratación con el mismo origen local, selectores contra el DOM renderizado y que un fallo no omita los escenarios restantes. Corregir los defectos detectados localmente antes de pedir una ejecución con credenciales.
