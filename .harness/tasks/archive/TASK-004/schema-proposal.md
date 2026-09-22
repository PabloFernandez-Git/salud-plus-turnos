# TASK-004 — Propuesta de esquema PostgreSQL inicial

**Estado:** `READY_FOR_IMPLEMENTATION`  
**Naturaleza:** diseño humanamente aprobado; no es una migration ni autoriza cambios remotos por sí
solo.

## Principios del modelo

- PostgreSQL usa nombres `snake_case`, tablas plurales y UUID como claves primarias.
- Los datos operativos se aíslan por `center_id` y se refuerzan con FKs compuestas.
- `User` (cuenta de aplicación) y `Professional` (persona que atiende) permanecen separados.
- `Person` es una identidad global; `PatientCenter` contiene los datos administrativos privados del
  centro.
- La historia se preserva mediante `is_active = false` o estados, no mediante borrado físico.
- Los turnos concretos usan `timestamptz`; disponibilidad recurrente usa día ISO + `time without
  time zone`; nacimiento usa `date`; timestamps técnicos usan `timestamptz`.
- RLS se reserva principalmente para aislamiento. Roles, transiciones y reglas operativas complejas
  permanecen server-side o en una operación PostgreSQL transaccional específica si hace falta.
- Todas las FKs usan `ON DELETE RESTRICT`/`NO ACTION`; ninguna propaga borrados destructivos.

## 1. Diagrama textual de relaciones

```text
auth.users
    1
    │ shared PK/FK aprobada
    1
users
    1
    │
    N
center_memberships ─────────────── N:1 ─────────────── centers
    │ membership PROFESSIONAL                             │
    │ vínculo obligatorio para rol PROFESSIONAL          │
    0..1                                                  │
professional_centers ───────────── N:1 ─────────────── centers
    N                                                      │
    │                                                      │
    1                                                      │
professionals                                             │
                                                           │
professional_centers                                      │
    1                                                      │
    │                                                      │
    N                                                      │
professional_center_specialties ─ N:1 ─ specialties ──────┘
    │
    ├── 1:N availabilities
    │
    └── 1:N appointments ── N:1 patient_centers ── N:1 persons
                │                       │
                │                       └── N:1 centers
                ├── N:1 specialties (validada por la asignación)
                └── N:1 centers
```

Cardinalidades e invariantes centrales:

- un `user` tiene como máximo una membership por centro;
- un `professional` tiene como máximo un `professional_center` por centro;
- una `specialty` pertenece exactamente a un centro;
- una asignación profesional-especialidad sólo puede unir filas del mismo centro;
- una `person` tiene como máximo un `patient_center` por centro;
- una disponibilidad pertenece a un único `professional_center` y, por composición, a su centro;
- un turno referencia paciente, profesional y especialidad del mismo centro;
- una especialidad del turno debe existir en la asignación de ese `professional_center`.

## 2. Diseño definitivo tabla por tabla

### Tipos de apoyo

Se utilizarán dos enums PostgreSQL aprobados:

| Tipo | Valores | Motivo |
| --- | --- | --- |
| `membership_role` | `ADMIN`, `RECEPTION`, `PROFESSIONAL` | Evita roles arbitrarios y refleja el MVP. |
| `appointment_status` | `PENDING`, `CONFIRMED`, `ATTENDED`, `CANCELLED`, `NO_SHOW` | Evita estados inválidos y mantiene tipos generados precisos. |

Costo: agregar o renombrar valores de enums requiere migrations deliberadas. La alternativa es
`text` + `CHECK`, algo más flexible pero menos expresivo en tipos generados. Se adoptan enums porque
ambos conjuntos están aprobados y son pequeños.

### `centers`

**Propósito:** tenant operativo y fuente de zona horaria para agenda y disponibilidad.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `name` | `text` | no | — | `btrim(name) <> ''`. |
| `phone` | `text` | sí | `null` | Si existe, no puede ser sólo espacios. |
| `email` | `text` | sí | `null` | Validación sintáctica completa server-side. |
| `address` | `text` | sí | `null` | Dato libre de presentación. |
| `logo_path` | `text` | sí | `null` | Ruta de Storage, no URL firmada. |
| `timezone` | `text` | no | `America/Argentina/Buenos_Aires` | `CHECK (btrim(timezone) <> '')`; IANA real server-side. |
| `is_active` | `boolean` | no | `true` | Inactivación preserva historia. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Mantenido por trigger técnico común. |

No se implementará un trigger de catálogo IANA. Zod/lógica server-side validará el identificador y
la UI utilizará un selector de zonas válidas. No se elimina un centro con historia. Cambiar
`timezone` cuando existen turnos debe validarse server-side y puede prohibirse en el MVP.

### `users`

**Propósito:** perfil de aplicación asociado a una identidad de Supabase Auth. No almacena
contraseñas, hashes ni credenciales.

Decisión aprobada: clave primaria compartida con Auth.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | ninguno | PK y FK a `auth.users(id)` con borrado restringido. |
| `first_name` | `text` | no | — | No vacío luego de `btrim`. |
| `last_name` | `text` | no | — | No vacío luego de `btrim`. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

La clave compartida hace que `auth.uid()` sea directamente el `users.id`, simplifica policies y
evita una lookup adicional. `ON DELETE RESTRICT` protege memberships e historia frente a un borrado
accidental desde Auth; la baja normal sería desactivar memberships y, si corresponde, bloquear la
identidad Auth.

Este acoplamiento es intencional y aprobado. No se agrega `auth_user_id`. `auth.users` es la fuente
de identidad/login. La migration inicial tampoco agrega `email` a `public.users`: si la futura tarea
de Auth/gestión de usuarios necesita una copia para listados, deberá definir sincronización y agregar
la columna mediante una migration posterior.

### `center_memberships`

**Propósito:** acceso de un usuario a un centro; el rol y el estado son propios de esta relación, no
globales.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `center_id` | `uuid` | no | — | FK a `centers(id)`. |
| `user_id` | `uuid` | no | — | FK a `users(id)`. |
| `role` | `membership_role` | no | — | Rol único del usuario en ese centro. |
| `professional_center_id` | `uuid` | sí | `null` | Obligatorio sólo para rol `PROFESSIONAL`. |
| `is_active` | `boolean` | no | `true` | Desactivar no afecta otros centros. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints definitivas:

- `UNIQUE (center_id, user_id)`;
- FK compuesta `(professional_center_id, center_id)` →
  `professional_centers(id, center_id)` cuando el vínculo no sea nulo;
- `CHECK` exacto: `PROFESSIONAL` exige vínculo no nulo; `ADMIN` y `RECEPTION` exigen vínculo nulo;
- un enum único en la fila representa el único rol permitido para ese User-Center.

Este diseño vincula el acceso profesional a una participación exacta en el mismo centro y permite
limitar su agenda sin inferencias por email o documento. Roles combinados quedan fuera del MVP.

### `professionals`

**Propósito:** identidad global de una persona que presta atención, independiente de `users`.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `first_name` | `text` | no | — | No vacío. |
| `last_name` | `text` | no | — | No vacío. |
| `nationality_code` | `text` | no | — | ISO 3166-1 alpha-2 uppercase; formato validado por CHECK. |
| `document_number` | `text` | no | — | Valor original; no vacío. |
| `normalized_document` | `text` | no | generado | Generado por la función PostgreSQL aprobada. |
| `email` | `text` | no | — | No vacío; formato server-side. |
| `phone` | `text` | sí | `null` | No vacío si existe. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints definitivas:

- `CHECK (nationality_code ~ '^[A-Z]{2}$')`;
- `CHECK (normalized_document <> '')`;
- `UNIQUE (nationality_code, normalized_document)`.

No se agrega un vínculo directo con `users`: la relación de acceso está en
`center_memberships.professional_center_id`, porque el rol y el alcance son por centro. Tampoco se
agrega `is_active` global; el estado operativo está en `professional_centers`. `Professional` y
`Person` continúan siendo entidades separadas y `document_type` queda fuera del MVP.

### `professional_centers`

**Propósito:** participación de un profesional en un centro, con estado y duración habitual propios.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `professional_id` | `uuid` | no | — | FK a `professionals(id)`. |
| `center_id` | `uuid` | no | — | FK a `centers(id)`. |
| `license_number` | `text` | sí | `null` | Matrícula opcional del profesional en este centro; sin UNIQUE. |
| `usual_appointment_duration_minutes` | `integer` | no | `30` | Entre 5 y 480; múltiplo de 5. |
| `is_active` | `boolean` | no | `true` | Inactivación sólo en este centro. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- `UNIQUE (center_id, professional_id)`;
- `UNIQUE (id, center_id)` como clave candidata para FKs compuestas de aislamiento;
- `CHECK (usual_appointment_duration_minutes BETWEEN 5 AND 480)`;
- `CHECK (usual_appointment_duration_minutes % 5 = 0)`.

La duración habitual es un default operativo para calcular/ofrecer slots. No obliga a que cada
`appointments.ends_at - starts_at` sea exactamente igual.

### `specialties`

**Propósito:** catálogo de especialidades propio de un centro.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `center_id` | `uuid` | no | — | FK a `centers(id)`. |
| `name` | `text` | no | — | No vacío. |
| `description` | `text` | sí | `null` | Libre; límite de longitud a definir en validación. |
| `is_active` | `boolean` | no | `true` | Inactiva conserva historia y no admite nuevas asignaciones. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- `UNIQUE (id, center_id)` para FKs compuestas;
- índice único funcional por centro sobre `lower(btrim(name))`, sin predicado por `is_active`.

La comparación ignora mayúsculas y espacios externos, pero no normaliza acentos. La ausencia de un
predicado parcial hace que una especialidad inactiva conserve el nombre reservado; debe reactivarse
para reutilizarlo.

### `professional_center_specialties`

**Propósito:** asignación many-to-many de especialidades a la participación de un profesional en un
centro. Es la única tabla auxiliar del modelo y existe por una razón de dominio e integridad concreta.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `professional_center_id` | `uuid` | no | — | Parte de PK; FK compuesta con centro. |
| `specialty_id` | `uuid` | no | — | Parte de PK; FK compuesta con centro. |
| `center_id` | `uuid` | no | — | Copia controlada para impedir cruces de centro. |
| `is_active` | `boolean` | no | `true` | Inactivar preserva turnos históricos. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- PK `(professional_center_id, specialty_id)`;
- FK `(professional_center_id, center_id)` → `professional_centers(id, center_id)`;
- FK `(specialty_id, center_id)` → `specialties(id, center_id)`;

La redundancia de `center_id` está deliberadamente protegida por FKs; no queda confiada a la
aplicación. `appointments` referencia la PK `(professional_center_id, specialty_id)`; junto con las
FKs compuestas del turno y de esta tabla, eso implica que la especialidad pertenece al mismo centro
sin crear un índice UNIQUE triple redundante.

### `persons`

**Propósito:** identidad global común de una persona. No expone memberships, turnos ni datos
administrativos de otros centros.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `first_name` | `text` | no | — | No vacío. |
| `last_name` | `text` | no | — | No vacío. |
| `birth_date` | `date` | no | — | Validar que no sea futura server-side. |
| `nationality_code` | `text` | no | — | ISO 3166-1 alpha-2 uppercase; formato validado por CHECK. |
| `document_number` | `text` | no | — | Valor original/canónico visible. |
| `normalized_document` | `text` | no | generado | Generado por la función PostgreSQL aprobada. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraint principal:

- `CHECK (nationality_code ~ '^[A-Z]{2}$')`;
- `CHECK (normalized_document <> '')`;
- `UNIQUE (nationality_code, normalized_document)`.

La asignación de datos queda así, por evidencia documental:

- global en `persons`: nombre, apellido, nacimiento, nacionalidad y documento;
- privado por centro en `patient_centers`: teléfono, email, obra social/prepaga, notas y estado.

No se propone un `CHECK (birth_date <= current_date)` porque una condición dependiente del reloj no
es una invariante estable de fila; se valida en servidor.

`nationality_code` acepta exactamente dos letras ASCII uppercase en PostgreSQL. Zod/lógica de
dominio valida además que sea un código ISO reconocido; no se crea una tabla `countries` y
ciudadanías múltiples quedan fuera del MVP.

`normalized_document` será una columna generated stored basada en una única función PostgreSQL
`IMMUTABLE` y `STRICT`. La función aplica, en este orden: trim exterior, uppercase, eliminación de
whitespace, puntos, guion ASCII y variantes tipográficas equivalentes; preserva todos los demás
caracteres, caracteres no transliterados y ceros iniciales. Nunca convierte a número ni elimina de
forma indiscriminada todo carácter no alfanumérico. El `CHECK` rechaza un resultado vacío. TypeScript
puede replicar el algoritmo sólo para UX; el valor persistido siempre lo deriva PostgreSQL.

### `patient_centers`

**Propósito:** registro administrativo y privado de una persona en un centro.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `person_id` | `uuid` | no | — | FK a `persons(id)`. |
| `center_id` | `uuid` | no | — | FK a `centers(id)`. |
| `phone` | `text` | no | — | Requerido, no vacío. |
| `email` | `text` | sí | `null` | Privado por centro; formato server-side. |
| `insurance_name` | `text` | sí | `null` | Texto administrativo simple del MVP. |
| `administrative_notes` | `text` | sí | `null` | Privado por centro; no contiene historia clínica. |
| `is_active` | `boolean` | no | `true` | Inactivación preserva historia. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- `UNIQUE (center_id, person_id)`;
- `UNIQUE (id, center_id)` para FKs compuestas desde turnos.

No se duplica nombre/documento/nacimiento aquí: hacerlo permitiría divergencias no resueltas por el
producto. Si se necesitan snapshots históricos o nombres preferidos, deben aprobarse como campos con
semántica propia, no como copias accidentales.

### `availabilities`

**Propósito:** franjas semanales recurrentes locales de un `professional_center`.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `professional_center_id` | `uuid` | no | — | FK compuesta con centro. |
| `center_id` | `uuid` | no | — | Copia controlada para aislamiento. |
| `weekday` | `smallint` | no | — | ISO 8601: lunes `1` a domingo `7`. |
| `start_time` | `time without time zone` | no | — | Hora local del centro. |
| `end_time` | `time without time zone` | no | — | Hora local del centro. |
| `is_active` | `boolean` | no | `true` | Inactivar preserva configuración anterior. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- FK `(professional_center_id, center_id)` → `professional_centers(id, center_id)`;
- `CHECK (weekday BETWEEN 1 AND 7)`;
- `CHECK (start_time < end_time)`; una franja nocturna se expresa como dos filas en días contiguos;
- exclusion constraint parcial GiST para impedir superposición entre franjas activas del mismo
  `professional_center_id` y `weekday`.

No se persisten slots. Se calculan desde franjas, duración habitual, zona IANA y turnos bloqueantes.

### `appointments`

**Propósito:** turno concreto e histórico de un único centro.

| Columna | Tipo | Null | Default | Reglas |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `center_id` | `uuid` | no | — | Tenant explícito. |
| `patient_center_id` | `uuid` | no | — | FK compuesta con centro. |
| `professional_center_id` | `uuid` | no | — | FK compuesta con centro. |
| `specialty_id` | `uuid` | no | — | Parte de FK a asignación profesional-especialidad. |
| `starts_at` | `timestamptz` | no | — | Instante absoluto. |
| `ends_at` | `timestamptz` | no | — | Instante absoluto. |
| `status` | `appointment_status` | no | `PENDING` | El estado reemplaza borrado/inactivación. |
| `administrative_note` | `text` | sí | `null` | Nota operativa; no historia clínica. |
| `created_at` | `timestamptz` | no | `now()` | Auditoría técnica. |
| `updated_at` | `timestamptz` | no | `now()` | Trigger técnico común. |

Constraints:

- `CHECK (starts_at < ends_at)`;
- FK `(patient_center_id, center_id)` → `patient_centers(id, center_id)`;
- FK `(professional_center_id, center_id)` → `professional_centers(id, center_id)`;
- FK `(professional_center_id, specialty_id)` →
  `professional_center_specialties(professional_center_id, specialty_id)`;
- exclusion constraint parcial GiST para impedir intervalos solapados cuando
  `status <> 'CANCELLED'`.

Las FKs garantizan pertenencia y habilitación histórica de la especialidad, pero no que las filas
estén activas al momento de crear/reprogramar. Eso debe validarse dentro de la operación de negocio.
El bloqueo ocurre por `professional_center_id`: dos centros pueden reservar simultáneamente al mismo
`professional_id` mediante ProfessionalCenter distintos.

## 3. Constraints e integridad referencial

### Integridad multi-centro expresable declarativamente

- Toda tabla operativa contiene `center_id` explícito o sólo se alcanza mediante una relación
  compuesta que lo fija.
- Las FKs compuestas impiden que un turno del Centro A referencie un paciente, profesional o
  asignación de especialidad del Centro B, aunque el cliente envíe UUID válidos.
- `center_memberships` impide duplicar el acceso User-Center.
- `professional_centers` impide duplicar Professional-Center.
- `patient_centers` impide duplicar Person-Center.
- `persons` y `professionals` impiden duplicar el identificador principal normalizado.
- Checks locales impiden textos requeridos vacíos, nacionalidades con formato inválido, intervalos
  invertidos, weekday inválido y duración fuera del rango/granularidad aprobados.
- FKs restrictivas e inactivación preservan historia.

### Reglas que no conviene forzar con FKs o RLS

- paciente, profesional, especialidad y asignación deben estar activos al reservar;
- el turno no puede crearse/reprogramarse al pasado;
- el turno debe entrar completo en una franja disponible interpretada en `center.timezone`;
- la duración y alineación del slot deben respetar la configuración vigente;
- transiciones permitidas de estado y permisos por rol;
- cambiar timezone con turnos existentes;
- advertencias por identidad posiblemente duplicada sin coincidencia exacta.

Estas reglas requieren valores actuales, contexto temporal o decisiones de workflow. Deben vivir en
la lógica de dominio server-side y, para reservar/reprogramar, idealmente ejecutarse mediante una
función transaccional/RPC posterior que valide y escriba atómicamente. RLS no debe convertirse en un
motor de workflow.

### Normalización documental

Una única función PostgreSQL no expuesta como API de negocio será la autoridad para Person y
Professional. Debe ser `IMMUTABLE`, `STRICT`, devolver `text` y aplicar exactamente el algoritmo
aprobado. Las columnas `normalized_document` serán generated stored, por lo que clientes y código
TypeScript no podrán persistir un normalizado alternativo. Además de whitespace y punto ASCII
`U+002E`, la implementación elimina únicamente estos guiones equivalentes: `U+002D`, `U+2010`,
`U+2011`, `U+2012`, `U+2013`, `U+2014`, `U+2015`, `U+2212`, `U+FE58`, `U+FE63` y `U+FF0D`.
Cualquier otro carácter se preserva.

### `updated_at`

Se utilizará una única función técnica de trigger y un trigger por tabla mutable. El default por sí
solo no actualiza el timestamp. La función debe fijar `NEW.updated_at = now()` y no aceptar valores
arbitrarios del cliente.

## 4. Índices necesarios y motivo

Los PK, `UNIQUE` y exclusion constraints ya crean índices; no deben duplicarse. Se agregan además:

| Tabla | Índice | Motivo |
| --- | --- | --- |
| `center_memberships` | `(user_id, center_id)` | Resolver centros de `auth.uid()` y soportar la FK aun para filas inactivas. |
| `center_memberships` | `(center_id, role) WHERE is_active` | Listar accesos activos por rol en administración. |
| `center_memberships` | `(professional_center_id) WHERE professional_center_id IS NOT NULL` | Ownership profesional y soporte de la FK opcional. |
| `professional_centers` | `(professional_id)` | Navegación desde profesional global a centros sin depender del orden del UNIQUE. |
| `professional_centers` | `(center_id) WHERE is_active` | Listar profesionales activos del centro. |
| `specialties` | UNIQUE `(center_id, lower(btrim(name)))` | Evitar duplicados case-insensitive con trim y reservar el nombre inactivo. |
| `specialties` | `(center_id) WHERE is_active` | Catálogo activo del centro. |
| `professional_center_specialties` | `(specialty_id, center_id)` | Listar profesionales por especialidad y soportar la FK también en historia inactiva. |
| `patient_centers` | `(person_id)` | Resolver participación de una persona sin exponerla directamente. |
| `patient_centers` | `(center_id) WHERE is_active` | Base para listados/búsquedas de pacientes del centro. |
| `availabilities` | `(professional_center_id, center_id)` | Soporte completo de la FK compuesta. |
| `availabilities` | `(professional_center_id, weekday) WHERE is_active` | Cálculo de agenda semanal activa. |
| `appointments` | `(center_id, starts_at)` | Agenda diaria/semanal/mensual del centro. |
| `appointments` | `(professional_center_id, starts_at)` | Agenda y próximos turnos del profesional. |
| `appointments` | `(professional_center_id, specialty_id)` | Soporte de la FK a la asignación de especialidad. |
| `appointments` | `(patient_center_id, starts_at DESC)` | Historial/proximidad del paciente en ese centro. |
| `appointments` | `(center_id, status, starts_at)` | Dashboard y filtros por estado/fecha. |

No se propone búsqueda fuzzy ni `pg_trgm` en esta migration inicial: los patrones reales de búsqueda
de pacientes deben medirse primero. El índice único de persona cubre la deduplicación principal.

## 5. Estrategia RLS aprobada para esta etapa

### Aislamiento disponible desde la primera migration

1. Mantener `center_id` no nulo en filas operativas y FKs compuestas de coherencia.
2. Habilitar RLS en todas las tablas expuestas en `public`.
3. No crear policies permisivas todavía: con RLS habilitada y sin policies, `anon` y `authenticated`
   quedan en default-deny.
4. No otorgar a `anon` acceso a datos del dominio.
5. Mantener toda credencial que bypassee RLS exclusivamente server-side; la primera migration no
   necesita crear un cliente privilegiado.

Esto entrega una barrera segura aun antes del flujo Auth, aunque la aplicación todavía no pueda
operar sobre las tablas con la publishable key.

### Policies que dependen de Auth y memberships

Una migration posterior, coordinada con el flujo Auth, deberá agregar helpers/policies para:

- mapear `auth.uid()` al `users.id` aprobado;
- comprobar membership activa del `center_id` sin recursión en la policy de
  `center_memberships`;
- permitir `SELECT` de `centers` y filas operativas sólo a memberships activas;
- permitir al usuario leer su propio perfil y a administradores autorizados listar usuarios de su
  centro sin revelar memberships ajenas;
- exponer una `person` sólo a través de un `patient_center` perteneciente a un centro accesible, sin
  revelar en qué otros centros existe;
- exponer un `professional` sólo a través de un `professional_center` accesible;
- limitar rol `PROFESSIONAL` a su `professional_center_id` para agenda/turnos;
- definir escrituras mínimas por operación, manteniendo validación completa en servidor.

Para evitar recursión de policies sobre `center_memberships`, puede usarse una función
`SECURITY DEFINER` mínima en un schema no expuesto, con `search_path` fijo, `auth.uid()` y permisos
de ejecución explícitos. Debe revisarse por Security antes de implementarse.

### Reglas que permanecen server-side

- qué rol puede ejecutar cada comando;
- transición de estados;
- registro/reutilización segura de `Person`;
- checks de filas activas;
- validación de disponibilidad, timezone y horario pasado;
- coordinación Auth + creación de `users` + membership;
- mensajes de error seguros;
- límites de texto y validaciones Zod;
- reserva/reprogramación transaccional.

La defensa en profundidad queda:

```text
UI refleja permisos
→ servidor autentica, autoriza y valida dominio
→ operación transaccional evita carreras
→ RLS aísla centros
→ constraints preservan invariantes persistentes
```

## 6. Integridad de turnos y disponibilidad

### Turnos activos solapados

Un índice `UNIQUE` sobre `(professional_center_id, starts_at)` sólo impide dos turnos con el mismo
inicio; no detecta `09:00–10:00` contra `09:30–10:30`. Una consulta previa desde Next.js tampoco es
suficiente: dos requests concurrentes pueden observar el mismo hueco e insertar ambas.

La solución aprobada es una exclusion constraint GiST sobre:

```text
professional_center_id WITH =
tstzrange(starts_at, ends_at, '[)') WITH &&
WHERE status <> 'CANCELLED'
```

`[)` permite turnos contiguos: uno puede terminar exactamente cuando empieza el siguiente. La
constraint se evalúa dentro de PostgreSQL y resuelve la carrera concurrente; además crea el índice
GiST necesario para el control.

Para comparar UUID con `=` dentro de GiST se usará la extensión estándar de PostgreSQL
`btree_gist`, disponible en el proyecto Supabase aprobado. Ventajas:

- garantía real bajo concurrencia;
- modelo declarativo y auditable;
- no exige locks manuales en la aplicación;
- evita triggers ad hoc para el caso principal.

Costos y portabilidad:

- dependencia de PostgreSQL y de `btree_gist`;
- índice GiST adicional y costo en inserciones/updates;
- errores de constraint deben mapearse a un mensaje de slot ocupado;
- cambiar qué estados bloquean requiere una migration si la condición está en la constraint;
- no es portable directamente a motores sin exclusion constraints.

Alternativas descartadas como garantía única:

- `UNIQUE` por inicio: insuficiente para solapamiento parcial;
- check previo server-side: vulnerable a carreras;
- trigger que consulta solapamientos: requiere locking correcto y es más fácil de implementar mal;
- nivel `SERIALIZABLE` general: aumenta retries/costo y sigue necesitando una operación controlada.

La clave de exclusión es `professional_center_id`, no `professional_id`. Dos ProfessionalCenter
distintos pueden tener turnos simultáneos aunque pertenezcan al mismo Professional. Bloquean
`PENDING`, `CONFIRMED`, `ATTENDED` y `NO_SHOW`; sólo `CANCELLED` libera el slot conservando la fila y
sus horarios.

### Disponibilidad recurrente solapada

Se utilizará una exclusion constraint GiST parcial análoga para filas activas:

```text
professional_center_id WITH =
weekday WITH =
rango numérico derivado de start_time/end_time WITH &&
WHERE is_active
```

PostgreSQL no incluye un range nativo de `time`; puede indexarse una expresión `numrange` basada en
segundos desde medianoche. La constraint se combina con `start_time < end_time`. Es precisa,
declarativa y permite franjas contiguas, pero también depende de `btree_gist` y de una expresión
PostgreSQL específica.

La alternativa de validar sólo en aplicación se descarta porque no protege a todos los escritores ni
las carreras. La extension ya aprobada permite aplicar la misma garantía declarativa a disponibilidad
sin agregar otra dependencia.

### Pertenencia del turno a una franja

No se propone un trigger por fila que convierta timestamps usando una zona IANA, busque franjas,
compruebe duración y estados activos. Esa lógica cruza varias tablas, depende del reloj y de reglas
de workflow. Debe implementarse en una operación transaccional de dominio que:

1. autorice usuario, centro, rol y ownership;
2. bloquee/lea la configuración relevante;
3. compruebe filas activas;
4. convierta fecha/hora local con `center.timezone` y rechace ambigüedades DST;
5. compruebe que el intervalo completo cabe en disponibilidad;
6. rechace pasado y duración inválida;
7. inserte/actualice y deje que la exclusion constraint resuelva una carrera final.

## 7. Decisiones humanas aprobadas

| ID | Decisión definitiva incorporada |
| --- | --- |
| U1 | `users.id` es PK/FK 1:1 a `auth.users(id)`, sin cascada destructiva; Auth es la fuente de identidad y no se copia email en este schema inicial. |
| U2 | Una membership y un rol por User-Center; sólo `PROFESSIONAL` exige `professional_center_id` del mismo centro; roles combinados fuera del MVP. |
| P1 | `license_number` opcional en `professional_centers`, sin UNIQUE; no existe matrícula global. |
| P2 | Professional separado de Person y único por `(nationality_code, normalized_document)`; sin `document_type`. |
| P3 | `usual_appointment_duration_minutes integer NOT NULL DEFAULT 30`, entre 5 y 480 y múltiplo de 5. |
| S1 | Nombre único por centro mediante índice funcional `lower(btrim(name))`, sin normalizar acentos y reservado aun inactivo. |
| I1 | Nacionalidad ISO 3166-1 alpha-2: `text`, uppercase, dos letras por CHECK; catálogo reconocido validado server-side. |
| I2 | PostgreSQL genera el documento normalizado con la regla aprobada, preservando original, ceros y caracteres no removidos. |
| A1 | El bloqueo de turnos es por ProfessionalCenter; no hay coordinación global multi-centro. |
| A2 | Todos los estados salvo `CANCELLED` bloquean horario. |
| A3 | Se adopta `btree_gist` y exclusion constraint GiST `[)` para concurrencia y turnos contiguos. |
| T1 | Timezone es texto no vacío con default; IANA se valida server-side y no mediante trigger PostgreSQL. |

No quedan decisiones humanas abiertas dentro del alcance del esquema inicial.

## 8. Orden concreto de creación en una migration futura

1. **Preflight fuera de la transaction:** ejecutar bootstrap, confirmar branch/diff y revalidar nombre,
   ref, región y link del proyecto DEV. No abrir conexión si algún guard falla.
2. **Iniciar migration transaccional** y crear/habilitar `btree_gist` en el schema de extensiones
   aprobado por Supabase.
3. Crear los enums `membership_role` y `appointment_status`.
4. Crear el schema privado/no expuesto para funciones internas si aún no existe.
5. Crear la función `normalize_document(text)` como `IMMUTABLE`, `STRICT`, `SECURITY INVOKER`, con
   `search_path` fijo y algoritmo exacto aprobado.
6. Crear la función técnica de trigger para `updated_at`, también con `search_path` fijo y privilegios
   mínimos.
7. Crear tablas raíz sin dependencias de dominio: `centers`, `users`, `professionals`, `persons`.
   `users.id` incorpora inmediatamente la FK restrictiva a `auth.users(id)`.
8. Crear `specialties` y su FK a `centers`.
9. Crear `professional_centers`, incluidas duración habitual, matrícula, FKs y claves candidatas
   compuestas.
10. Crear `center_memberships` después de `professional_centers`, para incorporar directamente su FK
    compuesta y el CHECK rol/vínculo sin `ALTER` circular.
11. Crear `professional_center_specialties` con PK compuesta y ambas FKs de mismo centro.
12. Crear `patient_centers` con UNIQUE Person-Center y clave candidata `(id, center_id)`.
13. Crear `availabilities` con checks locales, FK compuesta y exclusion constraint GiST parcial sobre
    franjas activas.
14. Crear `appointments` con FKs compuestas, checks y exclusion constraint GiST parcial
    `status <> 'CANCELLED'` sobre `tstzrange(..., '[)')` por `professional_center_id`.
15. Crear índices funcionales, parciales y de consulta no cubiertos por PK, UNIQUE o exclusion.
16. Crear los triggers `updated_at` en todas las tablas mutables.
17. Habilitar RLS en todas las tablas de `public`; no crear policies permisivas y revisar/revocar
    grants de `anon` incompatibles con default-deny.
18. Verificar ownership y privilegios de funciones: sin `SECURITY DEFINER` ni EXECUTE público
    innecesario en esta migration.
19. Confirmar el catálogo resultante antes del commit de la transaction y, luego de aplicar sólo en
    DEV, ejecutar la batería de verificación y regenerar tipos.

El orden evita FKs diferidas y `ALTER` circulares innecesarios. No se deshabilitan constraints durante
la creación.

## 9. Riesgos

1. **Filtración entre centros:** las entidades globales requieren policies indirectas cuidadosas;
   nunca debe exponerse la lista de centros de una persona/profesional.
2. **Recursión RLS:** policies de membership que consultan la misma tabla pueden recursar; cualquier
   helper `SECURITY DEFINER` necesita `search_path` fijo y review de seguridad.
3. **Borrado Auth:** `ON DELETE CASCADE` podría destruir perfil o romper historia; `RESTRICT` exige un
   proceso explícito de baja y retención.
4. **Creación no atómica entre Auth y public:** Supabase Auth y el alta del perfil/membership deben
   coordinar compensación o una operación administrativa robusta en una tarea posterior.
5. **Normalización:** una implementación que elimine más caracteres que el algoritmo aprobado puede
   fusionar documentos legítimamente distintos; cada variante eliminada debe estar probada.
6. **Matrícula:** al no tener unicidad, posibles duplicados son deliberadamente aceptados en el MVP y
   no deben utilizarse como identidad.
7. **Redundancia de `center_id`:** es segura sólo si todas las copias quedan protegidas por FKs
   compuestas y los updates no permiten desalinearlas.
8. **Cambios de estado:** el predicado de una exclusion constraint debe acompañar la semántica real
   de cancelación/cierre.
9. **Concurrencia:** sin exclusion constraint o locking transaccional correcto, la doble reserva sigue
   siendo posible aunque los tests secuenciales pasen.
10. **Zona horaria/DST:** `timestamptz` resuelve instantes, no valida por sí solo que una hora local
    exista o sea inequívoca.
11. **Performance RLS:** helpers y subqueries necesitan índices centrados en membership y centro;
    deben verificarse con `EXPLAIN` cuando existan policies.
12. **Enums:** son precisos pero menos flexibles que `text` + `CHECK`; cambios futuros necesitan
    migrations cuidadosas.
13. **Inactivación:** FK válida no significa entidad activa. La reserva debe validar estados en la
    misma transacción.
14. **Privacidad de notas:** `administrative_notes` no debe evolucionar accidentalmente a historia
    clínica ni aparecer en logs.

## 10. Tests y verificaciones para la futura implementación

### Implementer

- [ ] Revalidar branch, diff, bootstrap e identidad DEV antes de cualquier comando remoto.
- [ ] Existe una migration SQL versionada, revisable y reproducible; no hay cambios manuales desde
  Dashboard.
- [ ] La migration crea sólo objetos aprobados, en el orden previsto y con rollback/recuperación
  evaluados.
- [ ] Las columnas, tipos, defaults, nulabilidad, PK, FK, UNIQUE y CHECK coinciden con la propuesta
  aprobada.
- [ ] Las FKs compuestas rechazan cruces de centro para paciente, profesional y especialidad.
- [ ] Catálogo confirma `users.id` PK/FK restrictiva a `auth.users(id)`, sin `auth_user_id`, email,
  credenciales ni cascada destructiva.
- [ ] Tests de membership rechazan rol `PROFESSIONAL` sin vínculo, roles no profesionales con vínculo,
  vínculo a otro centro, segunda membership User-Center y roles fuera del enum.
- [ ] Tests de normalización para Person y Professional cubren trim, case, whitespace, puntos, guion
  ASCII, variantes tipográficas, ceros iniciales, caracteres preservados, no transliteración y
  resultado vacío; también verifican ambos UNIQUE de identidad.
- [ ] Tests de nacionalidad rechazan minúsculas, longitudes distintas de dos y caracteres no ASCII;
  Zod prueba códigos ISO conocidos y desconocidos.
- [ ] Tests de ProfessionalCenter cubren duración 5/30/480, rechazan 0/481/no múltiplos de 5 y
  confirman matrícula nula/duplicada permitida.
- [ ] El índice funcional de especialidades rechaza diferencias sólo de case/trim, permite nombres
  distintos por acento, conserva reservado el nombre inactivo y permite el mismo nombre en otro
  centro.
- [ ] La unicidad Person-Center y las FKs compuestas rechazan cruces de centro para paciente,
  profesional y especialidad.
- [ ] La inactivación conserva turnos y relaciones históricas.
- [ ] Tests de disponibilidad rechazan weekday/intervalos inválidos y franjas activas solapadas;
  aceptan franjas contiguas, inactivas y de ProfessionalCenter distintos.
- [ ] Tests de turnos cubren solapamiento parcial, total y contenido para cada estado bloqueante;
  aceptan contiguos, `CANCELLED` superpuesto y simultaneidad entre ProfessionalCenter distintos,
  incluso si comparten Professional.
- [ ] Una prueba real con dos sesiones/transactions concurrentes demuestra que dos inserts o
  reprogramaciones bloqueantes solapadas no pueden confirmar ambas.
- [ ] La reserva valida server-side actividad, disponibilidad, especialidad, pasado, timezone y rol;
  esas reglas no se trasladan innecesariamente a RLS.
- [ ] `updated_at` cambia en updates y no depende de valores enviados por el cliente.
- [ ] Bajo roles `anon` y `authenticated`, todas las tablas `public` quedan inaccesibles por
  default-deny; no hay policies permisivas en esta migration.
- [ ] La migration se aplica únicamente en el proyecto DEV aprobado después de revalidar nombre,
  ref, región y link.
- [ ] `src/lib/supabase/database.types.ts` se regenera desde DEV mediante `pnpm db:types` y no se edita
  manualmente.
- [ ] `pnpm bootstrap`, checks de schema, tests, format, lint, typecheck y build aplicables pasan.
- [ ] No se ejecutan migrations, seeds, resets ni cambios en PROD.

### Database/RLS Reviewer

- [ ] Revisar SQL, orden, atomicidad, nombres, tipos, defaults, nulabilidad y acciones `ON DELETE`.
- [ ] Confirmar que `btree_gist`, operator classes, rangos `[)` y predicados parciales implementan
  exactamente las reglas aprobadas sin índices duplicados.
- [ ] Verificar `IMMUTABLE`/`STRICT` y casos límite de `normalize_document`, además de las columnas
  generated stored y ambos UNIQUE de identidad.
- [ ] Inspeccionar todas las FKs compuestas y ejecutar pruebas negativas multi-centro.
- [ ] Repetir la prueba concurrente de doble reserva y la simultaneidad permitida entre
  ProfessionalCenter distintos.
- [ ] Confirmar RLS habilitada, ausencia de policies permisivas, ausencia de drift inesperado y tipos
  generados coherentes con el schema DEV real.

### Security Reviewer

- [ ] Confirmar que las funciones internas usan `SECURITY INVOKER`, `search_path` fijo y privilegios
  mínimos; no existe `SECURITY DEFINER` nuevo en esta migration.
- [ ] Confirmar default-deny efectivo para `anon`/`authenticated` y que no se expone Person,
  Professional, memberships ni notas administrativas.
- [ ] Confirmar que `auth.users` sólo se referencia por ID, no se copian credenciales/email y no hay
  cascada destructiva.
- [ ] Ejecutar el check de secretos/bundle y verificar que no aparecieron clientes privilegiados,
  keys, datos reales ni cambios contra PROD.
- [ ] Emitir PASS independiente junto con Database/RLS antes de considerar la implementación lista
  para cierre.

## Gate final de este documento

La propuesta fue aprobada humanamente y no contiene decisiones abiertas. TASK-004 queda
`READY_FOR_IMPLEMENTATION`. Esta actualización no crea SQL ni autoriza PROD; la implementación debe
seguir el orden, tests y reviews definidos arriba.
