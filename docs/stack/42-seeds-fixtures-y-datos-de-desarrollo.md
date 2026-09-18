# 42. Seeds, fixtures y datos de desarrollo

Esta sección explica cómo prepararemos datos para trabajar con el sistema sin depender de información real.

---

## 42.1. Tres conceptos distintos

```text
Migration
→ cambia estructura

Seed
→ carga escenario de desarrollo

Fixture / builder
→ prepara un caso de test
```

Ejemplos:

```text
Migration
→ crear tabla appointments

Seed
→ crear Centro Demo, profesionales y turnos

Fixture
→ crear dos turnos específicos para probar solapamiento
```

Cada herramienta tiene un propósito diferente.

---

## 42.2. ¿Para qué sirve un seed?

Cuando abramos una agenda vacía, muchas funcionalidades serán difíciles de evaluar.

Queremos poder ejecutar:

```text
pnpm db:seed:dev
```

y obtener un escenario conocido.

Por ejemplo:

```text
Centro Demo

Administrador
Recepción

Profesional A
→ Clínica Médica
→ 30 minutos

Profesional B
→ Cardiología
→ 45 minutos

Profesional C
→ Otorrinolaringología
```

con pacientes y turnos ficticios.

---

## 42.3. Dataset pequeño pero intencional

No queremos cien registros aleatorios sin propósito.

Preferimos datos que permitan validar comportamientos concretos:

```text
profesionales trabajando simultáneamente
duraciones distintas
turnos pendientes
confirmados
atendidos
cancelados
ausentes
paciente con varios turnos
franjas libres
franjas ocupadas
```

El seed también funciona como escenario manual de aceptación.

---

## 42.4. ¿Por qué TypeScript?

Gran parte de los datos vive en PostgreSQL, pero los usuarios también existen en Supabase Auth.

Necesitamos coordinar:

```text
Auth User
+
User
+
CenterMembership
+
Professional
```

Un script TypeScript puede utilizar Supabase Admin de forma controlada y luego crear los datos relacionados.

Por eso:

```text
migrations
→ SQL

seed DEV
→ TypeScript
```

---

## 42.5. Ubicación y comando

Previsto:

```text
scripts/
└── seed-dev.ts
```

Comando:

```text
pnpm db:seed:dev
```

El comando debe dejar claro que su destino es DEV.

Evitar nombres ambiguos como:

```text
pnpm seed
```

si no dejan claro dónde operan.

---

## 42.6. Idempotencia

Idealmente:

```text
primera ejecución
→ crea dataset

segunda ejecución
→ reconoce datos existentes
→ no crea duplicados evidentes
```

No significa que el seed deba reconstruir exactamente cualquier estado posible.

Significa que repetirlo durante el desarrollo no debería convertir la base en basura.

---

## 42.7. Producción está prohibida

Antes de crear o modificar datos, el script debe comprobar que apunta al proyecto DEV esperado.

Flujo:

```text
pnpm db:seed:dev
↓
verificar project ref / entorno
↓
¿DEV correcto?
   ↓ sí
continuar

¿no?
↓
STOP
```

Los agentes tampoco pueden saltarse esa protección.

---

## 42.8. Datos ficticios

Nunca utilizar:

```text
DNI real
email personal real
teléfono real
paciente real
información clínica real
```

Ejemplo válido:

```text
Ana Demo
Documento: 10000001
Email: ana.demo@example.test
```

El objetivo es que nadie pueda confundir los datos seed con información productiva.

---

## 42.9. Contraseñas demo

Las contraseñas no deben formar parte de documentación pública ni código versionado como secretos reutilizables.

Podrán provenir de:

```text
.env.local
```

Ejemplo:

```text
DEV_ADMIN_PASSWORD
DEV_RECEPTION_PASSWORD
DEV_PROFESSIONAL_PASSWORD
```

El archivo no se versiona.

El script tampoco debe registrar los valores en logs.

---

## 42.10. Seed no es fixture

Un test unitario como:

```text
calculateAvailableSlots()
```

no debe necesitar una base previamente sembrada.

Puede crear su propio input:

```ts
const schedule = {
  weekday: "monday",
  startTime: "09:00",
  endTime: "12:00",
};
```

Esto mantiene los tests:

```text
rápidos
aislados
predecibles
```

---

## 42.11. E2E

Los E2E sí necesitarán datos integrados.

Pero no vamos a hacerlos depender permanentemente de un seed manual compartido.

Cuando tengamos:

```text
entorno E2E reproducible
+
datos aislados
```

definiremos su estrategia propia.

---

## 42.12. No reset destructivo en v1

Trabajaremos inicialmente contra Supabase DEV remoto.

Por eso no queremos un comando demasiado fácil de ejecutar que borre toda la base.

No agregaremos de entrada:

```text
db:reset:dev
```

Si aparece la necesidad, diseñaremos:

```text
confirmaciones
verificación de entorno
protecciones
```

antes de incorporarlo.

---

## 42.13. Relación con la agenda

El dataset debería permitir abrir:

```text
/agenda
```

y evaluar rápidamente:

```text
día
semana
mes
simultaneidad
filtros
duraciones
estados
disponibilidad
```

Esto será especialmente útil al pasar del spike de React Big Calendar a la agenda integrada con Supabase.

---

## 42.14. Relación con el harness

El seed forma parte del entorno de desarrollo, no del dominio productivo.

Los agentes pueden:

```text
crear o ajustar seed DEV
ejecutarlo en DEV
usar sus datos para revisar UI
```

No pueden:

```text
sembrar PROD
borrar PROD
usar datos reales
exponer contraseñas
hacer reset destructivo sin decisión explícita
```

---

## 42.15. Resumen mental

```text
Migration
→ estructura

Seed DEV
→ escenario manual reproducible

Fixture
→ escenario de test

PROD
→ nunca recibe seeds automáticos
```

La idea fundamental es:

> **Los datos de desarrollo deben ayudarnos a reproducir escenarios; nunca deben parecerse a una herramienta para manipular datos reales.**
