# 16. Estrategia de entornos Supabase

## Decisión aprobada

**Dos proyectos Supabase separados: Development y Production**

### Arquitectura

```text
LOCAL
Next.js localhost
↓
Supabase DEV
```

```text
VERCEL PREVIEW
↓
Supabase DEV
```

```text
VERCEL PRODUCTION
↓
Supabase PROD
```

### Motivos principales

- separar datos de desarrollo y producción;
- evitar que pruebas locales afecten el entorno publicado;
- permitir probar migrations y cambios de esquema antes de producción;
- mantener usuarios, datos y archivos de prueba fuera de producción;
- facilitar un flujo de trabajo profesional con previews.

### Migrations

La estructura de la base de datos deberá evolucionar mediante migrations SQL versionadas en el repositorio.

El flujo esperado será:

```text
crear migration
↓
aplicar en Supabase DEV
↓
probar
↓
ejecutar tests
↓
aplicar en Supabase PROD
```

No se deberán replicar manualmente cambios de esquema entre ambientes.

### Datos

DEV y PROD compartirán la misma estructura lógica, pero no los mismos datos.

DEV podrá contener datos ficticios y seeds para desarrollo y testing.

### Supabase Auth

Los usuarios de DEV y PROD serán independientes.

Las cuentas de prueba existirán únicamente en DEV salvo necesidad explícita.

### Supabase Storage

Los archivos de DEV y PROD estarán separados.

Los logos u otros archivos de prueba no deberán mezclarse con producción.

### Variables de entorno

Cada entorno utilizará sus propias credenciales.

Ejemplo conceptual:

```text
LOCAL / PREVIEW
→ Supabase DEV

PRODUCTION
→ Supabase PROD
```

### Supabase local

No se utilizará Supabase local como requisito inicial.

Podrá evaluarse más adelante si aporta valor para:

- tests;
- aislamiento;
- automatización;
- CI.

### Estado

**Aprobado**
