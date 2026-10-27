# TASK-032 — Refinamiento UX de Gestión de usuarios

**Estado:** ACTIVE. **Base:** `origin/main` (`25bc3b7`). **Rama:** `codex/task-032-users-ux`.

## Objetivo

Mejorar la administración de usuarios en móvil y clarificar los pasos de edición e incorporación, conservando los contratos actuales de autorización, idempotencia y persistencia.

## Criterios de aceptación

- Tabla de escritorio conservada; tarjetas móviles con los mismos datos, orden y acción, sin scroll horizontal a 390 px.
- Administrar acceso sólo permite revisar cambios semánticos válidos; explica la restricción del último ADMIN y mantiene confirmación, descarte y manejo de pending.
- Incorporación abre un modal accesible desde una tarjeta compacta. Sus etapas son email, datos/acceso y revisión sin mutación para identidad nueva o existente sin membership. La mutación sucede al confirmar, sin exponer ni persistir la contraseña en la revisión.
- Cierre, Escape y descarte recuperan el foco del disparador, no pierden una intención incierta y limpian la contraseña al descartar. El listado no cambia de posición al abrir.
- Validaciones y errores próximos a los campos cuando sea posible; textos comprensibles.
- Se documenta el diagnóstico de consultas, Auth, memberships, último ADMIN e intención de alta, con pruebas y evidencias visuales a 390, 556 y 1440 px.
- Revisión independiente y controles locales completados; tarea permanece ACTIVE hasta integración y cierre documental.

## Impacto y límites

Componentes y pruebas de `src/modules/access`, documentación funcional de acceso y estado. No cambiar queries, alcance de visibilidad, schemas de servidor, RPC, RLS, migrations, Auth global ni TASK-029. Sin acceso a Supabase DEV/PROD.

## Riesgos

- Un resultado incierto de provisioning debe reintentarse con el mismo `operation_id`; la revisión no debe crear otro intento ni conservar contraseña tras submit.
- El precheck de último ADMIN puede quedar obsoleto: la RPC mantiene la decisión final.
- `pnpm bootstrap` intenta reconciliar `node_modules` y falla sin TTY; ejecutar el script directo y usar binarios existentes para verificación.
- El checkout contiene `next-env.d.ts` modificado y numerosos untracked ajenos, que deben preservarse.
- La preferencia de modal reemplaza expresamente la decisión inline anterior. El diálogo debe conservar `operation_id` e intención ante resultados inciertos, sin dejar la contraseña en un formulario cerrado.

## Ajuste final solicitado en validación visual

- En «Datos y acceso», una identidad nueva exige confirmación exacta de contraseña inicial antes de revisar, con error inline y sin enviarla a la acción ni persistirla.
- Tras una operación exitosa, el mismo modal muestra un estado compacto y preciso: creación, incorporación o confirmación idempotente. Ofrece «Cerrar» y «Agregar otro usuario»; limpia credenciales y reinicia la intención al salir o empezar otra alta.
- El alcance se limita a estos dos ajustes del modal, sus pruebas y evidencias. La validación visual fue aprobada; el gate técnico, commit y PR están autorizados. No se autorizó merge, despliegue ni operaciones en DEV/PROD.
