# TASK-025 — Refinamiento UX de Profesionales

## Objetivo

Presentar alta/vinculación, configuración y cambio de estado de Profesionales en modales responsive, con descarte seguro y errores visibles, manteniendo los contratos y flujos actuales.

## Criterios de aceptación

- Nuevo profesional abre un modal amplio; conserva verificación de documento, alta cuando no existe, vínculo y reactivación cuando existe, y la confirmación explícita.
- Configurar abre un modal amplio con Configuración y Especialidades y sus guardados independientes; Desactivar abre confirmación centrada, botón rojo y mensaje de conservación actual. Activar conserva su comportamiento.
- Cancelar, X, Escape y fondo cierran formularios limpios y solicitan confirmación si hay cambios sin guardar. Una sección guardada no cuenta como pendiente; los cambios pendientes de otra sección no se pierden sin confirmación.
- El modal bloquea cierre y envío duplicado durante operaciones, contiene el foco y lo devuelve al disparador.
- FormFieldError muestra errores por campo con asociación accesible y borde gris/azul/rojo. La validación propia evita globos nativos equivalentes.
- Nacionalidad se elige por nombre de país y se envía como ISO alpha-2. El botón dice «Verificar documento» y la descripción «Administrá los profesionales del centro».
- Pasan pruebas focales de los flujos, errores, descarte y diseño responsive desktop/móvil.

## Riesgos e impacto

Impacto restringido a `src/modules/professionals/`, sus pruebas y el brief/harness. Se reutilizan los componentes visuales compartidos y el patrón de TASK-024. Riesgos: perder un borrador al guardar la otra sección, usar un token CAS anterior después de un guardado, carreras al verificar documento, cierre durante una mutación, foco o scroll incorrectos en móvil. Se verifican esos casos y el diff. Sin cambios en PostgreSQL, RPC, RLS, migrations, otros módulos, listado ni Disponibilidad; sin acceso a Supabase DEV/PROD.

## Bloqueo de revisión: detalle de Disponibilidad (23/10/2026)

Objetivo: resolver el 404 al abrir el detalle desde Profesionales o Disponibilidad general, conservando los permisos de ADMIN, RECEPTION y PROFESSIONAL, el aislamiento por centro y la restricción de vínculos inactivos.

Criterios de aceptación: la ruta de detalle debe estar registrada en el servidor Next.js activo y un pedido sin sesión debe redirigir a `/login`; un ADMIN o RECEPTION con vínculo activo puede abrirla, incluso sin horarios; PROFESSIONAL sólo abre su propia disponibilidad. Se agrega una prueba focal de registro de ruta y se verifica el flujo en localhost sin reiniciar el servidor.

Diagnóstico: los dos enlaces contienen `professional_centers.id` y la URL reportada contiene UUID válidos. El servidor activo devolvía 404 incluso sin sesión, mientras las rutas vecinas devolvían 307 a `/login`. Su `.next/dev/types/routes.d.ts` omitía el detalle, aunque una generación nueva con `next typegen` sí lo incluía. La causa comprobada es un registro de rutas obsoleto del servidor de desarrollo. El riesgo está limitado al enrutamiento local; no se cambian consultas, permisos, RLS ni base de datos.

## Bloqueo de revisión: confirmaciones de Profesionales (23/10/2026)

Objetivo: asociar cada resultado exitoso de activar, desactivar, guardar configuración y guardar especialidades con el texto exacto aprobado. Una cancelación o resultado no exitoso no debe mostrar éxito, y un guardado nuevo debe retirar el aviso anterior mientras espera respuesta.

Criterios de aceptación: los cuatro mensajes corresponden a su operación después del resultado `success`; los casos `error` y `stale` conservan su tratamiento; cancelar no dispara acción ni confirmación; guardar especialidades limpia un éxito previo al iniciar. Pruebas focales de acciones y componente pasan sin reiniciar Next.js.

Diagnóstico y alcance: `performProfessionalAction` usa «Configuración del profesional actualizada.» como rama final tanto para `update` como para `setActive`. La acción de especialidades usa un texto genérico y su envío no borra el `feedback` anterior. Cambios limitados a acciones y componentes de Profesionales y sus pruebas; no se modifican modales, formularios, validaciones, permisos, reglas de negocio, RPC, RLS ni migrations.

## Ajustes finales: tabla y cierre de Configurar (23/10/2026)

Objetivo: mostrar en la tabla las especialidades activas asociadas, inmediatamente después de Profesional, y llamar «Cerrar» al botón inferior de Configurar. No se modifican los guardados ni la regla compartida de descarte.

Criterios de aceptación: ninguna asociación activa muestra «Sin especialidades»; una o varias muestran sus nombres completos; sólo se muestran especialidades y asociaciones activas. Un guardado exitoso se refleja en la tabla antes del refresco, y el refresco vuelve a usar los datos del servidor. En Configurar, Cerrar/X/Escape/fondo cierran sin borrador y advierten sólo sobre cambios pendientes, incluso cuando otra sección ya se guardó. La tabla conserva columnas y acciones con desplazamiento horizontal utilizable a 390 px.

Riesgos e impacto: evitar que un cambio aún no guardado aparezca en la tabla y que una respuesta local obsoleta prevalezca sobre el siguiente refresco. Alcance restringido a la pantalla y pruebas de Profesionales, documentación del módulo y expediente TASK-025. Sin nuevas consultas, cambios de permisos, reglas de negocio, SQL, RPC, RLS, migrations o Disponibilidad. Next.js sigue en localhost sin reinicio.

## Ajustes de estado y cursor (23/10/2026)

Objetivo: habilitar «Guardar configuración» sólo cuando matrícula o duración difieran de los últimos valores confirmados, y dar cursor pointer a botones/enlaces interactivos y not-allowed a botones deshabilitados dentro de Profesionales.

Criterios de aceptación: el botón comienza deshabilitado, se habilita al editar, se deshabilita al revertir o tras éxito, y conserva el estado pendiente tras error; el envío queda protegido durante la operación y el guardado de especialidades sigue independiente. Cursores comprobados en navegador para botón habilitado, botón deshabilitado y enlace.

Riesgos e impacto: la matrícula se recorta y la duración se normaliza en la validación existente, por lo que la comparación visual debe usar esos valores canónicos sin cambiar la persistencia. El CSS se limita al contenedor de Profesionales para no alterar otros módulos. Sólo se modifican pantalla, pruebas focales y este brief; sin cambios en servidor, permisos o base de datos.

## Ajustes responsive de tabla (26/10/2026)

Objetivo: mantener las tres acciones del profesional activo en una única fila y orientar sobre el desplazamiento horizontal únicamente cuando la tabla desborde su contenedor.

Criterios de aceptación: a 390 px y 100 % de zoom, Disponibilidad, Configurar y Desactivar quedan alineados horizontalmente sin reducir texto ni superficie de interacción; la tabla se desplaza dentro de su sección sin desbordar la página y muestra encima una indicación secundaria. En escritorio sin desbordamiento, la indicación permanece oculta y la presentación no cambia. Se comprueba también el cambio de ancho de ventana.

Riesgos e impacto: la anchura intrínseca de Acciones aumenta la tabla, por lo que el indicador debe basarse en el desbordamiento real y actualizarse cuando cambie el tamaño. Alcance restringido a la tabla de Profesionales, su prueba focal, verificación responsive y este brief. Se conservan enlaces, permisos, acciones y todo el estado local previo; sin cambios de servidor, base de datos ni otros módulos.

## Altura uniforme de acciones (26/10/2026)

Objetivo: igualar altura, padding vertical, tipografía y centrado del enlace Disponibilidad y los botones Configurar/Desactivar sin fijar sus anchos.

Criterios de aceptación: los tres controles calculan exactamente la misma altura y centran el texto a 390, 556 y 1440 px; siguen en una fila, con desplazamiento dentro de la tabla y sin desbordamiento de página. Se preservan destinos, permisos, foco, cursor, hover y estado deshabilitado.

Diagnóstico y alcance: Chromium midió 44 px para el enlace y 38 px para cada botón porque sólo el enlace tenía `min-h-11`. El ajuste comparte una base de clases visuales entre las tres acciones y conserva las clases específicas de foco y disabled. Riesgo limitado a la celda Acciones; no se tocan lógica, servidor ni otros módulos.

## Revisión final y PR (26/10/2026)

La persona usuaria aprobó la implementación y la revisión visual autenticada en localhost:3000, incluidos los accesos a Disponibilidad desde Profesionales y desde Disponibilidad general. Autoriza preparar un commit limitado a TASK-025 y publicar un PR hacia `main`. La tarea permanece activa: el merge, el cierre y cualquier despliegue requieren aprobación posterior.
