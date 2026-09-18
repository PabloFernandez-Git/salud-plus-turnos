# Retrospective — TASK-001

## Resultado

TASK-001 completó el bootstrap del repositorio y cerró con Review PASS. Los trece criterios de aceptación del brief quedaron satisfechos sin ampliar producto, arquitectura ni alcance.

## Qué funcionó

- El brief mantuvo separados el bootstrap y las decisiones postergadas, en especial Supabase DEV, el spike de agenda y el E2E completo.
- La secuencia implementación → verificación → review independiente detectó un fallo real de ejecución en Windows antes del cierre.
- Las verificaciones agregadas (`pnpm check` y `pnpm verify`) y la instalación con lockfile congelado dieron una señal reproducible equivalente a CI.
- Probar el bloqueo del seed con `APP_ENV=production` verificó la protección destructiva sin necesitar credenciales ni infraestructura externa.

## Fricciones y lecciones

- Elegir automáticamente las majors más recientes no aseguró compatibilidad: TypeScript 7 excedía el rango soportado por `typescript-eslint` 8.70.0 y ESLint 10 excedía los peers de plugins incluidos por Next.js 16.3.5. Se fijaron TypeScript 6.0.3 y ESLint 9.39.5 y `pnpm peers check` confirmó el grafo resultante.
- En Windows, `execFileSync("pnpm", ...)` puede fallar con `ENOENT` porque pnpm se resuelve mediante un shim `.cmd`. La solución estable fue usar `ComSpec` en `win32`, pasar cada argumento por separado y conservar la invocación directa en POSIX.
- El smoke test de `db:types` con una referencia inválida permitió distinguir dos capas: el lanzamiento de pnpm/Supabase CLI sí funciona en Windows; la integración real con Supabase sigue fuera de alcance. Esta técnica evita confundir un problema del launcher con uno del servicio externo.
- Git avisó que convertiría LF a CRLF en el checkout de Windows. Además, el primer `git diff --check` del cierre detectó tres espacios finales introducidos en `docs/status.md`; se corrigieron y el segundo chequeo pasó. Los warnings locales de conversión LF/CRLF no se confundieron con esa regresión real ni motivaron normalizar archivos ajenos.
- La ausencia de `.env.local` debe seguir siendo advertencia, no error, mientras Supabase DEV no forme parte del bootstrap requerido.

## Mejoras para conservar

- Verificar peers antes de congelar versiones y repetir la instalación con `--frozen-lockfile` antes del review.
- Cuando un script Node invoque herramientas instaladas por pnpm, revisar explícitamente las ramas Windows y POSIX; evitar comandos concatenados y pasar argumentos de forma estructurada.
- Para integraciones todavía no configuradas, diseñar smoke tests que prueben hasta el límite externo sin crear secretos ni ampliar el alcance.
- Si vuelve a aparecer lógica de lanzamiento multiplataforma, evaluar extraer un helper pequeño y cubierto por tests en lugar de duplicar ramas por script.

## Cierre

- Criterios de aceptación: 13/13 satisfechos.
- Review: PASS.
- Riesgos residuales aceptados: Supabase DEV real y Playwright E2E completo permanecen postergados según el alcance aprobado.
- Próxima tarea: TASK-002 — React Big Calendar Spike.
