# TASK-PORTFOLIO-MVP — Demo pública de portfolio

## Objetivo

Preparar un despliegue de demostración con un solo centro y datos ficticios, navegable con una cuenta de lectura, sin modificar DEV/PROD ni TASK-029.

## Contexto relevante

Base `afd502dc2b45ac5be303b22efd51f6cd521b54c9`. La demo se aprovisionará en un proyecto Supabase independiente. La única cuenta Auth recibe una membership ADMIN para reutilizar las lecturas existentes; la migración DEMO limita a todos los usuarios `authenticated` de ese proyecto a lectura.

## Criterios de aceptación

- [x] La ruta de lectura de dashboard, agenda, profesionales, especialidades, pacientes y turnos se conserva; smoke con navegador desplegado pendiente.
- [x] PostgreSQL revoca DML y RPCs de escritura para `authenticated`; las seis RPC sensibles de pacientes fueron verificadas en DEMO, prueba directa de DML con JWT pendiente.
- [x] El servidor rechaza acciones de escritura en modo demo antes de operar servicios privilegiados.
- [x] La resolución global de identidad de personas/profesionales queda revocada y el flujo web se bloquea.
- [x] Auth usa un origen de despliegue explícito para recovery/callback sin aceptar redirecciones arbitrarias.
- [x] Migración y fixtures reproducibles, sin datos de DEV.
- [x] README, variables mínimas y smoke documentados.
- [x] Pruebas focales, typecheck, build y review local.

## Impactos

- Security: sí — bloqueos de escritura y de resolución global.
- Authorization: sí — marcador de cuenta demo comprobado en servidor y DB.
- Database: sí — una migración DEMO posterior a las 27 existentes.
- Documentation: sí — publicación y operación de DEMO.
- Testing: sí — pruebas focales y smoke manual pendiente de proyecto DEMO.

## Riesgos

- `PORTFOLIO_DEMO_MODE=true` es requisito de Vercel para bloquear acciones de servidor; el SQL DEMO cubre igualmente acceso directo a la base.
- Las migraciones futuras deberán volver a auditar los grants y las RPC concedidas.
- Supabase DEMO `oygrwetmxsqgcizopezq` tiene 28 migraciones, Auth demo y seed verificados. Falta el smoke con JWT real y el despliegue Vercel.
- Supabase Auth permite al titular de una sesión cambiar sus propias credenciales por API directa; la cuenta compartida requiere control operativo.

## Fuera de alcance

TASK-029, historia clínica, datos reales, DEV/PROD, despliegue, infraestructura empresarial y cambios generales de UI.
