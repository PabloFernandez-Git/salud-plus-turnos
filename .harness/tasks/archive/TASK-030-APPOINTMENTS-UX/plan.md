# Plan TASK-030

1. Refinar componentes del listado y utilidades de presentación de fechas/zonas, sin cambiar filtros o RPC.
2. Refinar el detalle, acciones y nota con estado de edición y descarte protegido.
3. Mover el selector de reprogramación a un modal nativo con foco y teclado; conservar servicios y payload.
4. Actualizar tests de componentes para presentación, roles, nota, confirmaciones y reprogramación.
5. Ejecutar tests focales, calidad pertinente, validación visual sintética 1440/390 y revisión independiente; registrar evidencia y límites.

## Segunda iteración

1. Crear un selector pequeño de fecha civil reutilizado por `BookingSelector`, con calendario integrado, navegación por meses y teclado; sin dependencias ni conversiones horarias.
2. Presentar únicamente los slots vigentes de la fecha como botones; mostrar offset en alternativas con la misma hora civil y mantener el instante exacto en el valor de selección.
3. Añadir navegación «Volver a turnos», ocultar eliminación de nota vacía y ajustar cursores/hover/foco en Turnos.
4. Actualizar tests de creación, reprogramación, calendario, DST, reset y estados; validar visualmente 1440/390 con varias franjas y revisar de manera independiente.

## Tercera iteración

1. Condicionar `BookingSelector` a paciente en Crear turno y resetear selección dependiente al cambiar paciente; mejorar tarjetas de búsqueda/selección.
2. Derivar filas visuales deshabilitadas desde intervalos de disponibilidad y duración, combinadas con los slots SQL exactos; cubrir huecos, fallas de disponibilidad y DST con tests.
3. Simplificar textos y mostrar offset del detalle sólo en una hora local ambigua; controlar la carga inicial del modal de Reprogramar.
4. Tests focales, comprobaciones pertinentes, capturas sintéticas 1440/390 y review independiente; registrar resultados y detener antes de commit.

## Pulido visual final

1. Ajustar sólo el layout responsive de acciones en detalle según 1–4 controles visibles, conservando su orden y estilo.
2. Igualar accesos rápidos del listado en móvil y derivar la indicación de período activo de `filters`/`today`, sin estado adicional.
3. Cambiar los textos de nota `NULL`/vacía y CTA correspondiente; mantener su semántica de edición y eliminación.
4. Actualizar tests de componente, verificar 1440/390 con datos sintéticos, pedir review independiente y registrar el resultado sin commit.
