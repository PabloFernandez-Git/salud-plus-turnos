# 15. Observabilidad

## Decisión aprobada

**Vercel Logs + Supabase Logs + logging estructurado y seguro para el MVP**

### Objetivo

La observabilidad del MVP debe permitir:

- detectar errores;
- investigar fallos;
- distinguir problemas de aplicación, base de datos, autenticación o storage;
- contar con contexto suficiente para depurar;
- evitar exponer información sensible.

### Vercel Logs

Vercel será la fuente principal para observar errores y logs producidos por la aplicación Next.js.

Se utilizará para investigar:

- errores del servidor;
- fallos en Server Actions o Route Handlers;
- excepciones;
- problemas de ejecución de la aplicación.

### Supabase Logs

Supabase se utilizará para investigar problemas relacionados con:

- PostgreSQL;
- Auth;
- API;
- Storage.

### Logging de aplicación

Los logs propios deberán ser intencionales y estructurados.

Ejemplo conceptual:

```text
appointment.create.failed
centerId: ...
professionalId: ...
reason: slot_not_available
```

Se evitarán logs genéricos o poco útiles como:

```text
entró
acá
error
```

### Privacidad

Los logs no deberán contener información sensible innecesaria.

Se evitará registrar:

- contraseñas;
- tokens;
- objetos completos de pacientes;
- datos clínicos;
- información personal que no sea necesaria para investigar el problema.

### Sentry

Sentry no se incorporará en el MVP inicial.

Se reevaluará cuando existan:

- un MVP estable;
- deploy público;
- usuarios externos;
- necesidad de error tracking centralizado.

### Analytics y observabilidad avanzada

No se incorporarán inicialmente herramientas como:

- Datadog;
- Prometheus;
- Grafana;
- OpenTelemetry;
- plataformas de analytics de producto.

Se evaluarán únicamente si aparece una necesidad real.

### Estado

**Aprobado**
