# TASK-003 — Plan

**Estado:** `READY_FOR_REVIEW`

## Estrategia

Separar el trabajo en un gate humano de aprovisionamiento y una implementación técnica posterior. La identidad de DEV se valida antes de ejecutar cualquier comando remoto; los secretos los carga el usuario directamente en su máquina; las comprobaciones usan el mínimo privilegio y son de sólo lectura; y la ausencia de cambios en PROD se trata como un criterio verificable, no como una suposición.

## Gate humano previo a la implementación

1. Ingresar al [Dashboard de Supabase](https://supabase.com/dashboard) con la cuenta y organización correctas.
2. Crear un proyecto exclusivo de desarrollo, preferentemente `salud-plus-turnos-dev`, o confirmar que ya existe uno que nunca fue usado como Production.
3. Seleccionar la región específica **South America (São Paulo), `sa-east-1`**.
4. Crear una contraseña de base única y guardarla en un password manager. No pegarla en el chat ni almacenarla en documentación.
5. Esperar a que el proyecto quede saludable. No ejecutar quickstarts ni crear tablas de ejemplo.
6. Abrir el proyecto y obtener:
   - `project ref`, visible en la URL `https://supabase.com/dashboard/project/<project-ref>`;
   - Project URL;
   - publishable key desde **Connect** o **Settings > API Keys**.
7. Copiar `.env.example` a `.env.local` y completar localmente, sin compartir valores:
   - `APP_ENV=development`;
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_DEV_PROJECT_REF`.
8. No agregar una clave privilegiada salvo que la implementación demuestre que es necesaria. Si se requiere, usar la clave moderna server-side recomendada o la service-role legacy sólo por compatibilidad, nunca con prefijo `NEXT_PUBLIC_`.
9. Autenticar la CLI desde la terminal local con `pnpm exec supabase login`, siguiendo el flujo interactivo. Guardar el token únicamente en el credential store; no pegarlo en el chat ni en `.env.local` salvo que un flujo no interactivo aprobado lo requiera.
10. Confirmar al Orchestrator que el proyecto DEV existe, que la región y el `project ref` fueron revisados, que `.env.local` fue completado y que la CLI quedó autenticada. Sólo el nombre, región y `project ref` pueden compartirse si hace falta diagnosticar identidad.

## Plan de implementación posterior

1. **Revalidar precondiciones**
   - Ejecutar el Startup Protocol y leer este Brief y Plan completos.
   - Confirmar la branch `task/003-supabase-dev-setup`, revisar el diff y volver a ejecutar `pnpm bootstrap`.
   - Confirmar con checks que `.env.local` está ignorado y no versionado, sin imprimir su contenido.

2. **Validar la identidad DEV antes de conectar**
   - Leer las variables por nombre y validar formato, sin loguear valores.
   - Derivar el host esperado desde `SUPABASE_DEV_PROJECT_REF` y rechazar cualquier URL discordante.
   - Bloquear los comandos de infraestructura si `APP_ENV=production`.
   - Contrastar desde la CLI o Dashboard nombre, ref y región; no vincular un proyecto si su identidad no es inequívoca.

3. **Ajustar el contrato de entorno**
   - Mantener `.env.example` sólo con placeholders y comentarios de clasificación.
   - Decidir y documentar el uso de clave `secret` moderna frente al nombre legado `SUPABASE_SERVICE_ROLE_KEY` existente.
   - Hacer que `scripts/bootstrap.mjs` exija sólo lo realmente necesario para TASK-003 y valide coherencia sin revelar credenciales.
   - Evitar que `next.config.ts` o cualquier configuración de bundling incluya secretos.

4. **Hacer reproducible `pnpm db:types`**
   - Cargar `.env.local` explícitamente para scripts ejecutados fuera del runtime de Next.js, usando una solución compatible con el stack existente.
   - Conservar la invocación multiplataforma de Supabase CLI ya verificada en TASK-001.
   - Ejecutar `supabase gen types typescript --project-id <DEV> --schema public` a través del wrapper del proyecto.
   - Escribir únicamente `src/lib/supabase/database.types.ts`, sin edición manual y sin introducir tablas de dominio.

5. **Preparar clientes mínimos de Next.js**
   - Crear un cliente browser con `@supabase/ssr`, URL y publishable key sólo si aporta una verificación o una base inmediatamente utilizable.
   - Crear el cliente server de sesión correspondiente sólo si puede hacerse sin implementar Auth funcional; no agregar proxy, login ni refresh de sesiones en esta tarea.
   - Tipar ambos con `Database` generado.
   - No crear un cliente admin por anticipado. Si aparece una necesidad aprobada, aislarlo en un módulo `server-only` que use exclusivamente una credencial no pública.

6. **Agregar una comprobación de conectividad segura**
   - Implementar un comando explícito para DEV que realice una lectura mínima contra el endpoint esperado usando publishable key.
   - No crear tablas, usuarios, datos, buckets, funciones, migrations ni seeds.
   - Rechazar URL/ref discordantes y `APP_ENV=production` antes de abrir la conexión.
   - Sanitizar mensajes de error y evidencia para que nunca incluyan claves o tokens.

7. **Verificar la frontera browser/server**
   - Buscar referencias a variables privilegiadas y asegurar que sólo existan en scripts o módulos `server-only` aprobados.
   - Agregar una prueba con un valor centinela sintético para comprobar que el build cliente no contiene secretos.
   - Verificar que browser y server de sesión usan la publishable key, no una clave que bypassee RLS.

8. **Documentar reproducción en otra máquina**
   - Crear `docs/supabase-dev-setup.md` o consolidar una guía equivalente en `supabase/README.md`.
   - Incluir requisitos, creación/selección del proyecto, región, localización del ref, variables, login de CLI, conectividad, `pnpm db:types`, rotación ante filtraciones y troubleshooting mínimo.
   - Usar placeholders en todos los ejemplos y reiterar que PROD queda fuera de los comandos automáticos.

9. **Verificar el resultado**
   - Ejecutar `pnpm bootstrap`.
   - Ejecutar el check de conectividad DEV.
   - Ejecutar `pnpm db:types` y revisar el archivo generado.
   - Ejecutar `pnpm format:check`, `pnpm check` y `pnpm build`.
   - Ejecutar `git check-ignore -v .env.local`, `git ls-files ".env*"` y revisar el diff por secretos o referencias PROD.
   - Confirmar que no se ejecutaron `db push`, migrations, seeds, resets ni mutaciones en PROD.

10. **Producir evidencia y review independiente**
    - Crear `implementation-report.md` con una matriz de criterios y salidas sanitizadas.
    - Delegar revisión funcional a Reviewer/Verifier.
    - Solicitar revisión de Security para variables, imports y bundle, y de Database para identidad DEV, CLI y tipos generados.
    - Corregir hallazgos y repetir verificaciones con el límite de ciclos del Harness.
    - No cerrar TASK-003 hasta Review PASS; el cierre sigue fuera de esta conversación.

## Archivos previstos

- `.env.example` — placeholders y clasificación; nunca valores reales.
- `.gitignore` — sólo si la verificación revela una brecha; actualmente ya ignora `.env.local`.
- `scripts/bootstrap.mjs` — validación segura y coherencia DEV.
- `scripts/generate-db-types.mjs` — carga reproducible de entorno y generación contra DEV.
- `scripts/check-supabase-dev.mjs` — smoke test de sólo lectura, si es la opción mínima elegida.
- `src/lib/supabase/client.ts` — cliente browser no privilegiado, si corresponde.
- `src/lib/supabase/server.ts` — cliente server de sesión no privilegiado, si corresponde.
- `src/lib/supabase/database.types.ts` — salida generada desde DEV.
- `docs/supabase-dev-setup.md` o `supabase/README.md` — guía reproducible.
- Tests cercanos a scripts/clientes — coherencia, fail-closed y frontera de secretos.
- `.harness/tasks/active/TASK-003/implementation-report.md` — evidencia posterior.

Los nombres son orientativos salvo los artefactos exigidos por el Harness. El Implementer debe preferir el cambio mínimo que satisfaga los criterios.

## Delegación prevista

- **Implementer:** configuración del repositorio, clientes mínimos, checks, tipos, tests y documentación.
- **Reviewer / Verifier:** reproducción independiente de criterios y comandos.
- **Security specialist:** claves públicas/secretas, `server-only`, bundle y sanitización.
- **Database/RLS specialist:** identidad DEV, acceso CLI, generación de tipos y confirmación de que no se creó schema ni se tocó PROD.

## Gates

- `WAITING_FOR_USER_SETUP` → estado actual; falta proyecto DEV confirmado, variables locales y login de CLI.
- `READY_FOR_IMPLEMENTATION` → gate humano completo y precondiciones revalidadas sin exponer secretos.
- `READY_FOR_VERIFICATION` → implementación y evidencia completas.
- `READY_FOR_REVIEW` → verificaciones locales y remotas DEV en verde.
- `PASS` → review independiente aprobada.
- `CLOSED` → cierre orquestado en una etapa posterior.

Estado actual: `READY_FOR_REVIEW`.
