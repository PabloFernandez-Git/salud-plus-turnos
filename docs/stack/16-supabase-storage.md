# 16. Supabase Storage

## ¿Qué es?

Supabase Storage es el servicio de almacenamiento de archivos de Supabase.

Mientras PostgreSQL guarda datos estructurados, Storage guarda archivos.

Ejemplo:

```text
PostgreSQL
→ nombre del centro
→ teléfono
→ dirección
→ ruta del logo

Supabase Storage
→ archivo real del logo
```

## ¿Por qué lo elegimos?

Ya utilizamos Supabase para:

- PostgreSQL;
- autenticación.

Agregar Storage mantiene la infraestructura concentrada en una misma plataforma y evita incorporar otro proveedor sin necesidad.

Para el MVP actual, el caso principal es muy simple:

```text
Administrador
→ selecciona logo
→ Next.js valida
→ Supabase Storage guarda
→ PostgreSQL guarda la referencia
```

## Regla del MVP

Inicialmente:

- solo ADMIN puede modificar el logo;
- se restringen tipos y tamaño;
- el logo puede reemplazarse;
- no se guardan versiones innecesarias;
- el bucket puede ser público porque el logo no es sensible.

## ¿Puede servir más adelante?

Sí.

El mismo servicio puede reutilizarse en futuros MVP para:

- avatares;
- recursos visuales;
- documentos administrativos;
- adjuntos no sensibles.

Esto permite sumar funcionalidades sin cambiar necesariamente de proveedor.

## Importante: archivos clínicos

No damos por aprobado el almacenamiento de documentos médicos o historia clínica.

Ese escenario exige una decisión específica sobre:

- buckets privados;
- permisos;
- acceso temporal o firmado;
- auditoría;
- privacidad;
- retención;
- eliminación segura.

Por lo tanto:

> Supabase Storage está aprobado como infraestructura de archivos, pero los casos sensibles deben evaluarse de forma independiente.
