# Plan TASK-033

1. Reutilizar consulta autoritativa de plataforma y accesos activos para renderizar enlaces correctos.
2. Adaptar el formulario actual a diálogo y tres etapas, conservando la acción, la intención persistida y el bloqueo de reintentos.
3. Añadir tarjetas móviles con los mismos datos y `CenterStatusForm`.
4. Probar navegación, flujo de alta, recuperación, responsive y regresiones; capturar Chromium.
5. Solicitar revisión independiente, corregir hallazgos de alcance y registrar resultados. Mantener ACTIVE.

## Segunda iteración

1. Igualar acciones del dashboard y limitar el enlace global a esa pantalla.
2. Reubicar el alta junto al listado, dividir la descripción y mantener navegación/cierre en el encabezado.
3. Separar encabezado, contenido desplazable y pie del modal; enfocar y revelar errores.
4. Actualizar pruebas y capturas sintéticas nuevas a 390/556/1440 px, incluido viewport bajo.
5. Verificar tooling y solicitar revisión independiente. Mantener ACTIVE para revisión visual humana.

## Tercera iteración

1. Compactar los dos botones del dashboard y ajustar la separación de la descripción.
2. Suprimir divisores sólo en el paso 1, centrar acciones y dar cursores coherentes a controles.
3. Ofrecer sugerencias de zonas IANA sin restringir el contrato de validación ni el valor exacto.
4. Verificar por separado revisión normal y envío retenido/resultado incierto, sin cambiar idempotencia.
5. Generar evidencia nueva, ejecutar pruebas y pedir revisión independiente; mantener ACTIVE.

## Cuarta iteración

1. Convertir el encabezado de `/platform` en franja superior con la misma estructura responsive del dashboard de centro.
2. Reemplazar la confirmación nativa compartida por un diálogo accesible de estado, con nombre, resultado y bloqueo de doble envío.
3. Probar el selector de zona horaria en Chromium; corregir búsqueda, selección, scroll y recorte sólo si se reproducen fallos.
4. Mostrar progreso durante el envío y reservar el aviso de incertidumbre para el resultado no concluyente o la recuperación.
5. Ejecutar pruebas focales y de regresión, capturar 390/556/1440 px, solicitar revisión independiente integral y mantener ACTIVE para aprobación visual.

## Quinta iteración

1. Sustituir el fallback de plataforma por `AppLoader` y cubrir el estado sin datos del dashboard con el mismo componente.
2. Dar feedback al navegar mediante los dos enlaces usando el estado pendiente de `Link`, sin cambiar rutas ni autorización.
3. Ajustar únicamente padding y separaciones del encabezado de `/platform`.
4. Verificar carga, error, autorización y navegación con pruebas focales; capturar componentes reales y datos sintéticos a 390/556/1440 px. Distinguir evidencia sintética de navegación Next real.
5. Ejecutar checks y revisión independiente; dejar TASK-033 ACTIVE sin publicación.

## Sexta iteración

1. Validar el email del primer paso con el schema existente antes de la acción, mostrar error local y evitar el globo nativo sólo en ese formulario.
2. Separar el valor IANA de la etiqueta visible, incluir localidad y offset calculado para la fecha actual, permitir búsqueda por localidad/país/identificador y conservar entradas IANA libres.
3. Documentar la RPC mínima necesaria para ADMIN activos; mantener la columna pendiente por decisión explícita de la persona usuaria, sin SQL ni consultas inseguras.
4. Ejecutar pruebas focales, Chromium sintético a 390/556/1440 px, TypeScript, ESLint, Prettier y Git; solicitar revisión independiente y mantener ACTIVE.

## Gate técnico final

1. Inventariar el diff completo frente a `origin/main` y los archivos nuevos de TASK-033, excluyendo cambios locales ajenos.
2. Ejecutar `pnpm check`, Vitest completo/focal, tooling, Prettier y `git diff --check`; clasificar cualquier falla y repetir sólo lo necesario.
3. Revisar evidencia visual aprobada y solicitar revisión independiente integral de seguridad, regresiones y documentos.
4. Registrar dictamen, riesgos residuales y preparación para PR en el expediente; mantener TASK-033 ACTIVE, sin publicar.
