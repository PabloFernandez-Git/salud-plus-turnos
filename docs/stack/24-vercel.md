# 24. Vercel

## ¿Qué es?

Vercel es la plataforma elegida para desplegar y publicar nuestra aplicación Next.js.

Supabase continuará proporcionando los servicios de datos y backend, mientras que Vercel ejecutará y publicará la aplicación.

```text
Usuario
↓
Vercel / Next.js
↓
Supabase
```

## ¿Por qué lo elegimos?

Vercel tiene una integración muy directa con Next.js y simplifica:

- build;
- deploy;
- HTTPS;
- CDN;
- variables de entorno;
- deployments automáticos;
- previews por rama o Pull Request.

## Integración con GitHub

El flujo esperado será:

```text
Código
↓
GitHub
↓
Vercel
↓
Deploy automático
```

Cuando exista un Pull Request, podremos utilizar un Preview Deployment para probar esa versión antes de hacer merge.

## Costos iniciales

Para el proyecto de portfolio y el MVP se utilizará inicialmente el plan gratuito de Vercel.

La combinación inicial será:

```text
Vercel Hobby
+
Supabase Free
```

Esto permite comenzar sin un costo mensual de infraestructura.

Si el producto se transforma posteriormente en un servicio comercial o supera los límites gratuitos, se revisarán los planes disponibles.

## Variables de entorno y secretos

No todas las variables pueden exponerse al navegador.

La regla será:

```text
NEXT_PUBLIC_*
→ únicamente información segura para el cliente

Secrets
→ solo servidor
```

Las credenciales administrativas de Supabase nunca deberán formar parte del bundle del navegador.

## Portabilidad

Vercel será nuestra infraestructura inicial, pero evitaremos diseñar el dominio alrededor de funcionalidades exclusivas de la plataforma.

El objetivo es conservar la posibilidad de mover la aplicación a otro proveedor en el futuro si fuera necesario.
