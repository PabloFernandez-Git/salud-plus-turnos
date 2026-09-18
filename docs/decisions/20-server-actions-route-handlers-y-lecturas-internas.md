# 20. Server Actions, Route Handlers y lecturas internas

## Decisión aprobada

El proyecto utilizará tres mecanismos distintos según el tipo de operación:

```text
Lecturas internas desde Server Components
→ queries del módulo

Mutaciones iniciadas desde nuestra aplicación web
→ Server Actions

APIs públicas, webhooks o clientes externos
→ Route Handlers
```

## ¿Qué problema resuelve esta decisión?

Evita que cada funcionalidad use un mecanismo diferente sin criterio y mantiene separadas la UI, la entrada al servidor y la lógica de negocio.

## Lecturas internas

Cuando un Server Component necesite datos, llamará directamente a una query del módulo:

```text
AgendaPage
↓
getAppointmentsForDay()
↓
Supabase Client
↓
PostgreSQL
```

No crearemos un endpoint HTTP solo para que el propio servidor Next.js se llame a sí mismo.

## Server Actions

Serán el mecanismo principal para mutaciones iniciadas desde nuestra propia aplicación web:

- crear paciente;
- crear profesional;
- crear turno;
- reprogramar turno;
- cancelar turno;
- confirmar turno;
- marcar turno como atendido;
- modificar configuración del centro.

Una Server Action deberá ser una capa delgada:

```text
UI
↓
Server Action
↓
autenticación
↓
autorización
↓
Zod
↓
lógica del módulo
↓
Supabase
```

La lógica central del negocio no deberá quedar encerrada dentro de la Server Action.

## Route Handlers

Se utilizarán cuando necesitemos una interfaz HTTP explícita para:

- webhooks;
- integraciones;
- APIs públicas;
- aplicaciones móviles;
- otros clientes externos.

Ejemplo:

```text
Servicio externo
↓
POST /api/webhooks/...
↓
Route Handler
↓
lógica del módulo
↓
Supabase
```

## Reutilización

Server Actions y Route Handlers actuarán como adaptadores alrededor de la misma lógica del módulo.

```text
Web App
↓
Server Action
        \
         → operación de dominio
        /
API externa
↓
Route Handler
```

## Seguridad

Toda operación sensible deberá validar en servidor:

- sesión;
- membership;
- centro activo;
- rol;
- ownership cuando corresponda;
- input mediante Zod.

Las Server Actions no se consideran privadas por el simple hecho de ejecutarse en el servidor.

## Regla final

> La lógica del negocio pertenece al módulo, no al mecanismo que la invoca.

## Estado

**Aprobado**
