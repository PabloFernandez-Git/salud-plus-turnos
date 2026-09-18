# 32. Observabilidad del MVP

## ¿Qué significa observabilidad?

Es la capacidad de entender qué está ocurriendo cuando la aplicación falla o se comporta de manera inesperada.

En el MVP utilizaremos tres fuentes principales:

```text
Next.js
→ Vercel Logs

Supabase
→ logs de PostgreSQL / Auth / API / Storage

Aplicación
→ logs estructurados propios
```

## Vercel Logs

Servirán principalmente para investigar problemas de la aplicación y del servidor.

## Supabase Logs

Servirán para investigar problemas relacionados con los servicios administrados de Supabase.

## Logging estructurado

Los logs deberán describir eventos concretos y útiles.

Ejemplo:

```text
appointment.create.failed
centerId: ...
reason: slot_not_available
```

La prioridad será registrar contexto técnico suficiente sin incluir datos personales innecesarios.

## Privacidad

Nunca se registrarán:

- contraseñas;
- tokens;
- credenciales;
- objetos completos con información sensible;
- datos clínicos.

## Sentry

Sentry queda como evolución futura.

Podrá evaluarse cuando el proyecto tenga usuarios externos y necesitemos:

- agrupación automática de errores;
- stack traces centralizados;
- frecuencia de fallos;
- seguimiento entre versiones.

No se incorporará antes de que exista una necesidad concreta.

## Filosofía

La regla será:

> primero usar la observabilidad ya incluida en nuestra infraestructura; agregar nuevas plataformas solo cuando aporten valor real.
