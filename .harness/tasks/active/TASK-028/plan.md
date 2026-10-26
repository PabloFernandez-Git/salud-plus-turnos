# Plan TASK-028

1. Ajustar el resultado de create/link para cerrar Registro, refrescar el listado filtrado y mostrar el aviso correcto; conservar navegación de `from=appointment` y los caminos ACTIVE/INACTIVE existentes.
2. Usar el catálogo de países de Profesionales en un selector accesible y reorganizar Registro en secciones y rejillas adaptables sin retirar campos.
3. Comparar datos administrativos canonizados, validar antes de habilitar Guardar y ubicar los avisos de operación en el contexto correspondiente.
4. Actualizar pruebas focales con mocks para éxito, errores, filtros, país, estado dirty, descarte y pestañas.
5. Ejecutar Vitest focal, TypeScript, ESLint y Prettier; revisar diff y comprobar Chromium a 390/556/1440 px con datos sintéticos si la sesión local lo permite.
6. Documentar resultado y review; mantener TASK-028 activa hasta aprobación visual humana e integración.

## Ajustes finales solicitados

7. Reutilizar los schemas y `FormFieldError` para validación visual al blur/continuar, con `noValidate` y foco dirigido.
8. Añadir entrada flexible `DD/MM/AAAA` y conversión civil determinística a ISO en el límite de las Actions; cubrir escritura, pegado, borrado, fechas inválidas y año bisiesto.
9. Derivar un resumen compacto de los mismos valores normalizados que se envían al confirmar, para create y link; conservar corrección de campos y los destinos posteriores.
10. Repetir pruebas focales, checks estáticos y Chromium sintético a 390/556/1440 px; review independiente y entrega para nueva revisión visual humana.

## Advertencia final y comprobación de identidad

11. Cambiar únicamente el texto de la advertencia de mismatch en la presentación; conservar su condición y estilo.
12. Reforzar tests del registro para `NOT_FOUND`, `FOUND/NOT_LINKED`, mismatch y `FOUND/ACTIVE`/`ALREADY_ACTIVE`, verificando ausencia de filtraciones, payloads y conservación de campos/filtros.
13. Verificar advertencia y formulario en Chromium sintético a 390 px, repetir Vitest focal y de Pacientes, TypeScript, ESLint, Prettier y diff check; documentar límites de mocks y review independiente. Detenerse para aprobación humana antes del PR.
