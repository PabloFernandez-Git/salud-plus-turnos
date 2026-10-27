# Plan TASK-031

1. Migración incremental de la RPC con control temporal tras lock y código de error estable; pruebas SQL locales que preserven roles, estados, CAS y concurrencia.
2. Mapear el error en contrato/Action y dar feedback claro con recarga segura.
3. Reflejar límites en el detalle con tiempo de referencia de servidor y actualización de pestaña; reutilizar el patrón `<dialog>` de Turnos para las cuatro acciones de estado.
4. Agregar pruebas focales de componente, Action y presentación responsive, ejecutar verificaciones locales y capturar 390/1440.
5. Solicitar revisión independiente, corregir hallazgos propios del alcance y documentar resultados sin publicar.

## Pulido visual final

1. Ajustar sólo clases del footer y presentación de los mensajes temporales en el detalle; conservar DOM semántico y `aria-describedby`.
2. Añadir aserciones focales de orden, distribución, mensajes presentes/ausentes y comportamiento existente.
3. Capturar los cuatro diálogos y los mensajes a 390/1440 con datos sintéticos; pasar TypeScript, ESLint, Prettier, diff check y review independiente focal. Registrar resultado en el mismo expediente, sin publicar.

## Iconos de reloj

1. Confirmar ausencia de icono de reloj compartido; agregar un SVG local pequeño y decorativo sólo a los dos mensajes autorizados.
2. Verificar alineación multilinea y `aria-describedby` en test focal y Chromium a 390/1440; capturar Acciones del turno.
3. Ejecutar formato, TypeScript y ESLint focal, revisar el diff y registrar resultado en TASK-031 sin publicar.

## Gate final y Pull Request autorizados

1. Verificar de nuevo migraciones y RPC en PostgreSQL local desechable, SQL, concurrencia, suite de React/Actions, TypeScript, ESLint, Prettier y diff; registrar resultados exactos y salvedades del entorno.
2. Obtener review independiente APPROVED del diff completo frente a `origin/main`; corregir sólo hallazgos bloqueantes del alcance.
3. Actualizar expediente, revisar secretos y datos personales, hacer staging explícito de TASK-031 sin `next-env.d.ts` ni archivos ajenos, revisar diff staged y crear commit.
4. Comprobar `origin/main`, publicar sólo esta rama sin force push y crear PR hacia `main`. Detenerse sin merge, despliegue ni migraciones remotas.
