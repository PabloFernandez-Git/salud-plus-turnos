# TASK-037 — Navegación lateral V1

**Base:** `origin/main` `bb50697df11a3b2d36f77f892e95152c0bacb402`. **Rama:** `codex/v1-sidebar-navigation`. **Worktree:** `.worktrees/v1-sidebar-navigation`.

## Objetivo

Sustituir las tarjetas de navegación del Dashboard por una barra lateral persistente en `/centers/[centerId]`, con menú accesible en móvil. Conservar las funciones y autorizaciones existentes.

## Criterios de aceptación

- El layout de centro muestra Inicio, Agenda, Turnos, Pacientes, Profesionales, Disponibilidad, Especialidades, Gestión de usuarios y Configuración del centro según el rol ya autorizado.
- La ruta activa se destaca automáticamente, incluso en páginas de detalle. Los enlaces permiten cambiar de módulo sin pasar por Inicio.
- El encabezado conserva centro, usuario, rol, enlace opcional a plataforma y cierre de sesión, sin controles de retorno duplicados.
- El Dashboard conserva actividad e indicadores operativos y deja de mostrar tarjetas de navegación.
- En escritorio, barra izquierda de ancho moderado y contenido sin desborde horizontal. En móvil, menú modal con botón accesible, Escape, cierre por selección y foco controlado.
- Se revisan 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844 en localhost con Supabase DEV, junto con pruebas focales, typecheck, ESLint y Prettier.
- El commit es solo local y se crea tras verificación satisfactoria.

## Alcance e impacto

Componentes de navegación y encabezado de `src/modules/access`, layout de centro, Dashboard y sus pruebas. Documentación de navegación del centro. Sin rutas nuevas, cambios de negocio, Auth, permisos, RLS, migraciones ni servicios externos.

## Riesgos

- Un enlace mostrado a un rol incorrecto puede confundir aunque la autorización de servidor lo deniegue; conservar la matriz actual.
- El menú móvil puede dejar el foco perdido o permanecer abierto tras navegar; comprobar Escape, selección y retorno de foco.
- Pantallas densas como Agenda pueden desbordar al reducir el ancho útil; revisar en navegador las cuatro medidas solicitadas.
- La instalación de dependencias y el servidor local requieren acceso a la configuración DEV y a paquetes; no usar DEMO.

## Refinamiento posterior de navegación y encabezado

**Objetivo:** ocultar el breadcrumb redundante en las pantallas principales y distribuir en una fila los controles del encabezado en escritorio, sin cambiar la navegación ni la identidad visual aprobada.

**Aceptación:** las pantallas principales mantienen título, descripción y acciones sin espacio superior vacío; los detalles y editores conservan los enlaces de retorno; «Administrar plataforma» y «Cerrar sesión» quedan alineados a la derecha y con ancho de contenido cuando hay espacio. El encabezado se adapta sin desborde en móvil. Revisar los cuatro viewports solicitados y ejecutar pruebas focales, TypeScript, ESLint y Prettier. Los cambios permanecen sin commit.

**Impacto y riesgos:** componentes compartidos `ModuleHeader`, `CenterHeader` y `LogoutButton`, más pruebas y documentación de TASK-037. Verificar que el cambio del ancho del botón no altere otras vistas y que los enlaces útiles de detalle sigan presentes. Sin cambios de permisos, autenticación, negocio ni servicios externos.

## Refinamiento de sidebar compacta

**Objetivo:** iniciar la sidebar de escritorio como carril de íconos de unos 64 px y expandirla a unos 240 px con mouse o foco de teclado, superpuesta al contenido y sin cambiar el ancho del área principal. Conservar el menú móvil y la matriz de destinos por rol.

**Aceptación:** todos los enlaces autorizados conservan icono, nombre accesible y estado activo. Los grupos tienen separadores discretos y muestran sus títulos al expandirse. La transición dura entre 150 y 200 ms; al salir el puntero se contrae salvo que el foco siga dentro. El menú móvil sigue mostrando texto y funcionando por botón, Escape y selección. Se comprueban los cuatro viewports pedidos, la ausencia de scroll horizontal y la posición estable de las tablas durante la expansión.

**Impacto y riesgos:** `CenterSidebar`, `CenterNavigation`, pruebas cercanas, documentación y harness visual. El overlay podría recibir eventos de puntero fuera del carril o tapar contenido mientras está abierto; comprobar expansión sin parpadeos, retorno al carril y foco. No cambiar rutas, permisos, lógica de negocio, autenticación, servicios externos ni el encabezado refinado. Sin commit, push ni deploy.

## Refinamiento de encabezado de ancho completo

**Objetivo:** ubicar el encabezado en una fila de ancho completo y, debajo, la sidebar compacta junto al contenido. Trasladar la identidad Salud Plus y el disparador móvil al encabezado sin duplicarlos.

**Aceptación:** el encabezado ocupa todo el ancho, conserva centro, usuario, rol y acciones; la sidebar comienza debajo y se expande sobre el contenido sin desplazarlo ni tapar el encabezado. El menú móvil, la navegación con teclado, el estado activo y los permisos se mantienen. Comprobar los cuatro viewports solicitados, scroll vertical, ausencia de scroll horizontal y las cinco pantallas indicadas; ejecutar pruebas focales, TypeScript, ESLint y Prettier. Dejar el resultado local sin commit.

**Impacto y riesgos:** layout del centro, `CenterHeader`, `CenterSidebar`, CSS táctil, pruebas y harness visual. El cambio de altura y posición podría crear scroll adicional en páginas cortas o superposición durante hover; comprobar geometría del header y contenido. Sin cambios de negocio, autenticación, permisos o servicios externos.

## Refinamiento de marca enlazada en el encabezado

**Objetivo:** alinear el ícono y texto Salud Plus a 16–24 px del borde izquierdo y convertir todo el conjunto en un enlace al Dashboard del centro activo.

**Aceptación:** el enlace usa Next.js Link y la ruta existente `/centers/[centerId]`, muestra cursor pointer, conserva nombre accesible y foco visible, y permite volver al Dashboard desde otros módulos. El centro, usuario, rol, acciones y menú móvil conservan su distribución sin desbordes.

**Impacto y riesgos:** sólo `CenterHeader`, prueba focal del layout, harness visual y documentación. Reducir el margen puede afectar la alineación con el contenido en escritorio; comprobar geometría y responsive. No cambiar sidebar, rutas, permisos, autenticación ni lógica de negocio. Sin commit, push ni deploy.

## Refinamiento de acciones compactas y capa expandida

**Objetivo:** presentar las acciones de plataforma, cierre de sesión y actualización del Dashboard como controles cuadrados con iconos Lucide y tooltips visibles con hover o foco; añadir una sombra sutil únicamente a la sidebar expandida.

**Aceptación:** los controles conservan su función, autorización, nombres accesibles, foco y alineación; la actualización conserva el loader existente. El enlace de marca y los breadcrumbs permanecen como están. La sombra no afecta el ancho reservado ni el menú móvil/tablet. Comprobar tooltips, foco, geometría, ausencia de scroll horizontal y navegación en escritorio y móvil; ejecutar pruebas focales, TypeScript, ESLint, Prettier y `git diff --check`.

**Impacto y riesgos:** `CenterHeader`, `LogoutButton` en su variante con confirmación, `DailyDashboardPanel`, `CenterSidebar`, pruebas cercanas y harness visual. Tooltips pueden recortarse o desbordar en móvil; verificar los cuatro tamaños y tablet táctil. No cambiar estructura general, negocio, permisos, autenticación ni servicios externos. Sin commit, push ni deploy.

## Refinamiento de recarga y encabezado de plataforma

**Objetivo:** dar al botón Actualizar cursor pointer, azul suave y un movimiento de recarga mientras la lectura existente está pendiente; unificar visualmente el encabezado de `/platform` con el de los centros mediante marca, contexto y dos acciones de icono.

**Aceptación:** el botón conserva 44 px, tooltip y nombre accesible, se deshabilita durante la actualización y recupera su estado al completar; la animación respeta reduced motion. `/platform` conserva destino y visibilidad del retorno al centro, salida inmediata, cuenta y advertencia, tabla y Crear centro. El encabezado es horizontal y de ancho completo en escritorio y se adapta sin desborde en móvil. Se verifican los cuatro viewports, teclado, tooltips y funciones con pruebas focales, TypeScript, ESLint, Prettier y `git diff --check`.

**Impacto y riesgos:** componente de Dashboard, presentación del encabezado de plataforma, variante visual del botón de salida y pruebas/harness. Mantener una vista previa durante la recarga podría exponer datos de un centro anterior si cambia el contexto; limitarlo estrictamente al mismo centro, membership y rol. No cambiar la acción de datos, permisos, negocio, servicios externos o tabla. Sin commit, push ni deploy.

## Alineación de marca en plataforma

**Objetivo:** centrar verticalmente la marca Salud Plus dentro del encabezado de `/platform` y conservarla como enlace accesible a la ruta existente.

**Aceptación:** ícono y texto permanecen juntos a la izquierda, centrados respecto del bloque de contexto en escritorio; el título Centros, las acciones y el diseño móvil mantienen su posición. La marca ofrece cursor pointer y foco visible. Verificar escritorio y móvil en localhost:3003, pruebas focales y formato. Sin commit, push ni deploy.

**Impacto y riesgos:** sólo el encabezado de plataforma y su comprobación visual. La alineación podría afectar el quiebre de la fila en móvil; limitar el ajuste a pantallas de tamaño `sm` o mayor y comprobar el ancho disponible.
