# 11. Deploy / hosting

## Decisión aprobada

**Vercel como plataforma de deploy para la aplicación Next.js**

### Arquitectura inicial

```text
GitHub
   ↓
Vercel
   ↓
Next.js
   ↓
Supabase
├── PostgreSQL
├── Auth
└── Storage
```

### Motivos principales

- integración directa con Next.js;
- configuración inicial simple;
- deployments automáticos desde GitHub;
- soporte para Preview Deployments;
- HTTPS y CDN administrados;
- adecuado para un MVP y proyecto de portfolio;
- permite comenzar con el plan Hobby sin costo mensual.

### Flujo de trabajo esperado

```text
branch
↓
tests
↓
Pull Request
↓
Vercel Preview
↓
revisión
↓
merge
↓
producción
```

Los Preview Deployments podrán utilizarse para revisar funcionalidades antes de integrarlas a producción.

### Entornos iniciales

Se mantendrán inicialmente:

- entorno local;
- producción en Vercel;
- previews automáticos asociados a ramas o Pull Requests.

No se agregará un entorno de staging separado en el MVP salvo que aparezca una necesidad concreta.

### Variables de entorno

Los secretos y credenciales sensibles deberán almacenarse como variables de entorno del servidor.

Las variables con prefijo `NEXT_PUBLIC_` solo se utilizarán cuando sea seguro exponer su valor al navegador.

Las credenciales administrativas de Supabase no deberán exponerse al cliente.

### Dependencia de proveedor

Se evitará introducir dependencias específicas de Vercel sin una necesidad concreta.

La aplicación deberá seguir siendo principalmente una aplicación Next.js/Node.js que pueda migrarse a otra plataforma si fuera necesario.

### Estado

**Aprobado**
