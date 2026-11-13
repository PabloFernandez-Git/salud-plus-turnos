# TASK-037 — Review

## Alcance revisado

- La sidebar se monta únicamente en el layout del centro; `/login`, recuperación y `/platform` quedan fuera.
- La matriz de destinos visible coincide con la navegación previa: ADMIN todos los módulos; RECEPTION Agenda, Turnos, Pacientes y Disponibilidad; PROFESSIONAL Agenda, Turnos y Disponibilidad. Las guardas de servidor siguen siendo la autoridad.
- La selección de módulo usa las rutas existentes y el estado activo se deriva del pathname, incluidos detalles. El Dashboard conserva el contenido operativo.
- El menú móvil usa `dialog.showModal()`, devuelve el foco al botón, se cierra al elegir un enlace o con Escape. Las pruebas de componente y Chromium cubren estas transiciones.

## Refinamiento revisado

- Pantallas principales sin breadcrumb redundante ni hueco superior. El detalle y la creación de turnos conservan enlaces hacia Turnos.
- Encabezado de administrador con controles alineados horizontalmente a la derecha en escritorio; rol sin permiso global sin enlace a plataforma. Móvil sin desbordes.

## Pendientes

- La persona usuaria confirmó la revisión autenticada de la sidebar inicial. La revisión autenticada de este refinamiento en Next DEV queda para la inspección visual del worktree; el navegador integrado no accedió a esa sesión durante esta ejecución.
- El `format:check` global mantiene deuda de formato anterior a esta rama (410 archivos). Código, dependencias y harness pasan Prettier focal; los tres documentos editados ya fallan en `origin/main`.

**Estado:** refinamiento listo para revisión visual. Sin commit, push ni deploy por instrucción explícita.

## Sidebar compacta

- El ancho reservado por el layout permanece en 64 px; el panel de 240 px se superpone. Las pruebas de Chromium comprobaron que el `main` conserva posición y ancho durante la expansión, incluso en Turnos.
- Mouse y foco expanden la barra; salir con el puntero la contrae salvo que el foco esté dentro. Los enlaces tienen nombre accesible, foco visible, iconos individuales y resaltado activo.
- La matriz de roles y las rutas siguen iguales. El menú móvil conserva texto, Escape y cierre al navegar; las pantallas táctiles de ancho tablet usan el mismo control.
- Verificaciones finales: 205/205 pruebas focales, typecheck, ESLint, Prettier focal, `git diff --check` y Chromium en cuatro viewports más tablet táctil: PASS. La inspección autenticada con sesión DEV real queda para la revisión visual de localhost:3003 porque el host del navegador integrado no estuvo disponible.

**Estado:** `TASK037_COMPACT_HOVER_SIDEBAR_READY`. Cambios locales sin commit.

## Encabezado de ancho completo

- El header precede a la fila lateral y ocupa todo el viewport. Centro, usuario, rol y acciones permanecen visibles; el menú móvil está junto a la identidad Salud Plus sin fila duplicada.
- La expansión de 64 a 240 px permanece bajo el encabezado y conserva las coordenadas del contenido. En una página corta no agrega scroll vertical; en una larga la página desplaza y el carril conserva su posición sticky. La inspección visual local y las pruebas de geometría pasaron en los cuatro viewports pedidos y en tablet táctil.
- Las rutas, permisos y funciones no cambiaron. Las pruebas focales (15/15), TypeScript, ESLint, Prettier y `git diff --check` pasaron. El navegador integrado no estuvo disponible para entrar en la sesión DEV existente, por lo que la revisión autenticada corresponde a la inspección humana en localhost:3003.

**Estado:** `TASK037_FULL_WIDTH_HEADER_READY`. Cambios locales sin commit.

## Marca del encabezado

- La marca completa usa la ruta del centro activo y se puede activar con teclado. El icono y texto comparten alineación vertical; el enlace tiene nombre accesible, cursor pointer y foco visible.
- El margen izquierdo queda entre 20 y 24 px en las medidas solicitadas, sin desborde. Chromium confirmó la vuelta desde Configuración al Dashboard y la conservación del menú móvil y sidebar. La revisión autenticada en Next DEV queda pendiente por indisponibilidad del navegador integrado.

**Estado:** `TASK037_HEADER_BRAND_LINK_READY`. Cambios locales sin commit.

## Controles de icono y sombra

- Plataforma conserva su permiso global; logout conserva el diálogo de confirmación; Actualizar conserva la lectura y el loader existentes. Los controles muestran nombre accesible y tooltip visible con hover o foco.
- La sombra sólo aparece en la sidebar expandida. La geometría del contenido, el menú móvil/tablet, el enlace de marca y la ausencia de breadcrumbs principales se conservaron. Chromium y las pruebas focales no detectaron desbordes ni regresiones.
- Validación técnica: 32/32 pruebas focales, TypeScript y ESLint focal: PASS. La revisión autenticada en la sesión DEV existente sigue pendiente porque el navegador integrado no accede a su host.

**Estado:** listo para revisión visual local, sin commit, push ni deploy.

## Recarga y encabezado de plataforma

- El estado de recarga del Dashboard se deriva de la clave de lectura existente y se limita al mismo centro, membership y rol. El botón no admite un segundo clic durante la lectura; el evento de visibilidad y el temporizador tampoco inician otra lectura mientras ésta continúa. Éxito, error y denegación recuperan su presentación correspondiente.
- `/platform` conserva sus comprobaciones de servidor, el destino de vuelta según cantidad de centros accesibles y el logout inmediato. La advertencia y el correo siguen visibles. El header se revisó en los cuatro viewports con tooltips y teclado; no se agregó sidebar ni se alteró la tabla.
- Pruebas focales, TypeScript, ESLint y Chromium sintético pasaron. La revisión autenticada en Next DEV queda pendiente porque el navegador integrado no estuvo disponible.

**Estado:** `TASK037_PLATFORM_HEADER_REFINED`, cambios locales sin commit.

## Alineación de marca en plataforma

- La marca quedó centrada verticalmente en escritorio y alineada a la izquierda en móvil. El enlace a `/platform` y el foco de teclado se comprobaron con el harness visual. Centros y los botones conservaron su posición; no hubo desborde horizontal en los cuatro viewports.
- Prueba focal de plataforma, TypeScript, ESLint, Prettier y `git diff --check`: PASS. La revisión autenticada en localhost:3003 continúa pendiente por indisponibilidad del navegador integrado. Sin commit, push ni deploy.

**Estado:** `TASK037_PLATFORM_BRAND_ALIGNMENT_FIXED`.
