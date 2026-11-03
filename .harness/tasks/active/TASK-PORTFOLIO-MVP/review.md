# TASK-PORTFOLIO-MVP — Review local

## Resultado

PASS para preparación local; smoke remoto pendiente antes de publicar.

## Criterios de aceptación

Las páginas de lectura conservan los roles y consultas existentes. Las acciones mutantes quedan bloqueadas por `PORTFOLIO_DEMO_MODE=true` y PostgreSQL revoca tanto DML directo como las RPC `SECURITY DEFINER` fuera de una lista de lecturas. El riesgo conocido de respuesta de identidad global se elimina para la demo porque las RPC de resolución no reciben `EXECUTE`. El seed contiene sólo identidades inventadas y rechaza un proyecto con otros usuarios o centros.

## Verificaciones

23/23 pruebas focales iniciales y 32/32 en la revisión previa a Vercel; typecheck, ESLint focal, Prettier focal, build de producción con webpack y diff check pasan. Revisión estática de firmas RPC, tablas, Server Actions y Route Handlers afectados. El operador confirmó DEMO con 28 migraciones, seed e inventario ficticio PASS y las seis RPC sensibles de pacientes sin EXECUTE para `anon` y `authenticated`. No se ejecutó aún un intento de DML directo con JWT demo ni smoke en navegador desplegado.

## Hallazgos

La acción web de cambio de contraseña no tenía guard DEMO; se añadió y se probó. Supabase Auth permite a un usuario autenticado cambiar directamente sus propias credenciales por la API Auth; el control de publicación de la cuenta compartida es operativo.

## Riesgos residuales

- Verificar DML directo con JWT demo, Auth redirects y el smoke de la guía antes de anunciar la URL.
- Evitar publicar la contraseña de la cuenta compartida sin un plan para restaurarla si se cambia por API Auth directa.
- La UI existente conserva controles CRUD visibles; la demo los rechaza. Las capturas o la grabación deben explicar esos flujos.
- Migraciones futuras requieren una revisión de grants antes de aplicarse a DEMO.
