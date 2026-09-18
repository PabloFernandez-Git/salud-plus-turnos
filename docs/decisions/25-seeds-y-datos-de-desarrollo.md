# 25. Seeds y datos de desarrollo

## Decisión aprobada

El proyecto distinguirá explícitamente entre:

```text
Migration
→ modifica la estructura de la base

Seed
→ carga datos conocidos para desarrollo

Fixture / builder
→ prepara datos para un test concreto
```

No se utilizará una misma herramienta para resolver las tres responsabilidades.

## Seed principal de desarrollo

El entorno DEV tendrá un seed explícito:

```text
scripts/seed-dev.ts
```

ejecutable mediante:

```text
pnpm db:seed:dev
```

Su objetivo será preparar un conjunto pequeño, conocido y útil de datos ficticios para poder desarrollar y revisar el producto sin cargar información manualmente cada vez.

## Datos previstos

El seed deberá poder preparar, como mínimo:

- un Centro Demo;
- usuarios con roles de Administrador, Recepción y Profesional;
- profesionales;
- especialidades;
- relaciones ProfessionalCenter;
- disponibilidad habitual;
- pacientes ficticios;
- turnos con distintos estados.

El dataset deberá incluir escenarios útiles para:

- agenda día;
- agenda semana;
- agenda mes;
- profesionales simultáneos;
- duraciones diferentes;
- turnos pendientes;
- confirmados;
- atendidos;
- cancelados;
- ausentes;
- pacientes con múltiples turnos;
- horarios libres y ocupados.

## Datos ficticios

Los seeds no utilizarán:

- pacientes reales;
- documentos reales;
- emails personales;
- teléfonos reales;
- datos clínicos reales.

Se utilizarán valores deliberadamente artificiales.

Para emails se preferirán dominios reservados para pruebas, por ejemplo:

```text
@example.test
```

## Auth y base de aplicación

Como los usuarios existen tanto en Supabase Auth como en nuestro modelo de aplicación:

```text
Supabase Auth User
↓
User
↓
CenterMembership
```

el seed principal será TypeScript y podrá utilizar operaciones administrativas de Supabase desde un contexto seguro.

Esto permite coordinar:

```text
crear usuario de Auth
↓
crear User
↓
crear CenterMembership
↓
crear Professional si corresponde
↓
crear relaciones y datos asociados
```

Las migrations seguirán siendo SQL.

Regla:

```text
schema
→ SQL migrations

datos demo
→ seed TypeScript
```

## Idempotencia

El seed deberá poder ejecutarse más de una vez sin generar duplicados evidentes ni corromper el entorno.

Cuando sea razonable:

```text
si Centro Demo existe
→ reutilizar o actualizar

si usuario demo existe
→ reutilizar

si dato seeded existe
→ no duplicar indiscriminadamente
```

No se pretende construir un motor complejo de sincronización.

La meta es que repetir:

```text
pnpm db:seed:dev
```

sea seguro para el flujo normal de desarrollo.

## Reset destructivo

No se incluirá inicialmente un comando general de reset destructivo contra el proyecto remoto DEV.

No se aprobará en la v1 algo como:

```text
pnpm db:reset:dev
```

que pueda borrar datos remotos sin protecciones específicas.

Si en el futuro necesitamos un reset reproducible, se diseñará como una decisión separada con validaciones explícitas.

## Protección de PROD

El seed solo podrá ejecutarse contra Supabase DEV.

El script deberá verificar explícitamente que el proyecto de destino sea el esperado antes de modificar datos.

No se confiará únicamente en recordar qué archivo `.env` está cargado.

Los agentes podrán ejecutar el seed de DEV cuando la tarea lo necesite.

**Los agentes nunca podrán sembrar PROD automáticamente.**

## Credenciales demo

Las contraseñas o secretos necesarios para usuarios de desarrollo no se versionarán como credenciales reutilizables reales.

Podrán utilizarse variables locales como:

```text
DEV_ADMIN_PASSWORD
DEV_RECEPTION_PASSWORD
DEV_PROFESSIONAL_PASSWORD
```

almacenadas en:

```text
.env.local
```

que no se versiona en Git.

El script nunca deberá imprimir secretos en logs.

## Seeds y testing

Los tests unitarios no dependerán del seed DEV.

Utilizarán datos construidos específicamente para el test:

```text
fixtures
builders
factories simples
objetos inline
```

según el caso.

Los E2E tendrán una estrategia de datos propia cuando exista un entorno reproducible y aislado.

La separación será:

```text
Seed DEV
→ desarrollo manual y escenarios de demo

Fixtures / builders
→ tests unitarios y de componentes

E2E setup
→ datos del entorno E2E
```

## Relación con el spike de agenda

El spike inicial de React Big Calendar seguirá utilizando mock data y no dependerá de Supabase.

Cuando la agenda se conecte a datos reales, el seed DEV deberá facilitar escenarios como:

- varios profesionales en el mismo horario;
- distintas duraciones;
- estados variados;
- vistas día, semana y mes;
- espacios libres y ocupados.

## Relación con el Agent Harness

Cuando una tarea necesite datos de desarrollo:

```text
Orchestrator
↓
detecta necesidad de seed o dataset

Implementer
↓
ajusta seed si realmente hace falta
↓
ejecuta solo contra DEV
↓
evita duplicados y secretos

Reviewer
↓
verifica datos ficticios
↓
verifica protección de PROD
↓
verifica que tests no dependan del seed manual
```

Modificar el seed debe ser una decisión consciente de la tarea, no un efecto secundario innecesario.

## Regla final

> Un seed es una herramienta para construir escenarios de desarrollo reproducibles, no una forma de modificar datos reales.

## Estado

**Aprobado**
