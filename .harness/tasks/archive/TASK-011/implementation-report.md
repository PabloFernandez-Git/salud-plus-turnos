# Implementación y verificación

- Pacientes, Especialidades y Profesionales muestran las descripciones exactas debajo del nombre del centro.
- Las tres usan las clases visuales de la descripción de Usuarios. Pacientes hereda `space-y-2`; las otras dos aplican `mt-2` sin cambiar la estructura del header.
- Tests de los cuatro headers: 31 aprobados.
- `pnpm lint`, `pnpm typecheck` y `git diff --check`: aprobados.
- `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- La inspección de JSX y tests confirma el orden eyebrow → título → centro → descripción. No hubo sesión ADMIN para revisar los cuatro headers en navegador.
