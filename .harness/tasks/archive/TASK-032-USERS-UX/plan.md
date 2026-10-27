# Plan TASK-032

1. Registrar diagnóstico breve de flujos y protecciones con referencia a componentes, servidor, SQL y tests.
2. Añadir tarjetas móviles al listado manteniendo tabla y datos de escritorio.
3. Calcular cambios semánticos y validez en Administrar acceso; ajustar feedback y descarte.
4. Añadir revisión previa local al formulario de alta, validaciones de entrada y recuperación segura del error de sesión.
5. Añadir pruebas focales, ejecutar controles y verificar visualmente 390/556/1440 px sin reiniciar el servidor.
6. Solicitar revisión independiente, corregir hallazgos del alcance y documentar resultados. Mantener ACTIVE.

## Iteración de validación visual: modal de alta

7. Mantener la tarjeta compacta; mover email, datos/acceso y revisión al mismo `<dialog>` nativo con foco, Escape, scroll interno y ancho adaptable.
8. Integrar una sola confirmación de descarte dentro del diálogo, sin anidar modales; al cerrar, limpiar datos sensibles y recuperar de forma segura cualquier operación pendiente.
9. Actualizar pruebas focales, capturas Chromium a 390/556/1440, documentación y revisión independiente. Detenerse antes de publicar.

## Ajuste final: contraseña y éxito

10. Añadir confirmación local exacta, errores accesibles y limpieza conjunta de ambos secretos sin ampliar el payload del servidor.
11. Sustituir el contenido de éxito por un encabezado y mensaje según el resultado, cierre sin descarte y reinicio con nueva intención; refrescar el listado.
12. Actualizar pruebas focales y capturas de error, confirmación y éxito a 390/556/1440; pasar controles y revisión independiente antes de validación visual.

## Gate técnico y PR tras aprobación visual

13. Confirmar estado local, archivos ajenos, checkpoint TASK-029 y base remota mediante fetch seguro, sin mover el checkout.
14. Ejecutar Vitest completo, tooling, TypeScript, ESLint, Prettier focal, `git diff --check` y Chromium sintético; documentar los checks no aplicables o bloqueados.
15. Exigir revisión independiente del diff completo y corregir hallazgos dentro del alcance, repitiendo controles pertinentes.
16. Stage explícito de TASK-032, revisar diff staged y ausencia de secretos; crear un commit, publicar la rama y abrir PR a `main`. Mantener ACTIVE y detenerse antes del merge.
