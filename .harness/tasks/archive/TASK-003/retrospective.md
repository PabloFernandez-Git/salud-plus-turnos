# Retrospective — TASK-003

## Resultado

TASK-003 dejó configurada y verificada la infraestructura mínima de Supabase DEV. El Reviewer emitió
`PASS` después de una segunda revisión independiente funcional, Security y Database. El proyecto
aprobado es `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, región `sa-east-1`.

El cierre conserva el esquema `public` vacío: no crea tablas, migrations, Auth, RLS, seeds ni cambios
en Production.

## Qué funcionó

- Separar el aprovisionamiento humano de la implementación evitó exponer tokens, contraseña de base o
  claves privilegiadas en el repositorio y en la evidencia.
- Los wrappers fail-closed compartieron la misma validación y rechazaron `APP_ENV=production`, URL o
  ref discordantes y un proyecto linkeado distinto antes de conectarse.
- La conectividad se comprobó con un health check de sólo lectura y la generación de tipos leyó el
  schema real sin introducir cambios estructurales ni datos.
- Los clientes browser/server separados usan únicamente URL y publishable key; no se creó un cliente
  administrativo ni una dependencia artificial de `SUPABASE_SERVICE_ROLE_KEY`.
- La prueba con centinelas sintéticos verificó la frontera del bundle cliente sin utilizar secretos
  reales.
- El informe de implementación y la segunda review conservaron evidencia sanitizada y reproducible de
  configuración, seguridad, CLI, tipos y ausencia de cambios en PROD.

## Fricciones y aprendizajes

- El primer review demostró que la coherencia interna entre `.env.local`, URL, project ref y link de
  CLI no prueba que el destino sea el proyecto autorizado: todos esos valores podían cambiar juntos y
  seguir siendo coherentes.
- La corrección fue fijar el project ref y la región aprobados en una única fuente versionada, no
  secreta y revisable. Los guards ahora validan env, URL y link contra esa identidad antes de red o
  CLI.
- La autenticación de CLI y las verificaciones remotas dependen del perfil y la conectividad locales;
  los fallos del sandbox deben distinguirse de fallos reales de configuración y repetirse sólo con el
  acceso requerido.
- La publishable key es pública por diseño, pero no es una barrera de autorización. El próximo cambio
  de schema deberá acompañar las tablas multi-centro con grants y RLS revisados.

## Mejora conservada

- Se agregó a `.harness/knowledge/lessons.md` la regla reusable de anclar todo guard de entorno remoto
  a una identidad aprobada, versionada y revisable, en lugar de aceptar sólo coherencia entre entradas
  locales controladas por el mismo operador.
- No se propusieron cambios adicionales al Harness: la secuencia de review, corrección y segunda
  revisión independiente detectó y resolvió el riesgo dentro del ciclo previsto.

## Cierre

- Review independiente funcional, Security y Database: PASS.
- Destino verificado: `salud-plus-turnos-dev` / `ehllxymqyzrofydrvtzo` / `sa-east-1`.
- Secretos: `.env.local`, tokens, contraseñas y claves privilegiadas permanecen fuera de Git.
- Scope excluido: schema de dominio, migrations, Auth, RLS, seeds y Production.
- Bloqueos: ninguno.
- Próxima etapa: definir un Task Brief independiente para el esquema PostgreSQL inicial mediante
  migrations SQL versionadas, aplicadas primero en DEV y revisadas antes de cualquier promoción.
- Estado final: CLOSED.
