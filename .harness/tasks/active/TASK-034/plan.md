# Plan TASK-034 — Fase B

1. Separar la autorización obligatoria del centro de la consulta opcional para su encabezado.
2. Resolver centros y privilegio global de manera independiente en `getAccessOverview`; propagar el error global sólo cuando no existe destino tenant seguro.
3. Quitar la segunda lectura global de `/platform` después de `requirePlatformAdmin`, conservando su guardia estricta.
4. Mostrar un error genérico con reintento manual cuando la resolución de acceso no puede completarse.
5. Añadir pruebas focales de decisiones positivas, negativas y errores; verificar TypeScript, ESLint, Prettier y diff. Registrar resultados y dejar la tarea ACTIVE.

## Fase C — validación funcional

1. Levantar Next.js en una instancia aislada con datos y autenticación sintéticos, valores públicos ficticios y sin credenciales reales de Supabase; mantener el servidor existente intacto.
2. Recorrer en Chromium los casos de acceso tenant, rutas de entrada, permiso global desconocido, `/platform` y errores obligatorios.
3. Corregir únicamente defectos reproducidos, repetir la validación focal y registrar evidencias y límites en `validation-report.md`.

## Fase D — gate técnico final

1. Confirmar rama, base, estado staged/unstaged/untracked y separación de cambios preexistentes.
2. Auditar autorización tenant/plataforma, permiso opcional, redirecciones y reintento raíz.
3. Ejecutar `pnpm check`; investigar y repetir de forma controlada sólo los componentes afectados por fallos del entorno. Completar tooling, formato focal y diff.
4. Obtener revisión independiente del diff acumulado y registrar dictamen, hallazgos, evidencias y límites en `review.md` y `gate-report.md`.
