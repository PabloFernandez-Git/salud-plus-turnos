# 33. Entornos Supabase

## Decisión

El proyecto utilizará dos proyectos de Supabase:

```text
salud-plus-turnos-dev
salud-plus-turnos-prod
```

## Desarrollo

Tanto el entorno local como los Preview Deployments de Vercel utilizarán Supabase DEV.

```text
localhost
→ Supabase DEV

Vercel Preview
→ Supabase DEV
```

Esto permite probar libremente:

- usuarios;
- turnos;
- pacientes;
- migrations;
- storage;
- datos ficticios.

## Producción

La aplicación publicada utilizará exclusivamente Supabase PROD.

```text
Vercel Production
→ Supabase PROD
```

## Migrations

Las migrations SQL serán la fuente de verdad para mantener ambos esquemas alineados.

```text
Git
↓
migration
↓
DEV
↓
tests
↓
PROD
```

Los cambios de estructura no se copiarán manualmente entre ambientes.

## Datos y usuarios

Los datos no se compartirán entre DEV y PROD.

Esto incluye:

- pacientes;
- profesionales;
- turnos;
- usuarios de Auth;
- archivos de Storage.

## Seeds

DEV podrá utilizar datos ficticios reproducibles para facilitar desarrollo y testing.

Por ejemplo:

```text
1 centro
3 profesionales
varios pacientes
varios turnos
```

## Supabase local

No será obligatorio al inicio.

Podrá evaluarse más adelante si necesitamos un entorno completamente local o automatización adicional.
