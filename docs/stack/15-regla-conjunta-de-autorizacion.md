# 15. Regla conjunta de autorización

La decisión aprobada es:

> La UI refleja permisos, el servidor los aplica y la base de datos protege el aislamiento entre centros.

Capas:

```text
Supabase Auth
→ identidad

CenterMembership
→ pertenencia y rol

Next.js Server
→ autorización de acciones

Supabase RLS
→ aislamiento de datos
```

Para usuarios con rol PROFESSIONAL también se verificará su relación ProfessionalCenter para limitar el acceso a su propia agenda y turnos.
