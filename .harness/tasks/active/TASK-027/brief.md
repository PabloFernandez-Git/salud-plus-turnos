# TASK-027 — Refinamiento UX de Disponibilidad

## Objetivo

Mejorar la presentación y la interacción del detalle de Disponibilidad sin cambiar sus contratos, permisos ni reglas de negocio.

## Alcance y criterios de aceptación

- Encabezado dinámico: «Horarios semanales de {nombre}.»; conservar la zona horaria real del centro para la operación.
- Guardar duración sólo habilitado con un valor válido distinto del último confirmado; conservar el valor pendiente ante error y deshabilitar de nuevo tras éxito.
- Quitar el aviso general de semana vacía; conservar «Sin disponibilidad» en cada día vacío.
- Crear y editar franjas en un modal centrado con controles de hora existentes, errores junto al campo, confirmación de descarte para cambios, cierre por Cancelar/X/Escape/fondo, foco y teclado accesibles, bloqueo de doble envío y confirmación específica de éxito.
- Quitar franja sólo tras confirmación visual que identifique día y horas.
- Verificar 390, 556 y 1440 px sin desbordamiento horizontal de página ni cambios en las siete tarjetas.
- Ajuste final aprobado tras revisión: la acción del encabezado vuelve al listado de Disponibilidad del mismo centro para ADMIN/RECEPTION, independientemente de la ruta de entrada. PROFESSIONAL conserva su detalle de sólo lectura y la redirección existente del índice.
- Sustituir los selectores nativos de hora por texto editable `HH:mm` de 24 horas en ambos modales, con pista discreta, teclado numérico móvil, errores por campo mediante `FormFieldError` y validación de cliente con los esquemas existentes antes de enviar. No convertir zona horaria.
- Los controles habilitados del módulo muestran cursor de interacción; los deshabilitados conservan cursor y estado visual coherentes.
- Último ajuste solicitado: al escribir o pegar dos a cuatro dígitos, insertar `:` después de los dos primeros (`0900` → `09:00`, `1800` → `18:00`). Aceptar entradas que ya lo contienen y permitir borrar, seleccionar, reemplazar y corregir sin máscara rígida. Validar al salir del campo o al guardar, sin errores durante la escritura parcial.
- Refinamiento visual aprobado para implementación: conservar las siete tarjetas de día y reemplazar las tarjetas interiores de franjas por filas compactas con separadores sutiles, ícono de reloj, rango `HH:mm – HH:mm` destacado y duración local debajo (`4 h`, `3 h 30 min`, `30 min`). Mantener «Agregar horario» arriba, «Sin disponibilidad» en días vacíos y acciones «Editar» / «Quitar» de 44 px con cursor, foco y hover. En móvil, las acciones permanecen juntas aunque bajen de línea; verificar 390/556/1440 px sin desbordamiento.

## Contratos existentes y límites

- La ruta consulta `getAvailabilityForProfessionalCenter`; ADMIN y RECEPTION mutan, PROFESSIONAL sólo consulta. Actions delgadas pasan por `performAvailabilityAction`, que reautoriza, valida con Zod y usa RPC existentes.
- Crear envía día y horas; editar conserva el día y envía `availabilityId` y `expectedUpdatedAt`; quitar hace desactivación lógica con CAS; duración comparte `ProfessionalCenter.updatedAt` y el campo usado por Profesionales.
- Horas locales del centro, intervalos `[inicio, fin)`, sin cruce de medianoche; solapamiento y concurrencia se resuelven en servidor/RPC. Los errores stale exigen refrescar y no reintentar automáticamente.
- No tocar SQL, migraciones, RPC, RLS, slots, citas, permisos ni otros módulos funcionales. No acceder a Supabase DEV/PROD. Tests con respuestas controladas.
- El resultado de las Actions de franja usa un mensaje genérico «Horario guardado.»; la pantalla distinguirá la confirmación por operación sin alterar el contrato del servidor.
- Una operación en curso no se podrá cerrar ni volver a enviar. Si la respuesta es incierta se conservará el formulario y se pedirá actualizar antes de reintentar.

## Riesgos e impacto

- El modal debe conservar el foco y el formulario ante errores, sin disparar mutaciones al cerrar.
- La duración requiere sincronizar el último valor confirmado con props refrescadas para evitar un botón falsamente habilitado.
- Mantener los siete días y los permisos existentes; el cambio afecta sólo al componente y tests de Disponibilidad, más documentación pertinente.
- Los campos de texto permiten entradas parciales mientras se editan. Al enviar, deben rechazarse `HH:mm` mal formado, horas fuera de 00:00–23:59 y fin no posterior al inicio, sin modificar el payload de las Actions.
- La duración mostrada se calcula sólo con las horas locales de cada franja válida, sin modificar datos ni reglas. La presentación debe seguir legible para cero, una o varias franjas, roles editables y sólo lectura, teclado y móvil. Modales y formulario permanecen intactos.

## Preparación

- `pnpm bootstrap`: PASS.
- `origin/main` actualizado a `5230be9` (PR #31). Rama `codex/task-027-availability-ux` creada en el checkout habitual; `next-env.d.ts` y artefactos anteriores preservados.
- `localhost:3000` responde. El cambio de rama no alteró el árbol de archivos, así que no fue necesario detener el servidor.
