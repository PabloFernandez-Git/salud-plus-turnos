# 37. Server Actions, Route Handlers y queries internas

Esta decisión define **cómo entra una operación desde la interfaz o desde el exterior hacia nuestra lógica de negocio**.

No son tres herramientas equivalentes. Cada una resuelve un problema distinto.

## 37.1. Regla rápida

```text
LECTURA INTERNA
→ query del módulo

MUTACIÓN DESDE NUESTRA WEB
→ Server Action

INTERFAZ HTTP PARA EL EXTERIOR
→ Route Handler
```

Elegimos esta separación para evitar una aplicación donde cada pantalla invente su propio patrón.

---

## 37.2. Queries internas

Una query es una función del módulo cuya responsabilidad principal es leer información.

Ejemplos:

```text
getAppointmentsForDay()
getPatientById()
getProfessionalAgenda()
```

Si una página de Next.js se ejecuta en el servidor, puede llamar directamente a esa función:

```text
src/app/(dashboard)/agenda/page.tsx
↓
getAppointmentsForDay()
↓
Supabase Client
↓
PostgreSQL
```

### ¿Por qué no crear `/api/appointments`?

Porque la página y la consulta ya están del lado servidor.

Crear este recorrido:

```text
Server Component
↓
HTTP
↓
/api/appointments
↓
mismo servidor
↓
Supabase
```

agregaría una capa que no aporta valor.

Por eso, para lecturas internas, **preferimos una query directa del módulo**.

---

## 37.3. Server Actions

Una Server Action es una función de Next.js que se ejecuta en el servidor y puede ser iniciada desde nuestra interfaz React.

Ejemplo conceptual:

```ts
"use server";

export async function cancelAppointment(input: unknown) {
  // operación del servidor
}
```

Nos permite hacer:

```text
Botón "Cancelar turno"
↓
Server Action
↓
Servidor Next.js
```

sin crear manualmente un endpoint `/api/...`.

### ¿Para qué las usaremos?

Para mutaciones iniciadas desde nuestra aplicación web:

```text
Crear paciente
Crear profesional
Crear turno
Reprogramar turno
Cancelar turno
Confirmar turno
Editar centro
```

### ¿Qué debe hacer una Server Action?

Coordinar la entrada:

```text
1. comprobar sesión
2. comprobar acceso al centro
3. validar input con Zod
4. llamar a la lógica del módulo
5. devolver un resultado seguro
```

No debe convertirse en un archivo con toda la lógica del negocio.

---

## 37.4. Route Handlers

Un Route Handler crea una URL HTTP explícita dentro de Next.js.

Ejemplos:

```text
POST /api/appointments
GET /api/appointments/123
POST /api/webhooks/whatsapp
```

Es la herramienta adecuada cuando el consumidor no es nuestra propia UI React.

Ejemplos futuros:

```text
Proveedor de WhatsApp
↓
Webhook

Aplicación móvil
↓
API

Sistema externo
↓
Integración
```

---

## 37.5. Ejemplo completo

### Mostrar la agenda

```text
AgendaPage
↓
getAppointmentsForDay()
↓
Supabase
```

No necesitamos Server Action ni Route Handler.

### Cancelar un turno desde nuestra web

```text
Usuario
↓
botón Cancelar
↓
cancelAppointmentAction()
↓
auth
↓
authorization
↓
Zod
↓
cancelAppointment()
↓
Supabase
```

Usamos una Server Action.

### Cancelar el mismo turno desde una futura app móvil

```text
Mobile App
↓
PATCH /api/appointments/:id
↓
Route Handler
↓
cancelAppointment()
↓
Supabase
```

La app móvil usa HTTP, pero la lógica de negocio es la misma.

---

## 37.6. La lógica importante debe ser reutilizable

No queremos:

```text
Server Action
└── toda la lógica de negocio
```

Queremos:

```text
Web App
↓
Server Action ─────┐
                   │
                   ▼
           lógica del módulo
                   │
                   ▼
                Supabase
                   ▲
                   │
Route Handler ─────┘
↑
API externa
```

Así evitamos duplicación y no encerramos el negocio dentro de una tecnología de entrada concreta.

---

## 37.7. Relación con nuestra arquitectura modular

Un módulo podría verse así:

```text
modules/
└── appointments/
    ├── actions/
    │   └── cancel-appointment.action.ts
    ├── queries/
    │   └── get-appointments-for-day.ts
    ├── schemas/
    │   └── cancel-appointment.schema.ts
    └── domain/
        └── cancel-appointment.ts
```

Y si aparece una API externa:

```text
app/
└── api/
    └── appointments/
        └── [id]/
            └── route.ts
```

La ruta reutiliza la lógica del módulo en lugar de duplicarla.

---

## 37.8. Seguridad

Una Server Action **no es automáticamente segura** por ejecutarse en el servidor.

Toda operación sensible debe comprobar:

```text
¿usuario autenticado?
↓
¿membership activo?
↓
¿centro correcto?
↓
¿rol permitido?
↓
¿input válido?
↓
¿regla de negocio válida?
↓
operación
```

Lo mismo aplica a Route Handlers.

---

## 37.9. Por qué elegimos este enfoque

Porque nos permite ser simples hoy sin cerrar puertas mañana.

Hoy:

```text
Next.js web
→ queries + Server Actions
```

Futuro:

```text
webhooks / app móvil / integraciones
→ Route Handlers
```

La lógica del dominio permanece reutilizable en ambos casos.

## Regla final

```text
Server Components + queries
→ lecturas internas

Server Actions
→ mutaciones desde nuestra web

Route Handlers
→ APIs, webhooks, integraciones y clientes externos
```

> **La lógica del negocio pertenece al módulo, no al mecanismo que la invoca.**
